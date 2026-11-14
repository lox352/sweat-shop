/**
 * The chart's scroll box is scrolled across from its right-hand edge, where
 * a chart is read from: it is written `direction: rtl`. A scroll across is
 * then a distance in from that edge, nought there and less than nought away
 * from it, and the browser keeps it as the chart grows or shrinks away from
 * it - columns opening and closing to the left of what is showing - with
 * nothing written to the scroll from here. A scroll written while a phone is
 * scrolling the box itself can be lost; one never written cannot.
 *
 * What is showing is still worked out from the box's scroll less the sheet's
 * offset in it, both measured from the same edge. Only a range of scrolls,
 * or holding an edge, needs to know which edge that is.
 */

const fromRight = new WeakMap<Element, boolean>();

/** Whether a box is scrolled across from its right-hand edge. */
export const scrollsFromRight = (box: HTMLElement): boolean => {
  let found = fromRight.get(box);
  if (found === undefined) {
    found = getComputedStyle(box).direction === "rtl";
    fromRight.set(box, found);
  }
  return found;
};

/** The scrolls across a box can take, lowest first: from its left-hand edge to its right. */
export const scrollAcross = (box: HTMLElement): [number, number] => {
  const extent = Math.max(0, box.scrollWidth - box.clientWidth);
  return scrollsFromRight(box) ? [-extent, 0] : [0, extent];
};
