import React, { useEffect } from "react";
import { Stitch } from "../types/Stitch";
import { ChartLayout } from "./layout";
import { cellAt, chartSize } from "./draw-chart";
import { progressBefore } from "./jump";
import Button from "../components/ui/Button";
import { KeyEntry } from "./stitch-key";
import { HatchSwatch, OnHoldSwatch, Swatch, hatchSaying } from "./ChartHelp";

/** How wide the bubble is, so it can be kept on the chart. */
const bubbleWidth = 208;
/** Wider when it also explains the stitch. */
const explainingWidth = 272;

/**
 * The bubble over a stitch tapped on the chart, offering to carry on from it.
 *
 * Tapping picks the stitch you want to work next: one ahead of you marks
 * everything before it knitted, and one behind you takes you back to it. It
 * asks rather than jumping at once, because a chart is also something you
 * scroll with your thumb, and it can be undone either way.
 */
const StitchPicker: React.FC<{
  id: number;
  stitches: Stitch[];
  rounds: number[][];
  layout: ChartLayout;
  cell: number;
  progress: number;
  /** Absent when you are not knitting: then it only says what the stitch is. */
  onJump?: (progress: number) => void;
  onClose: () => void;
  /** What the stitch is and how to work it, and the yarn it is worked in. */
  entry?: KeyEntry;
  yarn?: { name: string; hex: string };
  /** What each round is, beside its name: "dividing round", "Border, row 3". */
  labels?: string[];
  /** What each round is called in the knitting: "Body, round 23". */
  names?: string[];
  /** Whether the stitch is hatched: worked with the other side towards you. */
  otherFace?: boolean;
  /**
   * Where the stitch is on hold, the piece it is set aside for - "Left
   * sleeve" - and whether it is one of the stitches waiting on waste yarn,
   * rather than one still to be knitted.
   */
  onHold?: { piece: string; waiting: boolean };
  /** Anything more to say about the stitch, below what it is. */
  note?: React.ReactNode;
}> = ({ id, stitches, rounds, layout, cell, progress, onJump, onClose, entry, yarn, labels, names, otherFace, onHold, note }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const at = layout.cells.get(id);
  if (!at) return null;
  const target = progressBefore(stitches, rounds, at.round, at.index);
  const { x, y } = cellAt(layout, at.row, at.column, cell);
  const where = `${names?.[at.round - 1] ?? `Round ${at.round}`}, stitch ${at.index}`;
  const { width } = chartSize(layout, cell);
  const explains = entry !== undefined && entry.id !== "k1";
  const needles = stitches[id]?.needles;
  const joinsAfter = stitches[id + 1]?.type === "join";
  const bubble = explains || otherFace || onHold ? explainingWidth : bubbleWidth;
  const left = Math.min(
    Math.max(x + cell / 2 - bubble / 2, 4),
    Math.max(width - bubble - 4, 4),
  );
  // Above the stitch, unless that would run off the top of the chart.
  const below = y < 96;
  const here = target === progress;

  return (
    <>
      <div
        className="chart-picked"
        style={{ left: x - 2, top: y - 2, width: cell + 4, height: cell + 4 }}
        aria-hidden="true"
      />
      <div
        className={`stitch-picker${below ? " stitch-picker-below" : ""}`}
        role="dialog"
        aria-label={where}
        style={{
          left,
          width: bubble,
          top: below ? y + cell + 8 : undefined,
          bottom: below ? undefined : layout.rows * cell - y + 8,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="stitch-picker-head">
          <span>
            {where}
            {labels?.[at.round - 1] && (
              <span className="stitch-picker-where">{labels[at.round - 1]}</span>
            )}
          </span>
          <button
            type="button"
            className="stitch-picker-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {entry && (
          <div className="stitch-picker-what">
            {explains && <Swatch entry={entry} />}
            <div>
              <strong>
                {entry.label}
                {entry.abbreviation && <span className="stitch-abbr"> {entry.abbreviation}</span>}
              </strong>
              {yarn && (
                <span className="stitch-picker-yarn">
                  <span className="swatch" style={{ background: yarn.hex }} /> {yarn.name}
                </span>
              )}
              {needles !== undefined && (
                <span className="stitch-picker-needles">On {needles}mm needles</span>
              )}
              {joinsAfter && (
                <span className="stitch-picker-needles">Then join in the round</span>
              )}
              {explains && <p>{entry.how}</p>}
              {explains && entry.note && <p className="stitch-note">{entry.note}</p>}
            </div>
          </div>
        )}
        {otherFace && (
          <div className="stitch-picker-what stitch-picker-face">
            <HatchSwatch />
            <p>
              <strong>Hatched.</strong> {hatchSaying}
            </p>
          </div>
        )}
        {onHold && (
          <div className="stitch-picker-what stitch-picker-face">
            <OnHoldSwatch />
            <p>
              <strong>On hold</strong>{" "}
              {onHold.waiting
                ? `for the ${onHold.piece.toLowerCase()}: on waste yarn until the ${onHold.piece.toLowerCase()} is begun.`
                : `with the ${onHold.piece.toLowerCase()}: not knitted until the ${onHold.piece.toLowerCase()} is begun.`}
            </p>
          </div>
        )}
        {note}
        {!onJump ? null : here ? (
          <p className="stitch-picker-note">This is the next stitch to work.</p>
        ) : (
          <Button
            variant="primary"
            autoFocus
            onClick={() => {
              onJump(target);
              onClose();
            }}
          >
            {target > progress ? "Knit up to here" : "Go back to here"}
          </Button>
        )}
      </div>
    </>
  );
};

export default StitchPicker;
