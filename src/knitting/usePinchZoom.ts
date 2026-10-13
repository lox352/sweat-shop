import { RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

export const minCell = 8;
export const maxCell = 40;

const clamp = (cell: number) => Math.min(maxCell, Math.max(minCell, cell));

interface Gesture {
  startCell: number;
  cell: number;
  /** The point being zoomed about, in the sheet's own pixels at startCell. */
  originX: number;
  originY: number;
  /** And where that point is on screen, which is where it has to stay. */
  screenX: number;
  screenY: number;
}

/**
 * Pinch to zoom the chart, and ctrl + wheel for a trackpad pinch on a laptop.
 *
 * While fingers are down the sheet is only scaled with a transform, which a
 * browser can do every frame; the chart itself is redrawn at its new cell size
 * once, when the gesture ends. Then the scroll is moved so that the stitch
 * that was under your fingers is still under them - whether or not you are
 * knitting: a zoom never goes looking for the stitch you are on.
 *
 * Returns a way to zoom about a point without a gesture, for the keys.
 */
export function usePinchZoom(
  scrollRef: RefObject<HTMLDivElement>,
  sheetRef: RefObject<HTMLDivElement>,
  cell: number,
  setCell: (cell: number) => void,
  /** The chart scrolls both ways in a box of its own, not down the page. */
  contained = false,
) {
  const gesture = useRef<Gesture>();
  const settle = useRef<{
    ratio: number;
    originX: number;
    originY: number;
    screenX: number;
    screenY: number;
  }>();
  const current = useRef(cell);
  current.current = cell;

  useEffect(() => {
    const scroller = scrollRef.current;
    const sheet = sheetRef.current;
    if (!scroller || !sheet) return;

    const begin = (clientX: number, clientY: number) => {
      const box = sheet.getBoundingClientRect();
      gesture.current = {
        startCell: current.current,
        cell: current.current,
        originX: clientX - box.left,
        originY: clientY - box.top,
        screenX: clientX,
        screenY: clientY,
      };
      sheet.style.transformOrigin = `${gesture.current.originX}px ${gesture.current.originY}px`;
      /*
       * No will-change: it has the browser keep the whole chart as one layer
       * for the transform, and a big chart is more than a phone will
       * hold. Held mid-pinch, Safari redraws that layer at the new scale,
       * runs out, and leaves it blank after the fingers lift.
       */
    };

    const scaleTo = (cellWanted: number) => {
      const g = gesture.current;
      if (!g) return;
      g.cell = clamp(cellWanted);
      sheet.style.transform = `scale(${g.cell / g.startCell})`;
    };

    const end = () => {
      const g = gesture.current;
      gesture.current = undefined;
      if (!g) return;
      const next = Math.round(g.cell);
      if (next === g.startCell) {
        sheet.style.transform = "";
        return;
      }
      settle.current = {
        ratio: next / g.startCell,
        originX: g.originX,
        originY: g.originY,
        screenX: g.screenX,
        screenY: g.screenY,
      };
      setCell(next);
    };

    // Two fingers on a touch screen.
    let startDistance = 0;
    const distance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = distance(event.touches);
      begin(
        (event.touches[0].clientX + event.touches[1].clientX) / 2,
        (event.touches[0].clientY + event.touches[1].clientY) / 2,
      );
    };
    const onTouchMove = (event: TouchEvent) => {
      const g = gesture.current;
      if (!g || event.touches.length !== 2 || startDistance === 0) return;
      event.preventDefault();
      scaleTo((g.startCell * distance(event.touches)) / startDistance);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) end();
    };

    // A trackpad pinch arrives as a wheel with ctrl held, as does ctrl + wheel.
    let wheelTimer: number | undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!gesture.current) begin(event.clientX, event.clientY);
      scaleTo(gesture.current!.cell * Math.exp(-event.deltaY * 0.01));
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(end, 160);
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(wheelTimer);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [scrollRef, sheetRef, setCell]);

  // Once the chart is redrawn at its new size, drop the stand-in transform and
  // put the point that was zoomed about back where it was on screen.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const scroller = scrollRef.current;
    const done = settle.current;
    settle.current = undefined;
    if (!sheet) return;
    sheet.style.transform = "";
    if (!done || !scroller) return;
    /*
     * Measured rather than worked out: a browser may already have moved the
     * page itself to keep something else still as the chart grew (scroll
     * anchoring), and adding the growth on top of that overshoots. So look
     * where the point has got to, and move it back.
     */
    const box = sheet.getBoundingClientRect();
    const left = scroller.scrollLeft + box.left + done.originX * done.ratio - done.screenX;
    if (contained) {
      const top = scroller.scrollTop + box.top + done.originY * done.ratio - done.screenY;
      const place = () => {
        scroller.scrollLeft = Math.min(Math.max(left, 0), scroller.scrollWidth - scroller.clientWidth);
        scroller.scrollTop = Math.min(Math.max(top, 0), scroller.scrollHeight - scroller.clientHeight);
      };
      /*
       * An iPhone scrolls a box itself, apart from the page, and while it
       * thinks a finger is still on it - as it does for a while after a long
       * pinch - it ignores a scroll set from here and keeps its own. Zoomed
       * out, that is past the chart's new edge: blank, until the next touch
       * springs it back. Stopping the box scrolling for a frame makes it let
       * go of its own, and the scroll set here then stands.
       */
      scroller.style.overflow = "hidden";
      place();
      requestAnimationFrame(() => {
        scroller.style.overflow = "";
        place();
      });
      return;
    }
    scroller.scrollLeft = left;
    window.scrollBy({
      top: box.top + done.originY * done.ratio - done.screenY,
      behavior: "instant",
    });
  }, [cell, scrollRef, sheetRef, contained]);

  /** Zoom to a cell size about a point on screen, holding that point still. */
  return useCallback(
    (next: number, clientX: number, clientY: number) => {
      const sheet = sheetRef.current;
      const wanted = Math.round(clamp(next));
      if (!sheet || wanted === current.current) return;
      const box = sheet.getBoundingClientRect();
      settle.current = {
        ratio: wanted / current.current,
        originX: clientX - box.left,
        originY: clientY - box.top,
        screenX: clientX,
        screenY: clientY,
      };
      setCell(wanted);
    },
    [sheetRef, setCell],
  );
}
