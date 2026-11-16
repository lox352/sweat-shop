import type { Fitted, Fitting, FitRequest, Measurements, RoundSpec, Section } from "../../types";
import type { SweaterStitches } from "../../../../pattern/knitted";
import { yearOf } from "../years";
import { banded, below, grown, nearest, Writer } from "./knit";
import { type Gauge, budgets, gauge, ribsAt, settle, type Row } from "./plan";
import { baseSlot, trimSlot, yearOfSlot } from "./slots";

/**
 * Each Year Once, from part of its yoke knitted: the rest planned for what is
 * on the needles, at the knitter's own tension (see Fitting).
 *
 * - **Where.** After the last round of a year on the yoke. Every year begins
 *   with a round of one yarn, where shaping goes, so what follows can be laid
 *   out afresh.
 * - **The yoke.** As many rounds as its depth still wants at the tension.
 *   Where that is most of a strip, years go on round it, growing to the count
 *   the divide wants; where it is not, the yoke is done, and the body takes
 *   the difference.
 * - **The divide.** Stitches the yoke has that the tension does not need, or
 *   lacks, are shared between the body and the sleeves and said, never
 *   decreased away: the knitter chose a size, and is told what it comes to.
 * - **The body and sleeves.** The years not yet knitted, in order, each piece
 *   to its length at the tension, every strip framed alike (see plan's
 *   settle). Two ways: every year still to come, each cut to the rounds there
 *   are; or as many of the next as fit at about the height the pattern gives
 *   a year, the last left out.
 */

const all = Array.from({ length: 13 }, (_, i) => 2014 + i);

/** The year a round is knitted in, by its last stitch: none in the ribbing's trim. */
const yearAt = (knitted: SweaterStitches, round: number): number | undefined => {
  const ids = knitted.rounds[round - 1];
  const slot = baseSlot(knitted.stitches[ids[ids.length - 1]].slot);
  return slot.startsWith(trimSlot) ? undefined : yearOfSlot(slot);
};

const cutAfter = (knitted: SweaterStitches, from: number): number | undefined => {
  for (let round = Math.max(1, from); round <= knitted.rounds.length; round++) {
    if (knitted.roundPieces[round - 1] !== "yoke") return undefined;
    if (knitted.roundKinds[round - 1] !== "round") continue;
    const year = yearAt(knitted, round);
    if (year === undefined) continue;
    if (knitted.roundPieces[round] !== "yoke" || yearAt(knitted, round + 1) !== year) return round;
  }
  return undefined;
};

const named = (years: number[]): string =>
  years.length === 0 ? "no years" : years.length === 1 ? `${years[0]} ${yearOf(years[0]).name}` : `${years[0]} to ${years[years.length - 1]}`;
const half = (cm: number) => Math.round(cm * 2) / 2;
const rounds = (n: number) => `${n} round${n === 1 ? "" : "s"}`;

interface Pieces {
  yoke: Row[];
  body: Row[];
  sleeve: Row[];
  years: { yoke: number[]; body: number[]; sleeve: number[] };
}

/**
 * The years laid out over what is left of the yoke, the body and a sleeve:
 * the split that keeps a year's height most nearly the same on every piece,
 * of those whose strips can all be framed alike. The divide may move a few
 * rounds, the body taking them, so that it falls between two years.
 */
const laidOut = (years: number[], left: { yoke: number; body: number; sleeve: number }): Pieces | undefined => {
  const mean = (Math.max(0, left.yoke) + left.body + left.sleeve) / years.length;
  // A yoke with too little left for a year has none: the body is as much longer, or shorter, as the yoke is not.
  const room = left.yoke >= 0.6 * mean;
  const tries: { k: number; m: number; dy: number; dev: number }[] = [];
  for (let k = 0; k <= years.length - 2; k++) {
    if (k > 0 && !room) break;
    for (let m = 1; m <= years.length - k - 1; m++) {
      const n = years.length - k - m;
      for (const dy of k > 0 ? [0, -1, 1, -2, 2, -3, 3] : [0]) {
        const yoke = k > 0 ? left.yoke + dy : 0;
        const heights = [...(k > 0 ? [yoke / k] : []), (left.body + left.yoke - yoke) / m, left.sleeve / n];
        // A yoke with room for a year has one, if any split with one can be framed: its depth is the size's.
        tries.push({ k, m, dy, dev: Math.max(...heights.map((h) => Math.abs(h / mean - 1))) + 0.01 * Math.abs(dy) + (room && k === 0 ? 10 : 0) });
      }
    }
  }
  for (const { k, m, dy } of tries.sort((a, b) => a.dev - b.dev).slice(0, 24)) {
    const yokeRounds = k > 0 ? left.yoke + dy : 0;
    const [yokeYears, bodyYears, sleeveYears] = [years.slice(0, k), years.slice(k, k + m), years.slice(k + m)];
    const yoke = k > 0 ? settle(yokeYears, yokeRounds) : { framed: [] };
    if (!yoke) continue;
    // A yoke's strips may come out a round or two short of what they were given: the body has those too.
    const yokeRows = yoke.framed.flatMap((f) => f.rows);
    const body = settle(bodyYears, left.body + left.yoke - yokeRows.length);
    const sleeve = body && settle(sleeveYears, left.sleeve);
    if (!body || !sleeve) continue;
    return {
      yoke: yokeRows,
      body: body.framed.flatMap((f) => f.rows),
      sleeve: sleeve.framed.flatMap((f) => f.rows),
      years: { yoke: yokeYears, body: bodyYears, sleeve: sleeveYears },
    };
  }
  return undefined;
};

export const options: NonNullable<Fitting["options"]> = [
  { id: "every", label: "Every year still to come", detail: "Each hat not yet knitted, cut to the rounds there are for it." },
  { id: "fewer", label: "Fewer years, fuller", detail: "As many of the next hats as fit at about the height the pattern gives them. The last years are left out." },
];

/**
 * The fitting of an Each Year Once sampler: `prefix` its charts' ids begin
 * with, `lowTrim` the slot its waist and wrists are ribbed in.
 */
export const fitting = (prefix: string, lowTrim: () => string): Fitting => {
  const plan = ({ finished, tension, from, option = "every" }: FitRequest): Fitted => {
    const { knitted, round } = from;
    if (cutAfter(knitted, round) !== round) throw new Error(`the rest can't be planned from round ${round}: it is not the last round of a year on the yoke`);
    const g: Gauge = { stitches: tension.stitchesPer10cm / 10, rounds: tension.roundsPer10cm / 10 };
    const ribs = ribsAt(g);

    /* What is knitted. */
    const count = knitted.rounds[round - 1].length;
    const worked = knitted.roundKinds.slice(0, round).filter((kind) => kind === "round").length;
    const done = Math.max(...Array.from({ length: round }, (_, i) => yearAt(knitted, i + 1) ?? 0));
    const coming = all.filter((year) => year > done);
    if (coming.length < 2) throw new Error("there are too few years left to plan a body and sleeves from");

    /* What it is to be. */
    const want = budgets(finished, g);
    const chest = nearest(finished.chestCm * g.stitches, 4);
    const underarm = Math.min(24, Math.max(8, nearest(chest * 0.04, 2)));
    const upperArm = nearest(finished.upperArmCm * g.stitches, 2);
    const cuff = nearest(finished.cuffCm * g.stitches, 4);
    const yokeTotal = chest - 2 * underarm + 2 * (upperArm - underarm);
    // The yoke's depth is every round from the cast-on to the divide, the dividing round with them.
    const left = { yoke: Math.round(finished.yokeDepthCm * g.rounds) - 1 - worked, body: want.body, sleeve: want.sleeve };

    /* Which years, and where. */
    const total = Math.max(0, left.yoke) + left.body + left.sleeve;
    const written = budgets(finished, gauge);
    const fuller = Math.min(coming.length, Math.max(2, Math.round((total * 13) / (written.yoke + written.body + written.sleeve))));
    const years = option === "fewer" ? coming.slice(0, fuller) : coming;
    const pieces = laidOut(years, left);
    if (!pieces) throw new Error(`${named(years)} can't all be framed alike in the ${rounds(total)} left`);

    /* The rest of the yoke. */
    const sections: Section[] = [];
    const yoke = new Writer(prefix);
    let yokeEnd = count;
    if (pieces.yoke.length > 0) {
      const to = Math.max(count, nearest(yokeTotal, 4));
      const n = pieces.yoke.length;
      yokeEnd = grown(yoke, banded(pieces.yoke), count, to, (i) => count + (to - count) * Math.min(1, (i + 4) / n));
      const specs: RoundSpec[] = yoke.done();
      specs[specs.length - 1] = { ...specs[specs.length - 1], check: "yoke" };
      sections.push({ label: "Yoke", piece: "yoke", rounds: specs });
    }
    if (yokeEnd % 2 !== 0) throw new Error(`${yokeEnd} stitches can't be divided evenly for the body and sleeves`);

    /* The divide: what the yoke has over what the tension wants, or under it, shared between the body and the sleeves. */
    const over = yokeEnd - yokeTotal;
    const shared = Math.abs(over) > 0.02 * yokeTotal;
    const body = shared ? nearest((chest * yokeEnd) / yokeTotal, 4) : chest;
    const held = (yokeEnd - (body - 2 * underarm)) / 2;
    if (held < 2) throw new Error("the yoke has too few stitches for sleeves");
    const low = below({ body: banded(pieces.body), sleeve: banded(pieces.sleeve) }, { body, underarm, held, cuff }, lowTrim(), prefix, ribs);
    sections.push({ label: "Body", piece: "body", rounds: low.body }, ...low.sleeves);

    /* What it comes to. */
    const yokeRounds = worked + pieces.yoke.length + 1;
    const fits: Measurements = {
      chestCm: half(body / g.stitches),
      neckCm: half(knitted.rounds[0].length / g.stitches),
      yokeDepthCm: half(yokeRounds / g.rounds),
      bodyLengthCm: half((pieces.body.length + ribs.hem + 2) / g.rounds),
      upperArmCm: half((held + underarm) / g.stitches),
      sleeveLengthCm: half((pieces.sleeve.length + ribs.cuff + 2) / g.rounds),
      cuffCm: half(cuff / g.stitches),
    };
    const notes: string[] = [];
    notes.push(
      pieces.yoke.length > 0
        ? `The yoke has ${rounds(pieces.yoke.length)} more, ${named(pieces.years.yoke)}, and grows from ${count} stitches to ${yokeEnd}.`
        : left.yoke > 0
          ? `The yoke is within ${rounds(left.yoke)} of its depth at this tension, too few for another year: it divides for the body and sleeves on the next round, and the body is as much longer.`
          : `The yoke is as deep as it is to be at this tension${left.yoke < 0 ? `, and ${rounds(-left.yoke)} over, which the body is shorter by` : ""}: it divides for the body and sleeves on the next round.`,
    );
    if (shared) {
      notes.push(
        `There are ${yokeEnd} stitches round the yoke, ${Math.abs(over)} ${over > 0 ? "more" : "fewer"} than this tension wants for the size. ` +
          `They are shared between the body and the sleeves, not ${over > 0 ? "decreased away" : "made up"}: ` +
          `the chest comes to ${fits.chestCm}cm for ${finished.chestCm}cm, the upper arm to ${fits.upperArmCm}cm for ${finished.upperArmCm}cm.`,
      );
    }
    notes.push(`The body has ${named(pieces.years.body)} in ${rounds(pieces.body.length)}, each sleeve ${named(pieces.years.sleeve)} in ${rounds(pieces.sleeve.length)}.`);
    const out = coming.filter((year) => !years.includes(year));
    if (out.length > 0) notes.push(`Left out: ${named(out)}.`);

    /*
     * Where each year planned here sits, for a colourway that steps down the
     * jumper: the yoke the first part of the way, then the body and the
     * sleeves each the rest from the underarm, so a body band and the sleeve
     * band level with it share a place. Each year at the middle of its rounds.
     */
    const first = Array.from({ length: round }, (_, i) => i + 1).find((one) => yearAt(knitted, one) !== undefined) ?? round;
    const yokeDone = knitted.roundKinds.slice(first - 1, round).filter((kind) => kind === "round").length;
    const yokeAll = yokeDone + pieces.yoke.length;
    const armpit = yokeAll / (yokeAll + pieces.body.length);
    const middles = (rows: Row[]): [number, number][] =>
      [...new Set(rows.map((row) => row.year))].map((year) => [year, (rows.findIndex((row) => row.year === year) + rows.map((row) => row.year).lastIndexOf(year) + 1) / 2]);
    const places = Object.fromEntries([
      ...middles(pieces.yoke).map(([year, at]) => [String(year), (yokeDone + at) / (yokeAll + pieces.body.length)]),
      ...middles(pieces.body).map(([year, at]) => [String(year), armpit + (1 - armpit) * (at / pieces.body.length)]),
      ...middles(pieces.sleeve).map(([year, at]) => [String(year), armpit + (1 - armpit) * (at / pieces.sleeve.length)]),
    ]);
    const last = (rows: Row[]) => String(rows[rows.length - 1].year);

    return {
      sections,
      charts: [...yoke.charts.values(), ...low.charts],
      checks: { ...(pieces.yoke.length > 0 ? { yoke: yokeEnd } : {}), ...low.checks },
      finished: fits,
      notes,
      // The waist and wrists are ribbed beside the last years of the body and the sleeves, whichever those now are.
      placement: { places, trims: { [lowTrim()]: [last(pieces.body), last(pieces.sleeve)] } },
    };
  };
  return { options, cutAfter, plan };
};
