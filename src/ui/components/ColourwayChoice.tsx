import React, { useMemo, useState } from "react";
import type { Colourway, Design } from "../../pattern/design";
import { inkOn, ownBalls, paletteOf, trimIdOf, type Overrides } from "../../reading/palette";
import BodyStrip from "./BodyStrip";
import type { Body } from "./ColourPreview";
import Dialog from "./ui/Dialog";
import "./ColourwayChoice.css";

const balls = (n: number) => `${n} ${n === 1 ? "yarn" : "yarns"}`;

/**
 * The trim, chosen among the colourway's own yarns: the one it gives first,
 * marked, and any other of its palette. Part of the colourway rather than
 * wool of the knitter's own, so starting from another colourway resets it.
 */
const TrimChoice: React.FC<{
  trim: NonNullable<Design["trim"]>;
  colourway: Colourway;
  /** The colourway as the design gives it, before any trim is chosen. */
  given: Colourway;
  chosen?: string;
  onTrim: (trim: string | undefined) => void;
}> = ({ trim, colourway, given, chosen: choice, onTrim }) => {
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
      <p className="colourway-starts-title">
        <strong>{trim.label}</strong>
        {trim.note ? ` · ${trim.note}` : ""}
      </p>
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
    </div>
  );
};

/** A design's colourways in its groups, in the order they first come; one group, unnamed, where it has none. */
const groupsOf = (colourways: Colourway[]): [string | undefined, Colourway[]][] => {
  const groups = new Map<string | undefined, Colourway[]>();
  for (const c of colourways) groups.set(c.family, [...(groups.get(c.family) ?? []), c]);
  return [...groups];
};

/**
 * The sweater's colours, chosen from the design's colourways: each a base to
 * start from. Choosing one sets every yarn to it, and the jumper on the stage
 * wears it at once. Where a design has many, they are shown a group at a
 * time, the group of the one in use first.
 *
 * Once a yarn is changed the sweater is the knitter's own, from that base;
 * starting again from another asks first, since it can't be undone.
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
  const [asking, setAsking] = useState<Colourway>();
  const groups = useMemo(() => groupsOf(colourways), [colourways]);
  const [family, setFamily] = useState(colourway.family);
  const shown = groups.find(([name]) => name === family)?.[1] ?? groups[0][1];
  const own = ownBalls(colourway, overrides);
  const choose = (option: Colourway) => {
    if (own > 0) setAsking(option);
    else if (option.id !== colourway.id) onStartFrom(option.id);
  };

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
      <div className="colourway-grid">
        {shown.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`colourway-option${option.id === colourway.id ? " is-chosen" : ""}`}
            aria-pressed={option.id === colourway.id}
            onClick={() => choose(option)}
          >
            <BodyStrip {...body} palette={paletteOf(option)} className="colourway-motif" />
            <strong>{option.name}</strong>
          </button>
        ))}
      </div>
      {trim && onTrim && colourway.trims && colourway.trims.length > 1 && (
        <TrimChoice
          trim={trim}
          colourway={colourway}
          given={colourways.find((c) => c.id === colourway.id) ?? colourway}
          chosen={trimChosen}
          onTrim={onTrim}
        />
      )}
      <Dialog
        open={asking !== undefined}
        title={`Start again from ${asking?.name ?? ""}?`}
        text={`Every yarn changes to ${asking?.name ?? ""}'s, including the ${own === 1 ? "one" : own} of your own.`}
        confirmLabel="Start again"
        onConfirm={() => {
          if (asking) onStartFrom(asking.id);
          setAsking(undefined);
        }}
        onCancel={() => setAsking(undefined)}
      />
    </>
  );
};

// Drawn again only when what it shows changes: a sampler has many colourways of a thousand yarns each, and a project changes for other reasons.
export default React.memo(ColourwayChoice);
