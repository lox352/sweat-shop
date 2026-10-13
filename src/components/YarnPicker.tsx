import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Wool, WoolId, WoolRange } from "../data/yarns";
import { inkOn } from "../knitting/palette";
import Button from "./ui/Button";
import "./YarnPicker.css";

/**
 * Choose the wool actually in your hands.
 *
 * Nine hundred and ninety-eight shades is too many to scroll, so it opens on
 * the yarn the pattern names and is searched rather than browsed: "293",
 * "port wine" and "jamieson wine" all find the same ball. The library is
 * fetched when the picker first opens and never on the way to a hat, because
 * it is a quarter of a megabyte and most visits never need it.
 *
 * A shade that is not in the library - or a ball whose band went in the bin -
 * is still knittable: there is a plain colour well at the bottom.
 */

export interface Chosen {
  wool?: WoolId;
  name?: string;
  code?: string;
  hex?: string;
}

interface YarnPickerProps {
  open: boolean;
  /** Which yarn of the pattern is being replaced: "Yarn C", or "Yarns A, C and G". */
  label: string;
  /** What it is now, whether from the pattern or already chosen. */
  current: { name: string; code?: string; hex: string; wool?: WoolId };
  /** Where to start looking: the yarn the colourway is written in. */
  suggest?: string;
  onChoose: (chosen: Chosen | undefined) => void;
  onClose: () => void;
  /**
   * Something to show the choice by, above the wool. With one, choosing a
   * shade tries it rather than closing, so several can be compared.
   */
  preview?: React.ReactNode;
}

type Library = {
  ranges: WoolRange[];
  search: (query: string, within?: string) => (Wool & { id: WoolId })[];
};

/** Loaded once per visit, then kept. */
let loading: Promise<Library> | undefined;

const load = (): Promise<Library> => {
  loading ??= import("../data/yarns").then((yarns) => ({
    ranges: yarns.woolRanges(),
    search: yarns.searchWools,
  }));
  return loading;
};

const YarnPicker: React.FC<YarnPickerProps> = ({
  open,
  label,
  current,
  suggest,
  onChoose,
  onClose,
  preview,
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [library, setLibrary] = useState<Library>();
  const [query, setQuery] = useState("");
  const [within, setWithin] = useState<string>(suggest ?? "");

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const cancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    element.addEventListener("cancel", cancel);
    return () => element.removeEventListener("cancel", cancel);
  }, [onClose]);

  // Only when it is actually opened, and only once.
  useEffect(() => {
    if (!open || library) return;
    let live = true;
    load().then((loaded) => live && setLibrary(loaded));
    return () => {
      live = false;
    };
  }, [open, library]);

  // Reopening on a different yarn starts from that yarn's own range again.
  useEffect(() => {
    if (open) setWithin(suggest ?? "");
  }, [open, suggest]);

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

  const take = (wool: Wool & { id: WoolId }) => {
    onChoose({
      wool: wool.id,
      name: wool.name,
      code: wool.code,
      hex: wool.hex,
    });
    if (!preview) onClose();
  };

  return (
    <dialog className="yarn-picker" ref={dialog} aria-label={`Wool for ${label}`}>
      <div className="yarn-picker-head">
        <div>
          <h2>
            {label}
            <span className="quiet">
              {" "}
              · now {current.name}
              {current.code ? ` (${current.code})` : ""}
            </span>
          </h2>
          <span
            className="shade-chip"
            style={{ background: current.hex, color: inkOn(current.hex) }}
          >
            {current.hex}
          </span>
        </div>
        <Button variant="quiet" onClick={onClose} aria-label="Close">
          Done
        </Button>
      </div>
      {preview && (
        <div className="yarn-picker-preview">
          {preview}
          <p className="quiet">Tap a shade to try it; Done keeps it.</p>
        </div>
      )}

      <div className="yarn-picker-controls">
        <label>
          <span className="visually-hidden">Search the wool</span>
          <input
            type="search"
            value={query}
            placeholder="Name, shade number, spinner…"
            onChange={(event) => setQuery(event.target.value)}
          />
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

      <div className="yarn-picker-list">
        {!library && <p className="quiet">Fetching the wool…</p>}
        {library && shown.length === 0 && (
          <p className="quiet">
            {query.trim()
              ? "No wool of that name or number."
              : "Search, or choose a yarn to see its shades."}
          </p>
        )}
        <ul>
          {shown.map((wool) => (
            <li key={wool.id}>
              <button
                type="button"
                className={`yarn-option${wool.id === current.wool ? " is-chosen" : ""}`}
                aria-pressed={wool.id === current.wool}
                onClick={() => take(wool)}
              >
                <span className="yarn-swatch" style={{ background: wool.hex }} />
                <span className="yarn-option-name">
                  <strong>{wool.name}</strong>
                  {wool.code ? <span className="quiet"> {wool.code}</span> : null}
                  <span className="quiet yarn-option-range">
                    {wool.spinner} · {wool.range}
                    {wool.soldOut ? " · not in stock" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="yarn-picker-foot">
        <label>
          <span>Or a colour off the ball in your hands</span>
          <input
            type="color"
            value={current.hex}
            onChange={(event) =>
              onChoose({ hex: event.target.value, name: "Your own", code: undefined })
            }
          />
        </label>
        <Button variant="quiet" onClick={() => onChoose(undefined)}>
          Back to the pattern's wool
        </Button>
      </div>
    </dialog>
  );
};

export default YarnPicker;
