import type { Fitted, Fitting, FitRequest, Measurements, RoundSpec, Section, Start } from "../../types";
import type { SweaterStitches } from "../../../../pattern/knitted";
import { yearOf } from "../years";
import { bodyFor, shaperFrom } from "./body";
import { banded, below, grown, knit, nearest, shortRowsOf, trimsOf, Writer } from "./knit";
import { type Gauge, type Layout, budgets, gauge, planOf, ribsAt, type Row } from "./plan";
import { laidOut, reachAt } from "./refit";
import { baseSlot, trimSlot, yearOfSlot } from "./slots";

/**
 * Each Year Once for one knitter: a whole sweater from the cast-on, or the
 * rest of one from part of its yoke knitted, planned for what is on the
 * needles at the knitter's own tension (see Fitting). A published size is
 * the first of those at the pattern's tension.
 *
 * - **Where.** From nothing; or after the last round of a year on the yoke.
 *   Every year begins with a round of one yarn, where shaping goes, so what
 *   follows can be laid out afresh.
 * - **The yoke.** As many rounds as its depth still wants at the tension.
 *   Where that is most of a year's height, years go on round it, growing to
 *   the count the divide wants; where it is not, the yoke is done, and the
 *   body takes the difference.
 * - **The divide.** Stitches a yoke already knitted has that the tension does
 *   not need, or lacks, are shared between the body and the sleeves and said,
 *   never decreased away: the knitter chose a size, and is told what it
 *   comes to.
 * - **The years.** Those not yet knitted, in order, shared between the pieces
 *   and each cut as its piece has room for (see refit's laidOut). Two ways:
 *   every year still to come; or as many of the next as fit at about the
 *   height the pattern gives a year, the last left out.
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

/** What is to be knitted, and the counts it is said by: the neck's stitches, those the years begin on, and those the yoke divides on - with how many that is over what the tension wants, where they are shared out. */
interface Made {
  sections: Section[];
  charts: Fitted["charts"];
  checks: Record<string, number>;
  neck: number;
  count: number;
  yokeEnd: number;
  over?: number;
}

export const options: NonNullable<Fitting["options"]> = [
  { id: "every", label: "Every year still to come", detail: "Each hat not yet knitted, cut as its piece has room for." },
  { id: "fewer", label: "Fewer years, fuller", detail: "As many of the next hats as fit at about the height the pattern gives them. The last years are left out." },
];

/**
 * The fitting of an Each Year Once sampler: `prefix` its charts' ids begin
 * with, `lowTrim` the slot its waist and wrists are ribbed in. `shaped`, its
 * yoke's increases go where bodies of the size have room (see body.ts), and
 * the rest of one part knitted is the rest of the earliest plan that explains
 * what is knitted (see Fitting.consistent).
 */
export const fitting = (prefix: string, lowTrim: () => string, shaped = false): Fitting => {
  const bodyOf = (finished: Measurements) => (shaped ? bodyFor(finished.chestCm) : undefined);
  /** A whole sweater from the cast-on, as a published size is knitted (see knit): the ribs in the design's own trims. */
  const whole = (pieces: Pieces, finished: Measurements, g: Gauge): Made => {
    if (pieces.yoke.length === 0) throw new Error("the yoke has no room for a year at this tension");
    const knitted = knit(finished, { rows: pieces, opened: true }, prefix, g, lowTrim(), bodyOf(finished));
    return { ...knitted, neck: knitted.checks.neck, count: knitted.checks.neck, yokeEnd: knitted.checks.yoke };
  };

  /** The rest of a sweater, from a round of its yoke. */
  const onFrom = ({ knitted, round }: Start, pieces: Pieces, finished: Measurements, g: Gauge): Made => {
    const count = knitted.rounds[round - 1].length;
    const chest = nearest(finished.chestCm * g.stitches, 4);
    const underarm = Math.min(24, Math.max(8, nearest(chest * 0.04, 2)));
    const upperArm = nearest(finished.upperArmCm * g.stitches, 2);
    const cuff = nearest(finished.cuffCm * g.stitches, 4);
    const yokeTotal = chest - 2 * underarm + 2 * (upperArm - underarm);

    /* The rest of the yoke. */
    const sections: Section[] = [];
    const yoke = new Writer(prefix);
    let yokeEnd = count;
    if (pieces.yoke.length > 0) {
      const to = Math.max(count, nearest(yokeTotal, 4));
      const n = pieces.yoke.length;
      // A shaped yoke's increases go on from where its stitches are: its Shaper reads the rounds knitted.
      const body = bodyOf(finished);
      const neck = knitted.rounds[0].length;
      const shaper = body && shaperFrom(knitted, round, { body, neck, roundsPerCm: g.rounds, shortRows: shortRowsOf(neck) });
      yokeEnd = grown(yoke, banded(pieces.yoke), count, to, (i) => count + (to - count) * Math.min(1, (i + 4) / n), shaper);
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
    const low = below({ body: banded(pieces.body), sleeve: banded(pieces.sleeve) }, { body, underarm, held, cuff }, lowTrim(), prefix, ribsAt(g), true);
    sections.push({ label: "Body", piece: "body", rounds: low.body }, ...low.sleeves);
    return {
      sections,
      charts: [...yoke.charts.values(), ...low.charts],
      checks: { ...(pieces.yoke.length > 0 ? { yoke: yokeEnd } : {}), ...low.checks },
      neck: knitted.rounds[0].length,
      count,
      yokeEnd,
      ...(shared ? { over } : {}),
    };
  };

  const plan = ({ finished, tension, from, option = "every" }: FitRequest): Fitted => {
    if (from && cutAfter(from.knitted, from.round) !== from.round) {
      throw new Error(`the rest can't be planned from round ${from.round}: it is not the last round of a year on the yoke`);
    }
    const g: Gauge = { stitches: tension.stitchesPer10cm / 10, rounds: tension.roundsPer10cm / 10 };
    const ribs = ribsAt(g);

    /* What is knitted: nothing, for a sweater from the cast-on. */
    const kinds = from ? from.knitted.roundKinds.slice(0, from.round) : [];
    // The rounds of the yoke's depth that are not for the years to come: those knitted, or the neck's ribbing.
    const worked = from ? kinds.filter((kind) => kind === "round").length : ribs.neck;
    const done = from ? Math.max(...kinds.map((_, i) => yearAt(from.knitted, i + 1) ?? 0)) : 0;
    const coming = all.filter((year) => year > done);
    if (coming.length < 2) throw new Error("there are too few years left to plan a body and sleeves from");

    /* What it is to be. */
    const want = budgets(finished, g);
    // The yoke's depth is every round from the cast-on to the divide, the dividing round with them.
    const left = { yoke: Math.round(finished.yokeDepthCm * g.rounds) - 1 - worked, body: want.body, sleeve: want.sleeve };

    /* Which years, and where. */
    const total = Math.max(0, left.yoke) + left.body + left.sleeve;
    const written = budgets(finished, gauge);
    const fuller = Math.min(coming.length, Math.max(2, Math.round((total * 13) / (written.yoke + written.body + written.sleeve))));
    const years = option === "fewer" ? coming.slice(0, fuller) : coming;
    const laid = laidOut(years, left, reachAt(g));
    if (!laid) throw new Error(`${named(years)} will not go in the ${rounds(total)} ${from ? "left" : "there are"}`);
    const pieces = { yoke: laid.yoke.rows, body: laid.body.rows, sleeve: laid.sleeve.rows, years: { yoke: laid.yoke.years, body: laid.body.years, sleeve: laid.sleeve.years } };

    const made = from ? onFrom(from, pieces, finished, g) : whole(pieces, finished, g);
    const { sections, charts, checks, count, yokeEnd } = made;

    /* What it comes to. */
    const yokeRounds = worked + pieces.yoke.length + 1;
    const fits: Measurements = {
      chestCm: half(checks.body / g.stitches),
      neckCm: half(made.neck / g.stitches),
      yokeDepthCm: half(yokeRounds / g.rounds),
      // The body's first row is the dividing round, and the sleeve's the round it is taken up in (see Plan's opened).
      bodyLengthCm: half((pieces.body.length + ribs.hem + 1) / g.rounds),
      upperArmCm: half(checks["sleeve-left:top"] / g.stitches),
      sleeveLengthCm: half((pieces.sleeve.length + ribs.cuff + 1) / g.rounds),
      cuffCm: half(checks["sleeve-left:cuff"] / g.stitches),
    };
    const notes: string[] = [];
    notes.push(
      pieces.yoke.length > 0
        ? `The yoke has ${rounds(pieces.yoke.length)}${from ? " more" : ""}, ${named(pieces.years.yoke)}, and grows from ${count} stitches to ${yokeEnd}.`
        : left.yoke > 0
          ? `The yoke is within ${rounds(left.yoke)} of its depth at this tension, too few for another year: it divides for the body and sleeves on the next round, and the body is as much longer.`
          : `The yoke is as deep as it is to be at this tension${left.yoke < 0 ? `, and ${rounds(-left.yoke)} over, which the body is shorter by` : ""}: it divides for the body and sleeves on the next round.`,
    );
    if (made.over) {
      const over = made.over;
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
    const first = kinds.findIndex((_, i) => from && yearAt(from.knitted, i + 1) !== undefined);
    const yokeDone = first < 0 ? 0 : kinds.slice(first).filter((kind) => kind === "round").length;
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
      charts,
      checks,
      finished: fits,
      notes,
      // The waist and wrists are ribbed beside the last years of the body and the sleeves, whichever those now are; and a neck not yet knitted beside the first.
      placement: { places, trims: { ...(from ? {} : { [trimsOf(pieces).neck]: [String(pieces.yoke[0].year)] }), [lowTrim()]: [last(pieces.body), last(pieces.sleeve)] } },
    };
  };
  return { options, cutAfter, plan, ...(shaped ? { consistent: true } : {}) };
};

/**
 * A lined-up sampler for one knitter: the whole of it from the cast-on, laid
 * out for the size's measurements at their tension as a published size is at
 * the pattern's (see plan's lined) - every year a strip of the height the
 * tension gives it, and the same strips down each sleeve. Its sleeves are its
 * body's strips over again, round for round, so the rest of one part knitted
 * can't be planned yet: it has no cutAfter.
 */
export const fittingWhole = (prefix: string, layout: Layout): Fitting => ({
  plan: ({ finished, tension, from }: FitRequest): Fitted => {
    if (from) throw new Error("a lined-up sampler can only be planned whole, from the cast-on");
    const g: Gauge = { stitches: tension.stitchesPer10cm / 10, rounds: tension.roundsPer10cm / 10 };
    // Thirteen strips, each a round of its own yarn and a cut of its hat, want rounds enough between the neck's rib and the hem's.
    const room = budgets(finished, g);
    let laid: ReturnType<typeof planOf>;
    try {
      laid = planOf(finished, layout, g);
    } catch (error) {
      throw new Error(`thirteen strips will not go in the ${rounds(room.yoke + room.body)} the yoke and body have at this tension (${error instanceof Error ? error.message : String(error)})`);
    }
    const { sections, charts, checks } = knit(finished, laid, prefix, g);
    const ribs = ribsAt(g);
    const fits: Measurements = {
      chestCm: half(checks.body / g.stitches),
      neckCm: half(checks.neck / g.stitches),
      yokeDepthCm: half((ribs.neck + laid.rows.yoke.length + 1) / g.rounds),
      bodyLengthCm: half((laid.rows.body.length + ribs.hem + 2) / g.rounds),
      upperArmCm: half(checks["sleeve-left:top"] / g.stitches),
      sleeveLengthCm: half((laid.rows.sleeve.length + ribs.cuff + 2) / g.rounds),
      cuffCm: half(checks["sleeve-left:cuff"] / g.stitches),
    };
    const yearsOf = (strips: { year: number }[]) => named(strips.map((strip) => strip.year));
    const heights = [...laid.strips.yoke, ...laid.strips.body].map((strip) => strip.height);
    const last = laid.strips.sleeve[laid.strips.sleeve.length - 1];
    return {
      sections,
      charts,
      checks,
      finished: fits,
      notes: [
        `Every year is a strip of ${Math.min(...heights)} to ${Math.max(...heights)} rounds at this tension: ${yearsOf(laid.strips.yoke)} round the yoke, which grows from ${checks.neck} stitches to ${checks.yoke}, and ${yearsOf(laid.strips.body)} down the body.`,
        `Each sleeve has the body's strips round for round, and ${last.year} ${yearOf(last.year).name} carries on to the cuff in ${rounds(last.height)}.`,
      ],
    };
  },
});
