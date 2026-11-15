import type { Stitch } from "../pattern/Stitch";
import { isFabric, isStep, secondLoop, worksInto } from "../pattern/Stitch";

/**
 * Stretches of the stream of stitches read as one instruction: a span.
 *
 * The stream is flat - a stitch, or a step, at a time - and that is what a
 * project's progress counts. Some instructions are more than one of those,
 * and a span says how: `said: "one"` where the panel says it as one
 * instruction, and `done: "one"` where progress never rests inside it,
 * because stopping there would leave the needles in a state no pattern
 * describes. A span never changes what is saved: a position inside a
 * `done: "one"` span is read as its start (see startOf), and is never
 * rewritten.
 *
 * - A KFB, or a KBF: two loops of one stitch, worked in one go. Said and done
 *   as one.
 * - A turn on a short row: the step, and the stitch, in a later row or round,
 *   that works the double stitch it makes - `closes`. The span is the turn
 *   alone; it reaches forward to that stitch without containing everything
 *   between.
 */
export interface Span {
  type: "kfb" | "turn";
  /** The first stitch or step, and one past the last. */
  start: number;
  end: number;
  said?: "one";
  done?: "one";
  /** A turn's: the stitch that works its double stitch, its two legs as one. */
  closes?: number;
}

const kept = new WeakMap<Stitch[], Span[]>();

/** Every span of a knitting, in order of where it starts. */
export const spansOf = (stitches: Stitch[]): Span[] => {
  const known = kept.get(stitches);
  if (known) return known;
  const spans: Span[] = [];
  const turns: Span[] = [];
  /** The stitch slipped at each turn and made a double stitch, and its turn. */
  const doubled = new Map<number, Span>();
  for (const stitch of stitches) {
    if (secondLoop(stitch, stitches[stitch.id - 1])) {
      spans.push({ type: "kfb", start: stitch.id - 1, end: stitch.id + 1, said: "one", done: "one" });
      continue;
    }
    if (stitch.type === "turn") {
      const span: Span = { type: "turn", start: stitch.id, end: stitch.id + 1 };
      // The stitch just worked is the one slipped back and doubled.
      let last = stitch.id - 1;
      while (last > 0 && !isFabric(stitches[last])) last--;
      if (last > 0) doubled.set(last, span);
      spans.push(span);
      turns.push(span);
      continue;
    }
    if (isStep(stitch) || doubled.size === 0) continue;
    for (const below of worksInto(stitch)) {
      const turn = doubled.get(below);
      if (turn) {
        turn.closes = stitch.id;
        doubled.delete(below);
      }
    }
  }
  kept.set(stitches, spans);
  return spans;
};

const doneAsOne = new WeakMap<Stitch[], Map<number, Span>>();

/** The span done as one that a stitch is part of, if any. */
export const doneWith = (stitches: Stitch[], id: number): Span | undefined => {
  let at = doneAsOne.get(stitches);
  if (!at) {
    at = new Map();
    for (const span of spansOf(stitches)) if (span.done) for (let k = span.start; k < span.end; k++) at.set(k, span);
    doneAsOne.set(stitches, at);
  }
  return at.get(id);
};

/** Where to stand for a stitch: the first of the span done as one it is part of, or itself. */
export const startOf = (stitches: Stitch[], id: number): number => doneWith(stitches, id)?.start ?? id;

const closing = new WeakMap<Stitch[], Set<number>>();

/** Whether a stitch works a double stitch made at a turn, its two legs as one. */
export const worksDoubleStitch = (stitches: Stitch[], id: number): boolean => {
  let at = closing.get(stitches);
  if (!at) {
    at = new Set(spansOf(stitches).flatMap((span) => (span.closes === undefined ? [] : [span.closes])));
    closing.set(stitches, at);
  }
  return at.has(id);
};
