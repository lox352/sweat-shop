import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Keeping a size's settled sweater when its knitting moves on.
 *
 * A settled file is for one knitting of a size, and is written over when the
 * size is settled again. A project still on the edition before (see
 * data/sweaters/editions) would then have no settled sweater to show, so the
 * file about to be written over is first kept, under the edition it was
 * settled for, beside that edition's frozen copy - where only such a project
 * fetches it. `scripts/settled-editions.json` records which edition each
 * size's settled file is for. For scripts/settle.mjs; nothing in the site
 * imports this.
 */
export const settledForPath = "scripts/settled-editions.json";

/** Where a superseded edition's settled sweater is kept, and served from. */
export const keptSettledPath = (design: string, size: string, edition: string) =>
  `public/editions/${design}--${size}--${edition}.settled.json`;

const read = (root: string): Record<string, string> => {
  const path = join(root, settledForPath);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string>) : {};
};

/**
 * Before a size is settled as edition `now`: keep its settled file, if it has
 * one that was settled for another edition. Returns where it was kept.
 */
export const keepSettled = (design: string, size: string, now: string, root = "."): string | undefined => {
  const was = read(root)[`${design}--${size}`];
  const file = join(root, `src/data/sweaters/settled/${design}--${size}.json`);
  if (!was || was === now || !existsSync(file)) return undefined;
  const kept = join(root, keptSettledPath(design, size, was));
  if (!existsSync(kept)) {
    mkdirSync(dirname(kept), { recursive: true });
    copyFileSync(file, kept);
  }
  return kept;
};

/** Once a size's settled file is written: record the edition it is for. */
export const noteSettled = (design: string, size: string, now: string, root = "."): void => {
  const record = { ...read(root), [`${design}--${size}`]: now };
  const sorted = Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  writeFileSync(join(root, settledForPath), `${JSON.stringify(sorted, null, 1)}\n`);
};
