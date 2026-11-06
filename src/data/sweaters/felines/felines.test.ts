import { describe, expect, it } from "vitest";
import { buildSweater } from "../../../knitting/engine";
import { consumption } from "../../../types/StitchType";
import raglan from "../feline-raglan";
import yoke from "../feline-yoke";
import { measured } from "../wool-week/strips/design";
import { type Knitted, countsOf, cuffBandOf, felineOn, gauge, knit } from "./knit";
import { cuffFeline, hemCreature, neckBands } from "./motifs";
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
          // All five; but the right one's right foot, lost under glare in the photograph and drawn shorter by eye, has room for four when small.
          if (id === "right" && f === 1) expect(level.length).toBeGreaterThanOrEqual(4);
          else expect(level.length).toBe(5);
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
  it("draws the hem's creature 40 stitches by 35 rows, in the band's red, gold and cream", () => {
    expect(hemCreature.length).toBe(35);
    expect(hemCreature.every((row) => row.length === 40)).toBe(true);
    expect(new Set(hemCreature.join(""))).toEqual(new Set([".", "G", "c"]));
  });

  it("mirrors the creature's upper half for its lower, but for its tail", () => {
    // The body's middle is between rows 15 and 16; the tail is in stitches 29 to 37.
    for (let r = 1; r <= 11; r++) expect(hemCreature[15 + r - 1].slice(0, 29), `row ${15 + r}`).toBe(hemCreature[16 - r - 1].slice(0, 29));
  });

  it("draws the cuff's feline 30 stitches by 32 rows", () => {
    expect(cuffFeline.length).toBe(32);
    expect(cuffFeline.every((row) => row.length === 30)).toBe(true);
  });

  it("goes round a cuff in whole repeats of the feline and its gap, near a quarter more than the cuff", () => {
    for (const size of measured) {
      const cuff = countsOf(size.finished).cuff;
      const band = cuffBandOf(cuff);
      expect(band.count % band.repeats).toBe(0);
      expect(band.count / band.repeats - cuffFeline[0].length).toBeGreaterThanOrEqual(2);
      expect(Math.abs(band.count - cuff * 1.25)).toBeLessThan(10);
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

    it("runs a band of squared spirals round the neck as deep as the waist's, every spiral whole in every round of it", () => {
      const band = knitted.trim.band;
      expect(band).toBe(neckBands[design.id === yoke.id ? "yoke" : "raglan"]);
      expect(band.rows.length).toBe(hemCreature.length);
      const built = buildSweater(design, size.id);
      const gold = built.rounds.filter((round, i) => built.roundPieces[i] === "yoke" && round.some((id) => built.stitches[id].slot === "D"));
      const goldRows = band.rows.filter((row) => row.ground === "G" || row.spirals);
      expect(gold.length).toBe(goldRows.length);
      // Every spiral whole: found by its top row, and its stitches followed down the knitting - each to the stitch worked into it - reading the spiral's rows all the way to its foot, so no increase comes in it.
      const slotOf: Record<string, string> = { ".": "B", G: "D" };
      const below = new Map<number, number>();
      for (const stitch of built.stitches) if (stitch.type !== "m1" && consumption[stitch.type] === 1 && stitch.links.length) below.set(stitch.links[0], stitch.id);
      const w = band.spiral[0].length;
      const tiers = new Map<number, number>();
      goldRows.forEach((line, k) => {
        if (!line.spirals || line.spirals.row > 0) return;
        const round = gold[k];
        const n = round.length;
        let whole = 0;
        for (let at = 0; at < n; at++) {
          let ids = Array.from({ length: w }, (_, x) => round[(at + x) % n]);
          const read = (ids: number[]) => ids.map((id) => built.stitches[id]?.slot ?? "").join("");
          const drawn = (r: number) => [...band.spiral[r]].map((ch) => slotOf[ch]).join("");
          const mirrored = read(ids) !== drawn(0);
          const as = (r: number) => (mirrored ? [...drawn(r)].reverse().join("") : drawn(r));
          if (read(ids) !== as(0)) continue;
          let ok = true;
          for (let r = 1; r < band.spiral.length && ok; r++) {
            ids = ids.map((id) => below.get(id) ?? -1);
            ok = read(ids) === as(r);
          }
          if (ok) whole++;
        }
        tiers.set(line.spirals.tier, whole);
        // A round yoke's rows of spirals go round a whole number of pairs of them.
        if (design.id === yoke.id) expect(n % (2 * (w + band.gap))).toBe(0);
      });
      for (const whole of tiers.values()) expect(whole).toBeGreaterThanOrEqual(4);
      // A raglan's band is a square frame seen from above: through its spirals each line grows a stitch either side every round, at forty-five degrees.
      if (design.id === raglan.id) {
        const spiralRounds = gold.filter((_round, k) => goldRows[k].spirals);
        spiralRounds.slice(1).forEach((round, k) => expect(round.length - spiralRounds[k].length).toBe(8));
      }
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
      const lastRound = c.bodyRounds - (placed.band ? hemCreature.length : 6) - placed.below - 1;
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
