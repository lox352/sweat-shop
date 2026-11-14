import type { Design } from "../../pattern/design";
import file from "./catalogue.json";
import { type CatalogueFile, decodeCatalogue } from "./format";

/**
 * Every design the site knows about, without its knitting: all the site
 * reads of a design (see types' Design).
 *
 * Written from the designs' own files by `npm run editions`, so that a page carries no chart and nothing a pattern is worked out with.
 * A design's knitting comes from its editions (see editions/), fetched a size
 * at a time. Developing, the server writes both afresh from the designs as
 * they are in hand: see scripts/live-patterns.mjs.
 */
/** In the order the designs are listed in ../index.ts, which the file is written from. */
export const sweaters: Design[] = decodeCatalogue(file as unknown as CatalogueFile);

export const sweaterById = (id: string | undefined): Design | undefined => sweaters.find((sweater) => sweater.id === id);
