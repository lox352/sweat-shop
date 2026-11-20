import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StageSlot } from "./stage-slot";
import "./Pages.css";

export interface Page {
  id: string;
  /** What the page is: its title over it, and what its dot is called. */
  label: string;
  content: React.ReactNode;
}

/** A tab's pages: one or several, side by side. */
export interface PageGroup {
  id: string;
  /** The tab's name. */
  label: string;
  pages: Page[];
  /** The way forward - the tab a knitter is on their way to - marked so among the tabs. */
  forward?: boolean;
}

export interface PagesHandle {
  /** Goes to a tab's first page, or to the page of it named. */
  go: (group: string, page?: string) => void;
}

/**
 * Everything under a stage, a page at a time: each page the size of the room
 * there, all of them side by side in one row, swiped between like the pages
 * of a phone's home screen and coming to rest on one, never between two.
 *
 * The tabs over them are where in the row a kind of page begins - what a
 * design is, a size, its colours, starting - and a tab tapped goes to the first of
 * its pages. Swiping on from a tab's last page comes to the next tab's
 * first, so the whole of a design is one row to go along. Under the pages
 * are dots for the pages of the tab shown.
 *
 * So nothing is found by scrolling down past something else, and the pages
 * never need more room than there is: a page too long for it scrolls by
 * itself.
 *
 * Which page is shown is this component's own to know, and changes at once:
 * whoever shows it is told after (onShown), to keep the address in step, and
 * is not drawn again for it. A page is drawn when it is first near - the one
 * shown and the one either side - and each tab's first page while nothing
 * else is being done, so that a tab tapped is there already.
 */
const Pages = forwardRef<
  PagesHandle,
  {
    groups: PageGroup[];
    /** What the tabs are of, for a screen reader: "This design". */
    label: string;
    /** The tab it opens on, by its id: the first, unless told. And the page of it, where that is not its first. */
    first?: string;
    firstPage?: string;
    /** Told the tab shown, when it changes. */
    onShown?: (group: string) => void;
    /** Where the page shown may draw over the stage: see stage-slot. */
    slot?: HTMLElement | null;
  }
>(({ groups, label, first, firstPage, onShown, slot = null }, ref) => {
  const track = useRef<HTMLDivElement>(null);
  // Every page in one row, each knowing its tab.
  const flat = useMemo(() => groups.flatMap((group) => group.pages.map((page, within) => ({ group, page, within }))), [groups]);
  const starts = useMemo(() => {
    const out = new Map<string, number>();
    flat.forEach((one, at) => {
      if (!out.has(one.group.id)) out.set(one.group.id, at);
    });
    return out;
  }, [flat]);

  /** Where in the row a tab begins, or the page of it named is. */
  const indexOf = useCallback(
    (group: string, page?: string) => {
      const named = page === undefined ? -1 : flat.findIndex((one) => one.group.id === group && one.page.id === page);
      return named >= 0 ? named : (starts.get(group) ?? 0);
    },
    [flat, starts],
  );
  const [index, setIndex] = useState(() => indexOf(first ?? "", firstPage));
  const shown = Math.min(index, flat.length - 1);
  const at = useRef(shown);
  at.current = shown;
  const current = flat[shown];
  /** The page a tap is on its way to: until it is there, the pages passed on the way are not the page shown. */
  const going = useRef<number>();

  // Drawn once near, and kept; each tab's first page in turn while idle.
  const [seen, setSeen] = useState(() => new Set<string>());
  const near = [flat[shown - 1], current, flat[shown + 1]].filter(Boolean).map((one) => one.page.id);
  const drawn = (id: string) => seen.has(id) || near.includes(id);
  useEffect(() => {
    if (near.every((id) => seen.has(id))) return;
    setSeen((was) => new Set([...was, ...near]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near.join()]);
  useEffect(() => {
    const next = [...starts.values()].map((start) => flat[start].page.id).find((id) => !seen.has(id));
    if (!next) return;
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const asked = idle(() => setSeen((was) => new Set([...was, next])), { timeout: 1500 });
    return () => cancel(asked);
  }, [seen, starts, flat]);

  /*
   * Put where the page shown is: as it opens, and whenever its width changes
   * - a phone turned. Until it has been, how far along the row is says
   * nothing of which page is shown: the pages are another width, and the
   * same distance along is another page (see onScroll).
   */
  const placedAt = useRef(0);
  useLayoutEffect(() => {
    const box = track.current;
    if (!box) return;
    const place = () => {
      if (box.clientWidth > 0) box.scrollLeft = at.current * box.clientWidth;
      placedAt.current = box.clientWidth;
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

  const to = useCallback((page: number, smooth: boolean) => {
    const box = track.current;
    going.current = page;
    setIndex(page);
    box?.scrollTo?.({ left: page * box.clientWidth, behavior: smooth && !reducedMotion() ? "smooth" : "instant" });
  }, []);
  // A tab is gone to at once: gliding there would be a glide past every page between.
  const go = useCallback((group: string, page?: string) => to(indexOf(group, page), false), [indexOf, to]);
  useImperativeHandle(ref, () => ({ go }), [go]);

  /*
   * Where the row has come to rest is the page shown, whatever it was on its
   * way to: a glide to a page that something cut short - another scroll, a
   * finger - would otherwise leave the tabs saying the page it never reached.
   */
  const resting = useRef<number>();
  useEffect(() => () => window.clearTimeout(resting.current), []);
  const onScroll = () => {
    const box = track.current;
    if (!box || box.clientWidth === 0 || box.clientWidth !== placedAt.current) return;
    const now = Math.round(box.scrollLeft / box.clientWidth);
    window.clearTimeout(resting.current);
    resting.current = window.setTimeout(() => {
      if (box.clientWidth === 0 || box.clientWidth !== placedAt.current) return;
      going.current = undefined;
      const rested = Math.round(box.scrollLeft / box.clientWidth);
      if (rested !== at.current) setIndex(rested);
    }, 160);
    if (going.current !== undefined) {
      if (now !== going.current) return;
      going.current = undefined;
    }
    if (now !== at.current) setIndex(now);
  };

  const group = current?.group;
  useEffect(() => {
    if (group) onShown?.(group.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  if (!current || !group) return null;
  const start = starts.get(group.id) ?? 0;

  return (
    <div className="pages">
      <div className="stage-tabs screen-only" role="tablist" aria-label={label}>
        {groups.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            id={`stage-tab-${one.id}`}
            className={one.forward ? "stage-tab is-forward" : "stage-tab"}
            aria-selected={one.id === group.id}
            onClick={() => go(one.id)}
          >
            {one.label}
          </button>
        ))}
      </div>
      <div
        className="pages-track"
        ref={track}
        onScroll={onScroll}
        // A finger on the pages takes them over from wherever a tap was sending them.
        onPointerDown={() => (going.current = undefined)}
      >
        {flat.map((one, page) => (
          <div
            key={`${one.group.id} ${one.page.id}`}
            className="pages-page"
            // A page of its tab, which the dots under it choose between: not a region of the document, which what is on it may be.
            role="tabpanel"
            aria-labelledby={`page-title-${one.group.id}-${one.page.id}`}
            data-group={one.group.id}
            data-page={one.page.id}
            data-current={page === shown ? "" : undefined}
            // The pages either side are there to be swiped to, not to be tabbed into or read out.
            {...(page === shown ? {} : { inert: "" })}
          >
            <h2 className="pages-title" id={`page-title-${one.group.id}-${one.page.id}`}>
              {one.page.label}
            </h2>
            {/* Only the page shown draws over the stage: what a page beside it would put there is its own, for when it is come to. */}
            {drawn(one.page.id) && <StageSlot.Provider value={page === shown ? slot : null}>{one.page.content}</StageSlot.Provider>}
          </div>
        ))}
      </div>
      {/* Always there, so the pages are one height: a tab of one page has one dot. */}
      <div className="pages-dots screen-only" role="tablist" aria-label={`${group.label}: its pages`}>
        {group.pages.map((page, within) => (
          <button
            key={page.id}
            type="button"
            role="tab"
            className="pages-dot"
            aria-selected={within === current.within}
            aria-label={page.label}
            title={page.label}
            onClick={() => to(start + within, true)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
});
Pages.displayName = "Pages";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default Pages;
