import React, { RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { Colourway, SweaterPattern } from "../data/sweaters/types";
import { inkOn, ownBalls, paletteOf, trimIdOf, type Overrides, type Palette } from "../knitting/palette";
import BodyStrip from "./BodyStrip";
import { bodyRounds, stitchScale, usePainting } from "./bodyPicture";
import type { Body } from "./ColourPreview";
import Dialog from "./ui/Dialog";
import "./ColourwayChoice.css";

const balls = (n: number) => `${n} ${n === 1 ? "yarn" : "yarns"}`;

/** How tall the strip grows to once it is the banner, in CSS pixels. */
const BANNER = 96;
/** How far the page scrolls while the strip opens out into the banner. */
const OPEN = 96;
/** The strip's own edge, inside which the yoke is drawn. */
const EDGE = 1;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const between = (from: number, to: number, at: number) => from + (to - from) * at;

interface Place {
  /** The strip's place in the card, in the viewport. */
  left: number;
  right: number;
  width: number;
  height: number;
  screen: number;
  /** How far open, from the strip in the card (0) to the banner (1); undefined while in the card. */
  open?: number;
  top: number;
}

/**
 * The colourway's strip, which becomes the banner at the top of the screen
 * once the page scrolls it there, so the yoke stays in sight while the wool
 * below is chosen.
 *
 * Reaching the top, the strip itself leaves the card and stays, and opens
 * out to the banner, taller and wider together, smoothly, as the page
 * scrolls on. It grows about its middle, like curtains opening onto more of
 * the yoke on either side: nothing slides sideways. While it moves it shows
 * the banner's own picture, scaled to fit, so nothing is redrawn; in the
 * card and once open, every stitch is whole screen pixels. It is pushed off
 * again with the end of `until`, where the choosing ends.
 */
const DockingStrip: React.FC<{ body: Body; palette: Palette; until?: RefObject<Element> }> = ({ body, palette, until }) => {
  const slot = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place>();
  const rounds = useMemo(() => bodyRounds(body.rounds, body.stitches), [body.rounds, body.stitches]);
  const density = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const cardHeight = (place?.height ?? 0) - 2 * EDGE;
  const small = stitchScale(cardHeight * density, rounds.length);
  const large = stitchScale((BANNER - 2 * EDGE) * density, rounds.length);
  const inCard = usePainting(rounds, body.stitches, palette, small);
  const banner = usePainting(rounds, body.stitches, palette, large);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const own = slot.current?.getBoundingClientRect();
      if (!own) return;
      const screen = document.documentElement.clientWidth;
      const docked = own.top <= 0 && own.height > 0;
      const open = docked ? clamp(-own.top / OPEN) : undefined;
      const height = between(own.height, BANNER, open ?? 0);
      const end = until?.current?.getBoundingClientRect().bottom ?? Infinity;
      setPlace({
        left: own.left,
        right: screen - own.right,
        width: own.width,
        height: own.height,
        screen,
        open,
        top: Math.min(0, end - height),
      });
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", later);
      window.removeEventListener("resize", later);
    };
  }, [until]);

  let style: React.CSSProperties & { "--open"?: number } = {};
  const open = place?.open;
  if (place && inCard && banner && cardHeight > 0) {
    // The yoke centred, pinned to whole screen pixels.
    const centre = (width: number, height: number, picture: { width: number; height: number }, scale: number) => ({
      left: Math.round((width * density - picture.width * scale) / 2) / density,
      top: Math.round((height * density - picture.height * scale) / 2) / density,
    });
    if (open === undefined) {
      const at = centre(place.width - 2 * EDGE, cardHeight, inCard, 1);
      style = {
        backgroundImage: `url(${inCard.url})`,
        backgroundSize: `${inCard.width / density}px ${inCard.height / density}px`,
        backgroundPosition: `left ${at.left}px top ${at.top}px`,
      };
    } else {
      // At first the banner's picture shrunk to the card's, stitch for stitch.
      const scale = between(small / large, 1, open);
      const height = between(place.height, BANNER, open);
      // Wider in proportion as it grows taller, keeping its shape, and
      // opened further alongside where that falls short of the screen's
      // edges, so as to reach them as it reaches its height. On a narrow
      // screen, keeping its shape reaches the edges first, and it stops there.
      const shaped = (place.width * height) / place.height;
      const short = Math.max(0, place.screen - (place.width * BANNER) / place.height);
      const width = Math.min(place.screen, shaped + short * open);
      const middle = between(place.left + place.width / 2, place.screen / 2, open);
      const left = Math.max(0, middle - width / 2);
      const right = Math.max(0, place.screen - middle - width / 2);
      const across = centre(place.screen - left - right - 2 * EDGE, 0, banner, scale).left;
      const down = between(
        centre(0, cardHeight, inCard, 1).top,
        centre(0, BANNER - 2 * EDGE, banner, 1).top,
        open,
      );
      style = {
        position: "fixed",
        top: place.top,
        left,
        right,
        height,
        backgroundImage: `url(${banner.url})`,
        backgroundSize: `${(banner.width * scale) / density}px ${(banner.height * scale) / density}px`,
        backgroundPosition: `left ${across}px top ${down}px`,
        "--open": open,
      };
    }
  }

  return (
    <div className="your-colourway-slot" ref={slot}>
      <div
        className={`body-strip your-colourway-strip${open !== undefined ? " is-docked" : ""}`}
        style={style}
        aria-hidden="true"
      />
    </div>
  );
};

/**
 * The trim, chosen among the colourway's own yarns: the one it gives first,
 * marked, and any other of its palette. Part of the colourway rather than
 * wool of the knitter's own, so starting from another colourway resets it.
 */
const TrimChoice: React.FC<{
  trim: NonNullable<SweaterPattern["trim"]>;
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
 * The sweater's colours: there is only ever the knitter's own colourway.
 *
 * The design's colourways are starting points. Choosing one sets every
 * yarn to it, and none of them is marked as chosen afterwards, because once
 * a yarn is changed the sweater isn't any of them. Starting again over wool of
 * the knitter's own asks first, since it can't be undone.
 */
const ColourwayChoice: React.FC<{
  colourways: Colourway[];
  colourway: Colourway;
  overrides: Overrides;
  palette: Palette;
  body: Body;
  onStartFrom: (colourwayId: string) => void;
  /** The design's trim, where it has one, and choosing among the colourway's: see SweaterPattern.trim. */
  trim?: SweaterPattern["trim"];
  /** The trim chosen, if any, by its wool: see palette's trimIdOf. */
  trimChosen?: string;
  onTrim?: (trim: string | undefined) => void;
  /** Where choosing the wool ends, and the strip stops being the banner. */
  until?: RefObject<Element>;
}> = ({ colourways, colourway, overrides, palette, body, onStartFrom, trim, trimChosen, onTrim, until }) => {
  const [asking, setAsking] = useState<Colourway>();
  const own = ownBalls(colourway, overrides);
  const choose = (option: Colourway) => {
    if (own > 0) setAsking(option);
    else if (option.id !== colourway.id) onStartFrom(option.id);
  };

  return (
    <>
      <div className="your-colourway">
        <DockingStrip body={body} palette={palette} until={until} />
        <strong>Your colourway</strong>
        <span className="quiet">
          {own > 0
            ? `Started from ${colourway.name}, with ${balls(own)} of your own`
            : `${colourway.name}, as the design gives it · ${colourway.brand}`}
        </span>
      </div>
      <p className="colourway-starts-title">
        {own > 0 ? "Start again from one of the design's" : "Start from one of the design's"}
      </p>
      {/* All of them, always: choosing the one you're already on changes nothing. Grouped where the design groups them. */}
      {groupsOf(colourways).map(([family, options]) => (
        <div key={family ?? ""} className="colourway-family" role={family ? "group" : undefined} aria-label={family}>
          {family && <p className="colourway-family-title">{family}</p>}
          <div className="chooser colourway-starts">
            {options.map((option) => (
              <button key={option.id} type="button" className="colourway-option" onClick={() => choose(option)}>
                <BodyStrip {...body} palette={paletteOf(option)} className="colourway-motif" />
                <strong>{option.name}</strong>
                <span className="quiet">{option.brand}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
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

export default ColourwayChoice;
