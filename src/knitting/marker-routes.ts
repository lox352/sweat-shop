import { type Stitch, isFabric } from "../types/Stitch";
import { consumption, makesTwo } from "../types/StitchType";
import type { SweaterStitches } from "./engine";

/**
 * Where a stitch marker goes, round by round.
 *
 * A marker sits on the needle between two live stitches and is slipped from
 * one needle to the other as each round reaches it, so in the next round it
 * is between whatever was worked into the stitches either side of it. The
 * pattern only says where it is placed and where it comes off; the rounds in
 * between follow from the stitches.
 *
 * All but one stitch follows its own: a stitch worked into one before the
 * marker is before it, a KFB's second loop goes with the KFB. A make-one
 * lifted from the bar the marker sits on could go either side of it, and the
 * stitches cannot say which. It is worked before the marker is slipped, and
 * so counts with the stitches before it; the knitting panel says so.
 */
export interface MarkerRound {
  /** The stitch worked just before the marker is reached, and the one just after. */
  before: number;
  after: number;
  /** The round's first stitch. */
  start: number;
  /** A make-one at the marker this round, worked before it is slipped. */
  makeOne?: number;
  /**
   * The round it comes off in, the stitches either side of it then those
   * either side of where it is taken off: at a divide, where the stitches
   * past it may be going on hold, not where it has come up from.
   */
  takenOff?: boolean;
  /** A marker at the start of the round: reached as the round before ends, and drawn beside the round's first stitch. */
  atStart?: boolean;
  /** A short row, at the start of the round: it passes the marker part way along, from wherever it begins. */
  turned?: boolean;
}

export interface MarkerRoute {
  marker: string;
  /** The steps placing it and taking it off, where it comes off. */
  placed: number;
  off?: number;
  rounds: MarkerRound[];
}

const fabricBefore = (stitches: Stitch[], id: number): number => {
  let at = id;
  while (at > 0 && !isFabric(stitches[at])) at--;
  return at;
};

const fabricAfter = (stitches: Stitch[], id: number): number => {
  let at = id;
  while (at < stitches.length - 1 && !isFabric(stitches[at])) at++;
  return at;
};

const routes = new WeakMap<Stitch[], MarkerRoute[]>();

/** Every marker a pattern places, but the beginning of the round the knitting keeps for itself and moves with a new one. */
export const markerRoutes = (built: Pick<SweaterStitches, "stitches" | "knitting">): MarkerRoute[] => {
  const { stitches, knitting } = built;
  const kept = routes.get(stitches);
  if (kept) return kept;
  const roundOf = new Map<number, number>();
  knitting.rounds.forEach((round, index) => round.forEach((id) => roundOf.set(id, index)));
  const found: MarkerRoute[] = [];
  for (const step of stitches) {
    if (step.type !== "marker" || step.removed || step.begins || !step.marker) continue;
    const off = stitches.find((one) => one.id > step.id && one.type === "marker" && one.removed && one.marker === step.marker)?.id;
    let before = fabricBefore(stitches, step.id);
    let after = fabricAfter(stitches, step.id + 1);
    let index = roundOf.get(before);
    if (index !== undefined && roundOf.get(after) !== undefined && roundOf.get(after) !== index) {
      found.push({ marker: step.marker, placed: step.id, off, rounds: startsOf(built, roundOf.get(after)!, off) });
      continue;
    }
    if (index === undefined || roundOf.get(after) !== index) continue;
    const piece = knitting.roundPieces[index];
    const rounds: MarkerRound[] = [{ before, after, start: knitting.rounds[index][0] }];
    while (++index < knitting.rounds.length) {
      const round = knitting.rounds[index];
      // The round it comes off in, the divide's among them, ends it where it comes off.
      if (off !== undefined && off < round[round.length - 1]) {
        if (off > round[0]) rounds.push({ before: fabricBefore(stitches, off), after: fabricAfter(stitches, off + 1), start: round[0], takenOff: true });
        break;
      }
      const next = knitting.roundPieces[index] === piece ? sidesOf(stitches, round, before) : undefined;
      if (!next) break;
      ({ before, after } = next);
      rounds.push({ ...next, start: round[0] });
    }
    found.push({ marker: step.marker, placed: step.id, off, rounds });
  }
  routes.set(stitches, found);
  return found;
};

/**
 * A marker placed between two rounds, where the next begins: the start of the
 * round. It stays at the start of every round of its ring after that - the
 * body's after the yoke's - until it comes off or a piece is begun afresh from
 * held stitches. A short row passes it part way along, and is counted as
 * reaching it as the row before ends, as a round does.
 */
const startsOf = ({ stitches, knitting }: Pick<SweaterStitches, "stitches" | "knitting">, from: number, off?: number): MarkerRound[] => {
  const rounds: MarkerRound[] = [];
  for (let index = from; index < knitting.rounds.length; index++) {
    const round = knitting.rounds[index];
    if (off !== undefined && off < round[0]) break;
    const before = fabricBefore(stitches, round[0] - 1);
    // A piece begun afresh: the stitches between it and the round before are a step taking held stitches up.
    if (index > from && stitches.slice(before + 1, round[0]).some((one) => one.type === "resume")) break;
    // A short row begins wherever it turned: it is drawn where the round before it is.
    const turned = knitting.roundKinds[index] === "right" || knitting.roundKinds[index] === "wrong";
    rounds.push({ before, after: round[0], start: round[0], atStart: true, ...(turned ? { turned } : {}) });
  }
  return rounds;
};

/**
 * Where the marker is in a round, given the stitch it came just after in the
 * round before: between the last stitch on its side and the first on the
 * other, if it is still between two.
 */
const sidesOf = (stitches: Stitch[], round: number[], was: number): Omit<MarkerRound, "start"> | undefined => {
  // True for a stitch before the marker, false after it, undefined for one worked into nothing.
  const sides = round.map((id, k): boolean | undefined => {
    const stitch = stitches[id];
    const into = stitch.links.slice(0, consumption[stitch.type]);
    if (into.length > 0) return into[0] <= was;
    if (stitch.type === "m1" && k > 0 && makesTwo(stitches[round[k - 1]].type)) return stitches[round[k - 1]].links[0] <= was;
    return undefined;
  });
  let last = -1;
  for (let k = 0; k < round.length; k++) if (sides[k]) last = k;
  let first = last + 1;
  while (first < round.length && sides[first] === undefined) first++;
  if (last < 0 || first >= round.length || sides[first] !== false) return undefined;
  // Anything worked into nothing between the two goes before it, worked before the marker is slipped.
  const free = round.slice(last + 1, first);
  const makeOne = free.find((id) => stitches[id].type === "m1");
  return { before: free.length > 0 ? free[free.length - 1] : round[last], after: round[first], ...(makeOne === undefined ? {} : { makeOne }) };
};

/** The make-ones at a marker, each with what the marker marks. */
export const makeOnesAtMarkers = (built: Pick<SweaterStitches, "stitches" | "knitting">): Map<number, string> => {
  const at = new Map<number, string>();
  for (const route of markerRoutes(built)) {
    for (const round of route.rounds) if (round.makeOne !== undefined) at.set(round.makeOne, route.marker);
  }
  return at;
};

/**
 * Where a marker is reached part way along a round or a short row: the
 * stitch worked just before it, with what the marker marks. The knitting
 * panel stops each run there, so it takes you to the marker, and on from it.
 *
 * Most markers stand between the same two stitches' descendants all the way
 * up: the stitch before is the route's own. The start of the round in a
 * short row is passed wherever the row crosses the beginning of the round,
 * part way along it rather than before its first stitch: where the stitches
 * it is worked over, followed down to the last whole round, go from that
 * round's end back to its beginning.
 */
const passes = new WeakMap<Stitch[], Map<number, string>>();
export const markersPassed = (built: Pick<SweaterStitches, "stitches" | "knitting">): Map<number, string> => {
  const { stitches, knitting } = built;
  const kept = passes.get(stitches);
  if (kept) return kept;
  const at = new Map<number, string>();
  const index = new Map<number, number>();
  knitting.rounds.forEach((round, k) => round.forEach((id) => index.set(id, k)));
  const whole = (k: number | undefined) => k !== undefined && knitting.roundKinds[k] !== "right" && knitting.roundKinds[k] !== "wrong";
  // A stitch's place along the last whole round below it, following each down to the stitch it is worked into.
  const placeOf = (id: number): { round: number; at: number } | undefined => {
    let one = id;
    for (let depth = 0; depth < 64; depth++) {
      const k = index.get(one);
      if (k === undefined) return undefined;
      if (whole(k)) return { round: k, at: knitting.rounds[k].indexOf(one) };
      const stitch = stitches[one];
      const below = stitch.links.slice(0, consumption[stitch.type])[0];
      if (below === undefined) return undefined;
      one = below;
    }
    return undefined;
  };
  for (const route of markerRoutes(built)) {
    for (const round of route.rounds) {
      if (!round.atStart) {
        at.set(round.before, route.marker);
        continue;
      }
      if (!round.turned) continue;
      const k = index.get(round.start);
      if (k === undefined) continue;
      const ids = knitting.rounds[k].filter((id) => isFabric(stitches[id]));
      let last: { id: number; round: number; at: number } | undefined;
      for (const id of ids) {
        const place = placeOf(id);
        if (!place) continue;
        const size = knitting.rounds[place.round].length;
        if (last && last.round === place.round && Math.abs(place.at - last.at) > size / 2) {
          at.set(last.id, route.marker);
          break;
        }
        last = { id, ...place };
      }
    }
  }
  passes.set(stitches, at);
  return at;
};
