import React, { useMemo } from "react";
import { Stitch } from "../types/Stitch";
import { ChartLayout } from "./layout";
import { joinArrowLength } from "./draw-chart";
import type { Face, Hold, Join, Turn } from "./chart-marks";
import { Palette, yarnFor } from "./palette";
import {
  type NeedleRule,
  cellAt,
  chartSize,
  fillPaths,
  gridPaths,
  markPaths,
  numberedRows,
  progressPath,
} from "./chart-paths";

interface ChartSvgProps {
  yarnLabels?: Record<string, string>;
  stitches: Stitch[];
  rounds: number[][];
  layout: ChartLayout;
  palette: Palette;
  progress: number;
  nextStitchId?: number;
  cell: number;
  /** Where the needles are changed, and in which piece. */
  needleChanges?: NeedleRule[];
  /** Where the knitting is joined in the round. */
  join?: Join;
  /** Where a sleeve's stitches go on hold. */
  holds?: Hold[];
  /** Where a short row turns. */
  turns?: Turn[];
  /**
   * Rows, first and last, worked with the other side towards you from the
   * side you are on: hatched over.
   */
  hatch?: [number, number][];
  /** The side of the sweater shown: every stitch is drawn as it looks from there. */
  face?: Face;
  /** Which way this pattern's make-ones lean, if it says. */
  makeOneLean?: "left" | "right";
}

type Grid = ReturnType<typeof gridPaths>;

/**
 * The chart, as vectors.
 *
 * Two layers. The one underneath is the knitting - the colours, the rules and
 * the symbols - which does not change while you knit, so it is built once and
 * React is told to leave it alone. Over the top go the two things that do
 * change: how much is done, and which stitch is next.
 *
 * Both are a handful of paths rather than a shape per stitch, because a chart
 * is mostly long runs of one colour. See chart-paths.ts. That is what makes a
 * drawing of ten thousand stitches cheap enough to keep as vectors, which in
 * turn is what keeps it sharp on a phone, under zoom, and on paper.
 */

const Knitting: React.FC<{
  stitches: Stitch[];
  layout: ChartLayout;
  palette: Palette;
  cell: number;
  grid: Grid;
  makeOneLean?: "left" | "right";
  face: Face;
}> = React.memo(({ stitches, layout, palette, cell, grid, makeOneLean, face }) => {
  const fills = useMemo(
    () => fillPaths(stitches, layout, cell),
    [stitches, layout, cell],
  );
  const marks = useMemo(
    () => markPaths(stitches, layout, palette, cell, makeOneLean, face),
    [stitches, layout, palette, cell, makeOneLean, face],
  );

  return (
    <g>
      {fills.map(({ slot, d }) => (
        <path key={slot} d={d} fill={yarnFor(palette, slot).hex} />
      ))}
      <path d={grid.light} className="chart-rule" />
      <path d={grid.heavy} className="chart-rule chart-rule-heavy" />
      {grid.pieces && <path d={grid.pieces} className="chart-rule chart-rule-piece" />}
      {marks.map(({ ink, strokes, dots }) => (
        <g key={ink} stroke={ink} fill={ink}>
          {strokes && (
            <>
              {/* A halo, so a mark reads on a dark yarn as well as a light one. */}
              <path
                d={strokes}
                className="chart-mark-halo"
                stroke={ink === "#ffffff" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.75)"}
              />
              <path d={strokes} className="chart-mark" />
            </>
          )}
          {dots && <path d={dots} stroke="none" />}
        </g>
      ))}
    </g>
  );
});

const ChartSvg: React.FC<ChartSvgProps> = ({
  yarnLabels,
  stitches,
  rounds,
  layout,
  palette,
  progress,
  nextStitchId,
  cell,
  needleChanges,
  join,
  holds,
  turns,
  hatch = [],
  face = "right",
  makeOneLean,
}) => {
  const { width, height } = chartSize(layout, cell);
  /*
   * Built here rather than inside the knitting, because the change of
   * needles' rule is drawn over the worked-so-far veil: it says where the
   * needles changed, which is as much use behind you as ahead of you.
   */
  const grid = useMemo(
    () => gridPaths(layout, cell, needleChanges),
    [layout, cell, needleChanges],
  );

  const veil = useMemo(
    () => progressPath(layout, rounds, progress, cell),
    [layout, rounds, progress, cell],
  );
  const numbers = useMemo(
    () => numberedRows(layout, needleChanges),
    [layout, needleChanges],
  );
  const next = nextStitchId === undefined ? undefined : layout.cells.get(nextStitchId);

  return (
    <svg
      className="chart-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
    >
      <Knitting
        stitches={stitches}
        layout={layout}
        palette={palette}
        cell={cell}
        grid={grid}
        makeOneLean={makeOneLean}
        face={face}
      />
      {yarnLabels && <YarnLabels stitches={stitches} layout={layout} cell={cell} labels={yarnLabels} />}
      {veil && <path d={veil} className="chart-done" />}
      {hatch.length > 0 && (
        <>
          <defs>
            <pattern
              id="chart-hatch"
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={6} className="chart-hatch-line" />
            </pattern>
          </defs>
          {hatch.map(([from, to]) => (
            <rect
              key={from}
              className="chart-hatch"
              x={0}
              y={cellAt(layout, to, 1, cell).y}
              width={layout.columns * cell}
              height={(to - from + 1) * cell}
              fill="url(#chart-hatch)"
            />
          ))}
        </>
      )}
      {join && <JoinArrows join={join} layout={layout} rounds={rounds} cell={cell} />}
      {holds && holds.length > 0 && <HoldBars holds={holds} layout={layout} cell={cell} />}
      {turns && turns.length > 0 && <TurnHooks turns={turns} layout={layout} cell={cell} />}
      {grid.needles && (
        <g>
          {/* On a pale ground, so the dashes show on dark wool as on light. */}
          <path d={grid.needles} className="chart-rule chart-rule-needles-ground" />
          <path d={grid.needles} className="chart-rule chart-rule-needles">
            <title>The needles are changed here.</title>
          </path>
        </g>
      )}
      {next && (
        <rect
          className="chart-next"
          x={cellAt(layout, next.row, next.column, cell).x - 1}
          y={cellAt(layout, next.row, next.column, cell).y - 1}
          width={cell + 2}
          height={cell + 2}
        />
      )}
      <g className="chart-numbers">
        {numbers.map((row) => (
          <text
            key={row}
            x={layout.columns * cell + Math.round(cell * 0.45)}
            y={cellAt(layout, row, 1, cell).y + cell / 2}
            dominantBaseline="middle"
            style={{ fontSize: Math.max(12, cell * .55) }}
          >
            {layout.numbers[row - 1] ?? row}
          </text>
        ))}
      </g>
    </svg>
  );
};

export default ChartSvg;

const YarnLabels = React.memo(({ stitches, layout, cell, labels }: {
  stitches: Stitch[]; layout: ChartLayout; cell: number; labels: Record<string, string>;
}) => <g fill="#000" fontSize="9" aria-hidden="true">{stitches.map(stitch => {
  const at = layout.cells.get(stitch.id);
  if (!at) return null;
  const { x, y } = cellAt(layout, at.row, at.column, cell);
  return <text key={stitch.id} x={x + 2} y={y + 9}>{labels[stitch.slot]}</text>;
})}</g>);

/**
 * Where the knitting is joined in the round: a step, not a stitch, so it has
 * no cell to mark. It is drawn instead as the round going on past its last
 * stitch - an arrow leaving that stitch the way the round was worked - and
 * coming back in at the first stitch of the next, an arrow entering it the
 * same way. Short enough to keep clear of the round numbers; the chart
 * keeps a margin on its other side for them.
 */
const JoinArrows: React.FC<{
  join: Join;
  layout: ChartLayout;
  rounds: number[][];
  cell: number;
}> = ({ join, layout, rounds, cell }) => {
  const last = layout.cells.get(join.last);
  const first = layout.cells.get(join.first);
  if (!last || !first) return null;
  // Which way across the chart a round is worked, as drawn: -1 is leftwards.
  const way = (ids: number[] | undefined) => {
    const [a, b] = [ids?.[0], ids?.[1]].map((id) => (id === undefined ? undefined : layout.cells.get(id)));
    if (!a || !b) return -1;
    return cellAt(layout, b.row, b.column, cell).x > cellAt(layout, a.row, a.column, cell).x ? 1 : -1;
  };
  const length = cell * joinArrowLength;
  const head = cell * 0.18;
  const arrow = (from: number, to: number, y: number) => {
    const d = Math.sign(to - from);
    return `M${from} ${y}H${to}M${to - d * head} ${y - head}L${to} ${y}L${to - d * head} ${y + head}`;
  };
  const leaving = cellAt(layout, last.row, last.column, cell);
  const out = way(rounds[join.after - 1]);
  const leaveFrom = out < 0 ? leaving.x : leaving.x + cell;
  const entering = cellAt(layout, first.row, first.column, cell);
  const into = way(rounds[join.after]);
  const enterAt = into < 0 ? entering.x + cell : entering.x;
  return (
    <path
      className="chart-join"
      d={
        arrow(leaveFrom, leaveFrom + out * length, leaving.y + cell / 2) +
        arrow(enterAt - into * length, enterAt, entering.y + cell / 2)
      }
    >
      <title>Joined in the round here.</title>
    </path>
  );
};

/**
 * Where a sleeve's stitches go on hold, part way through the dividing round:
 * a step, so it has no cell of its own either. It is drawn as a bar at the
 * end of the stitch before it, the way the round was going - where the
 * sleeve's own columns begin, its stitches beyond the bar going down onto
 * waste yarn, with an arrow down it to say so. The round goes on past them
 * to the underarm cast on in their place, on the far side of the sleeve. On
 * a pale line of its own, like a change of needles, so it shows on dark wool
 * as on light.
 */
const HoldBars: React.FC<{
  holds: Hold[];
  layout: ChartLayout;
  cell: number;
}> = ({ holds, layout, cell }) => {
  const head = cell * 0.2;
  const bars = holds.flatMap((hold) => {
    const before = layout.cells.get(hold.before);
    const after = layout.cells.get(hold.after);
    if (!before || !after) return [];
    const a = cellAt(layout, before.row, before.column, cell);
    const b = cellAt(layout, after.row, after.column, cell);
    // At the end of the stitch before, on the side the round goes on to.
    const x = b.x < a.x ? a.x : a.x + cell;
    const [top, bottom] = [a.y - cell * 0.3, a.y + cell * 0.88];
    return [{
      hold,
      d: `M${x} ${top}V${bottom}M${x - head} ${bottom - head}L${x} ${bottom}L${x + head} ${bottom - head}`,
    }];
  });
  return (
    <g>
      {bars.map(({ hold, d }) => (
        <g key={hold.before}>
          <path d={d} className="chart-hold-ground" />
          <path d={d} className="chart-hold">
            <title>{`The ${hold.label.toLowerCase()}'s ${hold.count} stitches go on hold here.`}</title>
          </path>
        </g>
      ))}
    </g>
  );
};

/**
 * Where a short row turns: a hook from the outside of its last stitch, round
 * and up into the row above, pointing back the way that row goes. It is the
 * row's end, which on a short row is part way across the chart.
 */
const TurnHooks: React.FC<{
  turns: Turn[];
  layout: ChartLayout;
  cell: number;
}> = ({ turns, layout, cell }) => {
  const reach = cell * 0.38;
  const head = cell * 0.16;
  const d = turns.flatMap((turn) => {
    const last = layout.cells.get(turn.last);
    const before = layout.cells.get(turn.before);
    if (!last || !before) return [];
    const at = cellAt(layout, last.row, last.column, cell);
    const from = cellAt(layout, before.row, before.column, cell);
    // Which way the row was going across the chart when it turned.
    const way = at.x < from.x ? -1 : 1;
    const edge = way < 0 ? at.x : at.x + cell;
    const [y0, y1] = [at.y + cell / 2, at.y - cell / 2];
    const out = edge + way * reach;
    return [
      `M${edge} ${y0}H${out}V${y1}H${edge}` +
        `M${edge + way * head} ${y1 - head}L${edge} ${y1}L${edge + way * head} ${y1 + head}`,
    ];
  });
  return (
    <path className="chart-join" d={d.join("")}>
      <title>A short row turns here.</title>
    </path>
  );
};
