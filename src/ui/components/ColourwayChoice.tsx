import React from "react";
import type { Colourway, Design } from "../../pattern/design";
import { inkOn, paletteOf, trimIdOf, type Palette } from "../../reading/palette";
import BodyStrip from "./BodyStrip";
import type { Body } from "./ColourPreview";
import "./ColourwayChoice.css";

/**
 * The trim, chosen among the colourway's own yarns: the one it gives first,
 * marked, and any other of its palette. Part of the colourway rather than
 * wool of the knitter's own, so starting from another colourway resets it.
 */
export const TrimChoice: React.FC<{
  trim: NonNullable<Design["trim"]>;
  colourway: Colourway;
  /** The colourway as the design gives it, before any trim is chosen. */
  given: Colourway;
  chosen?: string;
  onTrim: (trim: string | undefined) => void;
  /** Under a heading of its own already - a sheet's: the choice first, and what the trim is said after it. */
  bare?: boolean;
}> = ({ trim, colourway, given, chosen: choice, onTrim, bare }) => {
  /*
   * The colourway's own: one yarn for the trim, or for a trim in parts (see
   * palette's trimmed) each part's own, which no one yarn stands for. Then
   * the colourway's own is a choice of its own, chosen until a yarn is.
   */
  const parts = given.shades.filter((s) => s.slot.split("/")[0] === trim.slot);
  const inParts = parts.some((s) => s.slot !== trim.slot);
  const current = inParts ? colourway.trims!.find((t) => trimIdOf(t) === choice) : colourway.shades.find((s) => s.slot === trim.slot);
  return (
    <div className="trim-choice" role="group" aria-label={trim.label}>
      {!bare && (
        <p className="colourway-starts-title">
          <strong>{trim.label}</strong>
          {trim.note ? ` · ${trim.note}` : ""}
        </p>
      )}
      <div className="trim-options">
        {inParts && (
          <button type="button" className="trim-option" aria-pressed={current === undefined} onClick={() => onTrim(undefined)}>
            <span className="trim-swatch trim-swatch-parts" aria-hidden="true">
              {[...new Map(parts.map((p) => [p.hex, p])).values()].map((p) => (
                <span key={p.slot} style={{ background: p.hex }} />
              ))}
              {current === undefined && <span className="trim-tick" style={{ color: inkOn(parts[0].hex) }}>✓</span>}
            </span>
            <span>Darkest beside each</span>
          </button>
        )}
        {colourway.trims!.map((option) => {
          const id = trimIdOf(option);
          const chosen = current !== undefined && trimIdOf(current) === id;
          return (
            <button
              key={id}
              type="button"
              className="trim-option"
              aria-pressed={chosen}
              onClick={() => onTrim(id)}
              title={`${option.name}${option.code ? ` (${option.code})` : ""}`}
            >
              <span className="trim-swatch" style={{ background: option.hex, color: inkOn(option.hex) }} aria-hidden="true">
                {chosen ? "✓" : ""}
              </span>
              <span>{option.name}</span>
            </button>
          );
        })}
      </div>
      {bare && trim.note && <p className="colourway-starts-title">{trim.note}</p>}
    </div>
  );
};

/** Each colourway's yarns as the design gives it, worked out once: a sampler's has a thousand, and its tile is drawn from them again whenever they are another object. */
const asGiven = new WeakMap<Colourway, Palette>();
const paletteAsGiven = (colourway: Colourway): Palette => {
  let palette = asGiven.get(colourway);
  if (!palette) {
    palette = paletteOf(colourway);
    asGiven.set(colourway, palette);
  }
  return palette;
};

/** Colourways as tiles, in even columns: a strip of each on the yoke, and its name, the one in use marked. Drawn again only when what it shows changes. */
export const ColourwayGrid = React.memo(function ColourwayGrid({
  options,
  chosen,
  body,
  onChoose,
}: {
  options: Colourway[];
  /** The colourway in use, by its id. */
  chosen: string;
  body: Body;
  onChoose: (option: Colourway) => void;
}) {
  return (
    <div className="colourway-grid">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`colourway-option${option.id === chosen ? " is-chosen" : ""}`}
          aria-pressed={option.id === chosen}
          onClick={() => onChoose(option)}
        >
          <BodyStrip {...body} palette={paletteAsGiven(option)} className="colourway-motif" />
          <strong>{option.name}</strong>
        </button>
      ))}
    </div>
  );
});
