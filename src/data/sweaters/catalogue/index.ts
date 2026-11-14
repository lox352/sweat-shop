import type { Design } from "../types";
import file from "./catalogue.json";
import { type CatalogueFile, decodeCatalogue } from "./format";

/**
 * Every design the site knows about, without its knitting: all the site
 * reads of a design (see types' Design).
 *
 * Written from the designs' own files by `npm run editions`, so that a page carries no chart and nothing a pattern is worked out with.
 * A design's knitting comes from its editions (see editions/), fetched a size
 * at a time; the designs' own files, and the engine that knits them, are
 * loaded only where a pattern has to be worked out after all: see
 * knitting/builder.
 */
/** In the order the designs are listed in ../index.ts, which the file is written from. */
export let sweaters: Design[] = decodeCatalogue(file as unknown as CatalogueFile);

export const sweaterById = (id: string | undefined): Design | undefined => sweaters.find((sweater) => sweater.id === id);

/**
 * The designs themselves in place of the catalogue's copies of them, for
 * where they are loaded anyway - developing, and the tests - so that a design
 * being worked on is what is shown, whether or not the catalogue has been
 * written since. See knitting/builder.
 */
export const showDesigns = (designs: Design[]) => {
  sweaters = designs;
};
