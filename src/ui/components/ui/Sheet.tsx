import React, { useEffect, useRef } from "react";
import "./Sheet.css";

/**
 * A card that comes up from the foot, over what is under a stage, with its
 * own way out at its top right: for something looked into without leaving
 * the page - a trim, the wools of a colourway - while the jumper on the
 * stage stays where it is and shows what is being changed.
 *
 * It is put where a StageLayout has room for one (its `sheet`), and covers
 * as much of that as it needs: all of it where it is `full`. What is behind
 * it is dimmed, and a tap there, or Escape, closes it. Nothing is added to
 * the browser's history: it opens and closes at once.
 *
 * One card may come up over another - the shades to change a wool to, over
 * the chart the wool was found on. The one over is `stacked`: what is left
 * showing of the card under it is not dimmed, and is still that card's to
 * use. The one `under` leaves Escape to the card over it.
 */
const Sheet: React.FC<{
  /** What it is, at its top; and over that, in small, what it is of. */
  title: string;
  eyebrow?: React.ReactNode;
  /** Its name for a screen reader, where the title alone would not say. */
  label?: string;
  /** Before its title, a picture of what it is of - a wool's colour; and beside its way out, another thing to do from it. */
  lead?: React.ReactNode;
  aside?: React.ReactNode;
  /** As tall as the room it has, rather than as tall as what is in it. */
  full?: boolean;
  /** Over another card, which shows undimmed past it; and under one, which Escape closes first. */
  stacked?: boolean;
  under?: boolean;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, eyebrow, label, lead, aside, full, stacked, under, className, onClose, children }) => {
  const sheet = useRef<HTMLElement>(null);
  // The sheet itself, not its first button, is what was opened.
  useEffect(() => sheet.current?.focus(), []);
  useEffect(() => {
    if (under) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, under]);

  return (
    <>
      {!stacked && <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />}
      <section ref={sheet} className={["sheet", full ? "is-full" : "", stacked ? "is-stacked" : "", className ?? ""].filter(Boolean).join(" ")} role="dialog" aria-label={label ?? title} tabIndex={-1}>
        <header className="sheet-head">
          {lead}
          <div className="sheet-head-text">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <strong>{title}</strong>
          </div>
          {aside}
          <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </section>
    </>
  );
};

export default Sheet;
