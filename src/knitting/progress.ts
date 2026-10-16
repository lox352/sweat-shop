import { Stitch, isFabric, isStep } from "../types/Stitch";
import { workedAs } from "./sides";
import { StitchType, makesTwo } from "../types/StitchType";
import type { Piece } from "../data/sweaters/types";
import type { RoundKind } from "./needles";
import { chartRows } from "./layout";

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
 * means. Each is numbered by its row of the chart, counted on from the neck:
 * a pattern that counts the body's rounds from 1 again is only renaming them,
 * and "body, round 104" is in the margin beside the round it names. See
 * chartRows.
 */

/** A piece, and the rounds it takes up, 1-based and inclusive. */
export interface PieceSpan extends Piece {
  first: number;
  last: number;
  /** The number of its last round: see RoundIndex.rows. */
  lastRow: number;
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
  /** Whether each is a round or a short row; see Needles.row. */
  roundKinds: RoundKind[];
  /** What each round is numbered, by its place from 0: its row of the chart. */
  rows: number[];
}

export const indexRounds = (
  rounds: number[][],
  labels: string[] = [],
  roundPieces: string[] = [],
  pieces: Piece[] = [],
  roundKinds: RoundKind[] = [],
): RoundIndex => {
  const roundOf = new Map<number, number>();
  const worked: number[] = [];
  rounds.forEach((round, index) =>
    round.forEach((id) => {
      roundOf.set(id, index + 1);
      worked.push(id);
    }),
  );
  const pieceRows = chartRows(roundPieces);
  const rows = rounds.map((_, index) => pieceRows[index] ?? index + 1);
  const spans: PieceSpan[] = [];
  roundPieces.forEach((id, index) => {
    const span = spans.find((candidate) => candidate.id === id);
    if (span) {
      span.last = index + 1;
      span.lastRow = rows[index];
    } else {
      const piece = pieces.find((candidate) => candidate.id === id);
      spans.push({ id, label: piece?.label ?? id, first: index + 1, last: index + 1, lastRow: rows[index] });
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
    roundKinds,
    rows,
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
  /** The piece the round belongs to. */
  piece?: PieceSpan;
  /** What the round is numbered: its row of the chart, counted on from the neck. */
  row: number;
  nextStitchId?: number;
  /** The needle size to change to, where that is the next thing to do. */
  needlesNext?: number;
  /** Whether the next thing to do is join the cast-on into a round. */
  joinNext?: "castOn";
  /** Stitches to put on hold next, part way through the dividing round. */
  holdNext?: { holder: string; count: number; wrap?: boolean };
  /** Held stitches to take back up next, to begin a piece with them, and the needles they go onto. */
  resumeNext?: { holder: string; count: number; needles?: number };
  /** A turn next, at the end of a short row, and the side the row after it is worked from. */
  turnNext?: { side: "right" | "wrong" };
  /** A marker to place or take off next, what it marks, and whether it is the round's new beginning. */
  markerNext?: { marker: string; removed?: boolean; begins?: boolean };
  /** A round, or a short row and the side it is worked from. */
  kind: RoundKind;
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
    row: index.rows[round - 1] ?? round,
    nextStitchId,
    needlesNext: next?.type === "needles" ? next.needles : undefined,
    joinNext: next?.type === "join" ? "castOn" : undefined,
    holdNext:
      next?.type === "hold"
        ? { holder: next.holder ?? "", count: next.count ?? 0, ...(next.wrap ? { wrap: true } : {}) }
        : undefined,
    resumeNext:
      next?.type === "resume"
        ? { holder: next.holder ?? "", count: next.count ?? 0, ...(next.needles === undefined ? {} : { needles: next.needles }) }
        : undefined,
    turnNext:
      next?.type === "turn"
        ? { side: index.roundKinds[round] === "wrong" ? "wrong" : "right" }
        : undefined,
    markerNext:
      next?.type === "marker"
        ? {
            marker: next.marker ?? "",
            ...(next.removed ? { removed: true } : {}),
            ...(next.begins ? { begins: true } : {}),
          }
        : undefined,
    kind: index.roundKinds[round - 1] ?? "round",
    finished: nextStitchId === undefined,
  };
};

/**
 * What the round in hand is called: "round 23", by its row of the chart, or,
 * on a short row, what the pattern calls the row - "short row 3, right side".
 */
export const roundName = (position: Pick<Position, "kind" | "label" | "row">): string => {
  if (position.kind !== "round" && position.label) {
    const name = position.label.split(" · ").pop() ?? position.label;
    return name.charAt(0).toLowerCase() + name.slice(1);
  }
  return `round ${position.row}`;
};

/**
 * What every round is called in the knitting, by its place from 0: "Yoke,
 * short row 2, wrong side", "Body, round 23" - as the knitting panel names
 * the round in hand, for a chart of the whole sweater to name any of them.
 */
export const roundNames = (index: RoundIndex): string[] =>
  index.rounds.map((_, at) => {
    const round = at + 1;
    const piece = index.pieces.find((span) => round >= span.first && round <= span.last);
    const label = index.labels[at];
    const kind = index.roundKinds[at] ?? "round";
    const name = roundName({ kind, label, row: index.rows[at] });
    return piece ? `${piece.label}, ${name}` : `Round ${round}`;
  });

/**
 * What every round is, by its place from 0, to say beside its name: what the
 * pattern calls it, less the section the name already places it in -
 * "dividing round", "plain round", "OXO, row 5". Nothing for a short row,
 * whose name is already what the pattern calls it.
 */
export const roundWhats = (index: RoundIndex): string[] =>
  index.rounds.map((_, at) => {
    const label = index.labels[at] ?? "";
    return (index.roundKinds[at] ?? "round") === "round" ? (label.split(" · ").pop() ?? label) : "";
  });

/** "Body, round 119 of 237": where you are, in the piece you are knitting, and the round it ends with. */
export const whereYouAre = (position: Position): string =>
  position.piece
    ? position.kind === "round"
      ? `${position.piece.label}, round ${position.row} of ${position.piece.lastRow}`
      : `${position.piece.label}, ${roundName(position)}`
    : `Round ${position.round} of ${position.totalRounds}`;

export interface Run {
  slot: string;
  type: StitchType;
  length: number;
  startId: number;
  endId: number;
  /** Worked from the wrong side, on a short row purled back. */
  wrongSide?: boolean;
  /**
   * A rib in one yarn, read as a pattern writes it rather than a stitch at a
   * time: the stitches that repeat, each with how many - one knit and one
   * purl, "(k1, p1)". A rib bound off in pattern is one too.
   */
  repeat?: { type: StitchType; count: number }[];
}

/** A stitch as it is worked: one of the sweater's own, or a KFB worked from the wrong side, a PFB. */
type Worked = StitchType | "pfb";

/**
 * What a knitter calls one of these.
 *
 * The one-for-one stitches are counted as stitches - "purl 2", "pick up and
 * knit 6" - and the rest as repetitions of themselves, because that is how a
 * pattern writes them: you do not work three stitches of k2tog, you work
 * k2tog three times.
 */
const words: Record<Worked, { said: string; after?: string; perStitch: boolean }> = {
  castOn: { said: "cast on", perStitch: true },
  k1: { said: "knit", perStitch: true },
  p1: { said: "purl", perStitch: true },
  // The count goes in the middle, as a pattern writes it: "knit 2 tbl".
  k1tbl: { said: "knit", after: "tbl", perStitch: true },
  m1: { said: "m1", perStitch: false },
  kfb: { said: "KFB", perStitch: false },
  kbf: { said: "KBF", perStitch: false },
  pfb: { said: "PFB", perStitch: false },
  k2tog: { said: "k2tog", perStitch: false },
  ssk: { said: "ssk", perStitch: false },
  s2kp: { said: "s2kp", perStitch: false },
  sk2p: { said: "sk2p", perStitch: false },
  sl1po: { said: "slip 1 and pass the cast-on over", perStitch: false },
  pickUp: { said: "pick up and knit", perStitch: true },
  bindOff: { said: "bind off", perStitch: true },
  bindOffPurl: { said: "bind off purlwise", perStitch: true },
  // Steps, not stitches: never part of a run. See currentRun.
  join: { said: "join in the round", perStitch: false },
  needles: { said: "change needles", perStitch: false },
  hold: { said: "put stitches on hold", perStitch: false },
  resume: { said: "take up the held stitches", perStitch: false },
  turn: { said: "turn and make a double stitch", perStitch: false },
  marker: { said: "place a marker", perStitch: false },
};

/** "knit", "purl", "knit tbl", "k2tog". */
export const stitchWord = (type: Worked): string =>
  [words[type].said, words[type].after].filter(Boolean).join(" ");

/** A rib's stitches as a pattern abbreviates them: "k", "p". */
const ribLetter = (type: StitchType): string => (type === "p1" || type === "bindOffPurl" ? "p" : "k");

/** The stitches of a rib's repeat as a pattern writes them, from the side worked: "k1, p1". */
const ribUnit = (run: Pick<Run, "repeat" | "wrongSide">): string =>
  (run.repeat ?? [])
    .map(({ type, count }) => `${ribLetter(workedAs({ type, wrongSide: run.wrongSide }) as StitchType)}${count}`)
    .join(", ");

const boundOffInPattern = (run: Pick<Run, "repeat">): boolean =>
  (run.repeat ?? []).some(({ type }) => type === "bindOff" || type === "bindOffPurl");

/** A run's stitch, in words, from the side it is worked from: see workedAs. */
export const runWord = (run: Pick<Run, "type" | "wrongSide" | "repeat">): string =>
  run.repeat
    ? boundOffInPattern(run)
      ? "bind off in pattern"
      : `(${ribUnit(run)}) rib`
    : stitchWord(workedAs(run));

/** The instruction a run is: "Knit 6", "Purl 2", "K2tog x 3", "(K1, p1) x 48". */
export const runInstruction = (run: Run): string => {
  let phrase: string;
  if (run.repeat && boundOffInPattern(run)) {
    phrase = `bind off ${run.length} in pattern`;
  } else if (run.repeat) {
    const size = run.repeat.reduce((total, { count }) => total + count, 0);
    const times = Math.floor(run.length / size);
    // What is left over is the first stitches of the repeat: "(k1, p1) x 48, k1".
    let left = run.length - times * size;
    const rest: string[] = [];
    for (const { type, count } of run.repeat) {
      if (left <= 0) break;
      rest.push(`${ribLetter(workedAs({ type, wrongSide: run.wrongSide }) as StitchType)}${Math.min(count, left)}`);
      left -= count;
    }
    phrase = [`(${ribUnit(run)}) x ${times}`, ...rest].join(", ");
  } else {
    const { said, after, perStitch } = words[workedAs(run)];
    phrase = perStitch
      ? [said, run.length, after].filter(Boolean).join(" ")
      : run.length === 1
        ? said
        : `${said} x ${run.length}`;
  }
  // A capital for the first letter, past any bracket a rib opens with.
  return phrase.replace(/[a-z]/i, (letter) => letter.toUpperCase());
};

/** The stitch a rib alternates with, in one yarn: a knit with a purl, and bound off so in pattern. */
const ribPartner: Partial<Record<StitchType, StitchType>> = {
  k1: "p1",
  p1: "k1",
  bindOff: "bindOffPurl",
  bindOffPurl: "bindOff",
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
  if (makesTwo(type)) {
    const second = stitches[startId + 1];
    if (second?.type === "m1" && second.slot === first.slot && index.roundOf.get(second.id) === round) {
      return {
        slot: first.slot,
        type,
        length: 1,
        startId,
        endId: second.id,
        ...(first.wrongSide ? { wrongSide: true } : {}),
      };
    }
  }

  /** Whether a stitch goes on in the same yarn, from the same side, in the same round. */
  const alongside = (candidate: Stitch | undefined): candidate is Stitch =>
    candidate !== undefined &&
    candidate.slot === first.slot &&
    Boolean(candidate.wrongSide) === Boolean(first.wrongSide) &&
    index.roundOf.get(candidate.id) === round;

  let endId = startId;
  for (let id = startId + 1; ; id++) {
    const candidate = stitches[id];
    if (!alongside(candidate) || candidate.type !== type) break;
    endId = id;
  }

  /*
   * A rib in one yarn - a knit or two and a purl or two, again and again -
   * is one instruction, "(k1, p1) x 48", as a pattern writes it, rather than
   * a stitch at a time. It is only a rib where the repeat goes round at
   * least twice; a two-colour rib changes yarn at every turn of it, and so
   * is runs of its own.
   */
  const partner = ribPartner[type];
  const knits = endId - startId + 1;
  if (partner && knits <= 3) {
    let purls = 0;
    while (purls < 4 && alongside(stitches[endId + 1 + purls]) && stitches[endId + 1 + purls].type === partner) purls++;
    if (purls >= 1 && purls <= 3) {
      const unit = [...Array<StitchType>(knits).fill(type), ...Array<StitchType>(purls).fill(partner)];
      let end = startId;
      for (let id = startId; alongside(stitches[id]) && stitches[id].type === unit[(id - startId) % unit.length]; id++) {
        end = id;
      }
      if (end - startId + 1 >= 2 * unit.length) {
        return {
          slot: first.slot,
          type,
          length: end - startId + 1,
          startId,
          endId: end,
          ...(first.wrongSide ? { wrongSide: true } : {}),
          repeat: [
            { type, count: knits },
            { type: partner, count: purls },
          ],
        };
      }
    }
  }

  return {
    slot: first.slot,
    type,
    length: endId - startId + 1,
    startId,
    endId,
    ...(first.wrongSide ? { wrongSide: true } : {}),
  };
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
