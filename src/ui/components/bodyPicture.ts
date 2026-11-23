import { useMemo } from "react";
import type { SlotId } from "../../pattern/design";
import { type Stitch, seen, isMakeOne, worksInto } from "../../pattern/Stitch";
import { kinds } from "../../pattern/kinds";
import { type SweaterStitches, isSpacer } from "../../pattern/knitted";
import { layOut } from "../../reading/layout";
import { yarnFor, type Palette } from "../../reading/palette";

/**
 * The rounds a picture of a sweater is of: its yoke's colourwork, from the
 * first band to the last, plain rounds between them and all.
 *
 * Not the ribbing, which is two colours too but is a knit-and-purl texture
 * rather than a pattern - so the picture starts at the first round of two
 * colours with no purl in it, and stops at the last.
 */
/** Whether a round is one of a pattern's: of two colours or more, and no purl in it. */
const isPatterned = (round: number[], stitches: Stitch[]) => {
  const slots = new Set<string>();
  for (const id of round) {
    const stitch = stitches[id];
    if (!stitch) continue;
    if (seen(stitch) === "p1") return false;
    slots.add(stitch.slot);
  }
  return slots.size > 1;
};

export const bodyRounds = (rounds: number[][], stitches: Stitch[]) => {
  const patterned = (round: number[]) => isPatterned(round, stitches);
  const first = rounds.findIndex(patterned);
  if (first < 0) return rounds;
  let last = rounds.length - 1;
  while (last > first && !patterned(rounds[last])) last--;
  return rounds.slice(first, last + 1);
};

/** The stitch a stitch was worked into, or drawn out of: none for one made from nothing. */
const parentOf = (stitch: Stitch | undefined): number | undefined => {
  if (!stitch) return undefined;
  const { links } = stitch;
  return (links.length > kinds[stitch.type].takes ? links.slice(0, -1) : links)[0];
};

/**
 * The stitches that only space a band's pattern out: a column's copies where
 * a band has doubled it (see ChartCell.spacer). Left out of the picture, they
 * leave each band painted at its own repeat, its motifs evenly spaced, rather
 * than the rounds after a doubling drifting along from those before it. They
 * are always background, so the pattern loses nothing but the extra width.
 */
export const spacers = (body: number[][], stitches: Stitch[]): Set<number> =>
  new Set(body.flatMap((round) => round.filter((id) => isSpacer(stitches[id]))));

/**
 * The stitches a picture paints for each round, a column at a time.
 *
 * Mostly a round's own. But a round that increases is painted where the
 * round it was worked into is: each of its stitches under the stitch it grew
 * out of, and the stitches it adds - a KFB's second loop, a make-one - left
 * for the round after it, which has room for them. That is how the knitting
 * looks: an increase grows out of the stitch below, in its colour, so a band
 * whose last round increases keeps its blocks in line to the end, and only
 * the next round is wider. Painted at its own count instead, that last round
 * has its blocks shifted along under the rest of the band.
 *
 * Not a band begun on more stitches, though, its make-ones spread through its
 * first round and the round laid out afresh: that is the new band's first row,
 * and painted in line with the round before it, it would drift along from the
 * rest of its band. So only a round whose new stitches are all a KFB's second
 * loop, or a round all of one yarn, where it makes no odds, is painted in line.
 */
export const paintedRows = (body: number[][], stitches: Stitch[]): number[][] => {
  const spaced = spacers(body, stitches);
  const rows = spaced.size ? body.map((round) => round.filter((id) => !spaced.has(id))) : body;
  return rows.map((round, y) => {
    const above = rows[y - 1];
    if (!above || round.length <= above.length) return round;
    const oneYarn = new Set(round.map((id) => stitches[id]?.slot)).size === 1;
    const twinned = round.every((id, i) => !(stitches[id] && isMakeOne(stitches[id])) || stitches[round[i - 1]]?.type === "kfb");
    if (!oneYarn && !twinned) return round;
    const grown = new Map<number, number>();
    for (const id of round) {
      const parent = parentOf(stitches[id]);
      if (parent !== undefined && !grown.has(parent)) grown.set(parent, id);
    }
    // Not worked stitch for stitch into the round above it - a sleeve begun after the other - so painted as it is.
    if (above.some((id) => !grown.has(id))) return round;
    return above.map((id) => grown.get(id)!);
  });
};

/**
 * Whole screen pixels a stitch, as near as they come to a strip `height`
 * screen pixels tall; until that is measured, a pixel a stitch for the
 * browser to scale.
 */
export const stitchScale = (height: number, rows: number) => Math.max(1, Math.round(height / Math.max(1, rows)));

/**
 * The yoke painted `scale` screen pixels a stitch, once per change of wool,
 * to use as a background, the way it is worn: the neck's end at the top.
 *
 * Every round is drawn as wide as the widest, its own stitches over and over
 * - a round goes all the way round the yoke, so more of it is simply the
 * next repeat - which keeps every band at the same stitch scale however many
 * stitches its round has. The picture is repeated sideways for the same
 * reason. A round that increases is drawn in line with the round above it,
 * and a band that doubles columns at its own repeat; see `paintedRows`. Undefined where there is no canvas (a test environment).
 */
export const usePainting = (body: number[][], stitches: Stitch[], palette: Palette, scale: number, highlight?: SlotId[]) =>
  useMemo(() => {
    if (body.length === 0 || typeof document === "undefined") return undefined;
    const element = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = element.getContext("2d");
    } catch {
      // No canvas here: the plain ground shows instead.
    }
    if (!ctx) return undefined;
    const width = Math.max(...body.map((round) => round.length));
    element.width = width * scale;
    element.height = body.length * scale;
    const lit = highlight && new Set(highlight.map((slot) => palette[slot]));
    paintedRows(body, stitches).forEach((round, y) => {
      for (let x = 0; x < width; x++) {
        const yarn = yarnFor(palette, stitches[round[x % round.length]]?.slot ?? "");
        ctx.globalAlpha = lit && !lit.has(yarn) ? 0.14 : 1;
        ctx.fillStyle = yarn.hex;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return { url: element.toDataURL(), width: element.width, height: element.height };
  }, [body, stitches, palette, highlight, scale]);

/**
 * A sweater whose yoke's pattern runs on into the body - a picture down the
 * front, not bands round the yoke - as its card shows it: the front, from the
 * yoke's first patterned round to the picture's last, about the middle of the
 * front.
 *
 * Each row is a round, and says which stitch is at each place across it,
 * counted from the middle of the front the way the chart's columns run, and
 * how many places it is before the round comes round again.
 */
export interface FrontRow {
  period: number;
  /** The stitch at each place, or -1 where the round has none. */
  at: Int32Array;
}

export interface FrontPicture {
  rows: FrontRow[];
  /** The yarn most of it is knitted in, for wherever there is no stitch. */
  ground: SlotId;
}

/** The plain rounds shown under a front's picture. */
const MARGIN = 6;

const mod = (value: number, by: number) => ((value % by) + by) % by;

/**
 * The most places a round can have room left to grow in and still be a round
 * growing along lines: a raglan's four lines, with room either side of each.
 * A round yoke's increase round has room at every increase, all the way
 * round.
 */
const LINES = 8;

/**
 * A raglan line's own stitches, put back beside the panels they are the ends
 * of. The chart stands them on the line, in the middle of the room either
 * side of it, since the line is what they climb; as worn each is the last
 * stitch of the panel beside it. So a stitch or two standing alone in a round
 * are moved along to the stitches either side: the first to those before it,
 * the second to those after.
 */
const closeLines = (at: Int32Array) => {
  const columns = at.length;
  const has = (place: number) => at[mod(place, columns)] >= 0;
  const move = (from: number, step: 1 | -1) => {
    let to = from;
    for (let n = 0; n < columns && !has(to + step); n++) to += step;
    if (to === from) return;
    at[mod(to, columns)] = at[mod(from, columns)];
    at[mod(from, columns)] = -1;
  };
  const alone: [number, number][] = [];
  for (let place = 0; place < columns; place++) {
    if (!has(place) || has(place - 1)) continue;
    const length = has(place + 1) ? (has(place + 2) ? 3 : 2) : 1;
    if (length < 3) alone.push([place, length]);
  }
  for (const [place, length] of alone) {
    move(place, -1);
    if (length === 2) move(place + 1, 1);
  }
};

/**
 * Where the yoke's rounds go depends on how the yoke grows, which the chart
 * shows: every stitch stands in its column there, with the columns it has yet
 * to grow into left empty.
 *
 * Where that room is in a few places - along a raglan's lines - the round is
 * placed as the chart has it, so each panel widens about its own middle and
 * nothing in it is sheared by the lines growing beside it, and the room shows
 * as ground. Where it is spread all the way round, as a round yoke's is, the
 * round is closed up stitch beside stitch about the middle of the front, each
 * band at its own count, as the strips paint it. Painted row by row from each
 * round's first stitch instead, a raglan's bands are sheared along every
 * line, and nothing is in the middle.
 *
 * The body's rounds stand under the yoke's last, each stitch under the one it
 * was worked into, so whatever has begun in the yoke carries straight on.
 */
const front = (built: SweaterStitches): FrontPicture | undefined => {
  const { stitches, rounds, roundPieces, knitting } = built;
  const yokeCount = roundPieces.findIndex((piece) => piece !== roundPieces[0]);
  if (yokeCount <= 0) return undefined;
  const patterned = (index: number) => isPatterned(rounds[index], stitches);
  const first = rounds.findIndex((_round, index) => patterned(index));
  if (first < 0 || first >= yokeCount || !patterned(yokeCount - 1)) return undefined;
  let end = yokeCount;
  while (roundPieces[end] === roundPieces[yokeCount] && patterned(end)) end++;
  if (end === yokeCount) return undefined;
  // And a few plain rounds under it, where there are any, as there are over it.
  for (let more = 0; more < MARGIN && roundPieces[end] === roundPieces[yokeCount] && !patterned(end); more++) end++;
  const width = rounds[yokeCount].length;
  if (width % 2 || rounds.slice(yokeCount, end).some((round) => round.length !== width)) return undefined;

  const ofYoke = <T,>(all: T[]) => all.filter((_, index) => knitting.roundPieces[index] === roundPieces[0]);
  const chart = layOut(stitches, ofYoke(knitting.rounds), ofYoke(knitting.roundKinds));
  const columnOf = (id: number | undefined) => (id === undefined ? undefined : chart.cells.get(id)?.column);
  // The body's rounds begin at the middle of the back, so the middle of the front is half way along.
  const middle = [width / 2 - 1, width / 2].map((index) => columnOf(worksInto(stitches[rounds[yokeCount][index]])[0]));
  if (middle[0] === undefined || middle[1] === undefined) return undefined;
  const centre = (middle[0] + middle[1]) / 2;
  /** How far a stitch is from the middle of the front, in columns: under half the chart, either way. */
  const across = (id: number) => mod((columnOf(id) ?? centre) - centre + chart.columns / 2, chart.columns) - chart.columns / 2;

  const placeRound = (round: number[]): FrontRow => {
    const columns = round.map(across).sort((a, b) => a - b);
    const gaps = columns.filter((column, index) => mod((columns[index + 1] ?? columns[0]) - column, chart.columns) > 1).length;
    if (gaps > 0 && gaps <= LINES) {
      const at = new Int32Array(chart.columns).fill(-1);
      for (const id of round) at[mod(Math.floor(across(id)), chart.columns)] = id;
      closeLines(at);
      return { period: chart.columns, at };
    }
    // All the way round, from the first stitch past the middle of the front.
    let from = 0;
    round.forEach((id, index) => {
      if (across(id) >= 0 && (across(round[from]) < 0 || across(id) < across(round[from]))) from = index;
    });
    return { period: round.length, at: Int32Array.from(round, (_, place) => round[(from + place) % round.length]) };
  };

  const rows = rounds.slice(first, yokeCount).map(placeRound);

  // The body, under the yoke's last round.
  const last = rows[rows.length - 1];
  const placeOf = new Map<number, number>();
  last.at.forEach((id, place) => id >= 0 && placeOf.set(id, place));
  const places: number[] = [];
  rounds[yokeCount].forEach((id, index) => {
    const parent = worksInto(stitches[id])[0];
    // A stitch cast on at the underarm goes on from the stitch before it.
    places.push(placeOf.get(parent) ?? (places[index - 1] ?? 0) + 1);
  });
  for (const round of rounds.slice(yokeCount, end)) {
    const at = new Int32Array(last.period).fill(-1);
    round.forEach((id, index) => (at[mod(places[index], last.period)] = id));
    rows.push({ period: last.period, at });
  }

  const counts = new Map<SlotId, number>();
  for (const round of rounds.slice(first, end)) for (const id of round) counts.set(stitches[id].slot, (counts.get(stitches[id].slot) ?? 0) + 1);
  const ground = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return { rows, ground };
};

const fronts = new WeakMap<SweaterStitches, FrontPicture | null>();
/** A sweater's front, where its card shows that and not its yoke's bands: see FrontPicture. Worked out once a knitting. */
export const frontPicture = (built: SweaterStitches): FrontPicture | undefined => {
  let picture = fronts.get(built);
  if (picture === undefined) fronts.set(built, (picture = front(built) ?? null));
  return picture ?? undefined;
};

/**
 * Screen pixels a stitch for a front `rows` rounds tall in a strip `height`
 * screen pixels tall: as shown, and as painted.
 *
 * The whole picture is to be seen, so it is as large as fits, which is
 * seldom a whole number of pixels. Where a whole number is near enough it is
 * taken - a few rounds lost off the foot, or a little ground under it - and
 * the picture is shown pixel for pixel, as a strip is. Otherwise it is
 * painted at the next whole number up and left to the browser to bring down,
 * smoothed.
 */
export const frontScale = (height: number, rows: number): { shown: number; painted: number } => {
  const exact = height / Math.max(1, rows);
  const whole = Math.round(exact);
  if (whole >= 1 && (whole > exact ? (whole - exact) / whole <= 0.04 : (exact - whole) / exact <= 0.12)) return { shown: whole, painted: whole };
  return { shown: exact, painted: Math.max(1, Math.ceil(exact)) };
};

/**
 * A front painted for a strip `width` by `height` screen pixels, its middle
 * in the middle, and how large to show it; see FrontPicture and frontScale.
 * Undefined until the strip is measured, and where there is no canvas.
 */
export const useFrontPainting = (
  picture: FrontPicture | undefined,
  stitches: Stitch[],
  palette: Palette,
  width: number,
  height: number,
) =>
  useMemo(() => {
    if (!picture || width <= 0 || height <= 0 || typeof document === "undefined") return undefined;
    const element = document.createElement("canvas");
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = element.getContext("2d");
    } catch {
      // No canvas here: the plain ground shows instead.
    }
    if (!ctx) return undefined;
    const { shown, painted } = frontScale(height, picture.rows.length);
    // An even number of stitches across, to cover the strip with the middle of the front in its middle.
    const half = Math.ceil(width / shown / 2);
    element.width = 2 * half * painted;
    element.height = picture.rows.length * painted;
    const ground = yarnFor(palette, picture.ground).hex;
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, element.width, element.height);
    picture.rows.forEach((row, y) => {
      // The chart's columns count from the right, so the places do.
      for (let x = 0; x < 2 * half; x++) {
        const id = row.at[mod(half - 1 - x, row.period)];
        if (id < 0) continue;
        ctx.fillStyle = yarnFor(palette, stitches[id]?.slot ?? "").hex;
        ctx.fillRect(x * painted, y * painted, painted, painted);
      }
    });
    return {
      url: element.toDataURL(),
      width: 2 * half * shown,
      height: picture.rows.length * shown,
      ground,
      smoothed: shown !== painted,
    };
  }, [picture, stitches, palette, width, height]);
