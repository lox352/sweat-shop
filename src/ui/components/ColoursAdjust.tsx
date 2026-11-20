import React from "react";
import type { Colourway, Design } from "../../pattern/design";
import { rgbOf, trimIdOf } from "../../reading/palette";
import { TrimChoice } from "./ColourwayChoice";
import Sheet from "./ui/Sheet";
import "./ColoursAdjust.css";

/** The trims a colourway offers for a design's trim, where there is a choice of them. */
const trimsOf = (trim: Design["trim"], colourway: Colourway) => (trim && colourway.trims && colourway.trims.length > 1 ? colourway.trims : undefined);

const chevron = (
  <svg className="colours-adjust-go" width="6" height="10" viewBox="0 0 7 12" aria-hidden="true">
    <path d="M1 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Under every page of a jumper's colours, what is done to the colourway
 * chosen: its trim and its wools, each a pill that opens a card up from the
 * foot. The same row on each page, held at the page's foot while what is
 * over it scrolls. A design's page and a jumper's own both have it.
 */
export const ColoursAdjust: React.FC<{
  /** The design's trim, where it has one: see Design.trim. */
  trim: Design["trim"];
  /** The colourway in use, with the trim chosen; and as the design gives it, before any is. */
  colourway: Colourway;
  given: Colourway;
  /** The trim chosen, if any, by its wool: see palette's trimIdOf. */
  trimChosen?: string;
  /** How many of its wools are the knitter's own. */
  own: number;
  onTrim: () => void;
  onWool: () => void;
}> = ({ trim, colourway, given, trimChosen, own, onTrim, onWool }) => {
  const trims = trimsOf(trim, colourway);
  const trimNow =
    trim && trims && (trims.find((one) => trimIdOf(one) === trimChosen) ?? (given.shades.some((s) => s.slot === trim.slot) ? colourway.shades.find((s) => s.slot === trim.slot) : undefined));
  // Where the trim is in parts, each the darkest yarn beside it, the darkest of them stands for it.
  const trimHex =
    trimNow?.hex ??
    (trim &&
      given.shades
        .filter((shade) => shade.slot.split("/")[0] === trim.slot)
        .map((shade) => shade.hex)
        .sort((a, b) => rgbOf(a).reduce((sum, part) => sum + part, 0) - rgbOf(b).reduce((sum, part) => sum + part, 0))[0]);
  return (
    <div className="colours-adjust">
      {trims && trim && (
        <button type="button" className="colours-adjust-one" aria-haspopup="dialog" onClick={onTrim}>
          {trimHex && <span className="colours-adjust-swatch" style={{ background: trimHex }} aria-hidden="true" />}
          <strong>{trim.label}</strong>
          <span className="quiet">{trimNow?.name ?? "Darkest beside each"}</span>
          {chevron}
        </button>
      )}
      <button type="button" className="colours-adjust-one" aria-haspopup="dialog" onClick={onWool}>
        <strong>Change wool</strong>
        {own > 0 && <span className="quiet">{own} your own</span>}
        {chevron}
      </button>
    </div>
  );
};

/** The trim, chosen in a card up from the foot: nothing, where the colourway has no choice of them. */
export const TrimSheet: React.FC<{
  trim: Design["trim"];
  colourway: Colourway;
  given: Colourway;
  chosen?: string;
  onTrim: (trim: string | undefined) => void;
  onClose: () => void;
}> = ({ trim, colourway, given, chosen, onTrim, onClose }) =>
  trim && trimsOf(trim, colourway) ? (
    <Sheet title={trim.label} eyebrow={colourway.name} onClose={onClose}>
      <div className="sheet-body">
        <TrimChoice trim={trim} colourway={colourway} given={given} chosen={chosen} onTrim={onTrim} bare />
      </div>
    </Sheet>
  ) : null;
