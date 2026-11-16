import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { sweaters } from "../../compiler/designs";
import WoolList from "./WoolList";
import { buildSweater } from "../../compiler/engine/engine";
import { metresBySlot } from "../../reading/yardage";

const sweater = sweaters[0];
const { stitches, rounds } = buildSweater(sweater, "xs");
const metres = metresBySlot(stitches, rounds);

it("counts balls of the colourway's own wool from the size's metres", () => {
  const html = renderToStaticMarkup(<WoolList colourway={sweater.colourways[0]} metres={metres}
    overrides={{}} onPick={() => {}}/>);
  expect(html).toMatch(/\d+ balls · about [\d,]+m/);
  expect(html).toContain("an estimate, not a promise");
});

it("gives metres rather than balls for wool of your own", () => {
  const html = renderToStaticMarkup(<WoolList colourway={sweater.colourways[0]} metres={metres}
    overrides={{ A: { name: "Own", hex: "#000000" } }} onPick={() => {}}
   />);
  expect(html).toMatch(/About [\d,]+m · yours/);
  expect(html).toContain("buy by the metres");
});
