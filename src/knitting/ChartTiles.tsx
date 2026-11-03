import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from "react";
import { TileView, type TileContent } from "./tile-view";

/** What the chart asks of the tiles, where the columns and rows may not be where the layout put them. */
export interface TilesHandle {
  /** Where a stitch's cell is on the sheet, as the chart is drawn now. */
  place(id: number): { x: number; y: number } | undefined;
  /** And on what floats over the tiles, moving with them: see TileView.afloat. */
  placeAfloat(id: number): { x: number; y: number } | undefined;
  /** How far what floats over the tiles is put along the sheet now. */
  afloatShift(): { x: number; y: number };
  /** The stitch at a point on screen. */
  stitchAt(clientX: number, clientY: number): number | undefined;
  /** Hold a stitch still while the chart scrolls to it. */
  hold(id: number | undefined): void;
  /** The box scrolled by the page this frame: see TileView.scrolled. */
  scrolled(): void;
  /** The box about to be sent straight to a stitch: see TileView.jumpTo. */
  jumpTo(id: number, inBox: { x: number; y: number }): { x: number; y: number } | undefined;
  /** The box about to be sent where a stitch will be: see TileView.aimed. */
  aimed(): void;
  /** Where to send the box for a stitch to come to rest in it, worked out ahead: see TileView.destination. */
  destination(id: number, inBox: { x: number; y: number }): { left: number; top: number } | undefined;
  /** After a zoom, where the point zoomed about has got to on the sheet; see TileView.zoomedTo. */
  zoomedTo(x: number, y: number, screenX: number, screenY: number): { x: number; y: number } | undefined;
}

interface ChartTilesProps extends TileContent {
  /** Told whenever the columns or rows move, for anything placed over them. */
  onMove?: (now?: boolean) => void;
  /** Told how far the stitch being scrolled to has moved across: see TileView.onTargetMoved. */
  onTargetMoved?: (by: number) => void;
  /** What floats over the tiles, placed by placeAfloat, and carried with them as they slide. */
  children?: ReactNode;
}

/**
 * The chart on canvas tiles: see TileView, which also outlines the stitch to
 * be worked next and, when asked, closes up the columns no row in view has a
 * stitch in and the rows no column on screen has.
 */
const ChartTiles = forwardRef<TilesHandle, ChartTilesProps>(({ onMove, onTargetMoved, children, ...content }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const afloatRef = useRef<HTMLDivElement>(null);
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
    view.afloat = afloatRef.current ?? undefined;
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
    view.onTargetMoved = onTargetMoved;
    view.show(content);
  });

  useImperativeHandle(ref, () => ({
    place: (id) => viewRef.current?.place(id),
    placeAfloat: (id) => viewRef.current?.placeAfloat(id),
    afloatShift: () => viewRef.current?.afloatShift() ?? { x: 0, y: 0 },
    stitchAt: (x, y) => viewRef.current?.stitchAt(x, y),
    hold: (id) => viewRef.current?.hold(id),
    scrolled: () => viewRef.current?.scrolled(),
    jumpTo: (id, inBox) => viewRef.current?.jumpTo(id, inBox),
    destination: (id, inBox) => viewRef.current?.destination(id, inBox),
    aimed: () => viewRef.current?.aimed(),
    zoomedTo: (x, y, screenX, screenY) => viewRef.current?.zoomedTo(x, y, screenX, screenY),
  }), []);

  return (
    <>
      <div ref={containerRef} className="chart-tiles" style={{ left: -content.margin, right: 0 }} aria-hidden="true" />
      {/* Clipped to the sheet, as the tiles are: see .chart-afloat-clip. */}
      <div className="chart-afloat-clip">
        <div ref={afloatRef} className="chart-afloat">
          {children}
        </div>
      </div>
    </>
  );
});
ChartTiles.displayName = "ChartTiles";

export default ChartTiles;
