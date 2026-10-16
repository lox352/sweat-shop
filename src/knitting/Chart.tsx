import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { Stitch, isFabric, isStep } from "../types/Stitch";
import { layOutSweater, mirrorLayout, type ChartLayout } from "./layout";
import type { RoundKind } from "./needles";
import { Palette, yarnFor } from "./palette";
import { cellAt, chartSize, drawChart, drawProgress, leftMargin } from "./draw-chart";
import ChartSvg from "./ChartSvg";
import ChartTiles, { type TilesHandle } from "./ChartTiles";
import ChartNotes from "./ChartNotes";
import { sceneOf } from "./chart-scene";
import { defaultColours } from "./chart-painter";
import { StitchLegend, TextRound } from "./ChartHelp";
import { faceAfter, holdsIn, joinIn, needleChangesIn, otherFaceRows, turnsIn } from "./chart-marks";
import { type HoldRegion, onHoldAt } from "./holds";
import StitchPicker from "./StitchPicker";
import { keyEntryAt } from "./stitch-key";
import { stitchAtPoint } from "./jump";
import { useSettings } from "../helpers/settings";
import type { SweaterPattern } from "../data/sweaters/types";
import { usePinchZoom } from "./usePinchZoom";
import "./Chart.css";

/**
 * How far above the panel the stitch being worked should sit: a quarter of
 * the way up what shows of the chart, so there is more of what has been
 * knitted in view and less of what is to come. Never under five rounds,
 * so the round you are on and the few just finished are clear of the panel
 * however short the window.
 */
const clearance = 5;
const lift = (showing: number, cell: number, share = 0.25) => Math.max(clearance * cell, showing * share);

/**
 * The largest canvas to ask a browser for, in pixels along either side.
 *
 * Safari on iOS will not allocate one much beyond this, and a canvas it
 * refuses comes back blank rather than throwing, so the chart is drawn at
 * whatever pixel ratio keeps it inside the limit.
 */
const maxCanvasSide = 2048;

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Which renderer to draw the chart with.
 *
 * Vectors, unless asked otherwise. "?chart=tiles" draws it on canvas tiles
 * instead, a piece at a time as it scrolls into view - see TileView - and
 * is remembered in this browser until "?chart=svg" asks for the vectors
 * again, so the two can be held against each other on the same chart, on
 * the same phone, while you knit. "?chart=canvas" is the older canvas one,
 * which draws the stitches and their marks but not the steps' marks.
 */
type Renderer = "svg" | "canvas" | "tiles";
const rendererKey = "chart";
const renderer = (): Renderer => {
  const asked = new URLSearchParams(
    typeof window === "undefined" ? "" : (window.location.hash.split("?")[1] ?? ""),
  ).get("chart");
  if (asked === "canvas") return "canvas";
  let kept: string | null = asked;
  try {
    if (asked === "tiles" || asked === "svg") localStorage.setItem(rendererKey, asked);
    else kept = localStorage.getItem(rendererKey);
  } catch {
    // Without storage the choice lasts only as long as the address asks for it.
  }
  return kept === "tiles" ? "tiles" : "svg";
};

/**
 * Whether the tiles close up the columns no row in view has a stitch in:
 * unless "?collapse=0" asks to see every column, to compare.
 */
const closesUp = (): boolean =>
  new URLSearchParams(
    typeof window === "undefined" ? "" : (window.location.hash.split("?")[1] ?? ""),
  ).get("collapse") !== "0";

/**
 * A colour from the stylesheet, so the canvas is painted in the same palette
 * as everything round it. Read once and remembered: asking for it forces a
 * style recalculation, and this is on the path of every stitch worked.
 */
const tokens = new Map<string, string>();
const token = (name: string, fallback: string): string => {
  const known = tokens.get(name);
  if (known) return known;
  const value =
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;
  tokens.set(name, value);
  return value;
};

interface ChartProps {
  stitches: Stitch[];
  rounds: number[][];
  palette: Palette;
  progress: number;
  /** Mark the next stitch and keep it in view. */
  follow?: boolean;
  /** What each round is, beside its name: "dividing round", "OXO, row 5". See progress.roundWhats. */
  labels?: string[];
  /**
   * Makes the chart tappable: tap a stitch to carry on from it. Given the
   * progress to move to, which is the stitch before the one tapped.
   */
  onJump?: (progress: number) => void;
  /** What the pattern says about its stitches, for the symbol key. */
  stitchNotes?: SweaterPattern["stitchNotes"];
  /**
   * Scroll the chart inside a window of its own, both ways, rather than
   * letting it run down the page. Zooming then changes only what is inside
   * the window, never the height of the page.
   */
  contained?: boolean;
  /** How far up the window the followed stitch sits, as a share of it. */
  followAt?: number;
  /** Drawn over the chart, in its own coordinates. */
  overlay?: (layout: ChartLayout, cell: number) => React.ReactNode;
  /** More to say about a tapped stitch. */
  pickerNote?: (id: number) => React.ReactNode;
  /** The sweater's pieces, to name the sleeve whose stitches go on hold. */
  pieces?: { id: string; label: string }[];
  /** Which of the rounds are short rows: see Needles.row. */
  kinds?: RoundKind[];
  /** The piece each round belongs to, for laying the whole sweater out as one chart. */
  roundPieces?: string[];
  /** What each round is called in the knitting: "Body, round 23". */
  names?: string[];
  /** The knitting's held regions, to mark as on hold while they are. See holds.ts. */
  holdRegions?: HoldRegion[];
}

/**
 * The chart, drawn onto a canvas.
 *
 * On the hat site it began as a CSS grid holding one div per stitch. For a
 * ten thousand stitch hat that was ten thousand elements to lay out, and ten
 * thousand React components to reconcile every time a stitch was worked:
 * about six hundred milliseconds a stitch on a phone, for a page whose whole
 * job is counting stitches. A sweater's body alone is four times that.
 *
 * Now the colours and marks are drawn once onto a canvas kept off screen,
 * because nothing about them changes while you knit, and what does change -
 * how much is done, and which stitch is next - is painted over the top. That
 * costs one blit and one rectangle per round, so working a stitch takes the
 * same time on a forty thousand stitch body as on a small sleeve.
 */
const Chart: React.FC<ChartProps> = ({
  stitches,
  rounds,
  palette,
  progress,
  follow = false,
  labels,
  stitchNotes,
  onJump,
  contained = false,
  overlay,
  pickerNote,
  followAt,
  pieces,
  kinds,
  roundPieces,
  names,
  holdRegions,
}) => {
  const [picked, setPicked] = useState<number>();
  const makeOneLean = stitchNotes?.m1?.lean;
  const closePicker = useCallback(() => setPicked(undefined), []);
  const [zoom, setZoom] = useState(16);
  const { highContrast: contrast, writtenRounds } = useSettings();
  const [textRound, setTextRound] = useState(1);
  const [showText, setShowText] = useState(false);
  const cellSize = contrast ? Math.max(28, zoom) : zoom;
  const shownPalette = useMemo(() => contrast ? Object.fromEntries(
    Object.entries(palette).map(([key, yarn]) => [key, { ...yarn, hex: "#ffffff" }]),
  ) : palette, [palette, contrast]);
  const yarnLabels = useMemo(() => {
    const names = [...new Set(Object.values(palette).map(yarn => `${yarn.name}|${yarn.hex}`))];
    return Object.fromEntries(Object.entries(palette).map(([key, yarn]) => [key, String(names.indexOf(`${yarn.name}|${yarn.hex}`) + 1)]));
  }, [palette]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomTo = useCallback((cell: number) => setZoom(Math.round(cell)), []);
  /*
   * The tiles, where the columns may be closed up: then where a stitch is
   * comes from them rather than from the layout, and a zoom settles about
   * the column it began in rather than in proportion.
   */
  const tilesRef = useRef<TilesHandle>(null);
  const closingUp = useRef(false);
  const placeAfter = useCallback(
    (x: number, top: number) => (closingUp.current ? tilesRef.current?.zoomedTo(x, top) : undefined),
    [],
  );
  const zoomAt = usePinchZoom(scrollRef, sheetRef, cellSize, zoomTo, contained, placeAfter);
  // Anything over the chart outside the tiles, the picker, is placed again when the columns move.
  const [, moved] = useReducer((count: number) => count + 1, 0);
  /*
   * The cell size the follow below reads, kept out of its dependencies: a
   * zoom leaves the chart where it lands, and only knitting moves it.
   */
  const cellNow = useRef(cellSize);
  cellNow.current = cellSize;
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  /*
   * The stitch to be worked next. When a step comes first - a sleeve going on
   * hold part way round, a change of needles - it is the stitch after the
   * step: a step has no cell to mark, and the knitting goes on from there.
   */
  const nextId = useMemo(() => {
    if (!follow) return undefined;
    let id = progress + 1;
    while (stitches[id] && isStep(stitches[id])) id++;
    return id;
  }, [follow, progress, stitches]);
  const preferredRenderer = useMemo(() => renderer(), []);
  // The older canvas cannot number the yarns for high contrast; the vectors and the tiles both can.
  const drawWith = contrast && preferredRenderer === "canvas" ? "svg" : preferredRenderer;
  /*
   * Only in a box of its own, whose scroll says which rows are in view, and
   * not under a heat map, which is drawn where the layout puts each stitch.
   */
  const collapse = useMemo(() => drawWith === "tiles" && closesUp(), [drawWith]) && contained && !overlay;
  closingUp.current = collapse;

  /*
   * The whole sweater, every stitch over the stitch it was worked into: the
   * yoke, and the body and the sleeves side by side above it; see
   * layOutSweater. The stitch ids are the sweater's own, so progress, the
   * next stitch and a jump all mean what they mean anywhere else on the site.
   */
  const laid = useMemo(
    () => layOutSweater(stitches, rounds, kinds, roundPieces),
    [stitches, rounds, kinds, roundPieces],
  );
  /*
   * A chart shows the knitting from the side you are working on, as the hat
   * site's does. A short row purled back is worked with the wrong side
   * towards you, so while you are on one the chart turns over with you, and
   * reads right to left along it as every row does; working the turn turns
   * it over, and undoing the turn turns it back.
   */
  const turnIds = useMemo(
    () => stitches.filter((stitch) => stitch.type === "turn").map((stitch) => stitch.id),
    [stitches],
  );
  const face = faceAfter(turnIds, progress);
  const layout = useMemo(() => (face === "wrong" ? mirrorLayout(laid) : laid), [laid, face]);
  /*
   * And every stitch is drawn as it looks from the side shown: from the right
   * side, as it is there, the rows purled back from the wrong side knits like
   * the rest; from the wrong side, as its pair from behind - see sides.ts. The
   * rounds worked with the other side towards you are hatched, because each
   * stitch there was worked as the opposite of what it shows.
   */
  const hatch = useMemo(() => otherFaceRows(laid.roundRows, kinds ?? [], face), [laid, kinds, face]);
  /*
   * The regions on hold where the knitting has got to: from the step that
   * held each to the step that takes it up again. Kept the same object
   * between those steps, so the chart is not redrawn on every stitch.
   */
  const heldNow = (holdRegions ? onHoldAt(holdRegions, progress) : []).map((region) => region.heldAt).join(",");
  const onHold = useMemo(() => {
    const now = new Set(heldNow.split(",").filter(Boolean).map(Number));
    return (holdRegions ?? []).filter((region) => now.has(region.heldAt));
  }, [holdRegions, heldNow]);
  const onHoldSets = useMemo(() => onHold.map((region) => region.region), [onHold]);
  const needles = useMemo(() => needleChangesIn(stitches, rounds, names), [stitches, rounds, names]);
  // Each drawn across its own piece, between the rows either side of it; held stitches taken up onto other needles are not.
  const needleRules = useMemo(
    () =>
      needles.filter((change) => !change.takeUp).map((change) => ({
        after: laid.roundRows[change.after - 1] ?? change.after,
        piece: laid.cells.get(rounds[change.after - 1]?.[0] ?? -1)?.piece ?? "",
      })),
    [needles, laid, rounds],
  );
  const join = useMemo(() => joinIn(stitches, rounds), [stitches, rounds]);
  const holds = useMemo(() => holdsIn(stitches, rounds, pieces), [stitches, rounds, pieces]);
  const turns = useMemo(() => turnsIn(stitches, rounds), [stitches, rounds]);
  const { width, height } = chartSize(layout, cellSize);

  const ratio = useMemo(() => {
    const wanted = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const longest = Math.max(width, height);
    return Math.max(1, Math.min(wanted, 2, maxCanvasSide / longest));
  }, [width, height]);

  const drawn = useMemo(
    () => rounds.flat().map((id) => stitches[id]).filter(isFabric),
    [stitches, rounds],
  );
  const scene = useMemo(
    () =>
      drawWith === "tiles"
        ? sceneOf(layout, stitches, rounds, { needleRules, join, holds, turns, face, makeOneLean })
        : undefined,
    [drawWith, layout, stitches, rounds, needleRules, join, holds, turns, face, makeOneLean],
  );
  const colours = useMemo(
    () => ({
      ...defaultColours,
      ground: token("--paper-raised", defaultColours.ground),
      paper: token("--paper", defaultColours.paper),
      ink: token("--ink", defaultColours.ink),
      faint: token("--ink-faint", defaultColours.faint),
      font: token("--body", defaultColours.font),
    }),
    [],
  );

  /**
   * Sizes a canvas for the chart, and says whether it had to be resized.
   *
   * Assigning to width or height reallocates the backing store and wipes it,
   * so it is only done when the size has actually changed - otherwise every
   * stitch worked would throw away two megapixels and make them again.
   */
  const size = (canvas: HTMLCanvasElement) => {
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    return true;
  };

  // The chart itself, redrawn only when the knitting or the wool changes.
  useLayoutEffect(() => {
    if (drawWith !== "canvas") return;
    const canvas = baseRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    size(canvas);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawChart(
      ctx,
      drawn,
      layout,
      palette,
      cellSize,
      token("--ink-faint", "#a29a91"),
      makeOneLean,
      needleRules,
      face,
    );
    // Size is derived from the same values this already depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, layout, palette, width, height, ratio, drawWith, makeOneLean, needleRules, face]);

  /*
   * And the two things that change as you knit, on a sheet of their own over
   * the top. Keeping them separate is what makes a stitch cheap: the chart
   * underneath is never touched, so working one costs a clear and a rectangle
   * per round rather than redrawing ten thousand stitches.
   */
  useLayoutEffect(() => {
    if (drawWith !== "canvas") return;
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (!size(canvas)) ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    drawProgress(
      ctx,
      layout,
      rounds,
      progress,
      nextId,
      cellSize,
      token("--paper", "#eae7e4"),
      token("--crimson", "#bb2c43"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, rounds, progress, nextId, ratio, width, height, drawWith]);

  /*
   * A chart is read from the bottom right, so that is where it opens. Only
   * once: after that the knitter's own scrolling, and the follow below, decide
   * where it sits.
   */
  const opened = useRef(false);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || opened.current) return;
    opened.current = true;
    scroller.scrollLeft = scroller.scrollWidth;
    if (contained) scroller.scrollTop = scroller.scrollHeight;
  }, [contained]);

  const at = nextId === undefined ? undefined : layout.cells.get(nextId);

  /*
   * Keep the stitch being worked in the middle, sideways, so the chart follows
   * the knitter rather than having to be hunted for. In a window of its own,
   * up and down too, in the same call: its round a few rows up from the
   * bottom edge. A smooth scroll of a box cancels any other still under way
   * in it, so the two directions cannot be sent separately. The round only
   * changes once a round, so within one this moves only sideways.
   */
  const aim = useCallback(
    (behavior: ScrollBehavior) => {
      const scroller = scrollRef.current;
      if (!scroller || !at) return;
      const cell = cellNow.current;
      // Held still on the tiles while the box scrolls to it, however the columns move on the way.
      if (drawWith === "tiles" && nextId !== undefined) tilesRef.current?.hold(nextId);
      const placed = drawWith === "tiles" && nextId !== undefined ? tilesRef.current?.place(nextId) : undefined;
      const { x, y } = placed ?? cellAt(layout, at.row, at.column, cell);
      scroller.scrollTo({
        left: Math.max(x - scroller.clientWidth / 2 + cell / 2, 0),
        top: contained
          ? Math.max(y + cell - (scroller.clientHeight - lift(scroller.clientHeight, cell, followAt)), 0)
          : undefined,
        behavior,
      });
    },
    [at, layout, contained, followAt, drawWith, nextId],
  );
  useEffect(() => {
    aim(reducedMotion() ? "auto" : "smooth");
  }, [aim]);

  /*
   * When the window changes size. Scroll positions are counted from the top
   * left, so on their own they hold the top left corner still, and a window
   * grown even for a moment, as a phone may while it takes a screenshot, has
   * its scroll cut back to fit and left there when it shrinks again. But a
   * chart is read from the bottom right: that is the corner to hold. So the
   * window keeps the distance it had from the chart's bottom and right edges,
   * as last seen at its settled size, or, while you knit, re-aims at the
   * stitch; the panel it sits above can grow after the aim (fonts arriving on
   * a fresh load, a hint or a turn, a rotation), which on the first round
   * would leave the stitch just below the window.
   *
   * Not when the knitting opens or closes, though, which moves the window on
   * purpose and holds the chart where it was by itself.
   */
  const aimRef = useRef(aim);
  aimRef.current = aim;
  const followingRef = useRef(false);
  followingRef.current = contained && at !== undefined;
  const toggled = useRef(false);
  const wasFollowing = useRef(follow);
  useLayoutEffect(() => {
    if (wasFollowing.current === follow) return;
    wasFollowing.current = follow;
    // For the resize this commit makes, which is seen in the frame after it.
    toggled.current = true;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        toggled.current = false;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [follow]);
  useEffect(() => {
    const scroller = scrollRef.current;
    const sheet = sheetRef.current;
    if (!contained || !scroller || !sheet || typeof ResizeObserver === "undefined") return;
    let width = scroller.clientWidth;
    let height = scroller.clientHeight;
    let right = 0;
    let bottom = 0;
    const settled = () => scroller.clientWidth === width && scroller.clientHeight === height;
    const note = () => {
      right = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft;
      bottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    };
    note();
    // A scroll the browser makes to fit a window mid-resize is not yours.
    const onScroll = () => {
      if (settled()) note();
    };
    const watch = new ResizeObserver(() => {
      // Only the chart changed, in a zoom: where it landed is where it is.
      if (settled()) {
        note();
        return;
      }
      width = scroller.clientWidth;
      height = scroller.clientHeight;
      if (toggled.current) {
        toggled.current = false;
        note();
      } else if (followingRef.current) {
        aimRef.current("auto");
      } else {
        scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth - right;
        scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - bottom;
      }
    });
    watch.observe(scroller);
    watch.observe(sheet);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      watch.disconnect();
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [contained]);

  /*
   * And down the page, but only when the round changes. Within a round the
   * stitch moves sideways, which the effect above handles, and scrolling the
   * page once per stitch would have the whole chart twitching.
   */
  const focusRound = at?.round;
  useEffect(() => {
    // A window of its own is followed both ways above.
    if (contained) return;
    const sheets = scrollRef.current?.querySelector(".chart-sheets");
    if (!sheets || focusRound === undefined) return;
    const cellSize = cellNow.current;
    const { y } = cellAt(layout, layout.roundRows[focusRound - 1] ?? focusRound, 1, cellSize);
    /*
     * The panel is stuck to the bottom of the screen while you work, so the
     * part of the page you can see ends at its top edge. Its height, not
     * wherever it happens to be sitting: it comes unstuck at the very bottom
     * of the page and rides higher than it will once the page has scrolled.
     */
    const panel = document.querySelector<HTMLElement>(".knitting-panel");
    const floor = window.innerHeight - (panel?.offsetHeight ?? 0);
    const bottom = sheets.getBoundingClientRect().top + y + cellSize;
    const delta = bottom - (floor - lift(floor, cellSize));
    if (Math.abs(delta) < 1) return;
    window.scrollBy({ top: delta, behavior: reducedMotion() ? "auto" : "smooth" });
    // Re-aim only when the round changes; the rest is in the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRound]);

  if (layout.rows === 0) return <p>This pattern has no stitches to chart.</p>;

  return (
    <div className="chart-frame">
      {contrast && <ul className="chart-yarn-numbers">{Object.entries(palette).filter(([key], i, entries) => entries.findIndex(([other]) => yarnLabels[other] === yarnLabels[key]) === i).map(([key, yarn]) => <li key={key}>{yarnLabels[key]}: {yarn.name}</li>)}</ul>}
      <div
        className={`chart-scroll${contained ? " chart-scroll-contained" : ""}`}
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Scrollable knitting chart. Plus and minus zoom it."
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const step = event.key === "+" || event.key === "=" ? 4 : event.key === "-" ? -4 : 0;
          if (!step) return;
          event.preventDefault();
          // About the middle of what is showing of the chart.
          const view = event.currentTarget.getBoundingClientRect();
          const top = Math.max(view.top, 0);
          const bottom = Math.min(view.bottom, window.innerHeight);
          zoomAt(cellSize + step, view.left + view.width / 2, (top + bottom) / 2);
        }}
      >
        <ChartNotes
          layout={layout}
          join={join}
          turns={turns}
          holds={holds}
          needles={needles.filter((change) => !change.takeUp)}
          onHold={onHold}
          hatch={hatch}
          names={names}
          pieces={pieces}
        />
        <div
          ref={sheetRef}
          className="chart-sheets chart-pickable"
          // Closed up, the tiles say how wide the chart is as the rows in view change.
          style={{ width: collapse ? undefined : width, height, marginLeft: leftMargin(cellSize) }}
          onClick={
            ((event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const id =
                drawWith === "tiles"
                  ? tilesRef.current?.stitchAt(event.clientX, event.clientY)
                  : stitchAtPoint(layout, rounds, cellSize, event.clientX - box.left, event.clientY - box.top);
              setPicked(id === picked ? undefined : id);
            })
          }
          role="img"
          aria-label={
            `The chart: ${layout.columns} columns and ${layout.rows} rows.` +
            (focusRound
              ? ` You are on ${[names?.[focusRound - 1] ?? `round ${focusRound}`, labels?.[focusRound - 1]].filter(Boolean).join(": ")}.`
              : "") +
            (face === "wrong"
              ? " The work is turned, with its wrong side towards you, and the chart is turned over to match," +
                " every stitch as it looks from that side."
              : "")
          }
        >
          {drawWith === "tiles" && scene ? (
            <ChartTiles
              ref={tilesRef}
              scene={scene}
              cell={cellSize}
              palette={shownPalette}
              yarnLabels={contrast ? yarnLabels : undefined}
              progress={progress}
              hatch={hatch}
              onHold={onHoldSets}
              colours={colours}
              margin={leftMargin(cellSize)}
              follow={nextId}
              collapse={collapse}
              onMove={picked !== undefined ? moved : undefined}
            />
          ) : drawWith === "svg" ? (
            <ChartSvg
              // Drawn afresh at each size rather than redrawn in place, so a
              // zoom never leaves the browser anything stale to repaint.
              key={cellSize}
              stitches={drawn}
              rounds={rounds}
              layout={layout}
              palette={shownPalette}
              yarnLabels={contrast ? yarnLabels : undefined}
              progress={progress}
              nextStitchId={nextId}
              cell={cellSize}
              needleChanges={needleRules}
              join={join}
              holds={holds}
              turns={turns}
              hatch={hatch}
              onHold={onHoldSets}
              face={face}
              makeOneLean={makeOneLean}
            />
          ) : (
            <>
              <canvas ref={baseRef} style={{ width, height }} />
              <canvas ref={overlayRef} style={{ width, height }} />
            </>
          )}
          {overlay && (
            <svg className="chart-overlay" width={width} height={height} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges" aria-hidden="true">
              {overlay(layout, cellSize)}
            </svg>
          )}
          {picked !== undefined && (
            <StitchPicker
              place={drawWith === "tiles" ? (id) => tilesRef.current?.place(id) : undefined}
              chartWidth={collapse ? sheetRef.current?.offsetWidth : undefined}
              note={pickerNote?.(picked)}
              entry={keyEntryAt(stitches, picked, stitchNotes, face)}
              labels={labels}
              names={names}
              yarn={stitches[picked] && yarnFor(palette, stitches[picked].slot)}
              otherFace={(() => {
                const row = layout.cells.get(picked)?.row;
                return row !== undefined && hatch.some(([from, to]) => row >= from && row <= to);
              })()}
              onHold={(() => {
                const region = onHold.find((one) => one.region.has(picked));
                return region && {
                  piece: pieces?.find((piece) => piece.id === region.holder)?.label ?? region.holder,
                  waiting: region.stitches.includes(picked),
                };
              })()}
              id={picked}
              stitches={stitches}
              rounds={rounds}
              layout={layout}
              cell={cellSize}
              progress={progress}
              onJump={onJump}
              onClose={closePicker}
            />
          )}
        </div>
      </div>
      <StitchLegend stitches={stitches} notes={stitchNotes} needles={needles} holds={holds} turns={turns} face={face} />
      {writtenRounds && <details className="chart-help" onToggle={e => setShowText(e.currentTarget.open)}>
        <summary>Text round instructions</summary>
        <label>Read round <select value={follow && focusRound ? focusRound : textRound} disabled={follow && !!focusRound} onChange={e => setTextRound(Number(e.target.value))}>
          {rounds.map((_, i) => <option key={i} value={i + 1}>{[names?.[i] ?? `Round ${i + 1}`, labels?.[i]].filter(Boolean).join(" · ")}</option>)}
        </select></label>
        {showText && <TextRound stitches={stitches} rounds={rounds} round={follow && focusRound ? focusRound : textRound} labels={labels} names={names} palette={palette} pieces={pieces} />}
      </details>}
      <p className="chart-caption">
        The whole sweater, {layout.columns} columns across and {layout.rows} rows: the
        yoke from the neck up, then the body and both sleeves side by side above
        it. Read from the bottom right, working right to left; scroll sideways to
        see a whole round, and pinch to zoom.{onJump && " Tap a stitch to carry on from there."} Every
        stitch stands over the stitch it was knitted into, so a column is a
        column of the knitting: a make-one begins a new one, with nothing below
        it, as do the stitches cast on at the underarms and picked up for the
        sleeves, and a decrease ends one. Above the divide each row holds a round
        of the body and one of each sleeve, all numbered on from the yoke's: going
        round the body you pass over the sleeves' columns, and a sleeve goes up
        its own columns a row at a time.
        {turns.length > 0 &&
          " The chart shows the side you are working on, every stitch as it looks from there, and turns over" +
            " with the work at a short row."}
      </p>
    </div>
  );
};

export default Chart;
