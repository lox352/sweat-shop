import { sweaterById } from "../library/catalogue";
import type { Design, Tension } from "../pattern/design";
import type { Overrides } from "../reading/palette";
import { type Made, type Project, type Step, bareIdFor, isMade, isShadesOf, isTension, madeOf, overviewPath, storageKeyFor } from "./projects";

/**
 * A jumper's link: its address, with everything that makes it in it.
 *
 * A project is kept in the browser it was started in and nowhere else, and a
 * browser clears what it keeps: for room, or - Safari - after a week unused.
 * But a project is tiny (see projects.ts), and so is what made its knitting
 * where that is its own (see Made): a design, a size, the wool, how far it
 * has got, and each recalculation in order. All of it goes in the jumper's
 * own address, kept there as the jumper changes. So whatever holds the
 * address holds the jumper - a tab left open, a bookmark, the browser's
 * history, a message it was sent in - and opening it where the jumper is
 * not kept offers to make it again (see remake.ts, and Restore). Opened
 * where it is kept, it is just the jumper's address.
 *
 * What it does not hold is the knitting itself, which is made again: fetched,
 * where it is a published edition, which is never taken down; planned again,
 * where it was the project's own, and checked against the edition the link
 * names. Nor the time spent knitting, which is a backup's to keep.
 */

/** What a jumper's address carries its link in. */
export const linkParam = "jumper";

/**
 * A link as it is written: short names, as it is all read at once and the
 * address is long enough. A step is ["f", stitches, rounds, round or 0,
 * option] or ["j", edition, round].
 */
type WrittenStep = ["f", number, number, number, string?] | ["j", string, number];

interface Written {
  v: 1;
  /** The project's id, bare. */
  i: string;
  n?: string;
  d: string;
  s: string;
  c: string;
  t?: string;
  w?: Overrides;
  e?: string;
  p?: number;
  /** The knitter's tension: stitches and rounds to 10cm. */
  g?: [number, number];
  /** How its knitting was made: the edition it began as, and each step. */
  m?: { f?: string; s: WrittenStep[] };
  u?: string;
  /** When it was started, in seconds. */
  a?: number;
}

/** A jumper as a link says it: what a project keeps, less its knitting. */
export interface Linked {
  /** The project's id, as it is stored under. */
  id: string;
  name?: string;
  sweater: Design;
  sizeId: string;
  colourwayId: string;
  trim?: string;
  shades?: Overrides;
  /** The edition it knits: a published one, or with `made`, the name of what is to be made. */
  edition?: string;
  progress: number;
  tension?: Tension;
  made?: Made;
  upTo?: string;
  startedAt?: string;
}

/** The most a link may be: a jumper in every wool of its knitter's own, recalculated a dozen times, is a quarter of it. */
const maxLength = 8000;

const toText = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const toBytes = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

const writtenStep = (step: Step): WrittenStep =>
  "fit" in step
    ? step.option
      ? ["f", step.fit.stitchesPer10cm, step.fit.roundsPer10cm, step.round ?? 0, step.option]
      : ["f", step.fit.stitchesPer10cm, step.fit.roundsPer10cm, step.round ?? 0]
    : ["j", step.join, step.round];

const readStep = (step: unknown): Step | undefined => {
  if (!Array.isArray(step)) return undefined;
  if (step[0] === "f") {
    const [, stitchesPer10cm, roundsPer10cm, round, option] = step as unknown[];
    return { fit: { stitchesPer10cm, roundsPer10cm } as Tension, ...(round ? { round: round as number } : {}), ...(option !== undefined ? { option: option as string } : {}) };
  }
  return step[0] === "j" ? { join: step[1] as string, round: step[2] as number } : undefined;
};

/** A project's link: what goes in its address. */
export const linkOf = (project: Project): string => {
  const made = madeOf(project);
  const started = Date.parse(project.startedAt);
  const written: Written = {
    v: 1,
    i: bareIdFor(project.id),
    ...(project.name ? { n: project.name } : {}),
    d: project.sweaterId,
    s: project.sizeId,
    c: project.colourwayId,
    ...(project.trim ? { t: project.trim } : {}),
    ...(project.shades && Object.keys(project.shades).length > 0 ? { w: project.shades } : {}),
    ...(project.edition ? { e: project.edition } : {}),
    ...(project.progress > 0 ? { p: project.progress } : {}),
    ...(project.tension ? { g: [project.tension.stitchesPer10cm, project.tension.roundsPer10cm] } : {}),
    ...(made ? { m: { ...(made.from ? { f: made.from } : {}), s: made.steps.map(writtenStep) } } : {}),
    ...(project.upTo ? { u: project.upTo } : {}),
    ...(Number.isFinite(started) ? { a: Math.round(started / 1000) } : {}),
  };
  return toText(new TextEncoder().encode(JSON.stringify(written)));
};

const isName = (value: unknown, most = 200): value is string => typeof value === "string" && value.length > 0 && value.length <= most;
const isEdition = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{1,64}$/.test(value);

/**
 * A link read back: undefined where it is not one, or names a design, size
 * or colourway the site has not got. Everything in it is checked as a
 * backup's is: it is whatever was in an address.
 */
export const readLink = (text: string | null | undefined): Linked | undefined => {
  if (!text || text.length > maxLength) return undefined;
  try {
    const written = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(toBytes(text))) as Partial<Written> | null;
    if (typeof written !== "object" || written === null || written.v !== 1) return undefined;
    const sweater = typeof written.d === "string" ? sweaterById(written.d) : undefined;
    if (!sweater || typeof written.i !== "string" || !/^[0-9A-Za-z-]{1,64}$/.test(written.i)) return undefined;
    if (!sweater.sizes.some((size) => size.id === written.s) || !sweater.colourways.some((colourway) => colourway.id === written.c)) return undefined;
    const tension = written.g === undefined ? undefined : Array.isArray(written.g) ? { stitchesPer10cm: written.g[0], roundsPer10cm: written.g[1] } : null;
    const steps = written.m === undefined ? undefined : Array.isArray(written.m?.s) ? written.m.s.map(readStep) : null;
    const made = steps === undefined ? undefined : steps && steps.every((step) => step) ? { ...(written.m?.f !== undefined ? { from: written.m.f } : {}), steps: steps as Step[] } : null;
    if (
      (written.n !== undefined && !isName(written.n)) ||
      (written.t !== undefined && !isName(written.t)) ||
      (written.w !== undefined && !isShadesOf(sweater.slots, written.w)) ||
      (written.e !== undefined && !isEdition(written.e)) ||
      (written.u !== undefined && !isEdition(written.u)) ||
      (written.p !== undefined && !(Number.isSafeInteger(written.p) && written.p > 0)) ||
      (tension !== undefined && !isTension(tension)) ||
      (made !== undefined && !isMade(made)) ||
      (written.a !== undefined && !(Number.isSafeInteger(written.a) && written.a > 0 && written.a < 1e11)) ||
      // Knitting that is to be made is named, to be checked when it is.
      (made && !written.e)
    ) return undefined;
    return {
      id: storageKeyFor(written.i),
      ...(written.n ? { name: written.n } : {}),
      sweater,
      sizeId: written.s as string,
      colourwayId: written.c as string,
      ...(written.t ? { trim: written.t } : {}),
      ...(written.w && Object.keys(written.w).length > 0 ? { shades: written.w } : {}),
      ...(written.e ? { edition: written.e } : {}),
      progress: written.p ?? 0,
      ...(tension ? { tension } : {}),
      ...(made ? { made } : {}),
      ...(written.u ? { upTo: written.u } : {}),
      ...(written.a ? { startedAt: new Date(written.a * 1000).toISOString() } : {}),
    };
  } catch {
    return undefined;
  }
};

/** A jumper's path in the site, with its link: what the router goes to. */
export const linkedPath = (project: Project) => `${overviewPath(project.id)}?${linkParam}=${linkOf(project)}`;

/** A jumper's whole address, to keep or to send. */
export const addressOf = (project: Project) => `${window.location.origin}${window.location.pathname}#${linkedPath(project)}`;

/**
 * The path in the site that something pasted asks for - a jumper's address,
 * or what is left of one - where it is a jumper's and its link reads.
 */
export const pathIn = (pasted: string): string | undefined => {
  const found = /\/project\/([0-9A-Za-z-]{1,64})(?:\/chart)?\?(?:[^\s#]*&)?jumper=([0-9A-Za-z_-]+)/.exec(pasted.trim());
  if (!found) return undefined;
  const [, id, link] = found;
  const linked = readLink(link);
  return linked && linked.id === storageKeyFor(id) ? `/project/${id}?${linkParam}=${link}` : undefined;
};
