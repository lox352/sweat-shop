import { Stitch, isFabric, isStep } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import { adjacentStitchDistance } from "../constants";
import type { SweaterStitches } from "../knitting/engine";
import { Vec, add, cross, length, lerp, scale, sub } from "./vector";

/**
 * The sweater laid out in space before anything settles it: blocked, with
 * the arms held out.
 *
 * Worn, with y up, the front facing +z and so the wearer's right hand at -x.
 * Every round is a ring round its piece's own axis: the body's runs straight
 * down from the underarms, each sleeve's out from an upright armhole and
 * down to the arm's angle, and the yoke's from the neck down to where the
 * body and the sleeves begin.
 *
 * The rings go round the way the knitting does. Knitted top down and turned
 * the right way up, a round runs left to right as you look at it from
 * outside - which, for a ring round an axis d with its first stitch in the
 * direction e1, is the angle falling from there in the frame (e1, d x e1).
 * The same rule places the body's rounds, starting at the middle of the back,
 * and each sleeve's, starting at the middle of its underarm, and it is why
 * the first sleeve the dividing round reaches is the wearer's right. A test
 * holds the pose to it.
 *
 * The point of the pose is to start the physics with every rope at or under
 * its length, so that it has nothing to tear apart and only gravity to
 * answer to. Three things in a sweater make that more than drawing circles:
 *
 * - A rib is narrower than the stocking stitch above it, and a sleeve
 *   narrows all the way to its cuff. A tube's rings come in no faster than a
 *   round's height allows, starting early where the next rib is much
 *   narrower; see `taper`.
 * - Decreases and increases take stitches out of a round and put them in,
 *   so the stitches of one round are not evenly over those of the last.
 *   Each round's stitches start over what they were worked into and are then
 *   evened out only part of the way; see `keep`.
 * - The yoke changes shape. Its neck is a circle, and its last round is the
 *   line where the body's front and back and the sleeves' tops begin. The
 *   neck rib, which keeps the cast-on count all the way down, stands as a
 *   collar; below it each stitch is as far of the way from the collar's foot
 *   to that line as the rounds and rows between have carried it, over the
 *   same fraction of each. Short rows across the back carry the back further
 *   than the front, and the neck tilts up at the back to take them. The neck
 *   is set high enough that no stitch of the line is further from the collar
 *   than the yoke below the collar is long there.
 */

export interface PoseOptions {
  /** How far the arms are held out from hanging straight down, in degrees. */
  armAngle?: number;
}

/**
 * A piece's axis: where it begins, and which way it runs. A sleeve's is its
 * arm's, from the end of the bend down from its armhole.
 */
export interface Axis {
  origin: Vec;
  direction: Vec;
}

export interface Pose {
  /** Three numbers a stitch, by id. */
  positions: Float32Array;
  /** Each piece's axis, by piece. */
  axes: Record<string, Axis>;
}

const down: Vec = [0, -1, 0];

/**
 * How quickly a tube's rings may narrow or widen, as a share of a round's
 * height. Less than one, so a round that comes in still has some height to
 * stand on; at 0.6 it stands on four fifths of a round.
 */
const taper = 0.6;

/**
 * How much of the unevenness a round's stitches inherit from what they were
 * worked into it keeps. None, and every stitch either side of a pair of
 * decreases stands a whole stitch along from the one it was worked into;
 * all of it, and a decrease leaves a gap of a stitch and a half beside it,
 * which the rounds after it only widen. Half each way keeps both within a
 * rope's reach, and the unevenness dies away over the rounds that follow, as
 * the lean of the stitches beside a decrease does.
 */
const keep = 0.5;

/** How many times the unevenness is smoothed over its neighbours first. */
const smoothing = 3;

/**
 * How tightly a sleeve bends from its armhole down to the arm's angle: the
 * radius of the curve its axis follows, in the sleeve's own radii. At one
 * the underarm would be a pivot that every round of the bend shares.
 */
const bendRadius = 1.5;

/** Where a stitch a fraction `at` of the way round a ring sits: see the note above. */
const onRing = (centre: Vec, radius: number, e1: Vec, e2: Vec, at: number): Vec => {
  const angle = -2 * Math.PI * at;
  return add(centre, add(scale(e1, radius * Math.cos(angle)), scale(e2, radius * Math.sin(angle))));
};

/** A fraction of a turn, taken whole turns round until it is within half a turn of `to`. */
const near = (fraction: number, to: number): number =>
  fraction - Math.round(fraction - to);

export const pose = (built: SweaterStitches, options: PoseOptions = {}): Pose => {
  const { stitches, rounds, roundPieces, roundHeight } = built;
  const arm = ((options.armAngle ?? 45) * Math.PI) / 180;
  const positions = new Float32Array(stitches.length * 3);
  const set = (id: number, at: Vec) => positions.set(at, id * 3);
  const get = (id: number): Vec => [positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]];
  const widthOf = (stitch: Stitch) => stitch.width ?? adjacentStitchDistance;
  const riseOf = (round: number[]) => stitches[round[0]].rise ?? roundHeight;
  const radiusOf = (round: number[]) =>
    (round.length * widthOf(stitches[round[0]])) / (2 * Math.PI);

  const order = [...new Set(roundPieces)];
  const roundsOf = (piece: string) => rounds.filter((_, index) => roundPieces[index] === piece);
  const yokeId = order[0];
  const pickedUp = (piece: string) => roundsOf(piece)[0].some((id) => stitches[id].type === "pickUp");
  const sleeves = order.filter((piece) => piece !== yokeId && pickedUp(piece));
  const bodyId = order.find((piece) => piece !== yokeId && !sleeves.includes(piece));
  if (!bodyId) throw new Error("a sweater needs a body below its yoke");
  const axes: Record<string, Axis> = {};

  /*
   * Where round its piece's axis each stitch sits, as a fraction of a turn
   * from where its piece's rounds begin.
   */
  const turn = new Float64Array(stitches.length);
  const evenly = (round: number[]) => round.forEach((id, index) => (turn[id] = index / round.length));
  /** What a stitch was worked into: its links but the stitch before it. */
  const workedInto = (stitch: Stitch) =>
    (stitch.links.length > consumption[stitch.type] ? stitch.links.slice(0, -1) : stitch.links)
      .filter((id) => isFabric(stitches[id]));

  /**
   * A round whose stitches were worked into the round before it: each starts
   * over the middle of what it was worked into, and a make-one, worked into
   * nothing, between its neighbours. Then whatever that leaves uneven is
   * smoothed, and only `keep` of it kept.
   */
  const follow = (round: number[]) => {
    const n = round.length;
    const over = round.map((id): number | undefined => {
      const worked = workedInto(stitches[id]);
      if (worked.length === 0) return undefined;
      const first = turn[worked[0]];
      return worked.reduce((sum, below) => sum + near(turn[below], first), 0) / worked.length;
    });
    const known = over.flatMap((value, index) => (value === undefined ? [] : [index]));
    if (known.length === 0) return evenly(round);
    // One rising run of fractions, a turn round the round.
    const run = new Array<number>(n);
    run[known[0]] = over[known[0]]!;
    for (let k = 1; k < known.length; k++) {
      const [before, index] = [known[k - 1], known[k]];
      run[index] = near(over[index]!, run[before] + (index - before) / n);
    }
    for (let k = 0; k < known.length; k++) {
      const a = known[k];
      const wraps = k + 1 === known.length;
      const b = wraps ? known[0] + n : known[k + 1];
      const [from, to] = [run[a], wraps ? run[known[0]] + 1 : run[b]];
      for (let index = a + 1; index < b; index++) {
        const value = from + ((to - from) * (index - a)) / (b - a);
        if (index < n) run[index] = value;
        else run[index - n] = value - 1;
      }
    }
    // How far each is from an even spacing, less what they all share.
    let uneven = run.map((value, index) => value - index / n);
    const phase = uneven.reduce((sum, value) => sum + value, 0) / n;
    uneven = uneven.map((value) => value - phase);
    for (let pass = 0; pass < smoothing; pass++) {
      uneven = uneven.map(
        (value, index) => (uneven[(index + n - 1) % n] + 2 * value + uneven[(index + 1) % n]) / 4,
      );
    }
    round.forEach((id, index) => (turn[id] = index / n + phase + keep * uneven[index]));
  };

  /*
   * A tube - the body, or a sleeve - knitted round and round along an axis.
   * Each round is a ring as wide as its stitches make it, unless it is too
   * close to a much narrower round below it or above it to be, and each ring
   * stands as far along the axis from the last as a round is tall, less
   * what the rings' coming in takes of that. A round is a turn of a helix,
   * not a ring, so each stitch is a little further along than the one before
   * and the yarn runs on from the last stitch of a round to the first of the
   * next without a jog.
   */
  const radiiOf = (tubeRounds: number[][]) => {
    const radii = tubeRounds.map(radiusOf);
    const rises = tubeRounds.map(riseOf);
    for (let k = radii.length - 2; k >= 0; k--) {
      radii[k] = Math.min(radii[k], radii[k + 1] + taper * rises[k + 1]);
    }
    for (let k = 1; k < radii.length; k++) {
      radii[k] = Math.min(radii[k], radii[k - 1] + taper * rises[k]);
    }
    return radii;
  };
  /** Where a tube's axis is a distance along it, and which way its rings face there. */
  interface Frame {
    centre: Vec;
    e1: Vec;
    e2: Vec;
  }
  /**
   * `frameAt` follows the axis; `spread` says how much further than its
   * axis the far side of a ring of a given radius moves there, which is one
   * where the axis runs straight and more where it bends.
   */
  const tube = (
    tubeRounds: number[][],
    radii: number[],
    frameAt: (along: number) => Frame,
    spread: (along: number, radius: number) => number = () => 1,
  ) => {
    let along = 0;
    tubeRounds.forEach((round, k) => {
      if (k === 0) evenly(round);
      else follow(round);
      /*
       * Each stitch is as far along from what it was worked into as part
       * of the step into its round and part of the step out of it, more of
       * the second the further round it is; so a step leaves room for the
       * rings' coming in on both sides of it.
       */
      const next = tubeRounds[k + 1];
      const narrowing = Math.max(
        Math.abs(radii[k] - radii[Math.max(k - 1, 0)]),
        next ? Math.abs(radii[k + 1] - radii[k]) : 0,
      );
      const step = next
        ? Math.sqrt(Math.min(riseOf(round), riseOf(next)) ** 2 - narrowing ** 2) /
          spread(along, Math.max(radii[k], radii[k + 1]))
        : riseOf(round);
      round.forEach((id, index) => {
        const { centre, e1, e2 } = frameAt(along + (step * index) / round.length);
        set(id, onRing(centre, radii[k], e1, e2, turn[id]));
      });
      along += step;
    });
  };

  /* The body, straight down from the dividing round, which is at y = 0. */
  {
    const bodyRounds = roundsOf(bodyId);
    const e1: Vec = [0, 0, -1];
    const e2 = cross(down, e1);
    tube(bodyRounds, radiiOf(bodyRounds), (along) => ({ centre: [0, -along, 0], e1, e2 }));
    axes[bodyId] = { origin: [0, 0, 0], direction: down };
  }

  /*
   * Each sleeve, from its underarm - the edge the body cast on there, which
   * its first round picks up from. That first round is the armhole: it
   * stands upright at the side of the body with the underarm at its foot,
   * as an armhole does whatever the arm is doing. The sleeve runs straight
   * out from it and bends down to the arm's angle, as a sleeve does over the
   * shoulder, then runs straight on to the cuff. The rounds of the bend are
   * no further apart along the top of the arm than a round is tall, so they
   * bunch up underneath it, as they do under an arm.
   *
   * Tilting the armhole with the arm instead would stand the top of the
   * sleeve half an arm's width out from the side of the body, which no yoke
   * of a sensible depth can reach over.
   */
  /** Where each sleeve's first round faces: straight out, which the yoke's last round is a round back from. */
  const outward: Record<string, Vec> = {};
  for (const piece of sleeves) {
    const sleeveRounds = roundsOf(piece);
    const edge = sleeveRounds[0]
      .map((id) => stitches[id].from)
      .filter((id): id is number => id !== undefined);
    const middle = scale(
      edge.reduce<Vec>((sum, id) => add(sum, get(id)), [0, 0, 0]),
      1 / edge.length,
    );
    const side = Math.sign(middle[0]) || 1;
    const radii = radiiOf(sleeveRounds);
    /*
     * The underarm is straight and the armhole round, so the ends of the
     * underarm stand below the armhole by as much as it curves up over half
     * the underarm's length. Dropping the armhole by half that splits the
     * difference between them and its middle.
     */
    const half = (edge.length * widthOf(stitches[edge[0]])) / 2;
    const underarm = sub(middle, [0, (half * half) / (4 * radii[0]), 0]);
    // How far it bends down from straight out, and round how tight a curve.
    const bend = Math.PI / 2 - Math.min(Math.max(arm, 0), Math.PI / 2);
    const curve = bendRadius * radii[0];
    const bent = curve * bend;
    const up = (angle: number): Vec => [side * Math.sin(angle), Math.cos(angle), 0];
    const along = (angle: number): Vec => [side * Math.cos(angle), -Math.sin(angle), 0];
    const pivot = add(underarm, [0, radii[0] - curve, 0]);
    const e2: Vec = [0, 0, -side];
    const frameAt = (distance: number): Frame => {
      const angle = curve > 0 ? Math.min(distance, bent) / curve : 0;
      return {
        centre: add(
          add(pivot, scale(up(angle), curve)),
          scale(along(angle), Math.max(distance - bent, 0)),
        ),
        e1: scale(up(angle), -1),
        e2,
      };
    };
    tube(sleeveRounds, radii, frameAt, (distance, radius) =>
      distance < bent ? (curve + radius) / curve : 1,
    );
    outward[piece] = along(0);
    axes[piece] = { origin: frameAt(bent).centre, direction: along(bend) };
  }

  /*
   * The yoke. Its last round sits a round above whatever works into it: the
   * body's dividing round, or a sleeve's first round, a round back up its
   * arm.
   */
  const yokeRounds = roundsOf(yokeId);
  const yokeKinds = built.roundKinds.filter((_, index) => roundPieces[index] === yokeId);
  const isRow = (k: number) => (yokeKinds[k] ?? "round") !== "round";
  /*
   * A short row is part of the way round and unshaped, so each of its
   * stitches simply stands over the stitch it was worked into.
   */
  const overParents = (round: number[]) => {
    for (const id of round) turn[id] = turn[workedInto(stitches[id])[0] ?? id - 1];
  };
  yokeRounds.forEach((round, k) => (k === 0 ? evenly(round) : isRow(k) ? overParents(round) : follow(round)));
  const last = yokeRounds[yokeRounds.length - 1];
  const consumer = new Map<number, number>();
  for (const piece of [bodyId, ...sleeves]) {
    for (const id of roundsOf(piece)[0]) {
      for (const worked of workedInto(stitches[id])) consumer.set(worked, id);
    }
  }
  const pieceOf = new Map<number, string>();
  rounds.forEach((round, index) => round.forEach((id) => pieceOf.set(id, roundPieces[index])));
  const edgeLine: Vec[] = last.map((id) => {
    const next = consumer.get(id);
    if (next === undefined) throw new Error(`nothing works the yoke's stitch ${id}`);
    const rise = stitches[next].rise ?? roundHeight;
    const piece = pieceOf.get(next)!;
    return piece === bodyId
      ? add(get(next), [0, rise, 0])
      : sub(get(next), scale(outward[piece], rise));
  });
  // The fractions the last round's stitches are at, as one rising run: the knots of the line.
  const knots: number[] = [turn[last[0]]];
  for (let index = 1; index < last.length; index++) {
    knots.push(near(turn[last[index]], knots[index - 1] + 1 / last.length));
  }
  /** Where between the knots a fraction falls: the knot before it, and how far on to the next. */
  const between = (fraction: number): [number, number] => {
    const at = knots[0] + (((fraction - knots[0]) % 1) + 1) % 1;
    let [low, high] = [0, knots.length];
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (knots[middle] <= at) low = middle;
      else high = middle;
    }
    const until = low + 1 < knots.length ? knots[low + 1] : knots[0] + 1;
    return [low, until > knots[low] ? (at - knots[low]) / (until - knots[low]) : 0];
  };
  const edgeAt = (fraction: number): Vec => {
    const [low, t] = between(fraction);
    return lerp(edgeLine[low], edgeLine[(low + 1) % edgeLine.length], t);
  };

  const neckRadius = radiusOf(yokeRounds[0]);
  const e1: Vec = [0, 0, -1];
  const e2 = cross(down, e1);
  const neckAt = (fraction: number, y: number) => onRing([0, y, 0], neckRadius, e1, e2, fraction);

  /*
   * How far down the yoke each stitch is from the neck: a round further than
   * the stitch it was worked into. Counted stitch by stitch rather than round
   * by round, because short rows across the back of the neck put rows there
   * that the front does not have - which is what they are for.
   */
  const slant = new Map<number, number>();
  yokeRounds.forEach((round, k) => {
    for (const id of round) {
      const below = workedInto(stitches[id])[0];
      const beside = id - 1;
      slant.set(
        id,
        k === 0 ? 0 : below !== undefined ? slant.get(below)! + riseOf(round) : slant.get(beside) ?? 0,
      );
    }
  });
  const depths = last.map((id) => slant.get(id)!);
  // The slant of the last round at a fraction of the way round.
  const depthAt = (fraction: number) => {
    const [low, t] = between(fraction);
    return depths[low] + (depths[(low + 1) % depths.length] - depths[low]) * t;
  };
  // The collar: the rounds that keep the cast-on's count, down to the first that does not.
  let collar = 0;
  while (
    collar + 2 < yokeRounds.length &&
    !isRow(collar + 1) &&
    yokeRounds[collar + 1].length === yokeRounds[0].length
  ) {
    collar++;
  }
  const foot = slant.get(yokeRounds[collar][0])!;
  /*
   * The neck tilts: higher at the back by however much more the back's
   * rounds and rows rise than the front's - the back of the neck raised, as
   * short rows raise it - and smoothly between, a cosine round the neck.
   */
  const backward = depthAt(0) - depthAt(0.5);
  const lift = (fraction: number) =>
    backward > 0 ? (backward * (1 + Math.cos(2 * Math.PI * fraction))) / 2 : 0;
  /*
   * The neck's height: as high as it can be with no point of the last round
   * further from its own point at the collar's foot than the yoke below the
   * collar is long there. Never below the tops of the sleeves, though: an arm
   * held out stands higher than the underarm, and a yoke too shallow to
   * reach over it is stretched rather than turned inside out.
   */
  let neckY = Infinity;
  let highest = -Infinity;
  edgeLine.forEach((point, index) => {
    const from = neckAt(knots[index], 0);
    const across = Math.hypot(point[0] - from[0], point[2] - from[2]);
    const length = depths[index] - foot;
    neckY = Math.min(
      neckY,
      point[1] + foot - lift(knots[index]) + Math.sqrt(Math.max(length * length - across * across, 0)),
    );
    highest = Math.max(highest, point[1]);
  });
  neckY = Math.max(neckY, highest + roundHeight);

  yokeRounds.forEach((round, k) => {
    for (const id of round) {
      const fraction = turn[id];
      const depth = slant.get(id)!;
      const top = neckY + lift(fraction);
      if (k <= collar) {
        set(id, neckAt(fraction, top - depth));
      } else {
        const length = depthAt(fraction) - foot;
        const t = length > 0 ? Math.min((depth - foot) / length, 1) : 1;
        set(id, lerp(neckAt(fraction, top - foot), edgeAt(fraction), t));
      }
    }
  });

  axes[yokeId] = { origin: [0, neckY, 0], direction: down };

  /*
   * The phantom stitch 0 with the first stitch cast on, and every step where
   * the stitch before it is: they are no fabric and never drawn, but each
   * still has a place, one to a stitch.
   */
  for (const stitch of stitches) {
    if (stitch.id === 0) set(0, get(yokeRounds[0][0]));
    else if (isStep(stitch)) set(stitch.id, get(stitch.id - 1));
  }
  return { positions, axes };
};

/** The positions as points, for anything that wants them one at a time. */
export const pointAt = (positions: Float32Array, id: number) => ({
  x: positions[id * 3],
  y: positions[id * 3 + 1],
  z: positions[id * 3 + 2],
});

/** How far apart two stitches are in a set of positions. */
export const distance = (positions: Float32Array, a: number, b: number): number =>
  length(sub(
    [positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]],
    [positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]],
  ));
