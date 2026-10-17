import type { Chart, RoundSpec, Section, SlotId } from "../types";
import { consumes } from "../types";
import { crownAsIncrease, decreaseEvenly, increaseEvenly, rowsOf } from "../writing";
import { type Block, type Item, type Part, blocks, brim, slotFor } from "./blocks";

/**
 * Grade the sampler: turn each size's measurements into its knitting.
 *
 * Hamefarin's sizes are a table worked out once and committed; the sampler's
 * are worked out here, as the design is loaded, because what a size knits is
 * a packing problem of thirteen hats and the table would be the size of the
 * pattern. It is deterministic, and the tests hold every size to what it
 * says: each count it states, each depth, every year's motifs present.
 *
 * - **Where the years go.** In date order: from 2014 round the yoke, the next
 *   years down the body, the rest down both sleeves. Where the yoke's years
 *   end and the body's begin, and where the body's end, is the size's to
 *   choose: whichever split fits every year's motifs with the most to spare.
 * - **Stitch counts.** Every band is knitted at a whole number of its
 *   repeats: the multiple nearest what the jumper wants there. On the yoke
 *   that grows from the neck to the divide, never back; on the body it stays
 *   near the chest; on a sleeve it tapers from the upper arm to the cuff,
 *   never back. Between two bands at different counts is a plain round that
 *   increases or decreases evenly - the plain round before the band, where
 *   there is one, or one of its own.
 * - **Crowns.** On the yoke a hat's crown, worked from its point (see
 *   writing's crownAsIncrease), is an increase: a slice of it takes the yoke
 *   from one count to a bigger one through the hat's own wedges. On a sleeve,
 *   worked as the hat works it, it is a decrease. Either is cut to what the
 *   size needs there: a whole number of wedges, from the row whose width goes
 *   into the stitches on the needle to the row nearest the count the jumper
 *   wants next.
 * - **Depth.** Each piece's motifs, a plain round between years, and its
 *   ribs, come to less than its depth in rounds in every size; what is left
 *   over is filled with the years' extras, the lowest priority first and the
 *   earliest year first within a priority, as long as each fits; then plain
 *   rounds, shared between the gaps between years, to the exact depth.
 */

export const gauge = { stitches: 3.2, rounds: 3.8 };

export interface Measured {
  chestCm: number;
  neckCm: number;
  yokeDepthCm: number;
  bodyLengthCm: number;
  upperArmCm: number;
  sleeveLengthCm: number;
  cuffCm: number;
}

const nearest = (value: number, multiple: number) => Math.max(multiple, Math.round(value / multiple) * multiple);

/** The most common yarn in a row: the band's ground there. */
const groundOf = (chart: Chart, row: number): SlotId => {
  const counts = new Map<SlotId, number>();
  for (const cell of chart.rows[row]) counts.set(cell.slot, (counts.get(cell.slot) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

/** What a chart row works on the needle, and leaves. */
const works = (chart: Chart, row: number) => chart.rows[row].reduce((sum, cell) => sum + consumes(cell), 0);
const leaves = (chart: Chart, row: number) => chart.rows[row].length;

type Way = "up" | "down" | "level";

/** One piece's rounds as they are laid down, with the stitch count kept as they go. */
class Run {
  specs: RoundSpec[] = [];
  rows = 0;
  charts = new Map<string, Chart>();
  checks: Record<string, number> = {};
  /** How many gaps between years there have been, and the plain rounds each is to have. */
  gaps = 0;
  /** Plain rounds over the one each gap has: the padding, gap by gap. */
  padding: number[] = [];
  /** How many of the rounds so far are padding, which the counts wanted take no notice of. */
  padded = 0;

  /** The count the jumper wants once `ahead` more rounds are knitted. */
  target: (ahead: number) => number = () => this.count;

  constructor(
    public count: number,
    private readonly way: Way,
    readonly limit: { low: number; high: number },
  ) {}

  /** To `to` stitches, in a plain round of `slot`: the last plain round knitted, if there is one just before. */
  shape(to: number, slot: SlotId) {
    if (to === this.count) return;
    const ops = to > this.count ? increaseEvenly(this.count, to) : decreaseEvenly(this.count, to);
    const last = this.specs[this.specs.length - 1];
    if (last?.type === "rounds" && !last.sequence && last.count >= 1) {
      const kept = last.count - 1;
      this.specs.pop();
      if (kept > 0) this.specs.push({ ...last, count: kept });
      this.specs.push({ type: "shaping", slot: last.slot, ops, to });
    } else {
      this.specs.push({ type: "shaping", slot, ops, to });
      this.rows++;
    }
    this.count = to;
  }

  plain(slot: SlotId, rows: number) {
    if (rows <= 0) return;
    const last = this.specs[this.specs.length - 1];
    if (last?.type === "rounds" && last.slot === slot && !last.sequence) {
      this.specs[this.specs.length - 1] = { ...last, count: last.count + rows };
    } else this.specs.push({ type: "rounds", count: rows, slot });
    this.rows += rows;
  }

  /**
   * The count a band of `repeat`, `rows` rounds deep, goes at here: the
   * multiple nearest what is wanted three fifths of the way down it - where
   * most of the band is, on a yoke that is growing under it - never against
   * the piece's way.
   */
  countFor(repeat: number, rows = 0): number {
    const wanted = this.target(rows * 0.6);
    const options: number[] = [];
    for (let n = repeat; n <= this.limit.high + repeat; n += repeat) {
      if (n < this.limit.low || n > this.limit.high) continue;
      if (this.way === "up" && n < this.count) continue;
      // A sleeve may come back up a little for a wide repeat - fifteen per cent - as a hat's body comes up for its widest band.
      if (this.way === "down" && n > this.count * 1.15) continue;
      // One round can at most double the stitches, or take a third of them away.
      if (n > 2 * this.count || 2 * (this.count - n) > this.count) continue;
      options.push(n);
    }
    if (options.length === 0) throw new Error(`no count for a repeat of ${repeat} from ${this.count}`);
    // The count on the needle, if it is a whole number of repeats and near enough what is wanted: no shaping round needed.
    if (options.includes(this.count) && Math.abs(this.count - wanted) <= wanted * 0.05) return this.count;
    return options.reduce((best, n) => (Math.abs(n - wanted) < Math.abs(best - wanted) ? n : best));
  }

  band(chart: Chart) {
    const repeat = works(chart, 0);
    for (let row = 0; row < chart.rows.length; row++) {
      if (works(chart, row) !== leaves(chart, row)) throw new Error(`${chart.id} shapes in row ${row + 1}`);
    }
    this.shape(this.countFor(repeat, chart.rows.length), groundOf(chart, 0));
    this.charts.set(chart.id, chart);
    this.specs.push({ type: "chart", chart: chart.id, rows: [1, chart.rows.length] });
    this.rows += chart.rows.length;
  }

  /**
   * A slice of a crown: up, from its point, as an increase; down, as the hat
   * knits it, as a decrease. Left out where no slice of a whole number of
   * wedges goes from near the count on the needle towards the one wanted.
   */
  crown(crown: Chart, way: "up" | "down") {
    const widths = crown.rows.map((row) => row.length);
    const full = widths[0];
    let best: { from: number; to: number; k: number; start: number; end: number } | undefined;
    for (let to = 2; to <= widths.length; to++) {
      for (let from = 1; from < to; from++) {
        // A slice must shape: rows where the crown narrows, not a band of it.
        if (widths[from - 1] === widths[to - 1]) continue;
        let start: number;
        let end: number;
        let k: number;
        if (way === "up") {
          if (from > 1 && widths[from - 2] === full && widths[from - 1] === full) continue;
          // Worked from row `to`, plain, out to row `from`.
          k = Math.round(this.count / widths[to - 1]);
          start = k * widths[to - 1];
          end = k * widths[from - 1];
        } else {
          if (from < 2) continue;
          // Row `from` works the row below it.
          k = Math.round(this.count / works(crown, from - 1));
          start = k * works(crown, from - 1);
          end = k * widths[to - 1];
        }
        if (k < 2 || Math.abs(start - this.count) > this.count * 0.1) continue;
        // Never against the piece's way, even to start it.
        if (way === "up" ? start < this.count : start > this.count) continue;
        const rows = to - from + 1;
        const wanted = this.target(rows + (start === this.count ? 0 : 1));
        /*
         * Towards the count wanted after it. A crown shapes faster than the
         * jumper does - it halves a hat in a dozen rounds - so a slice may run
         * a fifth past what is wanted on the yoke, a seventh short of it on a
         * sleeve, and the bands after it simply keep the count until the
         * jumper catches up. Never past the yoke's count at the divide, nor
         * under the cuff's.
         */
        if (way === "up" ? end > Math.min(wanted * 1.2, this.limit.high) || end <= start : end < Math.max(wanted * 0.85, this.limit.low) || end >= start) continue;
        if (start > 2 * this.count || 2 * Math.abs(this.count - start) > this.count) continue;
        if (!best || Math.abs(end - wanted) < Math.abs(best.end - wanted)) best = { from, to, k, start, end };
      }
    }
    if (!best) return;
    const { from, to } = best;
    const id = `${crown.id}-${way}-${from}-${to}`;
    const name = `${crown.name}, rows ${from} to ${to}`;
    const chart = way === "up" ? crownAsIncrease(crown, from, to, id, name) : rowsOf(crown, from, to, id, name);
    this.shape(best.start, way === "up" ? groundOf(crown, to - 1) : groundOf(crown, from - 2));
    this.charts.set(id, chart);
    this.specs.push({ type: "chart", chart: id, rows: [1, chart.rows.length] });
    this.rows += chart.rows.length;
    this.count = best.end;
  }

  item(item: Item) {
    if (item.kind === "band") this.band(item.chart);
    else if (item.kind === "plain") this.plain(item.slot, item.rows);
    else this.crown(item.crown, item.way);
  }

  /** A plain round between two years, in the next one's ground, and any padding the size gives it. */
  gap(slot: SlotId) {
    const pad = this.padding[this.gaps] ?? 0;
    this.plain(slot, 1 + pad);
    this.padded += pad;
    this.gaps++;
  }
}

/** `rows` shared out over `gaps` as evenly as whole rounds go. */
const shared = (rows: number, gaps: number) =>
  Array.from({ length: gaps }, (_, k) => Math.floor((rows * (k + 1)) / gaps) - Math.floor((rows * k) / gaps));

/** The yarn of the last plain or shaping round, or of anything else knitted in one. */
const lastSlot = (specs: RoundSpec[]): SlotId => {
  for (let index = specs.length - 1; index >= 0; index--) {
    const spec = specs[index];
    if ("slot" in spec && typeof spec.slot === "string") return spec.slot;
  }
  throw new Error("nothing knitted yet");
};

/** A rib's last row, as the knits and purls it is bound off in. */
const ribOf = (chart: Chart): ("k" | "p")[] => chart.rows[chart.rows.length - 1].map((cell) => (cell.symbol === "purl" ? "p" : "k"));

/** The ground of a part's first band or plain rounds: what a gap before it is knitted in. */
const firstSlot = (part: Part): SlotId => {
  for (const item of part.items) {
    if (item.kind === "band") return groundOf(item.chart, 0);
    if (item.kind === "plain") return item.slot;
  }
  const crown = part.items[0];
  return crown.kind === "crown" ? groundOf(crown.crown, crown.crown.rows.length - 1) : "A";
};

/** The parts a size knits of these years: their motifs, and the extras in `extras`. */
const partsOf = (years: Block[], extras: Set<string>) =>
  years.map((block) => block.parts.filter((part, index) => part.priority === undefined || extras.has(`${block.year}:${index}`)));

/** Every extra of these years, in the order a size with rounds to spare puts them back. */
const extrasOf = (years: Block[]) =>
  years
    .flatMap((block) => block.parts.map((part, index) => ({ key: `${block.year}:${index}`, priority: part.priority, year: block.year })))
    .filter((extra) => extra.priority !== undefined)
    .sort((a, b) => a.priority! - b.priority! || a.year - b.year);

interface Piece {
  /** The rounds, with the depth they come to: the extras in `extras`, and the gaps between years padded by `padding`. */
  lay: (extras: Set<string>, padding?: number[]) => Run;
  depth: number;
  years: Block[];
}

/** Put the extras back, cheapest first, as long as the piece stays within its depth; then pad it to the depth. */
const pack = (piece: Piece): Run => {
  const extras = new Set<string>();
  let run = piece.lay(extras);
  if (run.rows > piece.depth) throw new Error(`${run.rows} rounds of motifs in a depth of ${piece.depth}`);
  for (const extra of extrasOf(piece.years)) {
    extras.add(extra.key);
    try {
      const tried = piece.lay(extras);
      if (tried.rows <= piece.depth) {
        run = tried;
        continue;
      }
    } catch {
      // A count with no room to change: leave this extra out.
    }
    extras.delete(extra.key);
  }
  const over = piece.depth - run.rows;
  if (over === 0) return run;
  if (run.gaps === 0) throw new Error("nowhere to pad");
  const padded = piece.lay(extras, shared(over, run.gaps));
  if (padded.rows !== piece.depth) throw new Error(`padded to ${padded.rows} of ${piece.depth}`);
  return padded;
};

export interface Graded {
  sections: Section[];
  checks: Record<string, number>;
  charts: Chart[];
  /** Which years went where, for the tests and the design's notes. */
  years: { yoke: number[]; body: number[]; sleeves: number[] };
}

const neckSlot = slotFor(2014, "A");
const cuff = brim(2026, "Hem", 11, 24, "y26-cuff");

/** The last body year's brim, as the hem: turned for top down, and the hat's top row of it carried on above to the depth. */
const hemOf = (year: number, rows: number): Chart => {
  const chart = brim(year, "A", 1, ({ 2019: 14, 2020: 8, 2021: 10 } as Record<number, number>)[year], `y${year % 100}-hem`);
  const extra = Math.max(0, rows - chart.rows.length);
  return { ...chart, rows: [...Array.from({ length: extra }, () => chart.rows[0]), ...chart.rows] };
};

export const grade = (size: Measured): Graded => {
  const g = gauge;
  const neck = nearest(size.neckCm * g.stitches, 4);
  const body = nearest(size.chestCm * g.stitches, 4);
  const underarm = Math.min(24, Math.max(8, nearest(body * 0.04, 2)));
  const top = nearest(size.upperArmCm * g.stitches, 2);
  const cuffCount = nearest(size.cuffCm * g.stitches, 4);
  const held = top - underarm;
  const yokeTotal = body - 2 * underarm + 2 * held;
  const half = (body - 2 * underarm) / 2;
  if (half % 2 !== 0) throw new Error("the back will not split at its middle");
  const depth = {
    yoke: Math.round(size.yokeDepthCm * g.rounds),
    body: Math.round(size.bodyLengthCm * g.rounds),
    sleeve: Math.round(size.sleeveLengthCm * g.rounds),
  };
  const neckRib = 9;
  const hemRows = 14;

  const yokePiece = (years: Block[]): Piece => ({
    years,
    depth: depth.yoke,
    lay: (extras, padding = []) => {
      const room = depth.yoke - neckRib;
      const first = Math.round(neck * 1.3);
      const run = new Run(neck, "up", { low: neck, high: yokeTotal });
      run.padding = padding;
      run.target = (ahead) => first + ((yokeTotal - first) * Math.min(room, run.rows - run.padded - neckRib + ahead)) / room;
      run.rows = neckRib;
      run.specs.push(
        { type: "castOn", count: neck, slot: neckSlot, fabric: "rib", check: "neck" },
        { type: "join" },
        { type: "rounds", count: neckRib, slot: neckSlot, sequence: ["k", "p"], fabric: "rib" },
        { type: "needles", to: "main" },
        {
          type: "shortRows",
          first: Math.round(neck * 0.16),
          extend: Math.round(neck * 0.05),
          pairs: 3,
          slot: neckSlot,
        },
      );
      // The short rows end with a round from the last turn to the end of the round: a round of the yoke's depth.
      run.rows++;
      partsOf(years, extras).forEach((parts, k) => {
        if (k > 0) run.gap(firstSlot(parts[0]));
        for (const part of parts) for (const item of part.items) run.item(item);
      });
      run.shape(yokeTotal, lastSlot(run.specs));
      run.specs[run.specs.length - 1] = { ...run.specs[run.specs.length - 1], check: "yoke" };
      return run;
    },
  });

  const bodyPiece = (years: Block[]): Piece => ({
    years,
    depth: depth.body,
    lay: (extras, padding = []) => {
      const run = new Run(body, "level", { low: body * 0.92, high: body * 1.08 });
      run.padding = padding;
      run.target = () => body;
      const parts = partsOf(years, extras);
      run.rows = 1; // the dividing round
      parts.forEach((own, k) => {
        if (k > 0) run.gap(firstSlot(own[0]));
        for (const part of own) for (const item of part.items) run.item(item);
      });
      const hem = hemOf(years[years.length - 1].year, hemRows);
      run.shape(nearest(body, 4), groundOf(hem, 0));
      run.charts.set(hem.id, hem);
      run.specs.push(
        { type: "needles", to: "rib" },
        { type: "chart", chart: hem.id, rows: [1, hem.rows.length], check: "hem" },
        { type: "bindOff", slot: groundOf(hem, hem.rows.length - 1), fabric: "rib", sequence: ribOf(hem) },
      );
      run.rows += hem.rows.length + 1;
      return run;
    },
  });

  const sleevePiece = (years: Block[]): Piece => ({
    years,
    depth: depth.sleeve,
    lay: (extras, padding = []) => {
      const run = new Run(top, "down", { low: cuffCount * 0.9, high: top });
      run.padding = padding;
      const room = depth.sleeve - cuff.rows.length - 2;
      run.target = (ahead) => top + ((cuffCount - top) * Math.min(room, run.rows - run.padded + ahead)) / room;
      run.rows = 1; // the round that picks the sleeve up
      partsOf(years, extras).forEach((own, k) => {
        if (k > 0) run.gap(firstSlot(own[0]));
        for (const part of own) for (const item of part.items) run.item(item);
      });
      run.shape(cuffCount, groundOf(cuff, 0));
      run.charts.set(cuff.id, cuff);
      run.specs.push(
        { type: "needles", to: "rib" },
        { type: "chart", chart: cuff.id, rows: [1, cuff.rows.length], check: "cuff" },
        { type: "bindOff", slot: groundOf(cuff, cuff.rows.length - 1), fabric: "rib", sequence: ribOf(cuff) },
      );
      run.rows += cuff.rows.length + 1;
      return run;
    },
  });

  /*
   * The splits: the yoke ends after 2015 or 2016, the body after 2019, 2020
   * or 2021. The one that fits, with the most rounds to spare in its
   * tightest piece.
   */
  let best: { pieces: Piece[]; split: [number, number]; spare: number } | undefined;
  const failures: string[] = [];
  for (const yokeEnd of [2015, 2016]) {
    for (const bodyEnd of [2019, 2020, 2021]) {
      const yokeYears = blocks.filter((block) => block.year <= yokeEnd);
      const bodyYears = blocks.filter((block) => block.year > yokeEnd && block.year <= bodyEnd);
      const sleeveYears = blocks.filter((block) => block.year > bodyEnd);
      try {
        const pieces = [yokePiece(yokeYears), bodyPiece(bodyYears), sleevePiece(sleeveYears)];
        const bare = pieces.map((piece) => piece.depth - piece.lay(new Set()).rows);
        if (Math.min(...bare) < 0) {
          failures.push(`${yokeEnd}/${bodyEnd}: short by ${bare.join(", ")}`);
          continue;
        }
        const spare = Math.min(...bare.map((rows, k) => rows / pieces[k].depth));
        if (!best || spare > best.spare) best = { pieces, split: [yokeEnd, bodyEnd], spare };
      } catch (error) {
        failures.push(`${yokeEnd}/${bodyEnd}: ${(error as Error).message}`);
      }
    }
  }
  if (!best) throw new Error(`no way to fit every year's motifs: ${failures.join("; ")}`);
  const [yoke, bodyRun, sleeve] = best.pieces.map(pack);
  const split = best.split;
  const sleeveSection = (piece: string, label: string): Section => ({
    label,
    piece,
    rounds: [
      { type: "piece", held: piece, before: underarm / 2, after: underarm / 2, slot: (sleeve.specs.find((spec) => "slot" in spec) as { slot: SlotId } | undefined)?.slot ?? "A", check: `${piece}:top` },
      ...sleeve.specs.map((spec) => (spec.check ? { ...spec, check: `${piece}:${spec.check}` } : spec)),
    ],
  });
  const sections: Section[] = [
    { label: "Yoke", piece: "yoke", rounds: yoke.specs },
    {
      label: "Body",
      piece: "body",
      rounds: [
        {
          type: "divide",
          slot: (bodyRun.specs.find((spec) => "slot" in spec) as { slot: SlotId } | undefined)?.slot ?? "A",
          segments: [
            { work: half / 2 },
            { hold: "sleeve-right", count: held, castOn: underarm },
            { work: half },
            { hold: "sleeve-left", count: held, castOn: underarm },
            { work: half / 2 },
          ],
          check: "body",
        },
        ...bodyRun.specs,
      ],
    },
    sleeveSection("sleeve-left", "Left sleeve"),
    sleeveSection("sleeve-right", "Right sleeve"),
  ];
  const charts = new Map<string, Chart>([...yoke.charts, ...bodyRun.charts, ...sleeve.charts]);
  return {
    sections,
    checks: {
      neck,
      yoke: yokeTotal,
      body,
      hem: nearest(body, 4),
      "sleeve-left:top": top,
      "sleeve-left:cuff": cuffCount,
      "sleeve-right:top": top,
      "sleeve-right:cuff": cuffCount,
    },
    charts: [...charts.values()],
    years: {
      yoke: blocks.filter((block) => block.year <= split[0]).map((block) => block.year),
      body: blocks.filter((block) => block.year > split[0] && block.year <= split[1]).map((block) => block.year),
      sleeves: blocks.filter((block) => block.year > split[1]).map((block) => block.year),
    },
  };
};
