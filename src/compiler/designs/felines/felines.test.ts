import { describe, expect, it } from "vitest";
import { buildSweater } from "../../engine/engine";
import { kinds } from "../../../pattern/kinds";
import raglan from "../feline-raglan";
import yoke from "../feline-yoke";
import { measured } from "../wool-week/strips/design";
import { type Knitted, countsOf, cuffBandOf, felineOn, gauge, knit } from "./knit";
import { cuffBand, cuffCreature, hemBand, hemCreature, hemGap, mirrored, neckBands, sleeveFeline } from "./motifs";
import { CREAM, GROUND, RED, drawFeline } from "./raster";
import model from "./model.json";

/** Groups of cells of one code, touching at edges or corners, within a part of a grid. */
const groups = (grid: number[][], code: number, rows: [number, number], cols: [number, number]): number => {
  const seen = new Set<string>();
  let n = 0;
  for (let r = rows[0]; r < rows[1]; r++)
    for (let c = cols[0]; c < cols[1]; c++) {
      if (grid[r][c] !== code || seen.has(`${r},${c}`)) continue;
      n++;
      const stack = [[r, c]];
      seen.add(`${r},${c}`);
      while (stack.length) {
        const [y, x] = stack.pop()!;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const [yy, xx] = [y + dy, x + dx];
            if (yy < rows[0] || yy >= rows[1] || xx < cols[0] || xx >= cols[1] || grid[yy][xx] !== code || seen.has(`${yy},${xx}`)) continue;
            seen.add(`${yy},${xx}`);
            stack.push([yy, xx]);
          }
      }
    }
  return n;
};

describe("the felines, drawn at a size", () => {
  for (const id of ["left", "right"] as const) {
    for (const width of [108, 126, 142, 164]) {
      const { grid, height } = drawFeline(id, width, gauge);
      const [x0, y0, x1, y1] = model[id].box;
      // Where on the drawing a part of the model is: its stitch and row.
      const at = ([x, y]: number[]) => [Math.floor(((x - x0) * width) / (x1 - x0)), Math.floor(((y - y0) * height) / (y1 - y0))];

      it(`draws the ${id} one ${width} stitches wide as tall as its picture is, a stitch being wider than a row is tall`, () => {
        expect(grid.length).toBe(height);
        expect(grid.every((row) => row.length === width)).toBe(true);
        expect(height).toBe(Math.round(((y1 - y0) * width * gauge.rounds) / ((x1 - x0) * gauge.stitches)));
        // Red, the ground and the cream, and nothing else.
        expect(new Set(grid.flat())).toEqual(new Set([GROUND, RED, CREAM]));
      });

      it(`gives the ${id} one's hands their claws, alike, apart: four where there is room, as on the tunic`, () => {
        for (const hand of model[id].hands) {
          const xs = hand.flat().map((p) => at(p)[0]);
          const ys = hand.flat().map((p) => at(p)[1]);
          const rows: [number, number] = [Math.min(...ys) - 1, Math.max(...ys) + 2];
          const cols: [number, number] = [Math.max(0, Math.min(...xs) - 2), Math.min(width, Math.max(...xs) + 3)];
          // Each a chevron of its own, never run into the next; all four at the larger sizes, three where a hand is small.
          const n = groups(grid, CREAM, rows, cols);
          expect(n).toBeGreaterThanOrEqual(width >= 120 ? 4 : 3);
          expect(n).toBeLessThanOrEqual(4);
        }
      });

      it(`nests the ${id} one's feet's claws five deep, a stitch of cream and one of red`, () => {
        model[id].feet.forEach((foot, f) => {
          // The rows of the foot with a level run of cream three or more stitches long: one for each claw, a row of red between each two.
          const ys = foot.flat().map((p) => at(p)[1]);
          const level: number[] = [];
          for (let r = Math.min(...ys) - 1; r <= Math.max(...ys) + 1; r++) {
            // The half of the foot nearer its back, where every claw runs level.
            const [tipX, backX] = [at(foot[0][1])[0], at(foot[0][3])[0]];
            const middle = Math.round((tipX + backX) / 2);
            const row = grid[r].slice(Math.min(middle, backX), Math.max(middle, backX) + 1);
            if (row.some((v, i) => v === CREAM && row[i + 1] === CREAM && row[i + 2] === CREAM)) level.push(r);
          }
          expect(level.length, `foot ${f}`).toBe(5);
          level.slice(1).forEach((r, i) => expect(r - level[i]).toBe(2));
        });
      });

      it(`keeps every claw of the ${id} one on red: no claw stitch beside the ground`, () => {
        for (const part of [...model[id].hands, ...model[id].feet]) {
          const xs = part.flat().map((p) => at(p)[0]);
          const ys = part.flat().map((p) => at(p)[1]);
          for (let r = Math.min(...ys); r <= Math.max(...ys); r++)
            for (let c = Math.max(0, Math.min(...xs)); c <= Math.min(width - 1, Math.max(...xs)); c++) {
              if (grid[r]?.[c] !== CREAM) continue;
              for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) expect(grid[r + dr]?.[c + dc], `${r},${c}`).not.toBe(GROUND);
            }
        }
      });
    }
  }
});

describe("the small motifs", () => {
  it("draws the hem's creature 36 stitches by 23 rows, in the band's red, gold and cream", () => {
    expect(hemCreature.length).toBe(23);
    expect(hemCreature.every((row) => row.length === 36)).toBe(true);
    expect(new Set(hemCreature.join(""))).toEqual(new Set([".", "G", "c"]));
    // It fills its picture: gold in its first stitch and its last, cream in its first row and its last.
    expect(hemCreature.some((row) => row[0] === "G")).toBe(true);
    expect(hemCreature.some((row) => row[35] === "G")).toBe(true);
    expect(hemCreature[0]).toContain("c");
    expect(hemCreature[22]).toContain("c");
  });

  it("gives the creature's front feet three claws each, a row of red between them, and its hind feet three tipped toes", () => {
    const column = (x: number) => hemCreature.map((row) => row[x]).join("");
    // The claws stand ahead of the feet, one stitch each, in every other row: the upper foot's, then the lower's.
    expect(column(7).slice(0, 5)).toBe("c.c.c");
    expect(column(7).slice(18)).toBe("c.c.c");
    for (const [tips, toes] of [[0, 1], [22, 21]]) {
      expect(hemCreature[tips].replace(/[^c]/g, "").length - 1).toBe(3);
      // Each tip is the end of a toe of gold, red between it and the next.
      [...hemCreature[tips]].forEach((ch, x) => {
        if (ch !== "c" || x === 7) return;
        expect(hemCreature[toes][x]).toBe("G");
        expect(hemCreature[toes][x + 1] ?? ".").toBe(".");
        expect(hemCreature[toes][x - 1]).toBe(".");
      });
    }
  });

  it("gives the creature a face - two eyes and a mouth between them, nearer its body - and no third yarn in a round but for them and its claws", () => {
    // Between its feet: rows 6 to 18 of its 23.
    const cream = hemCreature.flatMap((row, r) => [...row].flatMap((ch, x) => (ch === "c" && r > 4 && r < 18 ? [[x, r]] : [])));
    expect(cream).toEqual([[7, 9], [9, 10], [9, 11], [9, 12], [7, 13]]);
    // Every cream stitch of its face has gold all round it.
    for (const [x, r] of cream) for (const [dx, dy] of [[1, 0], [-1, 0]]) expect(hemCreature[r + dy][x + dx]).toBe("G");
  });

  it("lays the hem band 35 rows deep: the creatures on its red, and under them the tunic's two gold lines", () => {
    expect(hemBand.length).toBe(35);
    const first = hemBand.findIndex((row) => row.creature !== undefined);
    expect(hemBand.slice(0, first).map((row) => row.ground).join("")).toBe("..");
    expect(hemBand.slice(first, first + hemCreature.length).map((row) => `${row.ground}${row.creature}`)).toEqual(hemCreature.map((_row, r) => `.${r}`));
    // Four rounds of gold, two of red, two of gold, and a round of red before the rib.
    expect(hemBand.slice(first + hemCreature.length).map((row) => row.ground).join("")).toBe(".GGGG..GG.");
    expect(hemBand.slice(first + hemCreature.length).every((row) => row.creature === undefined)).toBe(true);
  });

  it("draws the sleeves' feline 36 stitches by 44 rows, red and cream on the ground, lying with its head to the left", () => {
    expect(sleeveFeline.length).toBe(44);
    expect(sleeveFeline.every((row) => row.length === 36)).toBe(true);
    expect(new Set(sleeveFeline.join(""))).toEqual(new Set(["o", ".", "c"]));
    // It fills its picture: red in its first stitch and its last, its first row and its last.
    const column = (x: number) => sleeveFeline.map((row) => row[x]).join("");
    expect(column(0)).toContain(".");
    expect(column(35)).toContain(".");
    expect(sleeveFeline[0]).toContain(".");
    expect(sleeveFeline[43]).toContain(".");
    // Its head is at the left: its ears' whites in its second stitch, two rows each, and nothing but its head and the lobes beside it in its first nine.
    expect([...column(1)].flatMap((ch, r) => (ch === "c" ? [r] : []))).toEqual([16, 17, 23, 24]);
    for (let x = 0; x < 9; x++) expect(column(x).slice(0, 7) + column(x).slice(31), `stitch ${x}`).toBe("o".repeat(20));
    // Its body runs the length of it, from the chin to the foot: its four middle rows whole.
    for (const r of [16, 17, 18, 19]) expect(sleeveFeline[r].slice(9, 36), `row ${r}`).toBe(".".repeat(27));
  });

  it("gives the sleeves' feline three claws to a hand, a row of red between them, and two stripes to a foot", () => {
    const column = (x: number) => sleeveFeline.map((row) => row[x]).join("");
    // The hands' tops are its eleventh stitch: a claw in every other row of each hand.
    expect([...column(10)].flatMap((ch, r) => (ch === "c" ? [r] : []))).toEqual([8, 10, 12, 24, 26, 28]);
    for (const r of [9, 11, 25, 27]) expect(sleeveFeline[r][10], `row ${r}`).toBe(".");
    // A foot's stripes run with the sleeve, one stitch of cream each and a stitch of red between: stitches 22 and 24, counted from 1.
    for (const [from, to] of [[4, 8], [29, 33]]) {
      for (let r = from; r < to; r++) expect(sleeveFeline[r].slice(20, 25), `row ${r}`).toBe(".c.c.");
    }
  });

  it("gives the sleeves' feline a face of the ground's colour: two eyes, a nose between them, and a mouth of teeth", () => {
    // The face is stitches 4 to 9, rows 16 to 24, counted from 1 - nine rows by six stitches of ground, but for these.
    const face = sleeveFeline.slice(15, 24).map((row) => row.slice(3, 9));
    expect(face).toEqual([
      "oooooo",
      "ocoooo", // an eye, two rows
      "ococco", // and the mouth's end: a tooth, and its lip
      "ooooco",
      "o.occo", // the nose, a tooth
      "ooooco",
      "ococco", // the other eye; a tooth
      "ocoooo",
      "oooooo",
    ]);
  });

  it("turns the hem's creature half round for the cuffs, and lays the cuff band 37 rows deep over the tunic's lines there", () => {
    expect(cuffCreature).toEqual(mirrored([...hemCreature].reverse()));
    expect(mirrored(mirrored(cuffCreature))).toEqual(cuffCreature);
    // It runs to the right, its tail's curl above it.
    expect(cuffCreature[0].slice(0, 7)).toBe(".GGGGG.");
    expect(cuffBand.length).toBe(37);
    const first = cuffBand.findIndex((row) => row.creature !== undefined);
    expect(cuffBand.slice(0, first).map((row) => row.ground).join("")).toBe("..");
    expect(cuffBand.slice(first, first + cuffCreature.length).map((row) => `${row.ground}${row.creature}`)).toEqual(cuffCreature.map((_row, r) => `.${r}`));
    // A round of red, four of gold, three of red, four of gold; the red rib is next.
    expect(cuffBand.slice(first + cuffCreature.length).map((row) => row.ground).join("")).toBe(".GGGG...GGGG");
  });

  it("goes round a cuff in whole repeats of the creature and the red between it and the next, near a quarter more than the cuff", () => {
    for (const size of measured) {
      const cuff = countsOf(size.finished).cuff;
      const band = cuffBandOf(cuff);
      expect(band.count % band.repeats).toBe(0);
      expect(band.count / band.repeats - cuffCreature[0].length).toBeGreaterThanOrEqual(hemGap);
      expect(Math.abs(band.count - cuff * 1.25)).toBeLessThan(10);
      // And leaves each of the sleeve's two felines room in its half of the round.
      expect(band.count / 2 - sleeveFeline[0].length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe.each([raglan, yoke].map((design) => [design.id, design] as const))("%s", (_, design) => {
  describe.each(measured.map((size) => [size.id, size] as const))("size %s", (__, size) => {
    const knitted = (design.sizes.find((s) => s.id === size.id) as unknown as { knitted: () => Knitted }).knitted();
    const { counts: c, placed } = knitted;

    it("comes out at the measurements it is graded to, within a centimetre", () => {
      const cm = (stitches: number) => stitches / gauge.stitches;
      expect(Math.abs(cm(c.body) - size.finished.chestCm)).toBeLessThan(1);
      expect(Math.abs(cm(c.upperArm) - size.finished.upperArmCm)).toBeLessThan(1);
      expect(Math.abs(cm(c.cuff) - size.finished.cuffCm)).toBeLessThan(1);
      // A raglan shares its neck out to its four panels, so its neck may be a stitch or two off.
      expect(Math.abs(cm(knitted.checks.neck) - size.finished.neckCm)).toBeLessThan(2);
    });

    it("draws the felines as wide as most of the front, a margin either side", () => {
      expect(placed.width).toBeLessThanOrEqual(c.half - 4);
      expect(placed.width).toBeGreaterThan(0.54 * c.half);
    });

    it("sets each feline midway between the neck's trim and the waist's, a row either way", () => {
      expect(Math.abs(placed.above - placed.below)).toBeLessThanOrEqual(1);
      expect(placed.above).toBeGreaterThanOrEqual(2);
    });

    it("raises the back of the neck with short rows in the red of the band's first rounds, which they run on into", () => {
      const built = buildSweater(design, size.id);
      const yokeRounds = built.rounds.flatMap((round, i) => (built.roundPieces[i] === "yoke" ? [{ round, kind: built.roundKinds[i] }] : []));
      // The yoke's only rows that are not rounds: three pairs of short rows and the row that knits on to the end of the round.
      const rows = yokeRounds.filter(({ kind }) => kind !== "round");
      expect(rows.length).toBe(7);
      const slots = (round: number[]) => new Set(round.map((id) => built.stitches[id].slot));
      for (const { round } of rows) expect(slots(round)).toEqual(new Set(["B"]));
      // Above them the rib, and under them the band's first three rounds, in the same red; then the band's gold.
      const last = yokeRounds.lastIndexOf(rows[rows.length - 1]);
      const first = yokeRounds.indexOf(rows[0]);
      expect(slots(yokeRounds[first - 1].round)).toEqual(new Set(["B"]));
      expect(knitted.trim.from).toBe(0);
      expect(knitted.trim.band.rows.slice(0, 4).map((row) => row.ground).join("")).toBe("...G");
      for (const { round } of yokeRounds.slice(last + 1, last + 4)) expect(slots(round)).toEqual(new Set(["B"]));
      expect(slots(yokeRounds[last + 4].round)).toEqual(new Set(["D"]));
    });

    it("runs a band of squared spirals round the neck as deep as the waist's, every spiral whole in every round of it", () => {
      const band = knitted.trim.band;
      expect(band).toBe(neckBands[design.id === yoke.id ? "yoke" : "raglan"]);
      expect(band.rows.length).toBe(hemBand.length);
      const built = buildSweater(design, size.id);
      const gold = built.rounds.filter((round, i) => built.roundPieces[i] === "yoke" && round.some((id) => built.stitches[id].slot === "D"));
      const goldRows = band.rows.filter((row) => row.ground === "G" || row.spirals);
      expect(gold.length).toBe(goldRows.length);
      // Every spiral whole: found by its top row, and its stitches followed down the knitting - each to the stitch worked into it - reading the spiral's rows all the way to its foot, so no increase comes in it.
      const slotOf: Record<string, string> = { ".": "B", G: "D" };
      const below = new Map<number, number>();
      for (const stitch of built.stitches) if (stitch.type !== "m1" && kinds[stitch.type].takes === 1 && stitch.links.length) below.set(stitch.links[0], stitch.id);
      const tiers = new Map<number, number>();
      goldRows.forEach((line, k) => {
        if (!line.spirals || line.spirals.row > 0) return;
        const spiral = band.spirals[line.spirals.tier];
        const w = spiral[0].length;
        const round = gold[k];
        const n = round.length;
        let whole = 0;
        for (let at = 0; at < n; at++) {
          let ids = Array.from({ length: w }, (_, x) => round[(at + x) % n]);
          const read = (ids: number[]) => ids.map((id) => built.stitches[id]?.slot ?? "").join("");
          const drawn = (r: number) => [...spiral[r]].map((ch) => slotOf[ch]).join("");
          const mirrored = read(ids) !== drawn(0);
          const as = (r: number) => (mirrored ? [...drawn(r)].reverse().join("") : drawn(r));
          if (read(ids) !== as(0)) continue;
          let ok = true;
          for (let r = 1; r < spiral.length && ok; r++) {
            ids = ids.map((id) => below.get(id) ?? -1);
            ok = read(ids) === as(r);
          }
          if (ok) whole++;
        }
        tiers.set(line.spirals.tier, whole);
        // A round yoke's rows of spirals each go round a whole, even number of them and their gaps, every one whole.
        if (design.id === yoke.id) {
          expect(n % (w + band.gap)).toBe(0);
          expect((n / (w + band.gap)) % 2).toBe(0);
          expect(whole).toBe(n / (w + band.gap));
        }
      });
      for (const whole of tiers.values()) expect(whole).toBeGreaterThanOrEqual(4);
      // A round yoke's spirals go round in rays: as many in every row.
      if (design.id === yoke.id) expect(new Set(tiers.values()).size).toBe(1);
      // A raglan's band is a square frame seen from above: through its spirals each line grows a stitch either side every round, at forty-five degrees.
      if (design.id === raglan.id) {
        gold.forEach((round, k) => {
          const [was, now] = [goldRows[k - 1]?.spirals, goldRows[k].spirals];
          if (was && now && was.tier === now.tier) expect(round.length - gold[k - 1].length).toBe(8);
          // Each line is two stitches climbing its marker, the KBF's new stitch before it and the KFB after, with nothing between: both the corner's diagonal, alike.
          if (!now || !was) return;
          const types = round.map((id) => built.stitches[id].type);
          const lines = types.flatMap((type, j) => (type === "m1" && types[j - 1] === "kbf" && types[j + 1] === "kfb" ? [j] : []));
          expect(lines.length, `row ${k}`).toBe(4);
          for (const j of lines) expect(built.stitches[round[j]].slot, `row ${k}`).toBe(built.stitches[round[j + 1]].slot);
        });
      }
    });

    it("lays two of the small felines across each sleeve just above its cuff band, one following the other round it, the left sleeve's the right one's in a mirror, the sleeve tapering through them", () => {
      const built = buildSweater(design, size.id);
      const { from, count, to, apart } = knitted.sleeveFelines;
      expect(apart).toBeGreaterThanOrEqual(1);
      // They end at the band's count - or, on the narrowest band, a decrease short of it: there the last would leave them no room beside the underarm, and waits for the plain rounds after them.
      expect(to - knitted.cuffBand.count === 0 || (to - knitted.cuffBand.count === 2 && to / 2 - apart - sleeveFeline[0].length === 2)).toBe(true);
      const slotOf: Record<string, string> = { o: "A", ".": "B", c: "C" };
      const w = sleeveFeline[0].length;
      const taper = c.sleeveRounds - 1 - cuffBand.length - 1;
      const roundsOf = (piece: string) => built.rounds.filter((_, i) => built.roundPieces[i] === piece);
      for (const piece of ["sleeve-left", "sleeve-right"]) {
        const rounds = roundsOf(piece);
        // The pick-up round, then the taper's rounds.
        const at = (r: number) => rounds[1 + from + r].map((id) => built.stitches[id]);
        expect(at(0).length, piece).toBe(count);
        expect(at(sleeveFeline.length - 1).length, piece).toBe(to);
        sleeveFeline.forEach((line, r) => {
          // The right sleeve's round as it is knitted; the left sleeve's read backwards, which is the right one's: its mirror image.
          const round = at(r).map((stitch) => stitch.slot);
          if (piece === "sleeve-left") round.reverse();
          const n = round.length;
          /*
           * Two of the one as drawn, the same way round: the first after the
           * middle of the round, the top of the arm, its head towards it -
           * on the front of the right arm, as on the tunic's - and the second
           * before the middle, its tail towards it and its head to the underarm.
           */
          const drawn = [...line].map((ch) => slotOf[ch]).join("");
          expect(round.slice(n / 2 + apart, n / 2 + apart + w).join(""), `${piece} row ${r}`).toBe(drawn);
          expect(round.slice(n / 2 - apart - w, n / 2 - apart).join(""), `${piece} row ${r}, the one following`).toBe(drawn);
          // Nothing but the ground round them, and the round's decreases - if it has them - beside the underarm, in the ground: a k2tog after its first stitch and an ssk before its last, on both sleeves.
          const rest = [...round.slice(0, n / 2 - apart - w), ...round.slice(n / 2 - apart, n / 2 + apart), ...round.slice(n / 2 + apart + w)];
          expect(new Set(rest), `${piece} row ${r}`).toEqual(new Set(["A"]));
          const taken = at(r).flatMap((stitch, j) => (stitch.type === "k2tog" || stitch.type === "ssk" ? [`${stitch.type} ${j}`] : []));
          if (taken.length) expect(taken, `${piece} row ${r}`).toEqual(["k2tog 1", `ssk ${n - 2}`]);
          expect(n === (r ? at(r - 1).length : n) || taken.length === 2, `${piece} row ${r}`).toBe(true);
        });
        // The sleeve never widens on its way down, and comes to its band's count by the band.
        const counts = rounds.slice(1, 1 + taper).map((round) => round.length);
        counts.forEach((n, i) => expect(n, `${piece} round ${i}`).toBeLessThanOrEqual(counts[i - 1] ?? c.upperArm));
        expect(counts[counts.length - 1]).toBe(knitted.cuffBand.count);
        // Three plain rounds of the ground between the felines and the band - one of them the last decrease, where the felines left it no room.
        const band = rounds.findIndex((round) => round.some((id) => built.stitches[id].slot === "D"));
        expect(band - 2 - (1 + from + sleeveFeline.length)).toBe(3);
        for (const round of rounds.slice(1 + from + sleeveFeline.length, 1 + taper)) expect(new Set(round.map((id) => built.stitches[id].slot))).toEqual(new Set(["A"]));
      }
      // The two sleeves are shaped alike, stitch for stitch, and coloured each as the other in a mirror: the felines go round them opposite ways, as the bands' creatures do.
      const [right, left] = [roundsOf("sleeve-right"), roundsOf("sleeve-left")].map((rounds) => rounds.slice(1, 1 + taper).map((round) => round.map((id) => built.stitches[id])));
      expect(left.map((round) => round.map((stitch) => stitch.type))).toEqual(right.map((round) => round.map((stitch) => stitch.type)));
      expect(left.map((round) => round.map((stitch) => stitch.slot))).toEqual(right.map((round) => round.map((stitch) => stitch.slot).reverse()));
      // And each sleeve has a chart of its own for them.
      const charts = knitted.charts.map((chart) => chart.name);
      expect(charts.filter((name) => name === "Right sleeve").length).toBe(1);
      expect(charts.filter((name) => name === "Left sleeve").length).toBe(1);
    });

    it("runs the band's creatures round the two cuffs opposite ways, over the tunic's lines, the left cuff the right one's mirror image", () => {
      const built = buildSweater(design, size.id);
      const taper = c.sleeveRounds - 1 - cuffBand.length - 1;
      const bandOf = (piece: string) =>
        built.rounds
          .filter((_, i) => built.roundPieces[i] === piece)
          .slice(1 + taper, 1 + taper + cuffBand.length)
          .map((round) => round.map((id) => built.stitches[id].slot));
      const [right, left] = [bandOf("sleeve-right"), bandOf("sleeve-left")];
      const { count, repeats } = knitted.cuffBand;
      const slotOf: Record<string, string> = { ".": "B", G: "D", c: "C" };
      const w = cuffCreature[0].length;
      const gap = count / repeats - w;
      expect(right.every((round) => round.length === count)).toBe(true);
      expect(left).toEqual(right.map((round) => [...round].reverse()));
      cuffBand.forEach((line, r) => {
        if (line.creature === undefined) {
          expect(new Set(right[r]), `row ${r}`).toEqual(new Set([slotOf[line.ground]]));
          return;
        }
        // On the right sleeve as on the tunic's: each creature whole, running to the right, the band's red shared either side of it.
        const drawn = [...cuffCreature[line.creature]].map((ch) => slotOf[ch]).join("");
        const repeat = "B".repeat(Math.floor(gap / 2)) + drawn + "B".repeat(Math.ceil(gap / 2));
        expect(right[r].join(""), `row ${r}`).toBe(repeat.repeat(repeats));
      });
      // Then a round of red gathers the band in to the cuff, and the rib is red.
      const after = built.rounds.filter((_, i) => built.roundPieces[i] === "sleeve-right").slice(1 + taper + cuffBand.length);
      expect(new Set(after.flat().map((id) => built.stitches[id].slot))).toEqual(new Set(["B"]));
    });

    it("runs the hem's creatures round the waist nose to tail, every one whole, one under the middle of the front, over the two gold lines", () => {
      if (!placed.band) return;
      const built = buildSweater(design, size.id);
      const body = built.rounds.filter((_round, i) => built.roundPieces[i] === "body");
      const n = 2 * c.half + 2 * c.underarm;
      // The band is the body's last rounds before its rib.
      const band = body.slice(c.bodyRounds - hemBand.length, c.bodyRounds).map((round) => round.map((id) => built.stitches[id].slot));
      expect(band.every((round) => round.length === n)).toBe(true);
      const slotOf: Record<string, string> = { ".": "B", G: "D", c: "C" };
      const first = hemBand.findIndex((row) => row.creature !== undefined);
      const w = hemCreature[0].length;
      const drawn = hemCreature.map((row) => [...row].map((ch) => slotOf[ch]).join(""));
      const at = (r: number, x: number) => Array.from({ length: w }, (_v, k) => band[first + r][(x + k) % n]).join("");
      // Where a creature begins: where all its rows are read, one above the other.
      const starts = Array.from({ length: n }, (_v, x) => x).filter((x) => drawn.every((row, r) => at(r, x) === row));
      expect(starts.length).toBe(Math.floor(n / (w + hemGap)));
      expect(starts).toContain(n / 2 - w / 2);
      starts.forEach((x, k) => expect((starts[(k + 1) % starts.length] - x + n) % n, `after the creature at ${x}`).toBeGreaterThanOrEqual(w + hemGap));
      // Nothing else in their rounds but the band's red: as many stitches of gold and of cream as the creatures have.
      const count = (rows: string[], slot: string) => rows.join("").split(slot).length - 1;
      for (const slot of ["D", "C"]) expect(count(band.slice(first, first + drawn.length).map((round) => round.join("")), slot)).toBe(starts.length * count(drawn, slot));
      // And every other round of the band is its ground's, all the way round.
      hemBand.forEach((row, r) => {
        if (row.creature === undefined) expect(new Set(band[r]), `row ${r}`).toEqual(new Set([slotOf[row.ground]]));
      });
    });

    it("puts the tunic's left feline on the front and its right on the back, upright, centred", () => {
      const built = buildSweater(design, size.id);
      const body = built.rounds.filter((_round, i) => built.roundPieces[i] === "body");
      // The body's rounds from the divide: its first is the felines' row after those in the yoke.
      const front = drawFeline(felineOn.front, placed.width, gauge).grid;
      const back = drawFeline(felineOn.back, placed.width, gauge).grid;
      const n = 2 * c.half + 2 * c.underarm;
      // The feline's row r is the body's round r - inYoke: its last row `below` rounds above the band (or the rib's gap).
      const first = Math.max(0, placed.inYoke);
      const lastRound = c.bodyRounds - (placed.band ? hemBand.length : 6) - placed.below - 1;
      expect(lastRound - (placed.height - 1)).toBe(-placed.inYoke);
      const slotOf = ["A", "B", "C"];
      for (const r of [first, Math.floor((first + placed.height) / 2), placed.height - 1]) {
        const round = body[r - placed.inYoke];
        expect(round.length).toBe(n);
        const slots = round.map((id) => built.stitches[id].slot);
        const left = Math.floor((c.half - placed.width) / 2);
        // The front, between the two underarms.
        const frontAt = c.half / 2 + c.underarm + left;
        expect(slots.slice(frontAt, frontAt + placed.width), `front, row ${r}`).toEqual(front[r].map((v) => slotOf[v]));
        // The back, its left half seen from outside ending the round and its right beginning it.
        const backAt = n - c.half / 2 + left;
        const backRow = Array.from({ length: placed.width }, (_x, x) => slots[(backAt + x) % n]);
        expect(backRow, `back, row ${r}`).toEqual(back[r].map((v) => slotOf[v]));
      }
    });
  });
});

describe("the two constructions", () => {
  it("raises each feline into its yoke, a raglan's and a round one's", () => {
    for (const size of measured) {
      const r = knit(size.finished, "raglan", "t-");
      const y = knit(size.finished, "yoke", "t-");
      expect(r.placed.inYoke).toBeGreaterThan(0);
      expect(y.placed.inYoke).toBeGreaterThan(0);
    }
  }, 60000);
});
