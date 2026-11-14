import type { SweaterStitches } from "../../pattern/knitted";
import { type EditionFile, decodeEdition } from "./format";

/**
 * Which edition of a size's knitting each project knits.
 *
 * Every size's knitting is named, as an edition, by a hash of it (see
 * format.ts and scripts/editions.mjs), and the manifest says which edition is
 * current and which was the first the site named. A project records the
 * edition it was started on; one saved before editions existed knits the
 * first. Once a change supersedes it, the project knits the frozen copy until
 * its knitter chooses to move on: nothing published later moves a stitch of
 * anyone's knitting.
 *
 * The site knits every size from its frozen copy, the current edition's too,
 * and has no other way to a pattern: nothing a browser loads can work one
 * out. Working one out is the slowest thing there is to do, the answer is
 * the same for everyone, and it is done once, by `npm run editions`. A size
 * whose copy cannot be fetched - offline, and never opened - says so.
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

/** The frozen copies fetched, and those that could not be: see loadEdition. */
const fetched = new Map<string, SweaterStitches>();
const loading = new Map<string, Promise<SweaterStitches>>();
const failed = new Set<string>();

/** The edition a size is knitted from, for a project on `edition` or for none: its own, else the size's now. */
export const knittedEdition = (design: string, size: string, edition?: string): string | undefined =>
  edition ?? currentEdition(design, size);

/** A size's knitting, if its frozen copy has been fetched: see loadEdition. */
export const editionKnitting = (design: string, size: string, edition?: string): SweaterStitches | undefined => {
  const from = knittedEdition(design, size, edition);
  return from ? fetched.get(keyOf(design, size, from)) : undefined;
};

/** Whether a size's frozen copy was asked for and could not be had: until askAgain. */
export const editionFailed = (design: string, size: string, edition?: string): boolean => {
  const from = knittedEdition(design, size, edition);
  return !from || !/^[0-9a-f]+$/.test(from) || failed.has(keyOf(design, size, from));
};

/**
 * Fetch and decode a size's frozen copy, once. Rejects where it could not be
 * reached or read, or the site has none of that name: a project is never
 * shown some other knitting for want of its own.
 */
export const loadEdition = (design: string, size: string, edition?: string): Promise<SweaterStitches> => {
  const from = knittedEdition(design, size, edition);
  // Only ever a name an edition could have, and so an address under editions/.
  if (!from || !/^[0-9a-f]+$/.test(from)) return Promise.reject(new Error(`${design} ${size}: no edition`));
  const key = keyOf(design, size, from);
  const known = fetched.get(key);
  if (known) return Promise.resolve(known);
  let pending = loading.get(key);
  if (!pending) {
    pending = fetch(editionUrl(design, size, from))
      .then(async (response) => {
        if (!response.ok) throw new Error(`edition ${key}: ${response.status}`);
        const file = (await response.json()) as EditionFile;
        if (file.design !== design || file.size !== size || file.edition !== from) throw new Error(`edition ${key}: not what was fetched`);
        const known = decodeEdition(file);
        fetched.set(key, known);
        failed.delete(key);
        return known;
      })
      .catch((error: unknown) => {
        failed.add(key);
        throw error;
      })
      .finally(() => loading.delete(key));
    loading.set(key, pending);
  }
  return pending;
};

/** Ask again for the copies asked for and not had. */
export const askAgain = () => failed.clear();

/** For tests: forget what has been fetched. */
export const forgetEditions = () => {
  fetched.clear();
  loading.clear();
  failed.clear();
};
