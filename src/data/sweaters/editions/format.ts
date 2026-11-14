import type { SweaterStitches } from "../../../knitting/engine";
import type { Held, RoundKind, SeamKind } from "../../../knitting/needles";
import type { Stitch } from "../../../types/Stitch";
import type { StitchType } from "../../../types/StitchType";

/**
 * An edition: one size of one design's knitting exactly as built, frozen.
 *
 * A project's progress is the id of the last stitch it worked, so it only
 * means anything against the knitting it was counted in. A design's knitting
 * changes now and then - a chart corrected, a better way to shape a yoke - and
 * a project part way through should not have its knitting change under it.
 * So each knitting a size has had is kept, as an edition, and a project knits
 * the edition it was started on until its knitter chooses to move on. See
 * editions/index.ts.
 *
 * The file holds the built sweater itself, not the pattern it was built from,
 * so the engine is free to change: an edition decodes to the same stitches
 * whatever the code that built it has become. It is small because knitting
 * repeats itself - a round of plain knitting is one run of one kind of
 * stitch, worked into the stitches of the round below at one distance back -
 * so every column is run-length coded, and links are kept as how far back
 * each one reaches rather than as ids.
 */

export const editionSchema = 1;

/** A run-length coded column: value, how many, value, how many... */
type Runs<T> = (T | number)[];
/** Ids as runs of consecutive ones: first, how many, first, how many... */
type Ranges = number[];

/** What a step or a picked-up stitch carries beyond its kind. */
interface Extra {
  from?: number;
  holder?: string;
  count?: number;
  wrap?: boolean;
  marker?: string;
  removed?: boolean;
  begins?: boolean;
}

interface PackedHeld {
  holder: string;
  stitches: Ranges;
  parts: { at: number; stitches: Ranges }[];
  edge?: Ranges;
  heldAt: number;
  resumedAt?: number;
}

export interface EditionFile {
  schema: number;
  design: string;
  size: string;
  /** The edition's name: a hash of its knitting, see hashable. */
  edition: string;
  stitches: {
    count: number;
    types: string[];
    slots: string[];
    pieces: string[];
    /** Each distinct width and rise, "width|rise", either left empty where the stitch has none. */
    fabrics: string[];
    /** Each distinct set of links, as how far back each reaches: "152,1". */
    links: string[];
    type: Runs<number>;
    slot: Runs<number>;
    piece: Runs<number>;
    /** 1 where worked from the wrong side. */
    side: Runs<number>;
    fabric: Runs<number>;
    /** The needles each is worked on, in millimetres, or null where it says none. */
    needles: Runs<number | null>;
    link: Runs<number>;
    /** The copies of a column a band has doubled: see engine's isSpacer. */
    spacers: Ranges;
    extras: Record<string, Extra>;
  };
  rounds: Ranges[];
  roundLabels: Runs<string>;
  roundPieces: Runs<string>;
  roundKinds: Runs<string>;
  holds: PackedHeld[];
  needleChanges: number[];
  checks: Record<string, number>;
  roundHeight: number;
  knitting: { rounds: Ranges[]; roundKinds: Runs<string>; roundPieces: Runs<string>; roundHeight: number };
}

const runs = <T>(values: T[]): Runs<T> => {
  const out: Runs<T> = [];
  for (let i = 0; i < values.length; ) {
    let j = i + 1;
    while (j < values.length && values[j] === values[i]) j++;
    out.push(values[i], j - i);
    i = j;
  }
  return out;
};

const unrun = <T>(coded: Runs<T>): T[] => {
  const out: T[] = [];
  for (let i = 0; i < coded.length; i += 2) {
    const value = coded[i] as T;
    for (let k = 0; k < (coded[i + 1] as number); k++) out.push(value);
  }
  return out;
};

const ranges = (ids: number[]): Ranges => {
  const out: Ranges = [];
  for (let i = 0; i < ids.length; ) {
    let j = i + 1;
    while (j < ids.length && ids[j] === ids[j - 1] + 1) j++;
    out.push(ids[i], j - i);
    i = j;
  }
  return out;
};

const unrange = (coded: Ranges): number[] => {
  const out: number[] = [];
  for (let i = 0; i < coded.length; i += 2) for (let k = 0; k < coded[i + 1]; k++) out.push(coded[i] + k);
  return out;
};

/** A dictionary that numbers values as they are first met. */
const numbering = <T>() => {
  const index = new Map<T, number>();
  const values: T[] = [];
  const of = (value: T) => {
    let n = index.get(value);
    if (n === undefined) {
      n = values.length;
      index.set(value, n);
      values.push(value);
    }
    return n;
  };
  return { of, values };
};

const extraKeys = ["from", "holder", "count", "wrap", "marker", "removed", "begins"] as const;

/** A built sweater, frozen as an edition. `edition` is its name, worked out by whoever writes it: see hashable. */
export const encodeEdition = (built: SweaterStitches, design: string, size: string, edition: string): EditionFile => {
  const types = numbering<string>();
  const slots = numbering<string>();
  const pieces = numbering<string>();
  const fabrics = numbering<string>();
  const links = numbering<string>();
  const extras: Record<string, Extra> = {};
  const spacers: number[] = [];
  built.stitches.forEach((stitch, id) => {
    if (stitch.id !== id) throw new Error(`stitch ${stitch.id} is not at ${id}`);
    const extra: Extra = {};
    for (const key of extraKeys) if (stitch[key] !== undefined) (extra as Record<string, unknown>)[key] = stitch[key];
    if (Object.keys(extra).length) extras[id] = extra;
    if ((stitch as { spacer?: true }).spacer) spacers.push(id);
  });
  const stitches = built.stitches;
  return {
    schema: editionSchema,
    design,
    size,
    edition,
    stitches: {
      count: stitches.length,
      type: runs(stitches.map((s) => types.of(s.type))),
      slot: runs(stitches.map((s) => slots.of(s.slot))),
      piece: runs(stitches.map((s) => pieces.of(s.piece))),
      side: runs(stitches.map((s) => (s.wrongSide ? 1 : 0))),
      fabric: runs(stitches.map((s) => fabrics.of(`${s.width ?? ""}|${s.rise ?? ""}`))),
      needles: runs(stitches.map((s) => s.needles ?? null)),
      link: runs(stitches.map((s) => links.of(s.links.map((to) => s.id - to).join(",")))),
      types: types.values,
      slots: slots.values,
      pieces: pieces.values,
      fabrics: fabrics.values,
      links: links.values,
      spacers: ranges(spacers),
      extras,
    },
    rounds: built.rounds.map(ranges),
    roundLabels: runs(built.roundLabels),
    roundPieces: runs(built.roundPieces),
    roundKinds: runs(built.roundKinds),
    holds: built.holds.map((held) => ({
      holder: held.holder,
      stitches: ranges(held.stitches),
      parts: held.parts.map((part) => ({ at: part.at, stitches: ranges(part.stitches) })),
      ...(held.edge ? { edge: ranges(held.edge) } : {}),
      heldAt: held.heldAt,
      ...(held.resumedAt !== undefined ? { resumedAt: held.resumedAt } : {}),
    })),
    needleChanges: built.needleChanges,
    checks: built.checks,
    roundHeight: built.roundHeight,
    knitting: {
      rounds: built.knitting.rounds.map(ranges),
      roundKinds: runs(built.knitting.roundKinds),
      roundPieces: runs(built.knitting.roundPieces),
      roundHeight: built.knitting.roundHeight,
    },
  };
};

/** An edition, built again: the same stitches, rounds and holds the engine built, field for field. */
export const decodeEdition = (file: EditionFile): SweaterStitches => {
  if (file.schema !== editionSchema) throw new Error(`edition ${file.edition}: schema ${file.schema} is not ${editionSchema}`);
  const coded = file.stitches;
  const type = unrun(coded.type);
  const slot = unrun(coded.slot);
  const piece = unrun(coded.piece);
  const side = unrun(coded.side);
  const fabric = unrun(coded.fabric);
  const needles = unrun(coded.needles);
  const link = unrun(coded.link);
  const lengths = [type, slot, piece, side, fabric, needles, link].map((column) => column.length);
  if (lengths.some((length) => length !== coded.count)) throw new Error(`edition ${file.edition}: columns of ${lengths.join(", ")}, not ${coded.count}`);
  const spacers = new Set(unrange(coded.spacers));
  const stitches: Stitch[] = [];
  for (let id = 0; id < coded.count; id++) {
    const reaches = coded.links[link[id]];
    const stitch: Stitch = {
      id,
      links: reaches === "" ? [] : reaches.split(",").map((back) => id - Number(back)),
      type: coded.types[type[id]] as StitchType,
      slot: coded.slots[slot[id]],
      piece: coded.pieces[piece[id]],
    };
    const [width, rise] = coded.fabrics[fabric[id]].split("|");
    if (width !== "") stitch.width = Number(width);
    if (rise !== "") stitch.rise = Number(rise);
    if (needles[id] !== null) stitch.needles = needles[id] as number;
    Object.assign(stitch, coded.extras[id]);
    if (side[id]) stitch.wrongSide = true;
    if (spacers.has(id)) Object.assign(stitch, { spacer: true });
    stitches.push(stitch);
  }
  const holds: Held[] = file.holds.map((held) => ({
    holder: held.holder,
    stitches: unrange(held.stitches),
    parts: held.parts.map((part) => ({ at: part.at, stitches: unrange(part.stitches) })),
    ...(held.edge ? { edge: unrange(held.edge) } : {}),
    heldAt: held.heldAt,
    ...(held.resumedAt !== undefined ? { resumedAt: held.resumedAt } : {}),
  }));
  return {
    stitches,
    rounds: file.rounds.map(unrange),
    roundLabels: unrun(file.roundLabels),
    roundPieces: unrun(file.roundPieces),
    roundKinds: unrun(file.roundKinds) as RoundKind[],
    holds,
    needleChanges: file.needleChanges,
    checks: file.checks,
    roundHeight: file.roundHeight,
    knitting: {
      fromSeam: true,
      stitches,
      rounds: file.knitting.rounds.map(unrange),
      roundKinds: unrun(file.knitting.roundKinds) as SeamKind[],
      roundPieces: unrun(file.knitting.roundPieces),
      roundHeight: file.knitting.roundHeight,
    },
  };
};

/**
 * What an edition's name is worked out from: the knitting, and nothing about
 * how it is drawn. Every stitch's kind, yarn, piece, side, needles, links,
 * spacing and step, and the rounds and holds they fall in, count; the labels
 * the chart's margin gives rounds, and how wide and tall a stitch is drawn,
 * do not, so rewording a label or retuning the fabric never makes a new
 * edition. Hashed by scripts/editions.mjs and the tests, never in the browser.
 */
export const hashable = (file: EditionFile): string => {
  const { stitches, rounds, roundPieces, roundKinds, holds, needleChanges, checks, knitting } = file;
  const { fabrics: _fabrics, fabric: _fabric, ...knitted } = stitches;
  void _fabrics;
  void _fabric;
  return JSON.stringify({
    stitches: knitted,
    rounds,
    roundPieces,
    roundKinds,
    holds,
    needleChanges,
    checks,
    knitting: { rounds: knitting.rounds, roundKinds: knitting.roundKinds, roundPieces: knitting.roundPieces },
  });
};
