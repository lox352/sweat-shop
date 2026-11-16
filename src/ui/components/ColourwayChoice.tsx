import React, { useState } from "react";
import type { Colourway, Design } from "../../pattern/design";
import { inkOn, paletteOf, trimIdOf, type Overrides, type Palette } from "../../reading/palette";
import BodyStrip from "./BodyStrip";
import type { Body } from "./ColourPreview";
import { useColourwayChoice } from "../useColourwayChoice";
import "./ColourwayChoice.css";

const balls = (n: number) => `${n} ${n === 1 ? "yarn" : "yarns"}`;

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

/**
 * The sweater's colours on a jumper's own page, to start again from: the
 * design's colourways, a group at a time where it has many, the group of the
 * one in use first; and under them the trim. A design's page lays the same
 * choice out in its own pages: see Sweater.
 */
const ColourwayChoice: React.FC<{
  colourways: Colourway[];
  colourway: Colourway;
  overrides: Overrides;
  body: Body;
  onStartFrom: (colourwayId: string) => void;
  /** The design's trim, where it has one, and choosing among the colourway's: see Design.trim. */
  trim?: Design["trim"];
  /** The trim chosen, if any, by its wool: see palette's trimIdOf. */
  trimChosen?: string;
  onTrim?: (trim: string | undefined) => void;
  /** Whether it says which colourway is in use, over the choice of them: not where whatever shows it has said so already. */
  named?: boolean;
}> = ({ colourways, colourway, overrides, body, onStartFrom, trim, trimChosen, onTrim, named = true }) => {
  const { groups, own, choose, confirm } = useColourwayChoice({ colourways, colourway, overrides, onStartFrom });
  const [family, setFamily] = useState(colourway.family);
  const shown = groups.find(([name]) => name === family)?.[1] ?? groups[0][1];

  return (
    <>
      {named && <p className="your-colourway">
        <strong>{colourway.name}</strong>{" "}
        <span className="quiet">
          {own > 0 ? (
            `with ${balls(own)} of your own`
          ) : (
            <>
              as the design gives it{" "}
              {/* The spinner with its dot, so a line never ends on the dot alone. */}
              <span className="your-colourway-brand">· {colourway.brand}</span>
            </>
          )}
        </span>
      </p>}
      {groups.length > 1 && (
        <div className="colourway-families" role="group" aria-label="Groups of colourways">
          {groups.map(([name]) => (
            <button key={name ?? ""} type="button" className="colourway-family" aria-pressed={name === family} onClick={() => setFamily(name)}>
              {name}
            </button>
          ))}
        </div>
      )}
      {/* All of the group, always: choosing the one in use changes nothing. */}
      <ColourwayGrid options={shown} chosen={colourway.id} body={body} onChoose={choose} />
      {trim && onTrim && colourway.trims && colourway.trims.length > 1 && (
        <TrimChoice trim={trim} colourway={colourway} given={colourways.find((c) => c.id === colourway.id) ?? colourway} chosen={trimChosen} onTrim={onTrim} />
      )}
      {confirm}
    </>
  );
};

// Drawn again only when what it shows changes: a sampler has many colourways of a thousand yarns each, and a project changes for other reasons.
export default React.memo(ColourwayChoice);
