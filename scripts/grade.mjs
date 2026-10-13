/**
 * Grade a top-down yoke: turn each size's target measurements into the
 * stitch and round counts its pattern prints.
 *
 *     node scripts/grade.mjs
 *
 * Prints a table to paste into the design file, where it is reviewed and
 * committed. The table, not this script, is the pattern: the tests replay
 * every number in it, and check that the measurements it was graded to
 * really are what it knits up to. Rerun this only to regrade.
 *
 * The structure it grades is the design's own (src/data/sweaters/
 * simmer-dim.ts): a ribbed neck and a first increase round straight after
 * it, then five bands each preceded by an increase round, then plain rounds
 * to the depth of the yoke; a body with an echo of the small peerie above its
 * hem; sleeves decreasing from the upper arm to the cuff, with the same echo
 * above it.
 */

const gauge = { stitches: 2.8, rounds: 3.2 }; // per centimetre

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
const sizes = [
  { id: "xs", label: "XS", toFit: 76, chest: 86, neck: 44, yoke: 19, body: 35, arm: 29, sleeve: 43, cuff: 19 },
  { id: "s", label: "S", toFit: 86, chest: 96, neck: 45, yoke: 20, body: 36, arm: 31, sleeve: 44, cuff: 19.5 },
  { id: "m", label: "M", toFit: 96, chest: 106, neck: 46, yoke: 21, body: 37, arm: 33, sleeve: 45, cuff: 20 },
  { id: "l", label: "L", toFit: 106, chest: 116, neck: 47, yoke: 22, body: 38, arm: 35.5, sleeve: 46, cuff: 21 },
  { id: "xl", label: "XL", toFit: 116, chest: 126, neck: 48, yoke: 23, body: 39, arm: 38, sleeve: 47, cuff: 22 },
  { id: "2xl", label: "2XL", toFit: 126, chest: 136, neck: 49, yoke: 24, body: 40, arm: 41, sleeve: 47, cuff: 23 },
  { id: "3xl", label: "3XL", toFit: 136, chest: 146, neck: 50, yoke: 25, body: 41, arm: 44, sleeve: 48, cuff: 24 },
  { id: "4xl", label: "4XL", toFit: 146, chest: 156, neck: 51, yoke: 26, body: 42, arm: 47, sleeve: 48, cuff: 25 },
];

const nearest = (value, multiple) => Math.max(multiple, Math.round(value / multiple) * multiple);

const grade = (size) => {
  const neck = nearest(size.neck * gauge.stitches, 4);
  const body = nearest(size.chest * gauge.stitches, 4);
  /*
   * The underarm: about four per cent of the body, and even, so a sleeve
   * can begin at its middle. Smaller than Elizabeth Zimmermann's eight per
   * cent, as modern top-down yokes are.
   */
  const underarm = Math.min(20, Math.max(8, nearest(body * 0.04, 2)));
  const half = (body - 2 * underarm) / 2;
  if (half % 2 !== 0) throw new Error(`${size.id}: the back will not split at its middle`);
  /*
   * The sleeve's top, near its target, even, and such that the yoke - the
   * body's front and back plus both sleeves' held stitches - is a whole
   * number of Border II's repeats.
   */
  let top;
  for (const step of [0, 2, -2, 4, -4, 6, -6]) {
    const candidate = nearest(size.arm * gauge.stitches, 2) + step;
    if ((body + 2 * candidate - 4 * underarm) % 12 === 0) {
      top = candidate;
      break;
    }
  }
  const sleeve = top - underarm;
  const yoke = 2 * half + 2 * sleeve;

  /*
   * Where the rounds go. The yoke's depth is measured at the front from the
   * cast-on. After the rib comes a first increase round and at least one
   * plain round; whatever the bands and their own increase rounds then leave
   * is spent on plain rounds - up to two before each band's increase round
   * where there is room, then the rest below the last band.
   */
  const depth = Math.round(size.yoke * gauge.rounds);
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
  const at = [];
  let round = neckRib + 1;
  bands.forEach((band, index) => {
    round += plain[index] + 1;
    at.push(round);
    round += band.rounds;
  });
  const reach = depth * 0.6;
  const wanted = bands.map((band, index) =>
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

  /* The body: from the dividing round to the bind-off. */
  const bodyTotal = Math.round(size.body * gauge.rounds);
  const bodyRounds = bodyTotal - 1 - echo - hemRib - bindOff;

  /* The sleeve: pick-up round, decreases, echo, cuff. */
  const cuff = nearest(size.cuff * gauge.stitches, 4);
  const decreases = (top - cuff) / 2;
  if (!Number.isInteger(decreases)) throw new Error(`${size.id}: the cuff is not even`);
  const sleeveTotal = Math.round(size.sleeve * gauge.rounds);
  const shaped = sleeveTotal - 1 - echo - cuffRib - bindOff;
  /*
   * Decreases from eight rounds below the pick-up to eight above the echo,
   * as evenly as whole rounds allow: so many every n rounds, then the rest
   * every n - 1, as a pattern writes it.
   */
  const firstDecrease = 8;
  const sleeveTail = 8;
  const room = shaped - firstDecrease - sleeveTail;
  const every = Math.floor(room / decreases);
  if (every < 2) throw new Error(`${size.id}: the sleeve decreases too fast`);
  const longer = room - every * decreases;
  const decreaseRounds = [
    ...(longer > 0 ? [{ every: every + 1, times: longer }] : []),
    { every, times: decreases - longer },
  ];
  return {
    id: size.id,
    label: size.label,
    toFitChestCm: size.toFit,
    finished: {
      chestCm: size.chest,
      neckCm: size.neck,
      yokeDepthCm: size.yoke,
      bodyLengthCm: size.body,
      upperArmCm: size.arm,
      sleeveLengthCm: size.sleeve,
      cuffCm: size.cuff,
    },
    grade: {
      neck,
      first,
      incs,
      plain,
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

const graded = sizes.map(grade);
for (const size of graded) {
  const g = size.grade;
  console.error(
    `${size.label.padEnd(4)} neck ${g.neck}  incs ${g.first} ${g.incs.join(" ")}  ` +
      `plain ${g.plain.join("")}+${g.pad}  divide ${g.back}/${g.sleeve}/${g.front}/${g.sleeve} ` +
      `u${g.underarm}  body ${g.back + g.front + 2 * g.underarm}  ` +
      `sleeve ${g.sleeve + g.underarm} -> ` +
      `${g.sleeve + g.underarm - 2 * g.decreases.reduce((t, d) => t + d.times, 0)} ` +
      `(dec ${g.decreases.map((d) => `${d.times}x${d.every}`).join(" + ")})`,
  );
}
console.log(JSON.stringify(graded, null, 2));
