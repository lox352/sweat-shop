import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./Pages.css";

export interface Page {
  id: string;
  /** What the page is: read out for a dot, and written on it where the pages are named. */
  label: string;
  content: React.ReactNode;
}

/**
 * What a panel holds, a page at a time: each page the size of the panel,
 * side by side, swiped between like the pages of a phone's home screen and
 * coming to rest on one, never between two.
 *
 * So that nothing a panel holds is found by scrolling down past the rest of
 * it, and the panel never needs more room than it has: a page too long for
 * it scrolls by itself, and the pages beside it stay where they are.
 *
 * Which page is shown is marked under the pages by dots, or over them by
 * their names where the names are what is being chosen between - a design's
 * groups of colourways. Either is tapped to go straight to a page.
 *
 * A page is drawn when it is first near: the one shown and the one either
 * side, so a swipe always has its next page ready, and a design with forty
 * colourways does not draw them all to show eight.
 */
const Pages: React.FC<{
  pages: Page[];
  /** What the pages are of, for a screen reader: "Size". */
  label: string;
  nav?: "dots" | "names";
  /** The page it opens on, by its id: the first, unless told. */
  first?: string;
}> = ({ pages, label, nav = "dots", first }) => {
  const track = useRef<HTMLDivElement>(null);
  const names = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.max(0, pages.findIndex((page) => page.id === first)));
  const shown = Math.min(index, pages.length - 1);
  const at = useRef(shown);
  at.current = shown;
  /** The page a tap on a dot or a name is on its way to: until it is there, the pages passed on the way are not the page shown. */
  const going = useRef<number>();
  const seen = useRef(new Set<number>());
  for (const near of [shown - 1, shown, shown + 1]) seen.current.add(near);

  // Put where the page shown is: as it opens, and whenever its width changes - a panel shown again, a phone turned.
  useLayoutEffect(() => {
    const box = track.current;
    if (!box) return;
    const place = () => {
      if (box.clientWidth > 0) box.scrollLeft = at.current * box.clientWidth;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    let width = box.clientWidth;
    const watch = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      place();
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  // The name of the page shown is kept in view among the names.
  useEffect(() => {
    const row = names.current;
    const name = row?.children[shown] as HTMLElement | undefined;
    if (!row || !name) return;
    // By where they are on screen: the row is nobody's offset parent.
    const [inRow, at] = [row.getBoundingClientRect(), name.getBoundingClientRect()];
    const left = row.scrollLeft + at.left - inRow.left - (inRow.width - at.width) / 2;
    row.scrollTo?.({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [shown]);

  const go = useCallback((to: number) => {
    const box = track.current;
    going.current = to;
    setIndex(to);
    box?.scrollTo?.({ left: to * box.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  const onScroll = () => {
    const box = track.current;
    if (!box || box.clientWidth === 0) return;
    const now = Math.round(box.scrollLeft / box.clientWidth);
    if (going.current !== undefined) {
      if (now !== going.current) return;
      going.current = undefined;
    }
    if (now !== at.current) setIndex(now);
  };

  const tabs = pages.map((page, to) => (
    <button
      key={page.id}
      type="button"
      role="tab"
      id={`${label}-page-tab-${page.id}`}
      className={nav === "names" ? "pages-name" : "pages-dot"}
      aria-selected={to === shown}
      aria-label={nav === "names" ? undefined : page.label}
      title={nav === "names" ? undefined : page.label}
      onClick={() => go(to)}
    >
      {nav === "names" ? page.label : <span aria-hidden="true" />}
    </button>
  ));

  return (
    <div className={`pages pages-by-${nav}`}>
      {nav === "names" && pages.length > 1 && (
        <div className="pages-names" role="tablist" aria-label={label} ref={names}>
          {tabs}
        </div>
      )}
      <div
        className="pages-track"
        ref={track}
        onScroll={onScroll}
        // A finger on the pages takes them over from wherever a tap was sending them.
        onPointerDown={() => (going.current = undefined)}
      >
        {pages.map((page, to) => (
          <div
            key={page.id}
            className="pages-page"
            role="tabpanel"
            aria-label={page.label}
            data-page={page.id}
            data-current={to === shown ? "" : undefined}
            // The pages either side are there to be swiped to, not to be tabbed into or read out.
            {...(to === shown ? {} : { inert: "" })}
          >
            {seen.current.has(to) && page.content}
          </div>
        ))}
      </div>
      {nav === "dots" && pages.length > 1 && (
        <div className="pages-dots" role="tablist" aria-label={label}>
          {tabs}
        </div>
      )}
    </div>
  );
};

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default Pages;
