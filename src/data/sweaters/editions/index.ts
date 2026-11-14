import type { SweaterStitches } from "../../../knitting/engine";
import { type EditionFile, decodeEdition } from "./format";

/**
 * Which edition of a size's knitting each project knits.
 *
 * Every size's knitting is named, as an edition, by a hash of it (see
 * format.ts and scripts/editions.mjs), and the manifest says which edition is
 * current and which was the first the site named. A project records the
 * edition it was started on; one saved before editions existed knits the
 * first. While a project's edition is current its knitting is built as it
 * always was. Once a change supersedes it, the project knits the frozen copy,
 * fetched when it is opened, until its knitter chooses to move on: nothing
 * published later moves a stitch of anyone's knitting.
 *
 * A frozen copy is a file served as it is, at an address its name gives, so
 * the page carries no list of them however many a design comes to have, and
 * only a project that knits one ever fetches it. Its name is a hash of what
 * it holds, so it never changes, and the service worker keeps it for good
 * once it has been fetched: see scripts/service-worker.js.
 */

type Manifest = Record<string, Record<string, { first: string; current: string }>>;

const manifest: Manifest =
  Object.values(import.meta.glob<{ default: Manifest }>("./manifest.json", { eager: true }))[0]?.default ?? {};

const keyOf = (design: string, size: string, edition: string) => `${design}--${size}--${edition}`;

/** Where a frozen copy is served from. */
export const editionUrl = (design: string, size: string, edition: string) =>
  `${import.meta.env.BASE_URL}editions/${keyOf(design, size, edition)}.json`;

/** The edition a size's knitting is now. */
export const currentEdition = (design: string, size: string): string | undefined => manifest[design]?.[size]?.current;

/** The edition a project knits: the one it was started on, or for a project saved before editions, the first. */
export const editionOf = (project: { sweaterId: string; sizeId: string; edition?: string }): string | undefined =>
  project.edition ?? manifest[project.sweaterId]?.[project.sizeId]?.first;

/** Whether an edition is one its size's knitting has moved on from, and so is knitted from its frozen copy. */
export const isSuperseded = (design: string, size: string, edition: string | undefined): edition is string => {
  const current = currentEdition(design, size);
  return edition !== undefined && current !== undefined && edition !== current && /^[0-9a-f]+$/.test(edition);
};

/**
 * What is known of a frozen copy: its knitting, once fetched; "missing" where
 * the site has no such edition - a project saved by some other build - which
 * is then knitted as the size is now, as every project was before editions;
 * or nothing yet.
 */
const fetched = new Map<string, SweaterStitches | "missing">();
const loading = new Map<string, Promise<SweaterStitches | "missing">>();

/** A superseded edition's knitting, if it has been fetched: see loadEdition. */
export const frozenEdition = (design: string, size: string, edition: string): SweaterStitches | undefined => {
  const known = fetched.get(keyOf(design, size, edition));
  return known === "missing" ? undefined : known;
};

/** Whether an edition has been asked for and the site has none of that name. */
export const editionMissing = (design: string, size: string, edition: string): boolean =>
  fetched.get(keyOf(design, size, edition)) === "missing";

/**
 * Fetch and decode a superseded edition, once. Rejects where it could not be
 * reached or read - offline, say - which is not the same as there being none:
 * a project must not be shown some other knitting for want of a connection.
 */
export const loadEdition = (design: string, size: string, edition: string): Promise<SweaterStitches | "missing"> => {
  const key = keyOf(design, size, edition);
  const known = fetched.get(key);
  if (known) return Promise.resolve(known);
  let pending = loading.get(key);
  if (!pending) {
    pending = fetch(editionUrl(design, size, edition))
      .then(async (response): Promise<SweaterStitches | "missing"> => {
        if (response.status === 404) return "missing";
        if (!response.ok) throw new Error(`edition ${key}: ${response.status}`);
        const file = (await response.json()) as EditionFile;
        if (file.design !== design || file.size !== size || file.edition !== edition) throw new Error(`edition ${key}: not what was fetched`);
        return decodeEdition(file);
      })
      .then((known) => {
        fetched.set(key, known);
        return known;
      })
      .finally(() => loading.delete(key));
    loading.set(key, pending);
  }
  return pending;
};

/** For tests: forget what has been fetched. */
export const forgetEditions = () => {
  fetched.clear();
  loading.clear();
};
