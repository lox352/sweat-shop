import { sweaters } from "../data/sweaters";
import { showDesigns } from "../data/sweaters/catalogue";
import type { Design, SweaterPattern } from "../data/sweaters/types";
import { buildSweater } from "./engine";
import { setBuilder } from "./useSweater";

/**
 * Working a pattern out here: the designs' own files and the engine that
 * knits them, which between them are most of what the site once was to fetch.
 *
 * The published site knits from frozen copies (see data/sweaters/editions)
 * and loads this only where one cannot be had - offline, on a size never
 * opened. Developing, and in the tests, it is loaded before anything is
 * shown, so that what is knitted and shown is the designs as they are in
 * hand: see main.tsx and test-setup.ts.
 */
const isPattern = (design: Design): design is SweaterPattern => "charts" in design;

setBuilder((design, sizeId) => {
  // A design handed over whole - a test's own - is knitted as it is; one of the catalogue's by its file.
  const pattern = isPattern(design) ? design : sweaters.find((sweater) => sweater.id === design.id);
  if (!pattern) throw new Error(`${design.id}: no such design to knit`);
  return buildSweater(pattern, sizeId);
});

/** The designs as their files have them, in place of the catalogue's copies. */
export const showLiveDesigns = () => showDesigns(sweaters);
