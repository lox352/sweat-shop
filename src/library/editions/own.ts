import type { EditionFile } from "./format";

/**
 * Editions a project owns: knitting no published file holds, kept on the
 * device in an edition's own format.
 *
 * A project knits a published edition until its knitting is made its own -
 * fitted to its knitter's tension (see library/fit), or carried on from an
 * edition part way through. From then the knitting is the project's, named
 * as an edition is by a hash of what it holds, and found here before the
 * network is asked: see loadEdition. It goes into a backup with its project,
 * and is dropped when no project knits it.
 */
const prefix = "edition-";
const keyFor = (design: string, size: string, edition: string) => `${prefix}${design}--${size}--${edition}`;

/** An edition kept on the device, if this one is. */
export const ownEdition = (design: string, size: string, edition: string): EditionFile | undefined => {
  try {
    const raw = localStorage.getItem(keyFor(design, size, edition));
    if (!raw) return undefined;
    const file = JSON.parse(raw) as EditionFile;
    return file.design === design && file.size === size && file.edition === edition ? file : undefined;
  } catch {
    return undefined;
  }
};

/** Keep an edition on the device. False where the device would not: it is full, or storing is off. */
export const keepEdition = (file: EditionFile): boolean => {
  try {
    localStorage.setItem(keyFor(file.design, file.size, file.edition), JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
};

/** Drop every edition kept that none of these projects knits. */
export const dropEditionsBut = (projects: { sweaterId: string; sizeId: string; edition?: string }[]) => {
  const knitted = new Set(projects.flatMap((project) => (project.edition ? [keyFor(project.sweaterId, project.sizeId, project.edition)] : [])));
  try {
    const kept = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((key): key is string => !!key?.startsWith(prefix));
    for (const key of kept) if (!knitted.has(key)) localStorage.removeItem(key);
  } catch {
    // Nothing to drop where nothing can be kept.
  }
};
