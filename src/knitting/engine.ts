import Needles, { type Held, RoundKind } from "./needles";
import { adjacentStitchDistance, verticalStitchDistance } from "../constants";
import type { Knitting } from "../physics/knitting";
import { Stitch } from "../types/Stitch";
import { StitchType } from "../types/StitchType";
import {
  Chart,
  ChartCell,
  MarkerAt,
  RoundSpec,
  ShapingOp,
  Size,
  SweaterPattern,
  consumes,
} from "../data/sweaters/types";

/**
 * Turns a design into stitches.
 *
 * Everything downstream - the chart, the sweater on screen, the row counter,
 * the knitting panel - only ever wants a list of stitches and the rounds they
 * fall in, which is what the hat site found too. What a sweater adds is
 * pieces: the yoke, then the body, then each sleeve, one after another in the
 * order they are knitted, with the stitches on hold in between.
 */

export interface SweaterStitches {
  stitches: Stitch[];
  rounds: number[][];
  /** A label per round, for the chart's margin: "Border, row 3". */
  roundLabels: string[];
  /** The piece each round belongs to. */
  roundPieces: string[];
  /** Whether each is a round or a short row, and from which side: see Needles.row. */
  roundKinds: RoundKind[];
  /** Every run of stitches put on hold, and when it is taken up again: see Needles.Held. */
  holds: Held[];
  /** The rounds after which the needles are changed, 1-based. */
  needleChanges: number[];
  /** The counts the design names; see Size.checks. */
  checks: Record<string, number>;
  /** How tall a round is, in the units the stitches are laid out in. */
  roundHeight: number;
  /** The knitting as the physics sees it, its rounds worked from each piece's seam: see physics/knitting. */
  knitting: Knitting;
}

/**
 * How tall a round of this size is, relative to how wide a stitch is: the
 * tension the size is written for. At 28 stitches and 32 rounds to 10cm a
 * round is seven eighths of a stitch's width.
 */
export const roundHeightFor = (size: Pick<Size, "stitchesPer10cm" | "roundsPer10cm">): number =>
  size.stitchesPer10cm && size.roundsPer10cm
    ? adjacentStitchDistance * (size.stitchesPer10cm / size.roundsPer10cm)
    : verticalStitchDistance;

/** The stitch a chart cell asks for. */
const stitchFor = (cell: ChartCell): StitchType => {
  switch (cell.symbol) {
    case "purl":
      return "p1";
    case "k1tbl":
      return "k1tbl";
    case "k2tog":
      return "k2tog";
    case "ssk":
      return "ssk";
    case "s2kp":
      return "s2kp";
    case "sk2p":
      return "sk2p";
    case "m1":
      return "m1";
    case "kfb":
      return "kfb";
    default:
      return "k1";
  }
};

/** How many stitches a chart row works, and so how many it needs. */
export const rowConsumes = (row: ChartCell[]): number =>
  row.reduce((total, cell) => total + consumes(cell), 0);

/**
 * What a shaping op works off the needle. A repeat of a fixed number of times
 * inside one that runs to a remainder costs all of them.
 */
const cost = (op: ShapingOp): number => {
  if ("repeat" in op) {
    const each = op.repeat.reduce((total, o) => total + cost(o), 0);
    return "times" in op ? each * op.times : each;
  }
  if (op.work === "m1") return 0;
  if (op.work === "kfb" || op.work === "kbf" || op.work === "pfb") return 1;
  if (op.work === "k2tog" || op.work === "ssk") return 2;
  if (op.work === "s2kp" || op.work === "sk2p") return 3;
  return op.times;
};

/**
 * Flatten a shaping round into stitches.
 *
 * A pattern writes these as "K2, [m1, k4] to last 2 sts, m1, k2", so a repeat
 * has to be expanded against how many stitches are left rather than against a
 * count the pattern never states. "to last 2" means exactly that: keep going
 * while more than two are still unworked.
 */
export const expand = (ops: ShapingOp[], available: number): StitchType[] => {
  const out: StitchType[] = [];
  let used = 0;

  const one = (op: ShapingOp) => {
    if ("repeat" in op) {
      const each = cost(op);
      const times =
        "times" in op
          ? op.times
          : each > 0
            ? Math.floor((available - used - op.untilRemaining) / each)
            : 0;
      for (let i = 0; i < times; i++) op.repeat.forEach(one);
      return;
    }
    if (op.work === "m1") {
      out.push("m1");
      return;
    }
    if (op.work === "kfb" || op.work === "kbf") {
      // One instruction, two loops: the second follows as the paired make-one.
      out.push(op.work, "m1");
      used += 1;
      return;
    }
    if (op.work === "pfb") throw new Error("a PFB is worked from the wrong side, in a short row");
    if (op.work === "k2tog" || op.work === "ssk" || op.work === "s2kp" || op.work === "sk2p") {
      out.push(op.work);
      used += cost(op);
      return;
    }
    for (let i = 0; i < op.times; i++) out.push(op.work === "p" ? "p1" : "k1");
    used += op.times;
  };

  ops.forEach(one);

  if (used !== available) {
    throw new Error(
      `a shaping round works ${used} stitches, but the needle has ${available}`,
    );
  }
  return out;
};

/**
 * A short row's shaping as the stitches it works, one to a place: a knit, or
 * an increase that makes two loops of it. Written as the pattern works it -
 * "k" and "kfb" from the right side, "p" and "pfb" from the wrong - and
 * checked to be worked from the side the row is.
 */
export const rowWork = (ops: ShapingOp[], places: number, side: "right" | "wrong"): ("k1" | "kfb")[] => {
  const [plain, increase] = side === "wrong" ? ["p", "pfb"] : ["k", "kfb"];
  const out: ("k1" | "kfb")[] = [];
  const one = (op: ShapingOp) => {
    if ("repeat" in op) {
      const each = cost(op);
      const times = "times" in op ? op.times : each > 0 ? Math.floor((places - out.length - op.untilRemaining) / each) : 0;
      for (let i = 0; i < times; i++) op.repeat.forEach(one);
      return;
    }
    if (op.work === increase) {
      out.push("kfb");
      return;
    }
    if (op.work !== plain || !("times" in op)) throw new Error(`a short row from the ${side} side cannot ${op.work}`);
    for (let i = 0; i < op.times; i++) out.push("k1");
  };
  ops.forEach(one);
  if (out.length !== places) throw new Error(`a short row's shaping works ${out.length} stitches, but it has ${places}`);
  return out;
};

/**
 * How far before the beginning of the round a round has to start.
 *
 * Usually not at all. But a centred double decrease takes three stitches and
 * leaves one standing over the middle of them, and a round that opens with
 * one has no stitch to its right to take - the hat site's 2026 crown says so
 * in as many words. Only a centred one asks for it.
 */
const borrowFor = (type?: StitchType): number => (type === "s2kp" ? 1 : 0);

/**
 * How wide a stitch of a named fabric is, and how tall its rounds are: a
 * stitch is a stitch wide and a round a round tall, unless the design knits
 * in more than one fabric and names this one.
 */
export const fabricOf = (
  pattern: SweaterPattern,
  roundHeight: number,
  fabric?: string,
): { width: number; rise: number } => {
  if (!fabric) return { width: adjacentStitchDistance, rise: roundHeight };
  const tension = pattern.tensions?.[fabric];
  if (tension === undefined) {
    throw new Error(`${pattern.id}: no tension for the fabric "${fabric}"`);
  }
  return {
    width: adjacentStitchDistance * (tension.stitch ?? 1),
    rise: roundHeight * (tension.round ?? 1),
  };
};

const chartOf = (pattern: SweaterPattern, id: string): Chart => {
  const chart = pattern.charts.find((candidate) => candidate.id === id);
  if (!chart) throw new Error(`${pattern.id}: no chart ${id}`);
  return chart;
};

export const sizeOf = (pattern: SweaterPattern, sizeId?: string): Size => {
  const size = sizeId
    ? pattern.sizes.find((candidate) => candidate.id === sizeId)
    : pattern.sizes[Math.floor((pattern.sizes.length - 1) / 2)];
  if (!size) throw new Error(`${pattern.id}: no size ${sizeId}`);
  return size;
};

export const buildSweater = (
  pattern: SweaterPattern,
  sizeId?: string,
): SweaterStitches => {
  const size = sizeOf(pattern, sizeId);
  const roundHeight = roundHeightFor(size);
  const needles = new Needles();
  const checks: Record<string, number> = {};

  /*
   * Which needles. A size gives its main needles and finer ones for the
   * ribbing, and the knitting starts on the ribbing's: the neck is ribbed.
   * A change after that is a step of its own, where the pattern says.
   */
  const needleFor = (which: "rib" | "main" | "colour") =>
    which === "rib"
      ? (size.ribNeedlesMm ?? size.needlesMm)
      : which === "colour"
        ? (size.colourNeedlesMm ?? size.needlesMm)
        : size.needlesMm;
  const startingNeedles = needleFor("rib");
  let onNeedles = startingNeedles;
  const needleChanges: number[] = [];

  /** Place a marker, or take one off, as the pattern says. */
  const marker = ({ place, remove, begins }: Omit<MarkerAt, "after">) => {
    if (remove !== undefined) needles.removeMarker(remove);
    if (place !== undefined) needles.placeMarker(place, begins);
  };

  const round = (
    label: string,
    work: { type: StitchType; slot: string }[],
    fabric?: string,
    borrow?: number,
    /** Markers placed or taken off part way round: see MarkerAt. */
    markers: MarkerAt[] = [],
  ) => {
    const { width, rise } = fabricOf(pattern, roundHeight, fabric);
    needles.startRound(label, width, rise, borrow ?? borrowFor(work[0]?.type));
    const at = (after: number) => markers.filter((one) => one.after === after).forEach(marker);
    work.forEach(({ type, slot }, index) => {
      at(index);
      needles.knit(type, slot);
    });
    at(work.length);
    needles.endRound();
  };

  const apply = (spec: RoundSpec, section: string) => {
    switch (spec.type) {
      case "castOn": {
        const { width, rise } = fabricOf(pattern, roundHeight, spec.fabric);
        needles.castOn(spec.count, spec.slot, width, rise, `${section} · cast on`);
        break;
      }
      case "join": {
        needles.join();
        break;
      }
      case "needles": {
        const to = needleFor(spec.to);
        if (to !== undefined && to !== onNeedles) {
          if (needles.rounds.length > 0) {
            needleChanges.push(needles.rounds.length);
            needles.changeNeedles(to);
          }
          onNeedles = to;
        }
        break;
      }
      case "rounds": {
        const sequence = spec.sequence ?? ["k"];
        const asStitch: Record<string, StitchType> = { k: "k1", p: "p1", k1tbl: "k1tbl" };
        /*
         * Called what they are, and not numbered: the knitting numbers every
         * round already, by its row of the chart, and a count of these alone
         * would only be a second number for the same round. See
         * progress.roundNames.
         */
        const what = sequence.every((one) => one === "k")
          ? "plain round"
          : `${sequence.map((one) => asStitch[one]).join(", ")} round`;
        for (let pass = 0; pass < spec.count; pass++) {
          const work = Array.from({ length: needles.count }, (_, i) => ({
            type: asStitch[sequence[i % sequence.length]],
            slot: spec.slot,
          }));
          round(`${section} · ${what}`, work, spec.fabric, undefined, pass === 0 ? spec.markers : []);
        }
        break;
      }
      case "shaping": {
        const types = expand(spec.ops, needles.count);
        round(
          `${section} · shaping round`,
          types.map((type) => ({ type, slot: spec.slot })),
          spec.fabric,
          spec.borrow,
        );
        if (needles.count !== spec.to) {
          throw new Error(
            `${section}: a shaping round left ${needles.count} stitches, ` +
              `but the pattern says ${spec.to}`,
          );
        }
        break;
      }
      case "chart": {
        const chart = chartOf(pattern, spec.chart);
        const [from, to] = spec.rows;
        for (let pass = 0; pass < (spec.passes ?? 1); pass++) {
          for (let row = from; row <= to; row++) {
            const cells = chart.rows[row - 1];
            if (!cells) throw new Error(`chart ${chart.id} has no row ${row}`);
            const each = rowConsumes(cells);
            const repeats = spec.repeats ?? needles.count / each;
            if (!Number.isInteger(repeats) || each * repeats !== needles.count) {
              throw new Error(
                `chart ${chart.id} row ${row} is a repeat of ${each}, which does ` +
                  `not go into the ${needles.count} stitches on the needle`,
              );
            }
            const work: { type: StitchType; slot: string }[] = [];
            for (let repeat = 0; repeat < repeats; repeat++) {
              cells.forEach((cell) => work.push({ type: stitchFor(cell), slot: cell.slot }));
            }
            round(
              `${chart.name ?? `Chart ${chart.id}`}, row ${row}`,
              work,
              spec.fabric ?? chart.fabric,
              undefined,
              pass === 0 && row === from ? spec.markers : [],
            );
          }
        }
        break;
      }
      case "walk": {
        const { width, rise } = fabricOf(pattern, roundHeight, spec.fabric);
        needles.walk(`${section} · to the new beginning of the round`, spec.slot, width, rise);
        break;
      }
      case "divide": {
        const { width, rise } = fabricOf(pattern, roundHeight, spec.fabric);
        needles.startRound(`${section} · dividing round`, width, rise);
        // A cast-on closed up to the stitches after it passes its last over the first of them.
        let closing = false;
        for (const segment of spec.segments) {
          if ("work" in segment) {
            for (let i = 0; i < segment.work; i++) needles.knit(closing && i === 0 ? "sl1po" : "k1", spec.slot);
            closing = false;
          } else if ("place" in segment || "remove" in segment) {
            marker(segment);
          } else {
            if (closing) throw new Error(`${section}: a cast-on is closed up to nothing`);
            needles.hold(segment.hold, segment.count, segment.wrap);
            needles.castOnHere(
              segment.castOn,
              spec.slot,
              segment.hold,
              segment.close === "slipPassOver",
              segment.marker && { after: segment.marker.after, name: segment.marker.place, begins: segment.marker.begins },
            );
            closing = segment.close === "slipPassOver";
          }
        }
        if (closing) throw new Error(`${section}: a cast-on is closed up to nothing`);
        needles.endRound();
        break;
      }
      case "piece": {
        const edge = needles.edge(spec.held);
        if (spec.before + spec.after < edge.length) {
          throw new Error(
            `${section}: picks up ${spec.before} + ${spec.after} stitches from an ` +
              `edge of ${edge.length}`,
          );
        }
        /*
         * The edge is the body's underarm cast-on, in the order the body
         * cast it on, and the piece goes round it the other way: it is the
         * same edge seen from the other side. Beginning at its middle, the
         * round picks up back to its start, knits the held stitches, then
         * picks up from its far end back to the middle again.
         *
         * Each half gives its share of the stitches, and where a half is
         * asked for more than it has, the rest come up out of its corner -
         * the gap between the cast-on and the held stitches, which a
         * pattern picks up from to close it.
         */
        const reversed = [...edge].reverse();
        const far = Math.round((edge.length * spec.after) / (spec.before + spec.after));
        const spread = (part: number[], count: number, corner: "first" | "last"): number[] => {
          if (part.length === 0) throw new Error(`${section}: half of the edge has no stitches to pick up from`);
          const extra = Array<number>(count - part.length).fill(corner === "first" ? part[0] : part[part.length - 1]);
          return corner === "first" ? [...extra, ...part] : [...part, ...extra];
        };
        // From the far end, at its corner, back to the middle; and from the middle out to the start's corner.
        const head = spread(reversed.slice(0, far), spec.after, "first");
        const tail = spread(reversed.slice(far), spec.before, "last");
        /*
         * Onto the main needles, whatever the last piece ended on: the body
         * ends in its hem rib, on the rib's, and a sleeve is not ribbed until
         * its cuff.
         */
        onNeedles = needleFor("main");
        needles.resume(spec.held, onNeedles);
        const { width, rise } = fabricOf(pattern, roundHeight, spec.fabric);
        needles.startRound(`${section} · pick-up round`, width, rise);
        tail.forEach((from) => needles.knit("pickUp", spec.slot, from));
        while (needles.remaining > 0) needles.knit("k1", spec.slot);
        head.forEach((from) => needles.knit("pickUp", spec.slot, from));
        needles.endRound();
        break;
      }
      case "shortRows": {
        const { width, rise } = fabricOf(pattern, roundHeight, spec.fabric);
        // How far each pair reaches past the beginning of the round: the last further, where the pattern stretches it.
        const reaches: number[] = [];
        for (let pair = 0; pair < spec.pairs; pair++) {
          const extend = pair === spec.pairs - 1 && spec.extendLast !== undefined ? spec.extendLast : spec.extend;
          reaches.push(pair === 0 ? spec.first : reaches[pair - 1] + extend);
        }
        const reach = reaches[reaches.length - 1];
        if (2 * reach >= needles.count) {
          throw new Error(`${section}: short rows ${reach} stitches either side need more than ${needles.count} stitches`);
        }
        /*
         * Places on the ring run from the beginning of the round, at the
         * middle of the back: the right side's turns are past it, the wrong
         * side's before it, counting back from the end of the round. Each
         * row counts them on the needles as they are when it is worked, so a
         * place counted back from the end is the same stitch after a row
         * before it has increased.
         */
        const span = (from: number, to: number, way: 1 | -1) => {
          const count = needles.count;
          const places: number[] = [];
          for (let place = from; place !== to + way; place += way) places.push(((place % count) + count) % count);
          return places;
        };
        let right = -1;
        let left = 0;
        for (let pair = 0; pair < spec.pairs; pair++) {
          const reachRight = reaches[pair] - 1;
          const reachLeft = -reaches[pair];
          // Right side: from just past the last wrong-side turn - or the beginning of the round - to the next turn.
          needles.row(
            `${section} · short row ${pair * 2 + 1}, right side`,
            width,
            rise,
            "right",
            span(pair === 0 ? 0 : left + 1, reachRight, 1),
            spec.slot,
          );
          needles.turn();
          right = reachRight;
          // Wrong side: back from just before that turn, past the beginning of the round, to the next.
          // The last of them increases on its way back to the beginning of the round, where the pattern says.
          const shaping = pair === spec.pairs - 1 ? spec.shaping?.wrong : undefined;
          needles.row(
            `${section} · short row ${pair * 2 + 2}, wrong side`,
            width,
            rise,
            "wrong",
            span(right - 1, reachLeft, -1),
            spec.slot,
            shaping ? rowWork(shaping, right, "wrong") : [],
          );
          needles.turn();
          left = reachLeft;
        }
        // And on from the last turn to the end of the round, which the next round begins after.
        const last = span(left + 1, -1, 1);
        needles.row(
          `${section} · short rows, to the end of the round`,
          width,
          rise,
          "right",
          last,
          spec.slot,
          spec.shaping?.right ? rowWork(spec.shaping.right, last.length, "right") : [],
        );
        break;
      }
      case "bindOff": {
        // Knitwise, or in pattern: a rib's purls bound off purlwise.
        const sequence = spec.sequence ?? ["k"];
        round(
          `${section} · bind off`,
          Array.from({ length: needles.count }, (_, i) => ({
            type: sequence[i % sequence.length] === "p" ? ("bindOffPurl" as const) : ("bindOff" as const),
            slot: spec.slot,
          })),
          spec.fabric,
        );
        break;
      }
    }
    if (spec.check) {
      checks[spec.check] =
        spec.type === "bindOff" ? needles.rounds[needles.rounds.length - 1].length : needles.count;
    }
  };

  for (const section of size.sections) {
    needles.startPiece(section.piece);
    for (const spec of section.rounds) apply(spec, section.label);
  }

  const { stitches, rounds, roundLabels, roundPieces, roundKinds, holds, objective } = needles.finish();
  /*
   * Every stitch on the needles it is worked on, the steps saying when that
   * changes: a change of needles, or held stitches taken up onto needles of
   * their own to begin a piece.
   */
  let on: number | undefined = startingNeedles;
  for (const stitch of stitches) {
    if (stitch.type === "needles" || (stitch.type === "resume" && stitch.needles !== undefined)) on = stitch.needles;
    else if (on !== undefined) stitch.needles = on;
  }
  const knitting: Knitting = {
    fromSeam: true,
    stitches,
    rounds: objective.rounds,
    roundKinds: objective.kinds,
    roundPieces: objective.pieces,
    roundHeight,
  };
  return { stitches, rounds, roundLabels, roundPieces, roundKinds, holds, needleChanges, checks, roundHeight, knitting };
};
