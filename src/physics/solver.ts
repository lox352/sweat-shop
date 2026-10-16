import { Stitch, isFabric, isStep } from "../types/Stitch";
import { consumption } from "../types/StitchType";
import { adjacentStitchDistance } from "../constants";
import type { Knitting } from "./knitting";
import type { Pose } from "./pose";
import { ropesOf } from "./ropes";
import { Tuning, defaultTuning } from "./tuning";

/**
 * Settles a sweater: where it comes to rest from its pose, held at the neck.
 *
 * The hat site's physics, without the physics engine. A hat was ten thousand
 * rigid bodies in Rapier, settled in a browser; a sweater is ten times that,
 * in eight sizes, and settled in a browser it would cost a quarter of an
 * hour and the best part of a gigabyte a size. So this is the same model
 * written as a small position-based solver over typed arrays, which runs in
 * Node in a minute or two and gives the same answer every time it is run:
 *
 * - every link between two stitches is a rope, which may go slack but never
 *   stretch past its length (ropes.ts);
 * - the neck's cast-on is held where the pose put it;
 * - each piece falls the way it was knitted - the body down, each sleeve
 *   down its arm - which is what "blocked with the arms out" means; the yoke
 *   is held spread, as on shoulders, rather than left to fall (see
 *   tuning.ts's yokeGravity);
 * - each round is pushed out from its own middle, which is what holds it out
 *   to the circle its stitches make rather than letting it wander in and out
 *   on its way round, as the hat site's pressure does for a hat;
 * - and it stops when the average stitch has moved less than a sliver of its
 *   own width a step for a couple of seconds - distance, not speed, as the
 *   hat site learned.
 *
 * The ropes are solved one after another in the order the stitches were
 * knitted, from the neck down, so the neck's hold reaches each round as it
 * is corrected; and every stitch is also tethered to the neck by the length
 * of yarn between them, up the column of stitches it was worked into, which
 * no rope can let it exceed. The tethers change nothing a converged settle
 * would do - they are implied by the ropes - but they let a sleeve a hundred
 * and fifty rounds long hang from the neck in a few passes rather than a few
 * hundred.
 */

export interface Progress {
  steps: number;
  /** How far the average stitch moved in the last step, in stitch widths. */
  moved: number;
}

export interface Settled {
  /** Three numbers a stitch, by id, like the pose's. */
  positions: Float32Array;
  steps: number;
  moved: number;
  /** Whether it came to rest, rather than running out of steps. */
  rested: boolean;
}

/** What the next stitch up a column is: what it was worked into, or failing that what it came out of. */
const upFrom = (stitch: Stitch): { id: number; across: boolean } | undefined => {
  const worked = stitch.links.slice(0, consumption[stitch.type]);
  if (worked.length > 0) return { id: worked[Math.floor(worked.length / 2)], across: false };
  if (stitch.from !== undefined) return { id: stitch.from, across: false };
  // A make-one, or a cast-on part way round: the stitch beside it.
  const last = stitch.links[stitch.links.length - 1];
  return last === undefined ? undefined : { id: last, across: true };
};

export const settle = (
  knitting: Knitting,
  pose: Pose,
  overrides: Partial<Tuning> = {},
  onProgress?: (progress: Progress) => void,
): Settled => {
  const tuning = { ...defaultTuning, ...overrides };
  const { stitches, rounds, roundPieces, roundHeight } = knitting;
  const count = stitches.length;

  /* Which piece each stitch is in, and what pulls it there. */
  const pieces = [...new Set(roundPieces)];
  const yoke = pieces[0];
  const pieceOf = new Int16Array(count).fill(-1);
  rounds.forEach((round, index) => {
    const piece = pieces.indexOf(roundPieces[index]);
    for (const id of round) pieceOf[id] = piece;
  });
  const fall = pieces.map((piece) => pose.axes[piece]?.direction ?? [0, -1, 0]);
  const pull = pieces.map((piece) => tuning.gravity * (piece === yoke ? tuning.yokeGravity : 1));
  const push = Float64Array.from(pieces.map((piece) => (piece === yoke ? tuning.yokePressure : tuning.pressure)));
  // Gravity's three parts for each piece, as plain numbers for the inner loop.
  const [gravityX, gravityY, gravityZ] = [0, 1, 2].map((axis) =>
    Float64Array.from(pieces.map((_, piece) => pull[piece] * fall[piece][axis])),
  );
  /*
   * Out from each round's own middle, wherever the round has got to. Out from
   * a fixed line - the axis the pose laid a piece along - pushes every stitch
   * the same way once the piece has swung off that line, which flattens a
   * sleeve into a strip instead of holding it round. The yoke and the body
   * are pushed out level; a sleeve, square to the line through the middles
   * of the rounds either side.
   */
  /*
   * A short row is only part of the way round, across the back, and its own
   * middle is off behind the neck; its stitches are pushed out from the
   * middle of the last whole round before it instead.
   */
  const roundOf = new Int32Array(count).fill(-1);
  let whole = 0;
  rounds.forEach((round, index) => {
    if ((knitting.roundKinds[index] ?? "round") === "round") whole = index;
    for (const id of round) roundOf[id] = whole;
  });
  // The pieces that hang straight down are pushed out level; the rest, a sleeve held out, along themselves.
  const level = fall.map(([fx, , fz]) => Math.hypot(fx, fz) < 1e-6);
  const middles = new Float64Array(rounds.length * 3);
  const along = new Float64Array(rounds.length * 3);
  const neighbourRound = (index: number, way: number) =>
    roundPieces[index + way] === roundPieces[index] ? index + way : index;

  /* What moves: the fabric, but not the neck. */
  const pinned = new Uint8Array(count);
  for (const id of rounds[roundPieces.indexOf(yoke)]) pinned[id] = 1;
  const moving: number[] = [];
  for (const stitch of stitches) {
    if (isFabric(stitch) && !pinned[stitch.id] && pieceOf[stitch.id] >= 0) moving.push(stitch.id);
  }
  const free = Int32Array.from(moving);
  const weight = new Float64Array(count);
  for (const id of free) weight[id] = 1;

  /* The ropes, in the order the stitches were knitted. */
  const ropes = ropesOf(stitches, roundHeight).filter((rope) => weight[rope.a] + weight[rope.b] > 0);
  // Where each end's three numbers start, and its share of a correction: the inner loop's whole diet.
  const ropeA = Int32Array.from(ropes.map((rope) => rope.a * 3));
  const ropeB = Int32Array.from(ropes.map((rope) => rope.b * 3));
  const ropeLength = Float64Array.from(ropes.map((rope) => rope.length));
  const ropeShareA = Float64Array.from(ropes.map((rope) => weight[rope.a] / (weight[rope.a] + weight[rope.b])));
  const ropeShareB = Float64Array.from(ropes.map((rope) => weight[rope.b] / (weight[rope.a] + weight[rope.b])));

  /* The tethers: each stitch to the neck, by the yarn up its column. */
  const anchor = new Int32Array(count).fill(-1);
  const reach = new Float64Array(count);
  for (const stitch of stitches) {
    if (pinned[stitch.id]) {
      anchor[stitch.id] = stitch.id;
      continue;
    }
    if (!isFabric(stitch)) continue;
    const up = upFrom(stitch);
    if (!up || anchor[up.id] < 0) continue;
    anchor[stitch.id] = anchor[up.id];
    reach[stitch.id] =
      reach[up.id] + (up.across ? stitch.width ?? adjacentStitchDistance : stitch.rise ?? roundHeight);
  }

  const x = Float64Array.from(pose.positions);
  const next = new Float64Array(x);
  const velocity = new Float64Array(count * 3);
  const before = new Float64Array(count * 3);
  const h = tuning.timeStep / tuning.substeps;
  const damp = 1 / (1 + h * tuning.damping);
  const quietNeeded = Math.ceil(tuning.restSeconds / tuning.timeStep);
  const still = tuning.restMovement * adjacentStitchDistance;

  let steps = 0;
  let quiet = 0;
  let moved = Infinity;
  while (steps < tuning.maximumSteps) {
    before.set(x);
    for (let substep = 0; substep < tuning.substeps; substep++) {
      /* Where the middle of each round is, and which way its piece runs there. */
      middles.fill(0);
      rounds.forEach((round, index) => {
        let [sx, sy, sz] = [0, 0, 0];
        for (const id of round) {
          sx += x[id * 3];
          sy += x[id * 3 + 1];
          sz += x[id * 3 + 2];
        }
        middles[index * 3] = sx / round.length;
        middles[index * 3 + 1] = sy / round.length;
        middles[index * 3 + 2] = sz / round.length;
      });
      rounds.forEach((_, index) => {
        if (level[pieces.indexOf(roundPieces[index])]) {
          along.set([0, 1, 0], index * 3);
          return;
        }
        const [a, b] = [neighbourRound(index, -1), neighbourRound(index, 1)];
        const dx = middles[b * 3] - middles[a * 3];
        const dy = middles[b * 3 + 1] - middles[a * 3 + 1];
        const dz = middles[b * 3 + 2] - middles[a * 3 + 2];
        const length = Math.hypot(dx, dy, dz) || 1;
        along.set([dx / length, dy / length, dz / length], index * 3);
      });

      /* The forces, and where they would take each stitch. */
      for (let k = 0; k < free.length; k++) {
        const id = free[k];
        const at = id * 3;
        const piece = pieceOf[id];
        // Out from the middle of its round: its offset from there, less the part along the piece.
        const round = roundOf[id] * 3;
        let ox = x[at] - middles[round];
        let oy = x[at + 1] - middles[round + 1];
        let oz = x[at + 2] - middles[round + 2];
        const ax = along[round];
        const ay = along[round + 1];
        const az = along[round + 2];
        const lengthwise = ox * ax + oy * ay + oz * az;
        ox -= lengthwise * ax;
        oy -= lengthwise * ay;
        oz -= lengthwise * az;
        const out = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const pushing = out > 1e-9 ? push[piece] / out : 0;
        velocity[at] = (velocity[at] + h * (gravityX[piece] + pushing * ox)) * damp;
        velocity[at + 1] = (velocity[at + 1] + h * (gravityY[piece] + pushing * oy)) * damp;
        velocity[at + 2] = (velocity[at + 2] + h * (gravityZ[piece] + pushing * oz)) * damp;
        next[at] = x[at] + h * velocity[at];
        next[at + 1] = x[at + 1] + h * velocity[at + 1];
        next[at + 2] = x[at + 2] + h * velocity[at + 2];
      }

      /* The ropes, from the neck down, and the tethers. */
      for (let pass = 0; pass < tuning.iterations; pass++) {
        for (let r = 0; r < ropeA.length; r++) {
          const a = ropeA[r];
          const b = ropeB[r];
          const dx = next[b] - next[a];
          const dy = next[b + 1] - next[a + 1];
          const dz = next[b + 2] - next[a + 2];
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const limit = ropeLength[r];
          if (length <= limit) continue;
          const over = (length - limit) / length;
          const sa = ropeShareA[r] * over;
          const sb = ropeShareB[r] * over;
          next[a] += sa * dx;
          next[a + 1] += sa * dy;
          next[a + 2] += sa * dz;
          next[b] -= sb * dx;
          next[b + 1] -= sb * dy;
          next[b + 2] -= sb * dz;
        }
        for (let k = 0; k < free.length; k++) {
          const id = free[k];
          const held = anchor[id];
          if (held < 0) continue;
          const at = id * 3;
          const to = held * 3;
          const dx = next[at] - next[to];
          const dy = next[at + 1] - next[to + 1];
          const dz = next[at + 2] - next[to + 2];
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (length <= reach[id]) continue;
          const scale = reach[id] / length;
          next[at] = next[to] + dx * scale;
          next[at + 1] = next[to + 1] + dy * scale;
          next[at + 2] = next[to + 2] + dz * scale;
        }
      }

      /* Where they got to is where they are, and how fast they went is how fast they are going. */
      for (let k = 0; k < free.length; k++) {
        const at = free[k] * 3;
        for (let axis = 0; axis < 3; axis++) {
          velocity[at + axis] = (next[at + axis] - x[at + axis]) / h;
          x[at + axis] = next[at + axis];
        }
      }
    }

    steps++;
    let total = 0;
    for (let k = 0; k < free.length; k++) {
      const at = free[k] * 3;
      const dx = x[at] - before[at];
      const dy = x[at + 1] - before[at + 1];
      const dz = x[at + 2] - before[at + 2];
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    moved = total / Math.max(free.length, 1);
    onProgress?.({ steps, moved: moved / adjacentStitchDistance });
    quiet = moved < still && steps >= tuning.minimumSteps ? quiet + 1 : 0;
    if (quiet >= quietNeeded) break;
  }

  /* The phantom and the steps where the stitch before each is, as in the pose. */
  const positions = Float32Array.from(x);
  const neck = rounds[0][0];
  for (const stitch of stitches) {
    if (stitch.id === 0) positions.copyWithin(0, neck * 3, neck * 3 + 3);
    else if (isStep(stitch)) positions.copyWithin(stitch.id * 3, (stitch.id - 1) * 3, stitch.id * 3);
  }
  return { positions, steps, moved: moved / adjacentStitchDistance, rested: quiet >= quietNeeded };
};
