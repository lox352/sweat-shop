import { Stitch, isFabric, isStep } from "../types/Stitch";
import { StitchType } from "../types/StitchType";
import type { Piece } from "../data/sweaters/types";

/**
 * Where you are in a sweater, and what to work next.
 *
 * Progress is the id of the last stitch worked, so the next one is the one
 * after it. A percentage is no use with needles in your hands; what you need
 * is the piece, the round within it, the stitch within that, and how many of
 * this stitch in this colour to work before either changes.
 *
 * The rounds come from the design rather than being recovered from the stitch
 * graph, so the round a knitter is told they are on is the round the pattern
 * means - counted within its piece, because "body, round 23" is what anyone
 * knitting a body wants to hear, not "round 104".
 */

/** A piece, and the rounds it takes up, 1-based and inclusive. */
export interface PieceSpan extends Piece {
  first: number;
  last: number;
}

export interface RoundIndex {
  rounds: number[][];
  /** Round number, 1-based, for each stitch id. */
  roundOf: Map<number, number>;
  /**
   * Every worked stitch's id, ascending, so that "how many have been worked"
   * is a binary search rather than a walk of eighty thousand stitches.
   */
  worked: number[];
  labels: string[];
  totalRounds: number;
  /** The piece each round belongs to. */
  roundPieces: string[];
  /** The pieces, in the order they are knitted, with their rounds. */
  pieces: PieceSpan[];
}

export const indexRounds = (
  rounds: number[][],
  labels: string[] = [],
  roundPieces: string[] = [],
  pieces: Piece[] = [],
): RoundIndex => {
  const roundOf = new Map<number, number>();
  const worked: number[] = [];
  rounds.forEach((round, index) =>
    round.forEach((id) => {
      roundOf.set(id, index + 1);
      worked.push(id);
    }),
  );
  const spans: PieceSpan[] = [];
  roundPieces.forEach((id, index) => {
    const span = spans.find((candidate) => candidate.id === id);
    if (span) span.last = index + 1;
    else {
      const piece = pieces.find((candidate) => candidate.id === id);
      spans.push({ id, label: piece?.label ?? id, first: index + 1, last: index + 1 });
    }
  });
  return {
    rounds,
    roundOf,
    worked,
    labels,
    totalRounds: rounds.length,
    roundPieces,
    pieces: spans,
  };
};

/** How many of an ascending list are at or below a value. */
const countUpTo = (ascending: number[], value: number): number => {
  let low = 0;
  let high = ascending.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (ascending[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
};

export interface Position {
  round: number;
  totalRounds: number;
  label?: string;
  stitchInRound: number;
  stitchesInRound: number;
  /** The piece the round belongs to, and which of its rounds this is. */
  piece?: PieceSpan;
  pieceRound: number;
  nextStitchId?: number;
  /** The needle size to change to, where that is the next thing to do. */
  needlesNext?: number;
  /** Whether the next thing to do is join the cast-on into a round. */
  joinNext?: "castOn";
  /** Stitches to put on hold next, part way through the dividing round. */
  holdNext?: { holder: string; count: number };
  /** Held stitches to take back up next, to begin a piece with them. */
  resumeNext?: { holder: string; count: number };
  finished: boolean;
}

export const positionOf = (
  stitches: Stitch[],
  progress: number,
  index: RoundIndex,
): Position => {
  const lastId = stitches.length > 0 ? stitches[stitches.length - 1].id : 0;
  const nextStitchId = progress >= lastId ? undefined : progress + 1;
  const next = nextStitchId === undefined ? undefined : stitches[nextStitchId];
  const stepNext = next !== undefined && isStep(next);

  /*
   * Which round this is. Before a stitch, it is that stitch's round. Before
   * a step, it is the round last worked into - the round just finished, for
   * a step between rounds, or the round in progress, for stitches put on hold
   * part way round - except before taking held stitches back up, which is
   * the start of a new piece and belongs to the round it begins.
   */
  let reference = nextStitchId ?? progress;
  if (next?.type === "resume") {
    while (stitches[reference] && !isFabric(stitches[reference])) reference++;
  } else if (stepNext) {
    reference = progress;
    while (reference > 0 && stitches[reference] && isStep(stitches[reference])) reference--;
  }
  while (reference > 0 && !index.roundOf.has(reference)) reference--;
  const round = index.roundOf.get(reference) ?? index.totalRounds;
  const ids = index.rounds[round - 1] ?? [];
  const at = ids.indexOf(reference);
  const piece = index.pieces.find((span) => round >= span.first && round <= span.last);

  return {
    round,
    totalRounds: index.totalRounds,
    label: index.labels[round - 1],
    stitchInRound:
      next?.type === "resume" ? 0 : stepNext ? at + 1 : Math.max(at + 1, 1),
    stitchesInRound: ids.length,
    piece,
    pieceRound: piece ? round - piece.first + 1 : round,
    nextStitchId,
    needlesNext: next?.type === "needles" ? next.needles : undefined,
    joinNext: next?.type === "join" ? "castOn" : undefined,
    holdNext:
      next?.type === "hold" ? { holder: next.holder ?? "", count: next.count ?? 0 } : undefined,
    resumeNext:
      next?.type === "resume" ? { holder: next.holder ?? "", count: next.count ?? 0 } : undefined,
    finished: nextStitchId === undefined,
  };
};

/** "Body, round 23 of 141": where you are, in the piece you are knitting. */
export const whereYouAre = (position: Position): string =>
  position.piece
    ? `${position.piece.label}, round ${position.pieceRound} of ${position.piece.last - position.piece.first + 1}`
    : `Round ${position.round} of ${position.totalRounds}`;

export interface Run {
  slot: string;
  type: StitchType;
  length: number;
  startId: number;
  endId: number;
}

/**
 * What a knitter calls one of these.
 *
 * The one-for-one stitches are counted as stitches - "purl 2", "pick up and
 * knit 6" - and the rest as repetitions of themselves, because that is how a
 * pattern writes them: you do not work three stitches of k2tog, you work
 * k2tog three times.
 */
const words: Record<StitchType, { said: string; after?: string; perStitch: boolean }> = {
  castOn: { said: "cast on", perStitch: true },
  k1: { said: "knit", perStitch: true },
  p1: { said: "purl", perStitch: true },
  // The count goes in the middle, as a pattern writes it: "knit 2 tbl".
  k1tbl: { said: "knit", after: "tbl", perStitch: true },
  m1: { said: "m1", perStitch: false },
  kfb: { said: "KFB", perStitch: false },
  k2tog: { said: "k2tog", perStitch: false },
  ssk: { said: "ssk", perStitch: false },
  s2kp: { said: "s2kp", perStitch: false },
  sk2p: { said: "sk2p", perStitch: false },
  pickUp: { said: "pick up and knit", perStitch: true },
  bindOff: { said: "bind off", perStitch: true },
  // Steps, not stitches: never part of a run. See currentRun.
  join: { said: "join in the round", perStitch: false },
  needles: { said: "change needles", perStitch: false },
  hold: { said: "put stitches on hold", perStitch: false },
  resume: { said: "take up the held stitches", perStitch: false },
};

/** "knit", "purl", "knit tbl", "k2tog". */
export const stitchWord = (type: StitchType): string =>
  [words[type].said, words[type].after].filter(Boolean).join(" ");

/** The instruction a run is: "Knit 6", "Purl 2", "K2tog x 3". */
export const runInstruction = (run: Run): string => {
  const { said, after, perStitch } = words[run.type];
  const phrase = perStitch
    ? [said, run.length, after].filter(Boolean).join(" ")
    : run.length === 1
      ? said
      : `${said} x ${run.length}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

/**
 * The run of one yarn and one stitch starting at the next stitch.
 *
 * This is the instruction that matters in Fair Isle: work this many of this
 * stitch in this colour, then change. A run stops at the end of a round,
 * because that is where a knitter's attention resets, and at a step, which is
 * never part of one.
 */
export const currentRun = (
  stitches: Stitch[],
  progress: number,
  index: RoundIndex,
): Run | undefined => {
  const startId = progress + 1;
  const first = stitches[startId];
  if (!first || isStep(first)) return undefined;

  const round = index.roundOf.get(startId);
  const type = first.type;

  // A KFB is one action at the needles but two loops: report it as one.
  if (type === "kfb") {
    const second = stitches[startId + 1];
    if (second?.type === "m1" && second.slot === first.slot && index.roundOf.get(second.id) === round) {
      return { slot: first.slot, type, length: 1, startId, endId: second.id };
    }
  }

  let endId = startId;
  for (let id = startId + 1; ; id++) {
    const candidate = stitches[id];
    if (!candidate) break;
    if (candidate.slot !== first.slot) break;
    if (candidate.type !== type) break;
    if (index.roundOf.get(id) !== round) break;
    endId = id;
  }

  return { slot: first.slot, type, length: endId - startId + 1, startId, endId };
};

export const upcomingRuns = (
  stitches: Stitch[],
  progress: number,
  index: RoundIndex,
  count = 3,
): Run[] => {
  const runs: Run[] = [];
  let at = progress;
  for (let i = 0; i < count; i++) {
    const run = currentRun(stitches, at, index);
    if (!run) break;
    runs.push(run);
    at = run.endId;
  }
  return runs;
};

/**
 * A round written out, as a pattern writes it: its runs in working order,
 * with any step part way through it in its place - the dividing round's
 * sleeves going on hold between the back and the underarm.
 */
export type RoundPart = { run: Run } | { step: Stitch };

export const roundParts = (stitches: Stitch[], ids: number[], index: RoundIndex): RoundPart[] => {
  const parts: RoundPart[] = [];
  const last = ids[ids.length - 1] ?? 0;
  let at = (ids[0] ?? 1) - 1;
  while (at < last) {
    const next = stitches[at + 1];
    if (!next) break;
    if (isStep(next)) {
      parts.push({ step: next });
      at++;
      continue;
    }
    const run = currentRun(stitches, at, index);
    if (!run) break;
    parts.push({ run });
    at = run.endId;
  }
  return parts;
};

/** Stitches that are worked: not the phantom, and not the steps. */
export const workable = (stitches: Stitch[]): Stitch[] => stitches.filter(isFabric);

export const totals = (
  index: RoundIndex,
  progress: number,
): { worked: number; total: number; remaining: number; percent: number } => {
  const total = index.worked.length;
  const done = countUpTo(index.worked, Math.max(progress, 0));
  return {
    worked: done,
    total,
    remaining: total - done,
    percent: total === 0 ? 0 : (100 * done) / total,
  };
};

/**
 * Id of the last stitch to work to finish the round holding `progress + 1` -
 * or, where a step comes part way through it, the last stitch before the
 * step. The dividing round puts the sleeves on hold half way round, and "end
 * of round" must never walk past that without saying so.
 */
export const endOfRound = (
  progress: number,
  index: RoundIndex,
  stitches?: Stitch[],
): number | undefined => {
  const round = index.roundOf.get(progress + 1);
  if (round === undefined) return undefined;
  const ids = index.rounds[round - 1];
  const last = ids?.[ids.length - 1];
  if (last === undefined || !stitches) return last;
  for (let id = progress + 1; id <= last; id++) {
    if (stitches[id] && isStep(stitches[id])) return id - 1;
  }
  return last;
};
