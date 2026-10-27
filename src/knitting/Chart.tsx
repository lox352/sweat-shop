import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { Stitch, isStep } from "../types/Stitch";
import { type ChartLayout, layOutSweater, mirrorLayout } from "./layout";
import { scrollAcross } from "./scroll-corner";
import type { MarkerLine } from "./view";
import type { RoundKind } from "./needles";
import { Palette, yarnFor } from "./palette";
import ChartTiles, { type TilesHandle } from "./ChartTiles";
import ChartNotes from "./ChartNotes";
import { sceneOf } from "./chart-scene";
import { type ChartOverlay, defaultColours, leftMargin } from "./chart-painter";
import { StitchLegend, TextRound } from "./ChartHelp";
import { faceAfter, holdsIn, joinIn, needleChangesIn, otherFaceRows, turnsIn } from "./chart-marks";
import { type HoldRegion, onHoldAt } from "./holds";
import StitchPicker from "./StitchPicker";
import { keyEntryAt } from "./stitch-key";
import { useSettings } from "../helpers/settings";
import type { SweaterPattern } from "../data/sweaters/types";
import { usePinchZoom } from "./usePinchZoom";
import { Glide } from "./glide";
import { leastCell, minCell, stepCell } from "./zoom";
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

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  /** How far up the window the followed stitch sits, as a share of it. */
  followAt?: number;
  /** Painted over the chart: a heat map of the knitter's pace, say. */
  overlay?: ChartOverlay;
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
  /**
   * The chart already laid out from these rounds, as the knitting's view of
   * them is - cut and turned at the beginning of the round in force - rather
   * than laid out here. See knitting/view.
   */
  layout?: ChartLayout;
  /** The stitch markers on the needles, each a line up the chart: see knitting/view. */
  markers?: MarkerLine[];
}

/**
 * The chart, in a window of its own that scrolls both ways, painted on
 * canvas tiles a piece at a time as they come into view: see TileView.
 *
 * On the hat site it began as a CSS grid holding one div per stitch, and
 * here it was one vector drawing; either way every stitch worked rebuilt
 * the whole of it, which for a sweater's forty thousand stitches is most of
 * a second on a phone. The tiles repaint only what a stitch changes.
 *
 * The columns no row in view has a stitch in close up, so that what is on
 * screen stands side by side as it does on the needles, and so do the rows
 * no column on screen has a stitch in: see column-window. Zooming changes
 * only what is inside the window, never the page.
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
  overlay,
  pickerNote,
  followAt,
  pieces,
  kinds,
  roundPieces,
  names,
  holdRegions,
  layout: given,
  markers,
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
  /*
   * The least the chart zooms out to: its whole width fitting the box, read
   * from the box as it is now - see zoom. Found once the scene below is,
   * hence a ref.
   */
  const leastRef = useRef<() => number>(() => minCell);
  const least = useCallback(() => leastRef.current(), []);
  /* Zoomed right out, the chart is kept fitting the box as the box changes size: see below. */
  const fitted = useRef(false);
  const zoomTo = useCallback((cell: number) => {
    fitted.current = cell <= least();
    setZoom(cell);
  }, [least]);
  /*
   * The tiles, where the columns and rows are closed up: where a stitch is
   * comes from them rather than from the layout, and a zoom settles about the
   * column and row it began in rather than in proportion.
   */
  const tilesRef = useRef<TilesHandle>(null);
  const placeAfter = useCallback(
    (x: number, y: number, screenX: number, screenY: number) => tilesRef.current?.zoomedTo(x, y, screenX, screenY),
    [],
  );
  const zoomAt = usePinchZoom(scrollRef, sheetRef, cellSize, zoomTo, placeAfter, least);
  // Anything over the chart outside the tiles, the picker, is placed again when the columns or rows move.
  const [, moved] = useReducer((count: number) => count + 1, 0);
  /*
   * The cell size the follow below reads, kept out of its dependencies: a
   * zoom leaves the chart where it lands, and only knitting moves it.
   */
  const cellNow = useRef(cellSize);
  cellNow.current = cellSize;
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

  /*
   * The whole sweater, every stitch over the stitch it was worked into: the
   * yoke, and the body and the sleeves side by side above it; see
   * layOutSweater. The stitch ids are the sweater's own, so progress, the
   * next stitch and a jump all mean what they mean anywhere else on the site.
   */
  const laid = useMemo(
    () => given ?? layOutSweater(stitches, rounds, kinds, roundPieces),
    [given, stitches, rounds, kinds, roundPieces],
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
  // Turned over with it: the line to the left of a column, to the left of the column on its other side.
  const markerLines = useMemo(
    () =>
      face === "wrong"
        ? (markers ?? []).map((line) => ({ ...line, after: laid.columns - line.after }))
        : (markers ?? []),
    [markers, face, laid.columns],
  );
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
  // Every stitch a holder takes, marked where it is: in the views that show it rather than the bar.
  const held = useMemo(() => (holdRegions ?? []).flatMap((region) => region.stitches), [holdRegions]);

  const scene = useMemo(
    () => sceneOf(layout, stitches, rounds, { needleRules, join, holds, held, turns, face, makeOneLean, markers: markerLines }),
    [layout, stitches, rounds, needleRules, join, holds, held, turns, face, makeOneLean, markerLines],
  );
  leastRef.current = () => {
    const box = scrollRef.current;
    if (!box) return minCell;
    const style = getComputedStyle(box);
    const room = box.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    return leastCell(room, layout.columns, new Set(scene.breaks.map((one) => `${one.right}:${one.left}`)).size);
  };
  // As the box changes width - a phone turned, the knitting opened - a chart zoomed right out is zoomed to fit it again.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    let width = box.clientWidth;
    const watch = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      if (fitted.current) setZoom(least());
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, [least]);
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
    scroller.scrollLeft = scrollAcross(scroller)[1];
    scroller.scrollTop = scroller.scrollHeight;
  }, []);

  const at = nextId === undefined ? undefined : layout.cells.get(nextId);

  /*
   * Keep the stitch being worked in the middle, sideways, so the chart follows
   * the knitter rather than having to be hunted for, and up and down too, in
   * the same call: its round a few rows up from the bottom edge. A smooth
   * scroll of a box cancels any other still under way in it, so the two
   * directions cannot be sent separately. The round only changes once a
   * round, so within one this moves only sideways.
   */
  const aimedAt = useRef<{ left: number; top: number; behavior: ScrollBehavior }>();
  /*
   * A smooth aim glides there, the scroll written frame by frame from here
   * rather than left to the browser, whose smooth scroll is carried off by
   * the columns opening on the way: see glide.
   */
  const glide = useRef<Glide>();
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const made = new Glide(scroller, () => tilesRef.current?.scrolled());
    glide.current = made;
    return () => {
      made.destroy();
      glide.current = undefined;
    };
  }, []);
  /** The box sent where it was last aimed: gliding, or there at once. */
  const send = useCallback(() => {
    const scroller = scrollRef.current;
    const aimed = aimedAt.current;
    if (!scroller || !aimed) return;
    if (aimed.behavior === "smooth" && glide.current) glide.current.to(aimed);
    else {
      glide.current?.stop();
      scroller.scrollTo({ left: aimed.left, top: aimed.top, behavior: "instant" });
    }
  }, []);
  const aim = useCallback(
    (behavior: ScrollBehavior, afresh = false) => {
      const scroller = scrollRef.current;
      const sheet = sheetRef.current;
      if (!scroller || !sheet || nextId === undefined || !at) return;
      const cell = cellNow.current;
      // Where in the box the stitch goes: the middle across, its round a little up from the foot.
      const inBox = { x: scroller.clientWidth / 2 - cell / 2, y: scroller.clientHeight - lift(scroller.clientHeight, cell, followAt) - cell };
      /*
       * Held still on the tiles while the box goes to it, however the
       * columns move on the way; or, sent straight to a chart laid out
       * afresh, laid out first as the box needs it there (see
       * TileView.jumpTo).
       */
      let placed: { x: number; y: number } | undefined;
      if (afresh) placed = tilesRef.current?.jumpTo(nextId, inBox);
      else {
        tilesRef.current?.hold(nextId);
        placed = tilesRef.current?.place(nextId);
      }
      if (!placed) return;
      aimedAt.current = {
        // From the same edge as the sheet's offset in the box, whichever it is scrolled from: see scroll-corner.
        left: sheet.offsetLeft + placed.x - inBox.x,
        top: Math.max(placed.y - inBox.y, 0),
        behavior,
      };
      send();
    },
    [at, followAt, nextId, send],
  );
  /*
   * Where the box was last sent, and sent on from there when the stitch it
   * was sent to is moved across on the way: by the columns being kept from
   * carrying the chart's right-hand edge into the box, which outranks holding
   * the stitch still. See TileView.keepColumnsInBox. Told of nothing moved,
   * the sheet having grown under a glide, there is nothing to do: the glide
   * writes the scroll afresh every frame.
   */
  const targetMoved = useCallback((by: number) => {
    const aimed = aimedAt.current;
    if (!aimed || (by === 0 && glide.current?.going)) return;
    aimedAt.current = { ...aimed, left: aimed.left + by };
    send();
  }, [send]);
  /*
   * The first aim, as the chart opens - on a view of its own after the
   * knitting moves to another - goes straight there: there is nothing on
   * screen yet to follow on from, and the chart is still being sized for
   * where it is going, which a smooth scroll under way would be thrown by.
   * So does the first on a chart laid out afresh - cut at a new beginning
   * of the round, or turned over for a short row - where the box's scroll
   * was a place on the chart as it was, and gliding on from it would go
   * from nowhere on this one. Either way the chart is laid out first as
   * the box will need it there, so that it is not sent past the chart's
   * edge (see TileView.jumpTo).
   */
  const aimedOn = useRef<ChartLayout>();
  useEffect(() => {
    if (!at) return;
    const afresh = aimedOn.current !== layout;
    aim(reducedMotion() || aimedOn.current !== layout ? "auto" : "smooth", afresh);
    aimedOn.current = layout;
  }, [aim, at, layout]);
  /*
   * When the knitting stops, the box is no longer being sent anywhere: the
   * stitch it was sent to is let go of at once, not at rest, so that columns
   * opening as you scroll straight away can't send the box back to it.
   */
  useEffect(() => {
    if (at || !aimedAt.current) return;
    aimedAt.current = undefined;
    glide.current?.stop();
    tilesRef.current?.hold(undefined);
  }, [at]);

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
  followingRef.current = at !== undefined;
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
    if (!scroller || !sheet || typeof ResizeObserver === "undefined") return;
    let width = scroller.clientWidth;
    let height = scroller.clientHeight;
    let right = 0;
    let bottom = 0;
    const settled = () => scroller.clientWidth === width && scroller.clientHeight === height;
    const note = () => {
      right = scrollAcross(scroller)[1] - scroller.scrollLeft;
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
        /*
         * Aimed again as it was last aimed: a smooth scroll under way, to the
         * next round say while the panel below changes height for it, goes on
         * smoothly to where the stitch now is, rather than being cut short
         * by a jump there.
         */
        aimRef.current(aimedAt.current?.behavior === "smooth" && !reducedMotion() ? "smooth" : "auto");
      } else {
        scroller.scrollLeft = scrollAcross(scroller)[1] - right;
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
  }, []);

  const focusRound = at?.round;

  if (layout.rows === 0) return <p>This pattern has no stitches to chart.</p>;

  return (
    <div className="chart-frame">
      {contrast && <ul className="chart-yarn-numbers">{Object.entries(palette).filter(([key], i, entries) => entries.findIndex(([other]) => yarnLabels[other] === yarnLabels[key]) === i).map(([key, yarn]) => <li key={key}>{yarnLabels[key]}: {yarn.name}</li>)}</ul>}
      <div
        className="chart-scroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Scrollable knitting chart. Plus and minus zoom it."
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const step = event.key === "+" || event.key === "=" ? 1 : event.key === "-" ? -1 : 0;
          if (!step) return;
          event.preventDefault();
          // About the middle of what is showing of the chart.
          const view = event.currentTarget.getBoundingClientRect();
          const top = Math.max(view.top, 0);
          const bottom = Math.min(view.bottom, window.innerHeight);
          zoomAt(stepCell(cellSize, step, least()), view.left + view.width / 2, (top + bottom) / 2);
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
          markers={markerLines}
          breaks={scene.breaks}
        />
        <div
          ref={sheetRef}
          className="chart-sheets chart-pickable"
          // The tiles say how wide and how tall the chart is, as what is in view changes.
          style={{ marginLeft: leftMargin(cellSize) }}
          onClick={(event) => {
            const id = tilesRef.current?.stitchAt(event.clientX, event.clientY);
            setPicked(id === picked ? undefined : id);
          }}
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
          <ChartTiles
            ref={tilesRef}
            scene={scene}
            cell={cellSize}
            palette={shownPalette}
            yarnLabels={contrast ? yarnLabels : undefined}
            progress={progress}
            hatch={hatch}
            onHold={onHoldSets}
            overlay={overlay}
            colours={colours}
            margin={leftMargin(cellSize)}
            follow={nextId}
            collapse
            onMove={picked !== undefined ? moved : undefined}
            onTargetMoved={targetMoved}
          />
          {picked !== undefined && (
            <StitchPicker
              place={(id) => tilesRef.current?.place(id)}
              chartWidth={sheetRef.current?.offsetWidth ?? 0}
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
        {layout.columns} columns across and {layout.rows} rows. The stitches cast on at
        an underarm are the bottom of two pieces, the body and a sleeve, so the
        sweater has more than one chart, chosen by the tabs above it: from the neck,
        the yoke with the body and both sleeves side by side above it, all but the
        underarms; the body, with both underarms; and each sleeve, picked up over
        its underarm. While you knit, the chart is the one the next stitch is in.
        Read from the bottom right, working right to left; scroll sideways to
        see a whole round, and pinch to zoom.{onJump && " Tap a stitch to carry on from there."} Every
        stitch stands over the stitch it was knitted into, so a column is a
        column of the knitting: a make-one begins a new one, with nothing below
        it, as do the stitches cast on at the underarms and picked up for the
        sleeves, and a decrease ends one. A column with no stitch in the rows on
        screen closes up, so what you see stands side by side as it does on the
        needles, and parts again when a make-one's row comes into view; so does
        a row with no stitch in the columns on screen. Above the divide each row holds a round
        of each piece the chart shows, all numbered on from the yoke's.
        {turns.length > 0 &&
          " The chart shows the side you are working on, every stitch as it looks from there, and turns over" +
            " with the work at a short row."}
      </p>
    </div>
  );
};

export default Chart;
