import { sweaters } from "./compiler/designs";
import type { Design, SweaterPattern } from "./compiler/designs/types";
import { buildSweater } from "./compiler/engine/engine";
import type { SweaterStitches } from "./pattern/knitted";
import { knitInHand } from "./library/knitting";

/*
 * The tests knit the designs as they are in hand, at once, where the site
 * fetches each size's frozen copy: a design handed over whole - a test's own -
 * as it is, and one of the catalogue's by its file. Kept, as the answer is
 * the same every time.
 */
const knitted = new Map<string, SweaterStitches>();
const isPattern = (design: Design): design is SweaterPattern => "charts" in design;
knitInHand((design, sizeId) => {
  const pattern = isPattern(design) ? design : sweaters.find((sweater) => sweater.id === design.id);
  if (!pattern) throw new Error(`${design.id}: no such design to knit`);
  const key = `${pattern.id}::${sizeId ?? ""}`;
  let built = knitted.get(key);
  if (!built) knitted.set(key, (built = buildSweater(pattern, sizeId)));
  return built;
});
