import type { SweaterStitches } from "../../pattern/knitted";
import { type EditionFile, decodeEdition } from "./format";
import { ownEdition } from "./own";

/**
 * Which edition of a size's knitting each project knits.
 *
 * Every size's knitting is named, as an edition, by a hash of it (see
 * format.ts and scripts/editions.mjs), and the manifest says which edition is
 * current. A project records the edition it was started on; one that records
 * none knits the size's edition now. Once a change supersedes it, the project knits the frozen copy until
 * its knitter chooses to move on: nothing published later moves a stitch of
 * anyone's knitting.
 *
 * The site knits every size from its frozen copy, the current edition's too,
 * and a page has no other way to a pattern: nothing it loads can work one
 * out. (A sweater fitted to its knitter part way through is worked out on
 * their device, in a worker, and is then an edition of the project's own,
 * kept there: see library/fit and own.ts.) Working one out is the slowest thing there is to do, the answer is
 * the same for everyone, and it is done once, by `npm run editions`. A size
 * whose copy cannot be fetched - offline, and never opened - says so.
 *
 * A frozen copy is a file served as it is, at an address its name gives, so
 * the page carries no list of them however many a design comes to have, and
 * only a project that knits one ever fetches it. Its name is a hash of what
 * it holds, so it never changes, and the service worker keeps it for good
 * once it has been fetched: see scripts/service-worker.js.
 */

/**
 * Each size's current edition, and, where the current one puts a
 * mistake right, `errata`: what it corrects, in a sentence, which the update
 * offered to a project on an older edition says. Written by hand after `npm
 * run editions`, and kept until the size's knitting moves on again.
 */
type Manifest = Record<string, Record<string, { current: string; errata?: string }>>;

const manifest: Manifest =
  Object.values(import.meta.glob<{ default: Manifest }>("./manifest.json", { eager: true }))[0]?.default ?? {};

const keyOf = (design: string, size: string, edition: string) => `${design}--${size}--${edition}`;

/** Where a frozen copy is served from. */
export const editionUrl = (design: string, size: string, edition: string) =>
  `${import.meta.env.BASE_URL}editions/${keyOf(design, size, edition)}.json`;

/** What a size's edition now corrects, where it says. */
export const errataOf = (design: string, size: string): string | undefined => manifest[design]?.[size]?.errata;

/** The edition a size's knitting is now. */
export const currentEdition = (design: string, size: string): string | undefined => manifest[design]?.[size]?.current;

/** The edition a project knits: the one it was started on, or where it records none, the size's edition now. */
export const editionOf = (project: { sweaterId: string; sizeId: string; edition?: string }): string | undefined =>
  project.edition ?? manifest[project.sweaterId]?.[project.sizeId]?.current;

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

const fetchEdition = async (design: string, size: string, edition: string): Promise<EditionFile> => {
  const key = keyOf(design, size, edition);
  const response = await fetch(editionUrl(design, size, edition));
  if (!response.ok) throw new Error(`edition ${key}: ${response.status}`);
  const file = (await response.json()) as EditionFile;
  if (file.design !== design || file.size !== size || file.edition !== edition) throw new Error(`edition ${key}: not what was fetched`);
  return file;
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
    // The project's own, kept on the device, before the network is asked: see own.ts.
    const own = ownEdition(design, size, from);
    pending = (own ? Promise.resolve(own) : fetchEdition(design, size, from))
      .then((file) => {
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
