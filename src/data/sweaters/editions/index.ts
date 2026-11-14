import type { SweaterStitches } from "../../../types/Knitted";
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
 * The published site knits every size from its frozen copy, the current
 * edition's too, so that no phone works a pattern out for itself: working one
 * out is the slowest thing the site does, and the answer is the same for
 * everyone. See prepareKnitting. Where a current edition's copy cannot be
 * had - offline, on a size never opened - the size is built as it always was.
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

/**
 * Whether sizes are knitted from their frozen copies. In the published site;
 * not while developing, where the copies are those of the last `npm run
 * editions` and the knitting is whatever is being worked on, nor in the unit
 * tests, which knit what the code builds.
 */
export const compiled = { on: import.meta.env.PROD };

/** Copies asked for and not had, this visit: not asked for again by a page that can do without. */
const gaveUp = new Set<string>();

/** The edition a size is knitted from, for a project on `edition` or for none: its own if superseded, else the size's now. */
export const knittedEdition = (design: string, size: string, edition?: string): string | undefined =>
  isSuperseded(design, size, edition) && !editionMissing(design, size, edition) ? edition : currentEdition(design, size);

/** A size's knitting from its frozen copy, if that has been fetched: see prepareKnitting. */
export const compiledKnitting = (design: string, size: string, edition?: string): SweaterStitches | undefined => {
  const from = knittedEdition(design, size, edition);
  return from ? frozenEdition(design, size, from) : undefined;
};

/**
 * The fetching of a size's frozen copy, where there is one to wait for:
 * undefined once it is had, or was asked for and could not be. It never
 * rejects - a page that waits on it then knits what it can - so a project
 * on a superseded edition, which must have its own knitting or none, asks
 * with loadEdition first: see useEditionReady.
 */
export const prepareKnitting = (design: string, size: string, edition?: string): Promise<void> | undefined => {
  if (!compiled.on) return undefined;
  const from = knittedEdition(design, size, edition);
  if (!from) return undefined;
  const key = keyOf(design, size, from);
  if (fetched.has(key) || gaveUp.has(key)) return undefined;
  return loadEdition(design, size, from).then(
    (known) => {
      if (known === "missing") gaveUp.add(key);
    },
    () => {
      gaveUp.add(key);
    },
  );
};

/** For tests: forget what has been fetched. */
export const forgetEditions = () => {
  fetched.clear();
  loading.clear();
  gaveUp.clear();
};
