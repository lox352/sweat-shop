import React, { useLayoutEffect, useRef } from "react";
import { cellAt } from "./chart-paths";
import { TileView, type TileContent } from "./tile-view";

interface ChartTilesProps extends TileContent {
  /** The stitch to be worked next, outlined. */
  nextStitchId?: number;
}

/**
 * The chart on canvas tiles, in place of the drawing as vectors: see
 * TileView. The stitch to be worked next is an outline laid over the tiles,
 * moved as you knit rather than painted into them.
 */
const ChartTiles: React.FC<ChartTilesProps> = ({ nextStitchId, ...content }) => {
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
    viewRef.current?.show(content);
  });

  const { scene, cell, margin } = content;
  const next = nextStitchId === undefined ? undefined : scene.layout.cells.get(nextStitchId);
  const at = next && cellAt(scene.layout, next.row, next.column, cell);
  return (
    <>
      <div ref={containerRef} className="chart-tiles" style={{ left: -margin, right: 0 }} aria-hidden="true" />
      {at && (
        <div
          className="chart-next"
          style={{ left: at.x - 1, top: at.y - 1, width: cell + 2, height: cell + 2 }}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default ChartTiles;
