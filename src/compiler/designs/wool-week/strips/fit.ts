import type { Fitted, Fitting, FitRequest, Measurements, RoundSpec, Section, Start } from "../../types";
import type { SweaterStitches } from "../../../../pattern/knitted";
import { yearOf } from "../years";
import { bodyFor, shaperFrom } from "./body";
import { isSolidRound, restOfBand } from "./kept";
import { banded, below, grown, knit, nearest, shortRowsOf, trimsOf, Writer } from "./knit";
import { type Gauge, type KeptRow, type Layout, budgets, gauge, keptSolid, planOf, ribsAt, type Row, type Worked } from "./plan";
import { linedUp } from "./lined";
import { laidOut, reachAt } from "./refit";
import { baseSlot, trimSlot, yearOfSlot } from "./slots";

/**
 * A strip sampler for one knitter, whichever way it is laid out: a whole
 * sweater from the cast-on, or the rest of one from part of its yoke
 * knitted, planned for what is on the needles at the knitter's own tension
 * (see Fitting). A published size is the first of those at the pattern's
 * tension.
 *
 * - **Where.** From nothing; or after any round of a year on the yoke.
 *   After the last round of a year, what follows is laid out afresh: every
 *   year begins with a round of one yarn, where shaping goes. Part way down a
 *   year, that year is finished first, as it was begun.
 * - **A year in hand.** The rounds of it still to come are kept as the
 *   pattern in hand has them, in order, read off its own stitches (see
 *   kept.ts) - and knitted on the count the yoke now wants: its rounds of
 *   one yarn take the new stitches, and each run of its patterned rounds
 *   goes on a whole number of its own repeat, a run begun already on the
 *   repeats it has. Its length is left alone unless it must change: where the
 *   yoke would come out more than its reach too deep, the band stops where
 *   that leaves the yoke nearest its depth - at the end of a run of its
 *   pattern or in the rounds of one yarn after it, never part way through a
 *   run - and what was to follow in it is left out. A year that must stop
 *   so with little of its pattern knitted - under a third of its patterned
 *   rounds (LITTLE), or none, only the round of one yarn it opens with -
 *   stops as soon as it can, and is laid out afresh with the years to come:
 *   it comes first of them, just below where it stopped, and nothing of it
 *   is lost. Each year once, but for that. So does a year with as little
 *   knitted whose end, as it was planned, would leave the yoke more than its
 *   reach too shallow with no room for another year: laid out afresh, it
 *   has the yoke's depth to fill.
 * - **The yoke.** As many rounds as its depth still wants at the tension.
 *   Where that is most of a year's height, years go on round it, growing to
 *   the count the divide wants; where it is not, the yoke is done, and the
 *   body takes the difference.
 * - **The count.** The yoke grows to the count the divide wants in the
 *   rounds it has left - or to what a run in hand leaves, where that doubles
 *   columns of its own past it. Where it has no round left, or none that
 *   will take the stitches, and is short of its count or on an odd one, it
 *   has one round more to make them in, in the yarn the body begins in: the
 *   round before the dividing round, never the dividing round itself.
 * - **The divide.** Stitches a yoke already knitted has that the tension does
 *   not need are shared between the body and the sleeves and said, never
 *   decreased away: the knitter chose a size, and is told what it comes to.
 *   So are any it still lacks, where they could not be made.
 * - **The years.** Those not yet knitted, in order, as the sampler lays its
 *   years out: Each Year Once shares them between the pieces, each cut as its
 *   piece has room for (see refit's laidOut); Thirteen Strips lines them up
 *   from the yoke down the body in strips of about the same height, and has
 *   the body's again down each sleeve (see lined's linedUp). Two ways: every
 *   year still to come; or as many of the next as fit at about the height
 *   the pattern gives a year, the last left out.
 */

const all = Array.from({ length: 13 }, (_, i) => 2014 + i);

/**
 * How far down the jumper the underarm is, of the way from the neck to the
 * hem, as the pattern has it for these measurements at its own tension: its
 * yoke's rounds of colourwork among its yoke's and body's. Worked out once
 * for each set of measurements, as laying the pattern out is no small sum.
 */
const underarms = new Map<string, number>();
const underarmOf = (finished: Measurements, layout: Layout): number => {
  const key = `${layout.kind} ${JSON.stringify(finished)}`;
  let share = underarms.get(key);
  if (share === undefined) {
    const { rows } = planOf(finished, layout);
    share = rows.yoke.length / (rows.yoke.length + rows.body.length);
    underarms.set(key, share);
  }
  return share;
};

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

/**
 * The first round, at or after `from`, the rest can be planned on from as it
 * stands: a round of a year on the yoke whose band's rounds still to come can
 * be read (see kept's restOfBand) - whole rounds, knitted and made - or the
 * last round of a year. None once the yoke is done.
 */
const startAfter = (knitted: SweaterStitches, from: number): number | undefined => {
  for (let round = Math.max(1, from); round <= knitted.rounds.length; round++) {
    if (knitted.roundPieces[round - 1] !== "yoke") return undefined;
    if (knitted.roundKinds[round - 1] !== "round" || yearAt(knitted, round) === undefined) continue;
    const end = cutAfter(knitted, round);
    if (end === undefined) return undefined;
    if (end === round || restOfBand(knitted, round, end)) return round;
  }
  return undefined;
};

const named = (years: number[]): string =>
  years.length === 0 ? "no years" : years.length === 1 ? `${years[0]} ${yearOf(years[0]).name}` : `${years[0]} to ${years[years.length - 1]}`;
const half = (cm: number) => Math.round(cm * 2) / 2;
const rounds = (n: number) => `${n} round${n === 1 ? "" : "s"}`;

const patterned = (r: KeptRow | undefined) => !!r && !keptSolid(r);

/**
 * Where a year in hand can stop, of its rounds still to come, as how many of
 * them are knitted first: never part way through a run of its pattern - not
 * between two rounds of one run, nor before a round that goes on a run begun
 * in a round already knitted.
 */
const stopsOf = (charted: KeptRow[]): number[] =>
  Array.from({ length: charted.length + 1 }, (_, n) => n).filter(
    (n) => n === charted.length || !patterned(charted[n]) || (n === 0 ? !charted[0].kept.carried : !patterned(charted[n - 1]) || charted[n - 1].kept.run !== charted[n].kept.run),
  );

/**
 * How much of a year in hand is knitted: all of its rounds still to come,
 * unless the yoke would then be more than `reach` rounds deeper than the
 * `budget` it has left. Then it stops where that leaves the yoke nearest its
 * depth, of the places it can stop (see stopsOf). Of two as near, the one
 * that keeps more of it.
 */
const keptWithin = (charted: KeptRow[], budget: number, reach: number): KeptRow[] => {
  if (charted.length - budget <= reach) return charted;
  const off = (n: number) => Math.abs(n - budget);
  return charted.slice(0, stopsOf(charted).reduce((best, n) => (off(n) <= off(best) ? n : best)));
};

/** How little of a year's pattern may be knitted, of its rounds as they were planned, for a year that must stop short to be laid out again. */
const LITTLE = 1 / 3;

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

/**
 * How the rest of a yoke part knitted is made: the rounds of the year in hand
 * that are kept; the count it is to grow to; whether it has a round more
 * before the divide, to make stitches in; and `asCharted`, where no count of
 * the year in hand is changed from the pattern in hand's, which is what is
 * done where nothing else can be.
 */
interface Way {
  kept: KeptRow[];
  to: number;
  extra?: boolean;
  asCharted?: boolean;
}

/** A count the yoke can divide on: the next even one. */
const even = (count: number) => count + (count % 2);

/** The counts a size is knitted to at a tension: round the chest, cast on at each underarm, round the upper arm and the cuff, and round the yoke as it divides. */
const countsAt = (finished: Measurements, g: Gauge) => {
  const chest = nearest(finished.chestCm * g.stitches, 4);
  const underarm = Math.min(24, Math.max(8, nearest(chest * 0.04, 2)));
  const upperArm = nearest(finished.upperArmCm * g.stitches, 2);
  const cuff = nearest(finished.cuffCm * g.stitches, 4);
  return { chest, underarm, upperArm, cuff, yokeTotal: chest - 2 * underarm + 2 * (upperArm - underarm) };
};

const options = (layout: Layout): NonNullable<Fitting["options"]> => [
  {
    id: "every",
    label: "Every year still to come",
    detail: layout.kind === "lined" ? "Each hat not yet knitted, in strips of about the same height." : "Each hat not yet knitted, cut as its piece has room for.",
  },
  { id: "fewer", label: "Fewer years, fuller", detail: "As many of the next hats as fit at about the height the pattern gives them. The last years are left out." },
];

/**
 * The fitting of a strip sampler laid out one way: `prefix` its charts' ids
 * begin with, `lowTrim` the slot its waist and wrists are ribbed in.
 * `shaped`, its yoke's increases go where bodies of the size have room (see
 * body.ts), and the rest of one part knitted is the rest of the earliest plan
 * that explains what is knitted (see Fitting.consistent).
 */
export const fitting = (prefix: string, layout: Layout, lowTrim: () => string, shaped = false): Fitting => {
  const lines = layout.kind === "lined";
  // Lined up, the years go down the yoke and the body, and one is enough to go on with; shared out, a body and a sleeve want one each.
  const least = lines ? 1 : 2;
  const lay = lines ? linedUp : laidOut;
  const bodyOf = (finished: Measurements) => (shaped ? bodyFor(finished.chestCm) : undefined);
  /** A whole sweater from the cast-on, as a published size is knitted (see knit): the ribs in the design's own trims. */
  const whole = (pieces: Pieces, finished: Measurements, g: Gauge): Made => {
    if (pieces.yoke.length === 0) throw new Error("the yoke has no room for a year at this tension");
    const knitted = knit(finished, { rows: pieces }, prefix, g, lowTrim(), bodyOf(finished));
    return { ...knitted, neck: knitted.checks.neck, count: knitted.checks.neck, yokeEnd: knitted.checks.yoke };
  };

  /** The rest of a sweater, from a round of its yoke. */
  const onFrom = ({ knitted, round }: Start, way: Way, pieces: Pieces, finished: Measurements, g: Gauge): Made => {
    const count = knitted.rounds[round - 1].length;
    const { chest, underarm, cuff, yokeTotal } = countsAt(finished, g);

    /* The rest of the yoke: what is kept of a year in hand, the years that go on round it, and a round more to grow in where it is to have one. */
    const sections: Section[] = [];
    const yoke = new Writer(prefix);
    const { to } = way;
    const fresh = banded(pieces.yoke);
    // The round more is of the yarn the dividing round is knitted in: the body's first row over again, as it stands in its band.
    const more: Row[] = way.extra ? [banded(pieces.body)[0]] : [];
    // A shaped yoke's increases go on from where its stitches are: its Shaper reads the rounds knitted.
    const body = bodyOf(finished);
    const neck = knitted.rounds[0].length;
    const shaper = body && shaperFrom(knitted, round, { body, neck, roundsPerCm: g.rounds, shortRows: shortRowsOf(neck) });
    let yokeEnd = count;
    if (way.asCharted) {
      // The year in hand round for round as the pattern in hand has it, its new stitches where that makes them; then the years after it.
      for (const r of way.kept) {
        const { cells, reps, places } = r.kept;
        if (keptSolid(r)) {
          const next = yokeEnd + (places?.length ?? 0);
          if (places) yoke.shape(cells[0].slot, yokeEnd, next, places);
          else yoke.plain(cells[0].slot);
          shaper?.knitAt(next, places ?? []);
          yokeEnd = next;
        } else if (places) {
          yoke.keepChanging(r, yokeEnd, yokeEnd + places.length, places);
          shaper?.knitAt(yokeEnd + places.length, places);
          yokeEnd += places.length;
        } else {
          yoke.keep(r);
          const own = cells.flatMap((cell, q) => (cell.symbol === "m1" ? [q] : []));
          yokeEnd = reps * cells.length;
          shaper?.knitAt(yokeEnd, Array.from({ length: reps }, (_, k) => own.map((q) => k * cells.length + q)).flat());
        }
      }
      const after = [...fresh, ...more];
      if (after.length > 0) {
        const [from, n] = [yokeEnd, after.length];
        const end = Math.max(even(from), to);
        yokeEnd = grown(yoke, after, from, end, (i) => from + (end - from) * Math.min(1, (i + 4) / n), shaper);
      }
    } else {
      const rows: Worked[] = [...way.kept, ...fresh, ...more];
      const n = rows.length;
      if (n > 0) yokeEnd = grown(yoke, rows, count, to, (i) => count + (to - count) * Math.min(1, (i + 4) / n), shaper);
    }
    const specs: RoundSpec[] = yoke.done();
    if (specs.length > 0) {
      specs[specs.length - 1] = { ...specs[specs.length - 1], check: "yoke" };
      sections.push({ label: "Yoke", piece: "yoke", rounds: specs });
    }
    if (yokeEnd % 2 !== 0) throw new Error(`${yokeEnd} stitches can't be divided evenly for the body and sleeves`);

    /* The divide: what the yoke has over what the tension wants, or under it, shared between the body and the sleeves. */
    const over = yokeEnd - yokeTotal;
    const shared = Math.abs(over) > 0.02 * yokeTotal;
    const round1 = shared ? nearest((chest * yokeEnd) / yokeTotal, 4) : chest;
    const held = (yokeEnd - (round1 - 2 * underarm)) / 2;
    if (held < 2) throw new Error("the yoke has too few stitches for sleeves");
    const low = below({ body: banded(pieces.body), sleeve: banded(pieces.sleeve) }, { body: round1, underarm, held, cuff }, lowTrim(), prefix, ribsAt(g));
    sections.push({ label: "Body", piece: "body", rounds: low.body }, ...low.sleeves);
    return {
      sections,
      charts: [...yoke.charts.values(), ...low.charts],
      checks: { ...(specs.length > 0 ? { yoke: yokeEnd } : {}), ...low.checks },
      neck,
      count,
      yokeEnd,
      ...(shared ? { over } : {}),
    };
  };

  const plan = ({ finished, tension, from, option = "every" }: FitRequest): Fitted => {
    if (from && startAfter(from.knitted, from.round) !== from.round) {
      throw new Error(`the rest can't be planned from round ${from.round}: it is not a round of a year on the yoke that can be carried on from`);
    }
    const g: Gauge = { stitches: tension.stitchesPer10cm / 10, rounds: tension.roundsPer10cm / 10 };
    const ribs = ribsAt(g);

    /* What is knitted: nothing, for a sweater from the cast-on. */
    const kinds = from ? from.knitted.roundKinds.slice(0, from.round) : [];
    // The rounds of the yoke's depth that are not for the years to come: those knitted, or the neck's ribbing.
    const worked = from ? kinds.filter((kind) => kind === "round").length : ribs.neck;
    // The latest year knitted, or begun: a year in hand is finished before the years to come.
    const done = from ? Math.max(...kinds.map((_, i) => yearAt(from.knitted, i + 1) ?? 0)) : 0;

    /* What it is to be. */
    const want = budgets(finished, g);
    const reach = reachAt(g);
    // The yoke's depth is every round from the cast-on to the divide, the dividing round with them.
    const budget = Math.round(finished.yokeDepthCm * g.rounds) - 1 - worked;

    /* The year in hand: its rounds still to come as the pattern in hand has them, and as many of them as the yoke has depth for. */
    const end = from && cutAfter(from.knitted, from.round);
    const inHand = (from && end && end > from.round && restOfBand(from.knitted, from.round, end)) || [];
    const within = keptWithin(inHand, budget, reach);
    const soonest = inHand.slice(0, stopsOf(inHand)[0]);
    // Little of it knitted: under a third of the year's patterned rounds, by where it would stop.
    const had = from ? kinds.filter((kind, i) => kind === "round" && yearAt(from.knitted, i + 1) === done && !isSolidRound(from.knitted, i + 1)).length : 0;
    const little = (kept: KeptRow[]) => inHand.length > 0 && had + kept.filter(patterned).length < LITTLE * (had + inHand.filter(patterned).length);

    /*
     * The rest, the year in hand gone on with as far as `tail`; or, `again`,
     * stopped as soon as it can be and laid out afresh with the years to come.
     */
    const restWith = (again: boolean) => {
      const tail = again ? soonest : within;
      const coming = all.filter((year) => (again ? year >= done : year > done));
      if (coming.length < least) throw new Error("there are too few years left to plan a body and sleeves from");

      /* Which years, and where: the rest of the yoke made one way. */
      const laidFor = (way: Way) => {
        const left = { yoke: budget - way.kept.length - (way.extra ? 1 : 0), body: want.body, sleeve: want.sleeve };
        // The rounds the years have between them: lined up, a sleeve's are its body's over again.
        const total = Math.max(0, left.yoke) + left.body + (lines ? 0 : left.sleeve);
        const written = budgets(finished, gauge);
        const fuller = Math.min(coming.length, Math.max(least, Math.round((total * 13) / (written.yoke + written.body + (lines ? 0 : written.sleeve)))));
        const years = option === "fewer" ? coming.slice(0, fuller) : coming;
        const laid = lay(years, left, reach);
        if (!laid) throw new Error(`${named(years)} will not go in the ${rounds(total)} ${from ? "left" : "there are"}`);
        const pieces = { yoke: laid.yoke.rows, body: laid.body.rows, sleeve: laid.sleeve.rows, years: { yoke: laid.yoke.years, body: laid.body.years, sleeve: laid.sleeve.years } };
        return { way, left, years, pieces, coming, again };
      };

      /*
       * From the cast-on, the one way. From part knitted, the first of these
       * that can be done and leaves the yoke on its count, near enough, and an
       * even one:
       * - the yoke grown in the rounds it has: to the count the divide wants;
       *   or, where a run in hand doubles its own columns past that, to what
       *   the run leaves; or no further than it must;
       * - the same with a round more before the dividing round, to grow in:
       *   for a yoke with no round left, or none that will take the stitches;
       * - as it is charted, what it then lacks shared out at the divide.
       */
      if (!from) {
        const laid = laidFor({ kept: [], to: 0 });
        return { ...laid, made: whole(laid.pieces, finished, g) };
      }
      const { yokeTotal } = countsAt(finished, g);
      const on = from.knitted.rounds[from.round - 1].length;
      const wanted = nearest(yokeTotal, 4);
      // What a run in hand leaves, on the repeats it has.
      let left = on;
      for (const row of tail) {
        if (!row.kept.carried) break;
        left = row.kept.reps * row.kept.cells.length;
      }
      const counts = [...new Set([Math.max(even(on), wanted), even(Math.max(left, wanted)), even(left)])];
      const ways: Way[] = [
        ...counts.map((to) => ({ kept: tail, to })),
        ...counts.map((to) => ({ kept: tail, to, extra: true })),
        { kept: tail, to: wanted, asCharted: true },
        { kept: tail, to: wanted, asCharted: true, extra: true },
      ];
      let why: unknown;
      for (const way of ways) {
        try {
          const laid = laidFor(way);
          const made = onFrom(from, way, laid.pieces, finished, g);
          // Left short of its count by more than is let pass at the divide: the next way may do better. As it is charted is the last, and stands.
          if (!way.asCharted && made.yokeEnd < wanted - 0.02 * yokeTotal) continue;
          return { ...laid, made };
        } catch (error) {
          why ??= error;
        }
      }
      throw why ?? new Error("the rest of the yoke can't be planned from here");
    };

    /*
     * A year in hand that has to stop short with little of it knitted is laid
     * out again (see above). So is one, with as little knitted, that would go
     * on to its end and leave the yoke more than its reach too shallow, with
     * too little left for another year: laid out again it has the yoke's
     * depth to fill, and does if that comes nearer.
     */
    // How far the yoke is from its depth when it divides, in rounds: over, or under.
    const off = (rest: ReturnType<typeof restWith>) => Math.abs(rest.left.yoke - rest.pieces.yoke.length);
    let found = restWith(within.length < inHand.length && little(within));
    if (!found.again && little(soonest) && found.pieces.yoke.length === 0 && found.left.yoke > reach) {
      try {
        const other = restWith(true);
        if (off(other) < off(found)) found = other;
      } catch {
        // As it was, then.
      }
    }
    const { way, left, years, pieces, made, coming, again } = found;
    const { sections, charts, checks, count, yokeEnd } = made;
    const kept = way.kept.length;
    const more = kept + pieces.yoke.length + (way.extra ? 1 : 0);

    /* What it comes to. */
    const yokeRounds = worked + more + 1;
    const fits: Measurements = {
      chestCm: half(checks.body / g.stitches),
      neckCm: half(made.neck / g.stitches),
      yokeDepthCm: half(yokeRounds / g.rounds),
      // The body's first row is the dividing round, and the sleeve's the round it is taken up in (see Plan).
      bodyLengthCm: half((pieces.body.length + ribs.hem + 1) / g.rounds),
      upperArmCm: half(checks["sleeve-left:top"] / g.stitches),
      sleeveLengthCm: half((pieces.sleeve.length + ribs.cuff + 1) / g.rounds),
      cuffCm: half(checks["sleeve-left:cuff"] / g.stitches),
    };
    const notes: string[] = [];
    if (again) {
      const why = within.length < inHand.length ? "The yoke has no room for the rest of" : "The yoke would be too shallow at the end of";
      notes.push(`${why} ${named([done])} as it was planned, and little of it is knitted: it stops ${kept > 0 ? "at the end of the part of its pattern in hand" : "here"}, and is laid out afresh with the years to come, so nothing of it is lost.`);
    }
    if (more > 0) {
      const cut = inHand.length - kept;
      const parts = [
        ...(kept > 0 ? [again ? `the part of ${named([done])} in hand` : `the rest of ${named([done])}${cut > 0 ? `, which stops ${rounds(cut)} short of where it was planned to` : ""}`] : []),
        ...(pieces.yoke.length > 0 ? [named(pieces.years.yoke)] : []),
        ...(way.extra ? ["a round before the dividing round to make stitches in"] : []),
      ];
      const grows = yokeEnd > count ? `grows from ${count} stitches to ${yokeEnd}` : `stays at ${count} stitches`;
      const then =
        pieces.yoke.length > 0
          ? ""
          : left.yoke > 0
            ? ` It is then within ${rounds(left.yoke)} of its depth at this tension, too few for another year, and the body is as much longer.`
            : left.yoke < 0
              ? ` It is then ${rounds(-left.yoke)} deeper than it is to be at this tension, which the body is shorter by.`
              : "";
      notes.push(`The yoke has ${rounds(more)}${from ? " more" : ""}, ${parts.join(", then ")}, and ${grows}.${then}`);
    } else if (inHand.length > 0 && !again) {
      notes.push(
        `${named([done])} stops here, ${rounds(inHand.length)} short of where it was planned to: the yoke is as deep as it is to be at this tension` +
          `${left.yoke < 0 ? `, and ${rounds(-left.yoke)} over, which the body is shorter by` : ""}. It divides for the body and sleeves on the next round.`,
      );
    } else {
      notes.push(
        left.yoke > 0
          ? `The yoke is within ${rounds(left.yoke)} of its depth at this tension, too few for another year: it divides for the body and sleeves on the next round, and the body is as much longer.`
          : `The yoke is as deep as it is to be at this tension${left.yoke < 0 ? `, and ${rounds(-left.yoke)} over, which the body is shorter by` : ""}: it divides for the body and sleeves on the next round.`,
      );
    }
    if (made.over) {
      const over = made.over;
      notes.push(
        `There are ${yokeEnd} stitches round the yoke, ${Math.abs(over)} ${over > 0 ? "more" : "fewer"} than this tension wants for the size. ` +
          `They are shared between the body and the sleeves, not ${over > 0 ? "decreased away" : "made up"}: ` +
          `the chest comes to ${fits.chestCm}cm for ${finished.chestCm}cm, the upper arm to ${fits.upperArmCm}cm for ${finished.upperArmCm}cm.`,
      );
    }
    if (lines) {
      // Each strip's rounds, but the sleeve's last, which is as long as the sleeve wants.
      const heights = [...new Set([...pieces.yoke, ...pieces.body].map((row) => row.year))].map((year) => [...pieces.yoke, ...pieces.body].filter((row) => row.year === year).length);
      const [low, high] = [Math.min(...heights), Math.max(...heights)];
      const onward = pieces.years.sleeve[pieces.years.sleeve.length - 1];
      notes.push(
        `${heights.length === 1 ? "The year" : "Every year"} ${from ? "still to come " : ""}is a strip of ${low === high ? rounds(low) : `${low} to ${rounds(high)}`} at this tension. ` +
          `The body has ${named(pieces.years.body)} in ${rounds(pieces.body.length)}, and each sleeve the same strips round for round, ` +
          `with ${onward} ${yearOf(onward).name} cut fuller to reach the cuff, in ${rounds(pieces.sleeve.length)}.`,
      );
    } else {
      notes.push(`The body has ${named(pieces.years.body)} in ${rounds(pieces.body.length)}, each sleeve ${named(pieces.years.sleeve)} in ${rounds(pieces.sleeve.length)}.`);
    }
    const out = coming.filter((year) => !years.includes(year));
    if (out.length > 0) notes.push(`Left out: ${named(out)}.`);

    /*
     * Where each year planned here sits, for a colourway that steps down the
     * jumper: the yoke the first part of the way, then the body and the
     * sleeves each the rest from the underarm, so a body band and the sleeve
     * band level with it share a place. Each year at the middle of its rounds.
     * A year in hand is not planned here: it keeps the yarns it was begun in.
     *
     * The underarm is where the pattern has it for these measurements, however
     * deep this knitter's yoke has come out beside their body: the yoke's
     * years share the way to it, and the body's and the sleeves' the way from
     * it. Taken instead as this yoke's own share of the rounds, a yoke of two
     * years over a body of five put the underarm at 31% of the way where the
     * pattern's is at 36%, and a journey that turns from blue to purple at
     * the top of the pattern's body turned sixteen rounds down this one's.
     *
     * A year the sleeve has again after the body is placed by the body's:
     * lined up, they are level round for round, but for the last.
     */
    const first = kinds.findIndex((_, i) => from && yearAt(from.knitted, i + 1) !== undefined);
    const yokeDone = (first < 0 ? 0 : kinds.slice(first).filter((kind) => kind === "round").length) + kept;
    const yokeAll = yokeDone + pieces.yoke.length + (way.extra ? 1 : 0);
    const armpit = underarmOf(finished, layout);
    const middles = (rows: Row[]): [number, number][] =>
      [...new Set(rows.map((row) => row.year))].map((year) => [year, (rows.findIndex((row) => row.year === year) + rows.map((row) => row.year).lastIndexOf(year) + 1) / 2]);
    const places = Object.fromEntries([
      ...middles(pieces.yoke).map(([year, at]) => [String(year), armpit * ((yokeDone + at) / yokeAll)]),
      ...middles(pieces.body).map(([year, at]) => [String(year), armpit + (1 - armpit) * (at / pieces.body.length)]),
      ...middles(pieces.sleeve)
        .filter(([year]) => !pieces.years.body.includes(year))
        .map(([year, at]) => [String(year), armpit + (1 - armpit) * (at / pieces.sleeve.length)]),
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
  return { options: options(layout), cutAfter, startAfter, plan, ...(shaped ? { consistent: true } : {}) };
};
