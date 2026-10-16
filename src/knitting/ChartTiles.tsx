import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { TileView, type TileContent } from "./tile-view";

/** What the chart asks of the tiles, where the columns may not be where the layout put them. */
export interface TilesHandle {
  /** Where a stitch's cell is on the sheet, as the chart is drawn now. */
  place(id: number): { x: number; y: number } | undefined;
  /** The stitch at a point on screen. */
  stitchAt(clientX: number, clientY: number): number | undefined;
  /** Hold a stitch still while the chart scrolls to it. */
  hold(id: number | undefined): void;
  /** After a zoom, where the point zoomed about has got to across the sheet; see TileView.zoomedTo. */
  zoomedTo(x: number, top: number): number | undefined;
}

interface ChartTilesProps extends TileContent {
  /** Told whenever the columns move, for anything placed over them. */
  onMove?: () => void;
}

/**
 * The chart on canvas tiles, in place of the drawing as vectors: see
 * TileView, which also outlines the stitch to be worked next and, when asked,
 * closes up the columns no row in view has a stitch in.
 */
const ChartTiles = forwardRef<TilesHandle, ChartTilesProps>(({ onMove, ...content }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<TileView>();

  /*
   * The sheet and the box it scrolls in are found from the tiles' own place
   * in the page: a parent's refs are attached only after its children's
   * effects have run, so on the first render they are not there yet.
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    const sheet = container?.parentElement;
    const scroller = container?.closest<HTMLElement>(".chart-scroll");
    if (!container || !scroller || !sheet) return;
    const view = new TileView(container, scroller, sheet);
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = undefined;
    };
  }, []);

  // Every render: the view works out for itself what, if anything, has to be repainted.
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.onMove = onMove;
    view.show(content);
  });

  useImperativeHandle(ref, () => ({
    place: (id) => viewRef.current?.place(id),
    stitchAt: (x, y) => viewRef.current?.stitchAt(x, y),
    hold: (id) => viewRef.current?.hold(id),
    zoomedTo: (x, top) => viewRef.current?.zoomedTo(x, top),
  }), []);

  return <div ref={containerRef} className="chart-tiles" style={{ left: -content.margin, right: 0 }} aria-hidden="true" />;
});
ChartTiles.displayName = "ChartTiles";

export default ChartTiles;
