import type { DivideSegment, MarkerAt, RoundSpec, ShapingOp, SweaterPattern } from "./types";

/**
 * A size of a design written out as a printed pattern words it, a round or
 * an instruction a line: "Shaping round: [m1, k4] x 29 (145 sts)."
 *
 * Written by `npm run editions` beside the frozen editions and committed, so
 * that a change to a size's knitting is a change a reviewer can read - the
 * lines that differ - and not only a new edition's name. Never read by the
 * site: it is for people, and for a printed pattern one day.
 */

const op = (one: ShapingOp): string => {
  if ("repeat" in one) {
    const inner = one.repeat.map(op).join(", ");
    return "times" in one ? `[${inner}] x ${one.times}` : `[${inner}] to last ${one.untilRemaining} sts`;
  }
  if ("times" in one) return `${one.work}${one.times}`;
  return one.work;
};

/**
 * A shaping round's instructions as a pattern would write them, a repeat
 * bracketed where the same few stitches come again and again: "[m1, k2] x 2,
 * m1, k3". A pattern written out a stitch at a time - a sampler's, worked out
 * by its planner - reads as the stretches it is made of.
 */
export const shaped = (ops: ShapingOp[]): string => {
  const words = ops.map(op);
  const out: string[] = [];
  for (let at = 0; at < words.length; ) {
    let best = { unit: 1, times: 1 };
    for (let unit = 1; unit <= 4; unit++) {
      let times = 1;
      while (words.slice(at, at + unit).every((word, k) => word === words[at + times * unit + k]) && at + (times + 1) * unit <= words.length) times++;
      if (times > 1 && unit * times > best.unit * best.times) best = { unit, times };
    }
    const piece = words.slice(at, at + best.unit).join(", ");
    out.push(best.times > 1 ? `[${piece}] x ${best.times}` : piece);
    at += best.unit * best.times;
  }
  return out.join(", ");
};

const markers = (at: MarkerAt[] = []): string =>
  at.length === 0
    ? ""
    : ` Markers: ${at
        .map((one) => `after ${one.after}, ${one.place ? `place ${one.begins ? "the new beginning of the round, " : ""}for ${one.place}` : `remove the one for ${one.remove}`}`)
        .join("; ")}.`;

const segment = (one: DivideSegment): string => {
  if ("work" in one) return `k${one.work}`;
  if ("place" in one) return `place marker for ${one.place}${one.begins ? " (the new beginning of the round)" : ""}`;
  if ("remove" in one) return `remove marker for ${one.remove}`;
  const parts = [
    `${one.wrap ? "wrap the next stitch, then " : ""}put ${one.count} on hold for ${one.hold}`,
    ...(one.thenRemove ? [`remove marker for ${one.thenRemove}`] : []),
    one.marker
      ? `cast on ${one.marker.after}, place marker for ${one.marker.place}${one.marker.begins ? " (the new beginning of the round)" : ""}, cast on ${one.castOn - one.marker.after}`
      : `cast on ${one.castOn}`,
    ...(one.close === "slipPassOver" ? ["cast on 1 more, slip 1 and pass the cast-on over"] : []),
  ];
  return parts.join(", ");
};

const fabric = (spec: RoundSpec) => ("fabric" in spec && spec.fabric ? ` [${spec.fabric}]` : "");
const counted = (spec: RoundSpec, counts: Record<string, number>) => (spec.check && counts[spec.check] !== undefined ? ` (${counts[spec.check]} sts)` : "");

const line = (spec: RoundSpec, counts: Record<string, number>): string => {
  const end = `${counted(spec, counts)}${fabric(spec)}`;
  switch (spec.type) {
    case "castOn":
      return `Cast on ${spec.count} in ${spec.slot}.${end}`;
    case "join":
      return "Join to work in the round.";
    case "needles":
      return `Change to the ${spec.to === "rib" ? "ribbing" : spec.to === "colour" ? "colourwork" : "main"} needles.`;
    case "rounds":
      return `${spec.count} round${spec.count === 1 ? "" : "s"} of ${(spec.sequence ?? ["k"]).map((s) => (s === "k1tbl" ? "k1 tbl" : `${s}1`)).join(", ")} in ${spec.slot}.${markers(spec.markers)}${end}`;
    case "shaping":
      // Its count is the one it says it goes to.
      return `Shaping round in ${spec.slot}: ${shaped(spec.ops)}, to ${spec.to} sts.${spec.borrow ? ` Begun ${spec.borrow} sts early.` : ""}${markers(spec.markers)}${fabric(spec)}`;
    case "chart":
      return `Chart ${spec.chart}, rows ${spec.rows[0]}-${spec.rows[1]}${spec.repeats ? `, ${spec.repeats} repeats a round` : ""}${spec.passes && spec.passes > 1 ? `, ${spec.passes} times` : ""}.${markers(spec.markers)}${end}`;
    case "divide":
      return `Divide, in ${spec.slot}: ${spec.segments.map(segment).join(", ")}.${end}`;
    case "walk":
      return `Knit on to the new beginning of the round, in ${spec.slot}.${end}`;
    case "piece":
      return `Begin ${spec.held}: pick up and knit ${spec.before}, knit the held stitches, pick up and knit ${spec.after}, in ${spec.slot}.${end}`;
    case "bindOff":
      return `Bind off ${spec.sequence ? `in pattern, (${spec.sequence.map((s) => `${s}1`).join(", ")})` : "knitwise"}, in ${spec.slot}.${end}`;
    case "shortRows":
      return `${{ german: "German" }[spec.method ?? "german"]} short rows in ${spec.slot}: ${spec.pairs} pairs, the first ${spec.first} sts past the beginning of the round, each ${spec.extend} further${spec.extendLast ? `, the last ${spec.extendLast} further again` : ""}.${
        spec.shaping?.wrong ? ` Last row back: ${shaped(spec.shaping.wrong)}.` : ""
      }${spec.shaping?.right ? ` Row to the end of the round: ${shaped(spec.shaping.right)}.` : ""}${end}`;
  }
};

/** A size, written out. `counts` are the stitch counts the knitting recorded by name: see Size.checks. */
export const writtenPattern = (pattern: SweaterPattern, sizeId: string, counts: Record<string, number> = {}): string => {
  const size = pattern.sizes.find((one) => one.id === sizeId);
  if (!size) throw new Error(`${pattern.id}: no size ${sizeId}`);
  const head = [
    `${pattern.name}, size ${size.label}`,
    `${size.stitchesPer10cm} sts and ${size.roundsPer10cm} rounds to 10cm on ${size.needlesMm}mm needles${size.ribNeedlesMm ? `, ribbing on ${size.ribNeedlesMm}mm` : ""}${size.colourNeedlesMm ? `, colourwork on ${size.colourNeedlesMm}mm` : ""}.`,
  ];
  const sections = size.sections.map((section) => [`${section.label} (${section.piece})`, ...section.rounds.map((spec) => `  ${line(spec, counts)}`)].join("\n"));
  return `${[head.join("\n"), ...sections].join("\n\n")}\n`;
};
