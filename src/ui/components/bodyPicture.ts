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

const mod = (value: number, by: number) => ((value % by) + by) % by;

/**
 * A sweater painted about the middle of its front, where a strip of its yoke
 * would not show it: a picture down the front, or a yoke that grows along a
 * raglan's lines.
 *
 * Each row is a round, and says which stitch is at each place across it,
 * counted from the middle of the front the way the round is knitted - which
 * as worn is left to right - and how many places it is before the round
 * comes round again.
 */
export interface FrontRow {
  period: number;
  /** The stitch at each place, or -1 where the round has none. */
  at: Int32Array;
  /**
   * Where the round has no stitch, the stitch whose yarn is painted there,
   * or -1 for the ground: the room at a raglan's line, filled. See `fold`.
   * Absent where the round has no such room.
   */
  lent?: Int32Array;
}

export interface FrontPicture {
  rows: FrontRow[];
  /** The yarn most of it is knitted in, for wherever there is no stitch. */
  ground: SlotId;
  /**
   * How much of it a strip shows: the top of a front, which is far taller
   * than a strip (see frontScale), or all of a yoke's bands, as a strip of
   * them is shown.
   */
  shown: "top" | "all";
}

/** The stitch painted at a place of a row: its own, or the one lent to it, or -1 for the ground. */
export const stitchAt = (row: FrontRow, place: number) => {
  const index = mod(place, row.period);
  const id = row.at[index];
  return id >= 0 ? id : (row.lent?.[index] ?? -1);
};

/** The plain rounds shown under a front's picture. */
const MARGIN = 6;

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

/** A stretch of a round that stands side by side: where it begins, counted from the middle of the front, and its stitches. */
interface Panel {
  begins: number;
  ids: number[];
}

/** A round that grows along lines: its panels in order round from the front's, and the room after each. */
interface Lined {
  panels: Panel[];
  room: number[];
  period: number;
}

const endOf = (row: Lined, panel: number) => row.panels[panel].begins + row.panels[panel].ids.length;

/** The panels of a round placed in the chart's columns, from the one the middle of the front is in. */
const panelsIn = (at: Int32Array): Lined => {
  const period = at.length;
  const has = (place: number) => at[mod(place, period)] >= 0;
  // The front's panel begins at or before the middle; with none there, the first after it.
  let start = 0;
  if (has(0)) while (start > -period && has(start - 1)) start--;
  else while (start < period && !has(start)) start++;
  const panels: Panel[] = [];
  for (let place = start; place < start + period; ) {
    if (!has(place)) {
      place++;
      continue;
    }
    const panel: Panel = { begins: place, ids: [] };
    while (place < start + period && has(place)) panel.ids.push(at[mod(place++, period)]);
    panels.push(panel);
  }
  const row: Lined = { panels, room: [], period };
  row.room = panels.map((_, index) => (panels[index + 1]?.begins ?? start + period) - endOf(row, index));
  return row;
};

/**
 * A band's rounds drawn at one width: every panel moved toward the front by
 * the room the band has where it is narrowest, the same for all its rounds.
 */
const closeUp = (run: Lined[]): Lined[] => {
  const least = run[0].room.map((_, index) => Math.min(...run.map((row) => row.room[index])));
  return run.map((row) => {
    let moved = 0;
    const panels = row.panels.map((panel, index) => {
      const begins = panel.begins - moved;
      moved += least[index];
      return { begins, ids: panel.ids };
    });
    return { panels, room: row.room.map((room, index) => room - least[index]), period: row.period - moved };
  });
};

/**
 * What is painted in the room a band's rounds still have at each line, once
 * the band is closed up: for each round, the stitch each empty place borrows
 * its yarn from.
 *
 * Seen from above, a raglan line that gains a stitch either side every round
 * is a mitre, as at the corner of a picture frame: the place `k` stitches
 * beyond the end of a panel is knitted by the panel round the corner, `k`
 * rounds further down and `k` stitches in from the line. So the room is the
 * corner folded out flat, and a motif drawn to turn the corner - the felines'
 * spirals - is whole. The corner is drawn from both its panels' sides, so it
 * is there twice along the band, the second a quarter turn from the first.
 *
 * Only that slope lies flat. Where a line gains stitches more slowly, the
 * room takes the line's own stitch, drawn as wide as the room: the end stitch
 * of the panel on its side of where the two panels come to meet.
 */
const fold = (run: Lined[]): (Int32Array | undefined)[] =>
  run.map((row, y) => {
    if (row.room.every((room) => room <= 0)) return undefined;
    const lent = new Int32Array(row.period).fill(-1);
    const count = row.panels.length;
    const last = run[run.length - 1];
    row.room.forEach((width, index) => {
      if (width <= 0) return;
      const next = (index + 1) % count;
      const edge = endOf(row, index);
      const meet = Math.min(edge + width, Math.max(edge, endOf(last, index) + Math.ceil(last.room[index] / 2)));
      /** Whether both panels gain a stitch at this line in each of the next `k` rounds. */
      const mitred = (k: number) => {
        for (let step = 1; step <= k; step++) {
          const below = run[y + step];
          if (!below || below.panels.length !== count) return false;
          if (endOf(below, index) - edge !== step || edge + width - (endOf(below, index) + below.room[index]) !== step) return false;
        }
        return true;
      };
      for (let n = 0; n < width; n++) {
        const before = edge + n < meet;
        const k = before ? n + 1 : width - n;
        const own = before ? row.panels[index].ids : row.panels[next].ids;
        let from: number | undefined = before ? own[own.length - 1] : own[0];
        if (mitred(k)) {
          const round = run[y + k].panels[before ? next : index].ids;
          from = (before ? round[k] : round[round.length - 1 - k]) ?? from;
        }
        lent[mod(edge + n, row.period)] = from ?? -1;
      }
    });
    return lent;
  });

const asRow = (row: Lined, lent?: Int32Array): FrontRow => {
  const at = new Int32Array(row.period).fill(-1);
  for (const panel of row.panels) panel.ids.forEach((id, index) => (at[mod(panel.begins + index, row.period)] = id));
  return lent ? { period: row.period, at, lent } : { period: row.period, at };
};

/**
 * A yoke's rounds, placed about the middle of the front. Where each goes
 * depends on how the yoke grows, which the chart shows: every stitch stands
 * in its column there, with the columns it has yet to grow into left empty.
 *
 * Where that room is spread all the way round, as a round yoke's is, the
 * round is closed up stitch beside stitch, at its own count, as the strips
 * paint it.
 *
 * Where it is in a few places - along a raglan's lines - each panel is kept
 * whole, widening about its own middle, and the panels are closed up a band
 * at a time: every round of a band is drawn at the width the band has where
 * it is narrowest, its last round, so that nothing in the band is sheared by
 * the lines growing through it. A band is the rounds of two colours or more
 * that follow one another; a round all of one colour is closed up on its own,
 * having nothing to shear. What room a band's rounds still have at a line is
 * the corner, folded out: see `fold`. Closed up a round at a time instead, as
 * a strip is, a raglan's bands are sheared along every line; left where the
 * chart has them, they are cut apart by wedges of ground.
 *
 * `leaning` says whether any band was closed up as one: whether a strip, a
 * round at a time, would have sheared it.
 */
const placeYoke = (built: SweaterStitches, rounds: number[][]) => {
  const { stitches, roundPieces, knitting } = built;
  const yokeCount = roundPieces.findIndex((piece) => piece !== roundPieces[0]);
  const body = built.rounds[yokeCount];
  if (!body || body.length % 2) return undefined;
  const ofYoke = <T,>(all: T[]) => all.filter((_, index) => knitting.roundPieces[index] === roundPieces[0]);
  const chart = layOut(stitches, ofYoke(knitting.rounds), ofYoke(knitting.roundKinds));
  const columnOf = (id: number | undefined) => (id === undefined ? undefined : chart.cells.get(id)?.column);
  // The body's rounds begin at the middle of the back, so the middle of the front is half way along.
  const middle = [body.length / 2 - 1, body.length / 2].map((index) => columnOf(worksInto(stitches[body[index]])[0]));
  if (middle[0] === undefined || middle[1] === undefined) return undefined;
  const centre = (middle[0] + middle[1]) / 2;
  /** How far a stitch is from the middle of the front, in columns: under half the chart, either way. */
  const across = (id: number) => mod((columnOf(id) ?? centre) - centre + chart.columns / 2, chart.columns) - chart.columns / 2;

  const placeRound = (round: number[]): FrontRow | Lined => {
    const columns = round.map(across).sort((a, b) => a - b);
    const gaps = columns.filter((column, index) => mod((columns[index + 1] ?? columns[0]) - column, chart.columns) > 1).length;
    if (gaps > 0 && gaps <= LINES) {
      const at = new Int32Array(chart.columns).fill(-1);
      for (const id of round) at[mod(Math.floor(across(id)), chart.columns)] = id;
      closeLines(at);
      return panelsIn(at);
    }
    // All the way round, from the first stitch past the middle of the front.
    let from = 0;
    round.forEach((id, index) => {
      if (across(id) >= 0 && (across(round[from]) < 0 || across(id) < across(round[from]))) from = index;
    });
    return { period: round.length, at: Int32Array.from(round, (_, place) => round[(from + place) % round.length]) };
  };

  const manyYarns = (round: number[]) => new Set(round.map((id) => stitches[id]?.slot)).size > 1;
  const rows: FrontRow[] = [];
  let leaning = false;
  let run: Lined[] = [];
  let banded = false;
  const finish = () => {
    if (run.length === 0) return;
    const closed = closeUp(run);
    const lent = fold(closed);
    closed.forEach((row, index) => rows.push(asRow(row, lent[index])));
    leaning ||= run.length > 1 && run.some((row) => row.room.some((room, index) => room !== run[0].room[index]));
    run = [];
  };
  for (const round of rounds) {
    const placed = placeRound(round);
    if ("at" in placed) {
      finish();
      rows.push(placed);
      continue;
    }
    const many = manyYarns(round);
    if (run.length && !(banded && many && run[0].panels.length === placed.panels.length)) finish();
    run.push(placed);
    banded = many;
  }
  finish();
  return { rows, leaning, yokeCount };
};

const groundOf = (rounds: number[][], stitches: Stitch[]): SlotId => {
  const counts = new Map<SlotId, number>();
  for (const round of rounds) for (const id of round) counts.set(stitches[id].slot, (counts.get(stitches[id].slot) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

/**
 * A sweater whose yoke's pattern runs on into the body - a picture down the
 * front, not bands round the yoke - as its card shows it: the front, from the
 * yoke's first patterned round to the picture's last, about the middle of the
 * front. A card shows the top of it: see frontScale.
 *
 * The yoke's rounds are placed as `placeYoke` has them. The body's stand
 * under the yoke's last, each stitch under the one it was worked into, so
 * whatever has begun in the yoke carries straight on.
 */
const front = (built: SweaterStitches): FrontPicture | undefined => {
  const { stitches, rounds, roundPieces } = built;
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

  const yoke = placeYoke(built, rounds.slice(first, yokeCount));
  if (!yoke) return undefined;
  const rows = yoke.rows;

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
  return { rows, ground: groundOf(rounds.slice(first, end), stitches), shown: "top" };
};

/** Worked out once a knitting: by its `knitting`, which is the same object however the rest is spread about. */
const once = <T,>(make: (built: SweaterStitches) => T | undefined) => {
  const made = new WeakMap<object, T | null>();
  return (built: SweaterStitches): T | undefined => {
    let picture = made.get(built.knitting);
    if (picture === undefined) made.set(built.knitting, (picture = make(built) ?? null));
    return picture ?? undefined;
  };
};

/** A sweater's front, where its card shows that and not its yoke's bands: see FrontPicture. */
export const frontPicture = once(front);

/**
 * A yoke as a strip shows it where a strip's own way would not do: its
 * patterned rounds, placed as `placeYoke` has them, all of them, the middle
 * of the front in the middle.
 *
 * That is a yoke with a band that grows along lines, which a strip, a round
 * at a time, would shear; and the yoke of a picture down the front, which a
 * strip would begin at the middle of the back, with half a feline at each
 * end. A round yoke's bands, and a band between lines that do not grow in
 * it, are a strip's to paint.
 */
const yoke = (built: SweaterStitches): FrontPicture | undefined => {
  const { stitches, rounds, roundPieces } = built;
  const yokeCount = roundPieces.findIndex((piece) => piece !== roundPieces[0]);
  if (yokeCount <= 0) return undefined;
  const body = bodyRounds(rounds.slice(0, yokeCount), stitches);
  if (body.length === 0 || !isPatterned(body[0], stitches)) return undefined;
  const placed = placeYoke(built, body);
  if (!placed || !(placed.leaning || frontPicture(built))) return undefined;
  return { rows: placed.rows, ground: groundOf(body, stitches), shown: "all" };
};

/** A sweater's yoke placed about the middle of the front, where a strip of it would shear its bands: see `yoke`. */
export const yokePicture = once(yoke);

/** What a sweater's card shows in a strip's place, if anything: its front, or its yoke placed. */
export const cardPicture = (built: SweaterStitches) => frontPicture(built) ?? yokePicture(built);

/** How much of a front's height its strip shows, about: the bands and the head of the picture, enough to know it by. */
const SHOWN = 0.65;

/**
 * Whole screen pixels a stitch for a front `rows` rounds tall in a strip
 * `height` screen pixels tall.
 *
 * A strip is the same shape on every card, and a front is far taller than
 * that: shown whole it is small, and never a whole number of pixels a stitch.
 * So it is shown from the top, pixel for pixel as a strip is, at the whole
 * number that comes nearest to showing `SHOWN` of it, and its foot is cut
 * off.
 */
export const frontScale = (height: number, rows: number) => Math.max(1, Math.round(height / (Math.max(1, rows) * SHOWN)));

/**
 * The stitch painted in each column of a row, across a picture `2 * half`
 * stitches wide with the middle of the front in its middle. As worn: knitted
 * top down and turned the right way up, a round runs left to right as it is
 * seen from outside, so the places do.
 */
export const stitchAcross = (row: FrontRow, x: number, half: number) => stitchAt(row, x - half);

/**
 * A front, or a yoke placed, painted for a strip `width` by `height` screen
 * pixels, its middle in the middle; see FrontPicture. A front's top is at the
 * top, at frontScale; a yoke is shown whole, at stitchScale, for the strip to
 * centre up and down. Undefined until the strip is measured, and where there
 * is no canvas.
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
    const whole = picture.shown === "all";
    const painted = whole ? stitchScale(height, picture.rows.length) : frontScale(height, picture.rows.length);
    // An even number of stitches across, to cover the strip with the middle of the front in its middle.
    const half = Math.ceil(width / painted / 2);
    const rows = whole ? picture.rows : picture.rows.slice(0, Math.ceil(height / painted));
    element.width = 2 * half * painted;
    element.height = rows.length * painted;
    const ground = yarnFor(palette, picture.ground).hex;
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, element.width, element.height);
    rows.forEach((row, y) => {
      for (let x = 0; x < 2 * half; x++) {
        const id = stitchAcross(row, x, half);
        if (id < 0) continue;
        ctx.fillStyle = yarnFor(palette, stitches[id]?.slot ?? "").hex;
        ctx.fillRect(x * painted, y * painted, painted, painted);
      }
    });
    return { url: element.toDataURL(), width: element.width, height: element.height, ground, whole };
  }, [picture, stitches, palette, width, height]);
