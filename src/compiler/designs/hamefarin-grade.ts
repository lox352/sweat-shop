import type { Measurements } from "../../pattern/design";

/**
 * Grading Hamefarin: a size's finished measurements and a tension, turned
 * into the stitch and round counts its pattern prints.
 *
 * The structure it grades is the design's own (hamefarin.ts): a ribbed neck
 * and a first increase round straight after it, then five bands each
 * preceded by an increase round, then plain rounds to the depth of the yoke;
 * a body with an echo of the small peerie above its hem; sleeves decreasing
 * from the upper arm to the cuff, with the same echo above it.
 *
 * The published sizes are this at the pattern's own tension. At another - a
 * knitter's own, measured in their knitting - it is the same sweater in
 * other counts.
 */

/** A tension, to the centimetre. */
export interface Gauge {
  stitches: number;
  rounds: number;
}

/** The pattern's own: 28 stitches and 32 rounds to 10cm. */
export const standard: Gauge = { stitches: 2.8, rounds: 3.2 };

export interface Grade {
  neck: number;
  /** The short rows across the back of the neck: see RoundSpec's shortRows. */
  shortRows: { first: number; extend: number; pairs: number };
  /** The first increase round, straight after the rib. */
  first: number;
  /** After the increase round before each band, in order. */
  incs: [number, number, number, number, number];
  /** Plain rounds before each band's increase round. */
  plain: [number, number, number, number, number];
  /** Plain rounds after the last band, down to the divide. */
  pad: number;
  /** All of the back, half either side of the beginning of the round. */
  back: number;
  front: number;
  /** Each sleeve's held stitches. */
  sleeve: number;
  /** Cast on at each underarm. */
  underarm: number;
  /** Plain body rounds after the dividing round, before the echo. */
  bodyRounds: number;
  firstDecrease: number;
  /** "Decrease every n rounds, so many times", in order. */
  decreases: { every: number; times: number }[];
  sleeveTail: number;
}

/** What a size is graded from: who it is for, and what it is to measure. */
export interface Measured {
  id: string;
  label: string;
  toFitChestCm: number;
  finished: Measurements;
}

export type Graded = Measured & { grade: Grade };

/** Rounds the design spends on things that do not change with size. */
const neckRib = 12;
const bands = [
  { name: "Peerie I", rounds: 5, repeat: 6 },
  { name: "Border", rounds: 9, repeat: 12 },
  { name: "Peerie II", rounds: 3, repeat: 4 },
  { name: "OXO", rounds: 17, repeat: 24 },
  { name: "Border II", rounds: 7, repeat: 12 },
];
/** The echo above the hem and the cuffs: a plain round, Peerie II, a plain round. */
const echo = 5;
const hemRib = 20;
const cuffRib = 20;
const bindOff = 1;

/*
 * The targets, as finished measurements in centimetres: standard body
 * measurements with about ten centimetres of ease at the chest, five at the
 * upper arm, and a neck wide enough to go over a head.
 */
const size = (id: string, label: string, toFitChestCm: number, chestCm: number, neckCm: number, yokeDepthCm: number, bodyLengthCm: number, upperArmCm: number, sleeveLengthCm: number, cuffCm: number): Measured => ({
  id, label, toFitChestCm, finished: { chestCm, neckCm, yokeDepthCm, bodyLengthCm, upperArmCm, sleeveLengthCm, cuffCm },
});
export const measured: Measured[] = [
  size("xs", "XS", 76, 86, 44, 19, 35, 29, 43, 19),
  size("s", "S", 86, 96, 45, 20, 36, 31, 44, 19.5),
  size("m", "M", 96, 106, 46, 21, 37, 33, 45, 20),
  size("l", "L", 106, 116, 47, 22, 38, 35.5, 46, 21),
  size("xl", "XL", 116, 126, 48, 23, 39, 38, 47, 22),
  size("2xl", "2XL", 126, 136, 49, 24, 40, 41, 47, 23),
  size("3xl", "3XL", 136, 146, 50, 25, 41, 44, 48, 24),
  size("4xl", "4XL", 146, 156, 51, 26, 42, 47, 48, 25),
];

const nearest = (value: number, multiple: number) => Math.max(multiple, Math.round(value / multiple) * multiple);

/** The rounds of the neck's rib. */
export const neckRibRounds = neckRib;

/*
 * German short rows across the back of the neck, after the rib: three
 * pairs, the first reaching a sixth of the neck past the middle of the
 * back each way and each pair after it a twentieth further, so the last
 * turns near the shoulders. Six rows at the middle of the back raise it
 * about two centimetres, which is what a back neck wants.
 */
export const shortRowsFor = (neck: number) => ({ first: Math.round(neck * 0.16), extend: Math.round(neck * 0.05), pairs: 3 });

/** The stitches a size is knitted to at a tension, which its widths alone decide. */
export const widths = (m: Measurements, gauge: Gauge, id = "") => {
  const neck = nearest(m.neckCm * gauge.stitches, 4);
  const body = nearest(m.chestCm * gauge.stitches, 4);
  /*
   * The underarm: about four per cent of the body, and even, so a sleeve
   * can begin at its middle. Smaller than Elizabeth Zimmermann's eight per
   * cent, as modern top-down yokes are.
   */
  const underarm = Math.min(20, Math.max(8, nearest(body * 0.04, 2)));
  const half = (body - 2 * underarm) / 2;
  if (half % 2 !== 0) throw new Error(`${id}: the back will not split at its middle`);
  /*
   * The sleeve's top, near its target, even, and such that the yoke - the
   * body's front and back plus both sleeves' held stitches - is a whole
   * number of Border II's repeats.
   */
  let top: number | undefined;
  for (const step of [0, 2, -2, 4, -4, 6, -6]) {
    const candidate = nearest(m.upperArmCm * gauge.stitches, 2) + step;
    if ((body + 2 * candidate - 4 * underarm) % 12 === 0) {
      top = candidate;
      break;
    }
  }
  if (top === undefined) throw new Error(`${id}: no sleeve top makes the yoke a whole number of repeats`);
  const sleeve = top - underarm;
  const cuff = nearest(m.cuffCm * gauge.stitches, 4);
  return { neck, body, underarm, half, top, sleeve, yoke: 2 * half + 2 * sleeve, cuff };
};

/**
 * The plain rounds of a body and the decreases of a sleeve, for their
 * lengths at a tension: a body `shorter` by so many rounds, where its yoke
 * is as much deeper than the size's.
 */
export const lengths = (m: Measurements, gauge: Gauge, top: number, cuff: number, id = "", shorter = 0) => {
  /* The body: from the dividing round to the bind-off. */
  const bodyTotal = Math.round(m.bodyLengthCm * gauge.rounds) - shorter;
  const bodyRounds = bodyTotal - 1 - echo - hemRib - bindOff;
  if (bodyRounds < 1) throw new Error(`${id}: the body is too short for its hem`);

  /* The sleeve: pick-up round, decreases, echo, cuff. */
  const decreases = (top - cuff) / 2;
  if (!Number.isInteger(decreases) || decreases < 0) throw new Error(`${id}: the cuff is not even`);
  const sleeveTotal = Math.round(m.sleeveLengthCm * gauge.rounds);
  const shaped = sleeveTotal - 1 - echo - cuffRib - bindOff;
  /*
   * Decreases from eight rounds below the pick-up to eight above the echo,
   * as evenly as whole rounds allow: so many every n rounds, then the rest
   * every n - 1, as a pattern writes it.
   */
  const firstDecrease = 8;
  const sleeveTail = 8;
  const room = shaped - firstDecrease - sleeveTail;
  const every = decreases > 0 ? Math.floor(room / decreases) : room;
  if (every < 2) throw new Error(`${id}: the sleeve decreases too fast`);
  const longer = decreases > 0 ? room - every * decreases : 0;
  const decreaseRounds = [
    ...(longer > 0 ? [{ every: every + 1, times: longer }] : []),
    { every, times: decreases - longer },
  ];
  return { bodyRounds, firstDecrease, decreases: decreaseRounds, sleeveTail, sleeveRounds: sleeveTotal, bodyTotal };
};

export const grade = (size: Measured, gauge: Gauge = standard): Graded => {
  const m = size.finished;
  const { neck, body, underarm, half, top, sleeve, yoke, cuff } = widths(m, gauge, size.id);
  void body;

  /*
   * Where the rounds go. The yoke's depth is measured at the front from the
   * cast-on. After the rib comes a first increase round and at least one
   * plain round; whatever the bands and their own increase rounds then leave
   * is spent on plain rounds - up to two before each band's increase round
   * where there is room, then the rest below the last band.
   */
  const depth = Math.round(m.yokeDepthCm * gauge.rounds);
  const fixed = neckRib + 1 + bands.reduce((total, band) => total + band.rounds + 1, 0);
  let spare = depth - fixed;
  if (spare < 1) throw new Error(`${size.id}: the yoke is too shallow for the bands`);
  const plain = [1, 0, 0, 0, 0];
  spare -= 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let band = 1; band < 5 && spare > 0; band++) {
      plain[band] += 1;
      spare -= 1;
    }
  }
  const pad = spare;

  /*
   * The counts after each increase round. A yoke is a cone over the
   * shoulders and a band round the chest and arms below them, so its
   * circumference grows with depth for the first part of the way and then
   * stops: here, linearly from the neck to its full count at six tenths of
   * the depth, read where each band begins, and rounded to the band's own
   * repeat. The first increase round, straight after the rib, takes the
   * neck half way - in ratio - to the first band's count, so that no single
   * round has to do more than about half again.
   */
  const at: number[] = [];
  let round = neckRib + 1;
  bands.forEach((band, index) => {
    round += plain[index] + 1;
    at.push(round);
    round += band.rounds;
  });
  const reach = depth * 0.6;
  const wanted = bands.map((_band, index) =>
    index === bands.length - 1
      ? yoke
      : neck + (yoke - neck) * Math.min(1, at[index] / reach),
  );
  /*
   * Rounded to each band's repeat, and kept rising: every increase round
   * leaves at least a little more than the one before, working back up
   * from the yoke's full count so that none of them overshoots it.
   */
  const incs = [...wanted];
  for (let index = bands.length - 2; index >= 0; index--) {
    const { repeat } = bands[index];
    const below = Math.floor((incs[index + 1] - 1) / repeat) * repeat;
    incs[index] = Math.min(nearest(wanted[index], repeat), below);
  }
  /*
   * Rounding to a repeat can leave an increase round with almost nothing to
   * do - four stitches in three hundred - beside a big one. Where a round
   * would add less than a twentieth, its count is moved to the middle, in
   * ratio, of its neighbours.
   */
  for (let pass = 0; pass < 2; pass++) {
    for (let index = 1; index < bands.length - 1; index++) {
      const before = incs[index - 1];
      const after = incs[index + 1];
      if (incs[index] / before >= 1.05 && after / incs[index] >= 1.05) continue;
      const { repeat } = bands[index];
      const middle = nearest(Math.sqrt(before * after), repeat);
      if (middle > before && middle < after) incs[index] = middle;
    }
  }
  const first = nearest(Math.sqrt(neck * incs[0]), 4);
  incs.forEach((count, index) => {
    const before = index === 0 ? first : incs[index - 1];
    if (count > 2 * before) throw new Error(`${size.id}: increase ${index + 1} more than doubles`);
    if (count <= before) throw new Error(`${size.id}: increase ${index + 1} does not increase`);
    if (count % bands[index].repeat !== 0) throw new Error(`${size.id}: increase ${index + 1}`);
  });
  if (incs[incs.length - 1] !== yoke) throw new Error(`${size.id}: the yoke does not divide`);

  const { bodyRounds, firstDecrease, decreases: decreaseRounds, sleeveTail } = lengths(m, gauge, top, cuff, size.id);
  /*
   * German short rows across the back of the neck, after the rib: three
   * pairs, the first reaching a sixth of the neck past the middle of the
   * back each way and each pair after it a twentieth further, so the last
   * turns near the shoulders. Six rows at the middle of the back raise it
   * about two centimetres, which is what a back neck wants.
   */
  const shortRows = shortRowsFor(neck);
  return {
    id: size.id,
    label: size.label,
    toFitChestCm: size.toFitChestCm,
    finished: size.finished,
    grade: {
      neck,
      shortRows,
      first,
      incs: incs as Grade["incs"],
      plain: plain as Grade["plain"],
      pad,
      underarm,
      back: half,
      front: half,
      sleeve,
      bodyRounds,
      firstDecrease,
      decreases: decreaseRounds,
      sleeveTail,
    },
  };
};

/** A yoke part knitted: its neck, the stitches on the needles, the rounds worked from the cast-on, and how many of the bands are done. */
export interface Knitted {
  neck: number;
  count: number;
  worked: number;
  done: number;
}

/** The rest of a size, graded on from a yoke part knitted: see gradeOn. */
export interface GradedOn {
  /** From the neck itself: the count after a first increase round, straight after the rib, with a plain round after it. */
  first?: number;
  /** The bands still to knit, in order: which of the five, the plain rounds before its increase round, and the count that round leaves. */
  bands: { band: number; plain: number; to: number }[];
  /** The bands there is no depth left for. */
  dropped: number[];
  /** Plain rounds to the divide, after the last band. */
  pad: number;
  /** The stitches the yoke divides on, and how many more that is than the tension wants for the size. */
  yoke: number;
  over: number;
  /** How many rounds deeper than the size's the yoke comes to, which the body is shorter by. */
  deeper: number;
  below: Pick<Grade, "back" | "front" | "sleeve" | "underarm" | "bodyRounds" | "firstDecrease" | "decreases" | "sleeveTail">;
  /** What it will measure. */
  finished: Measurements;
}

const upTo = (value: number, multiple: number) => Math.ceil(value / multiple) * multiple;
const half = (cm: number) => Math.round(cm * 2) / 2;

/**
 * The rest of a size graded for a tension from a yoke part knitted, after
 * the last round of one of its bands.
 *
 * - **The bands still to come** are knitted while the yoke has the depth for
 *   them, within a centimetre and a half; one it has not is left out, the
 *   last first. Rounds over go before the bands' increase rounds, up to two
 *   each, and then below the last, as in a size graded from the neck.
 * - **Their counts** follow the same cone from the neck, read where each
 *   begins, from the count on the needles to the count the divide wants at
 *   the tension - never fewer than are there: a yoke is not decreased.
 * - **The divide.** Stitches the yoke has over what the tension wants, or
 *   under, are shared between the body and the sleeves.
 * - **The body and sleeves** are as long as the size's at the tension, the
 *   body less whatever the yoke is deeper by.
 */
export const gradeOn = (m: Measurements, gauge: Gauge, knitted: Knitted): GradedOn => {
  const w = widths(m, gauge, "fitted");
  // Every round from the cast-on to the divide, the cast-on with them.
  const depth = Math.round(m.yokeDepthCm * gauge.rounds) + 1;
  // From the neck itself, as a size graded whole: a first increase round straight after the rib and a plain round, before any band.
  const fromNeck = knitted.done === 0;
  const worked = knitted.worked + (fromNeck ? 2 : 0);
  const left = depth - worked;
  const slack = Math.round(1.5 * gauge.rounds);

  const coming = bands.map((_band, index) => index).slice(knitted.done);
  const kept: number[] = [];
  let needed = 0;
  for (const band of coming) {
    if (needed + 1 + bands[band].rounds > left + slack) break;
    needed += 1 + bands[band].rounds;
    kept.push(band);
  }
  const dropped = coming.slice(kept.length);
  let spare = left - needed;
  const deeper = Math.max(0, -spare);
  const plain = kept.map(() => 0);
  for (let pass = 0; pass < 2; pass++) {
    for (let at = 0; at < kept.length && spare > 0; at++) {
      plain[at] += 1;
      spare -= 1;
    }
  }
  const pad = Math.max(0, spare);

  // The count the yoke ends on: what the divide wants, on the last band's repeat, and no fewer than are on the needles.
  const last = kept[kept.length - 1];
  const yoke = last === undefined ? knitted.count : Math.max(upTo(knitted.count, bands[last].repeat), nearest(w.yoke, bands[last].repeat));
  const reach = depth * 0.6;
  let round = worked;
  let count = knitted.count;
  let first: number | undefined;
  const to = kept.map((band, at) => {
    round += plain[at] + 1;
    const { repeat, rounds } = bands[band];
    const wanted = knitted.neck + (yoke - knitted.neck) * Math.min(1, round / reach);
    const next = band === last ? yoke : Math.min(Math.max(nearest(wanted, repeat), upTo(count, repeat)), Math.floor(yoke / repeat) * repeat);
    if (next < count) throw new Error(`fitted: ${bands[band].name} has no count between ${count} and ${yoke}`);
    // The first increase round takes the neck half way, in ratio, to the first band's count, so that no single round has to do more than about half again.
    if (fromNeck && at === 0) {
      first = nearest(Math.sqrt(count * next), 4);
      if (first <= count || first >= next) throw new Error(`fitted: no first increase between ${count} and ${next}`);
      count = first;
    }
    if (next > 2 * count) throw new Error(`fitted: the increase before ${bands[band].name} more than doubles`);
    round += rounds;
    count = next;
    return next;
  });

  // The divide: what the yoke has over what the tension wants, or under it, shared between the body and the sleeves.
  const over = yoke - w.yoke;
  const body = Math.abs(over) > 0.02 * w.yoke ? nearest((w.body * yoke) / w.yoke, 4) : w.body;
  const across = (body - 2 * w.underarm) / 2;
  const sleeve = (yoke - 2 * across) / 2;
  if (across % 2 !== 0 || !Number.isInteger(sleeve) || sleeve < 2) throw new Error(`fitted: ${yoke} stitches can't be divided evenly for the body and sleeves`);
  const top = sleeve + w.underarm;
  const cuff = w.cuff;
  const { bodyRounds, firstDecrease, decreases, sleeveTail, sleeveRounds, bodyTotal } = lengths(m, gauge, top, cuff, "fitted", deeper);
  return {
    ...(first === undefined ? {} : { first }),
    bands: kept.map((band, at) => ({ band, plain: plain[at], to: to[at] })),
    dropped,
    pad,
    yoke,
    over,
    deeper,
    below: { back: across, front: across, sleeve, underarm: w.underarm, bodyRounds, firstDecrease, decreases, sleeveTail },
    finished: {
      chestCm: half(body / gauge.stitches),
      neckCm: half(knitted.neck / gauge.stitches),
      yokeDepthCm: half((worked + needed + plain.reduce((a, b) => a + b, 0) + pad - 1) / gauge.rounds),
      bodyLengthCm: half(bodyTotal / gauge.rounds),
      upperArmCm: half(top / gauge.stitches),
      sleeveLengthCm: half(sleeveRounds / gauge.rounds),
      cuffCm: half(cuff / gauge.stitches),
    },
  };
};

/** The bands' names, as the grading knows them, in order. */
export const bandNames = bands.map((band) => band.name);
/** The rounds each band has, in order. */
export const bandRounds = bands.map((band) => band.rounds);
