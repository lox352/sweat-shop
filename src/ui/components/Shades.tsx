import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Wool, WoolId, WoolRange } from "../../pattern/yarns";
import { inkOn } from "../../reading/palette";
import Button from "./ui/Button";
import "./Shades.css";

/**
 * Choose the wool actually in your hands.
 *
 * Nine hundred and ninety-eight shades is too many to scroll, so they open
 * on the yarn the pattern names and are searched rather than browsed: "293",
 * "port wine" and "jamieson wine" all find the same ball. The library is
 * fetched when shades are first shown and never on the way to a design,
 * because it is a quarter of a megabyte and most visits never need it.
 *
 * A shade that is not in the library - or a ball whose band went in the bin -
 * is still knittable: there is a plain colour well at the foot.
 *
 * Each shade is a tile of its own colour with its name and number on it,
 * three across on a phone: a dozen to a screenful, set edge to edge to be
 * told apart, and still read as a ball band is. A tile tapped is only tried
 * (see Customise): what shows it says which is being, and keeping it is
 * whoever shows this's.
 */

export interface Chosen {
  wool?: WoolId;
  name?: string;
  code?: string;
  hex?: string;
}

type Library = {
  ranges: WoolRange[];
  search: (query: string, within?: string) => (Wool & { id: WoolId })[];
};

/** Loaded once per visit, then kept. */
let loading: Promise<Library> | undefined;

const load = (): Promise<Library> => {
  loading ??= import("../../pattern/yarns").then((yarns) => ({
    ranges: yarns.woolRanges(),
    search: yarns.searchWools,
  }));
  return loading;
};

/** The shades to change a ball to: searched, or a yarn's own range; a plain colour; and the way back to the pattern's wool. In the sheet of the Customise screen. */
const Shades: React.FC<{
  /** What the ball is now, whether from the pattern or already chosen. */
  current: { name: string; code?: string; hex: string; wool?: WoolId };
  /** Where to start looking: the yarn the colourway is written in. */
  suggest?: string;
  /** Whether the ball is wool of the knitter's own: only then is there a pattern's wool to go back to. */
  own?: boolean;
  /** The shade being tried, if one is. */
  tried?: Chosen;
  /** A shade tapped, to try; and the pattern's wool asked for back. */
  onChoose: (chosen: Chosen) => void;
  onPatterns: () => void;
}> = ({ current, suggest, own = true, tried, onChoose, onPatterns }) => {
  const [library, setLibrary] = useState<Library>();
  const [query, setQuery] = useState("");
  const [within, setWithin] = useState<string>(suggest ?? "");

  // Fetched when shades are first shown, and only once.
  useEffect(() => {
    let live = true;
    load().then((loaded) => {
      if (!live) return;
      // A ball already in wool of another yarn opens on that yarn's shades, where it is.
      const home = current.wool && loaded.ranges.find((range) => range.wools.some((wool) => wool.id === current.wool));
      if (home) setWithin(home.id);
      setLibrary(loaded);
    });
    return () => {
      live = false;
    };
    // Once, as the shades are first shown: what the ball is then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another yarn's shades start from that yarn's own range again.
  useEffect(() => setWithin(suggest ?? ""), [suggest]);

  /*
   * The shades open on the one the ball is in now, not at the top of a list
   * of two hundred: once, when they are first shown. A shade chosen after
   * that is under the finger already, and the list stays where it is.
   */
  const list = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  useLayoutEffect(() => {
    const box = list.current;
    if (!library || opened.current || !box) return;
    opened.current = true;
    const chosen = box.querySelector<HTMLElement>(".yarn-option.is-chosen");
    if (!chosen) return;
    const [inBox, row] = [box.getBoundingClientRect(), chosen.getBoundingClientRect()];
    box.scrollTop += row.top - inBox.top - (inBox.height - row.height) / 2;
  }, [library]);

  const shown = useMemo(() => {
    if (!library) return [];
    if (!query.trim()) {
      const range = library.ranges.find((one) => one.id === within);
      return range ? range.wools : [];
    }
    /*
     * Within the yarn being knitted in first, because that is nearly always
     * what is wanted - but a search that finds nothing there looks
     * everywhere rather than leaving somebody at a dead end wondering
     * whether the wool exists.
     */
    const near = library.search(query, within || undefined);
    return (near.length > 0 ? near : library.search(query)).slice(0, 400);
  }, [library, query, within]);
  // One yarn's shades, browsed: every row is that yarn's, which the menu over them says already.
  const oneRange = !query.trim() && within !== "";

  return (
    <>
      <div className="yarn-picker-controls">
        <label>
          <span className="visually-hidden">Search the wool</span>
          <input type="search" value={query} placeholder="Name, shade number, spinner…" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          <span className="visually-hidden">Which yarn</span>
          <select value={within} onChange={(event) => setWithin(event.target.value)}>
            <option value="">Every yarn</option>
            {library?.ranges.map((range) => (
              <option key={range.id} value={range.id}>
                {range.spinner} · {range.range}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="yarn-picker-list" ref={list}>
        {!library && <p className="quiet">Fetching the wool…</p>}
        {library && shown.length === 0 && (
          <p className="quiet">{query.trim() ? "No wool of that name or number." : "Search, or choose a yarn to see its shades."}</p>
        )}
        <ul>
          {shown.map((wool) => (
            <li key={wool.id}>
              <button
                type="button"
                className={`yarn-option${wool.id === current.wool ? " is-chosen" : ""}${tried?.wool === wool.id ? " is-tried" : ""}`}
                style={{ background: wool.hex, color: inkOn(wool.hex) }}
                aria-pressed={tried ? tried.wool === wool.id : wool.id === current.wool}
                onClick={() => onChoose({ wool: wool.id, name: wool.name, code: wool.code, hex: wool.hex })}
              >
                <span className="yarn-option-name">
                  <strong>{wool.name}</strong>
                  {wool.code ? <span className="yarn-option-code"> {wool.code}</span> : null}
                  {oneRange ? (
                    wool.soldOut && <span className="yarn-option-range">Not in stock</span>
                  ) : (
                    <span className="yarn-option-range">
                      {wool.spinner} · {wool.range}
                      {wool.soldOut ? " · not in stock" : ""}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {/* After the shades, whatever they are scrolled to: a colour of the knitter's own, and the pattern's wool back. */}
        <div className="yarn-picker-foot">
          <label>
            <span>Or a colour off the ball in your hands</span>
            <input type="color" value={current.hex} onChange={(event) => onChoose({ hex: event.target.value, name: "Your own", code: undefined })} />
          </label>
          {own && (
            <Button variant="quiet" onClick={onPatterns}>
              Back to the pattern's wool
            </Button>
          )}
        </div>
      </div>

    </>
  );
};

export default Shades;
