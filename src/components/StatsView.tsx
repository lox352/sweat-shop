/**
 * Explore statistics: the chart full screen, as when knitting, but for
 * looking back at how the knitting went rather than doing it.
 *
 * The chart shows one of three layers, switched in the panel below it: the
 * pattern as it is; its pace, each stitch coloured by the 30 stitches
 * around it against the knitter's usual; or the sittings, each coloured by
 * the sitting it was knitted in. Tapping a stitch says when it was knitted
 * and how fast. "Your speeds" opens a sheet like the key, with the
 * knitter's own time for each kind of stitch.
 */
import React, { useEffect } from "react";
import type { Stitch } from "../types/Stitch";
import { type KeyId, stitchKey } from "../knitting/stitch-key";
import { Swatch, NeedlesSwatch } from "../knitting/ChartHelp";
import type { SweaterPattern } from "../data/sweaters/types";
import type { TimeDetail } from "../knitting/timing/detail";
import type { Column, TimeSummary } from "../knitting/timing/model";
import { duration, range } from "../knitting/timing/format";
import {
  clock,
  day,
  paceColours,
  paceStep,
  paceWords,
  seconds,
  usualStep,
} from "../knitting/timing/pace";
import type { Layer } from "../knitting/timing/overlay";
import Button from "./ui/Button";
import "./StatsView.css";

/** What a tapped stitch's bubble adds: when it was knitted, and how fast. */
export const StitchTime: React.FC<{ time: TimeDetail; id: number; round?: number }> = ({ time, id, round }) => {
  const at = time.reachedAt[id];
  if (!Number.isFinite(at)) return <p className="stats-note">Not knitted yet.</p>;
  const sitting = time.sittings[time.sittingOf[id]];
  const s = time.smooth[id];
  const step = paceStep(s / time.usual);
  const r = round !== undefined ? time.perRound[round - 1] : undefined;
  return (
    <div className="stats-note">
      <p>
        Knitted {day(at)}, {clock(at)}
        {sitting && sitting.end > sitting.start && <>, in a sitting of {duration((sitting.end - sitting.start) / 1000)}</>}.
      </p>
      {Number.isFinite(s) ? (
        <p>
          <span className="stats-chip" style={{ background: paceColours[step] }} />
          {time.tapSpan[id] > 30 ? (
            <>Came in one tap of {time.tapSpan[id]} stitches, at about {seconds(s)} a stitch.</>
          ) : step === usualStep ? (
            <>Around here, about {seconds(s)} a stitch: about your usual.</>
          ) : (
            <>
              Around here, about {seconds(s)} a stitch: {paceWords[step]} than your usual {seconds(time.usual)}.
            </>
          )}
        </p>
      ) : (
        <p>No time for it: it came after a break.</p>
      )}
      {r && r.timed >= r.stitches / 2 && <p>The whole round took about {duration(r.seconds * (r.stitches / r.timed))}.</p>}
    </div>
  );
};

const PaceLegend: React.FC<{ usual: number }> = ({ usual }) => (
  <div className="stats-legend" aria-label="Colours: quicker to slower than usual">
    <span>Quicker</span>
    <span className="stats-legend-scale">
      {paceColours.map((c) => (
        <span key={c} style={{ background: c }} />
      ))}
    </span>
    <span>Slower</span>
    <span className="stats-legend-usual">than your usual {seconds(usual)} a stitch</span>
  </div>
);

const layers: { id: Layer; label: string }[] = [
  { id: "pattern", label: "Pattern" },
  { id: "pace", label: "Pace" },
  { id: "sittings", label: "Sittings" },
];

export const StatsPanel: React.FC<{
  summary: TimeSummary;
  time: TimeDetail;
  finished: boolean;
  layer: Layer;
  onLayer: (layer: Layer) => void;
  onSpeeds: () => void;
  onClose: () => void;
}> = ({ summary, time, finished, layer, onLayer, onSpeeds, onClose }) => (
  <section className="knitting-panel stats-panel" aria-label="Your knitting statistics">
    <div className="stats-figures">
      <div>
        <em>{duration(summary.knitted)}</em>
        <span className="quiet">knitted</span>
      </div>
      {!finished && summary.left && (
        <div>
          <em>{range(summary.left)}</em>
          <span className="quiet">to go</span>
        </div>
      )}
      <div>
        <em>{summary.sittings.length}</em>
        <span className="quiet">{summary.sittings.length === 1 ? "sitting" : "sittings"}</span>
      </div>
    </div>
    <div className="stats-layers" role="radiogroup" aria-label="Show on the chart">
      {layers.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={layer === id}
          className={layer === id ? "on" : ""}
          onClick={() => onLayer(id)}
        >
          {label}
        </button>
      ))}
    </div>
    {/* Every layer has the round strips, so every layer has their key. */}
    <PaceLegend usual={time.usual} />
    {layer === "sittings" && time.sittings.length > 0 && (
      <p className="quiet stats-hint">
        Each colour a sitting, {day(time.sittings[0].start)} to {day(time.sittings.at(-1)!.start)}. Tap a stitch for when.
      </p>
    )}
    {layer === "pattern" && <p className="quiet stats-hint">Tap a stitch for when you knitted it, and how fast.</p>}
    <div className="stats-actions">
      <Button variant="secondary" onClick={onSpeeds}>
        Your speeds
      </Button>
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </div>
  </section>
);

const opOf: Partial<Record<KeyId, Column>> = {
  castOn: "castOn",
  castOnUnderarm: "castOn",
  k1: "knit",
  p1: "purl",
  k1tbl: "tbl",
  k2tog: "decrease",
  ssk: "decrease",
  s2kp: "doubleDecrease",
  sk2p: "doubleDecrease",
  m1: "makeOne",
  kfb: "kfb",
  kbf: "kfb",
  pfb: "kfb",
  sl1po: "decrease",
  pickUp: "pickUp",
  bindOff: "bindOff",
  bindOffPurl: "bindOff",
};

/** How many of an operation the timed taps must cover before its cost means much. */
const enoughOf = (column: Column) => (["join", "hold", "resume", "needles", "turn"].includes(column) ? 1 : 60);

interface SpeedRow {
  key: string;
  swatch: React.ReactNode;
  label: string;
  column: Column;
  /** Time on top of the stitch itself, shown with a plus. */
  extra?: boolean;
}

const speedRows = (stitches: Stitch[], notes: SweaterPattern["stitchNotes"], time: TimeDetail): SpeedRow[] => {
  const rows: SpeedRow[] = [];
  for (const entry of stitchKey(stitches, notes)) {
    const column = opOf[entry.id];
    if (column) rows.push({ key: entry.id, swatch: <Swatch entry={entry} />, label: entry.label, column });
  }
  const has = (type: string) => stitches.some((s) => s.type === type);
  if (time.seen.colourChange > 0) {
    rows.push({ key: "yarn", swatch: <span className="stats-swatch-yarns" />, label: "Changing yarn", column: "colourChange", extra: true });
  }
  if (time.seen.knitPurlSwitch > 0) {
    rows.push({ key: "switch", swatch: <span className="stats-swatch-text">k|p</span>, label: "Switching knit and purl", column: "knitPurlSwitch", extra: true });
  }
  if (has("join")) rows.push({ key: "join", swatch: <span className="stats-swatch-text">←</span>, label: "Joining in the round", column: "join" });
  if (has("hold")) rows.push({ key: "hold", swatch: <span className="stats-swatch-text">⇣</span>, label: "Putting stitches on hold", column: "hold" });
  if (has("resume")) rows.push({ key: "resume", swatch: <span className="stats-swatch-text">⇡</span>, label: "Taking held stitches up again", column: "resume" });
  if (has("needles")) rows.push({ key: "needles", swatch: <NeedlesSwatch />, label: "Changing needles", column: "needles" });
  if (has("turn")) rows.push({ key: "turn", swatch: <span className="stats-swatch-text">↩</span>, label: "Turning a short row", column: "turn" });
  return rows;
};

/** The knitter's own time for each kind of stitch in this sweater, in a sheet like the key. */
export const SpeedsSheet: React.FC<{
  stitches: Stitch[];
  notes: SweaterPattern["stitchNotes"];
  time: TimeDetail;
  onClose: () => void;
}> = ({ stitches, notes, time, onClose }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = speedRows(stitches, notes, time);
  const known = rows.filter((r) => time.seen[r.column] >= enoughOf(r.column));
  const unknown = rows.filter((r) => time.seen[r.column] < enoughOf(r.column));
  return (
    <div className="key-sheet stats-speeds" role="dialog" aria-label="Your speeds">
      <div className="key-sheet-head">
        <strong>Your speeds</strong>
        <button type="button" className="key-sheet-close" aria-label="Close your speeds" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="key-sheet-body">
        {time.seen.knit >= enoughOf("knit") && (
          <p className="stats-summary">
            You knit a stitch in about <strong>{seconds(time.costs.knit)}</strong>.
          </p>
        )}
        <p className="quiet stats-hint">
          Each on average, worked out from {time.seen.tap.toLocaleString()} taps over {time.sittings.length}{" "}
          {time.sittings.length === 1 ? "sitting" : "sittings"}. The more you knit, the surer these get.
        </p>
        <ul className="stats-speed-list">
          {known.map((r) => (
            <li key={r.key}>
              <span className="stats-speed-swatch">{r.swatch}</span>
              <span className="stats-speed-name">{r.label}</span>
              <span className="stats-speed-you">
                {r.extra ? "+" : ""}
                {seconds(time.costs[r.column])}
              </span>
            </li>
          ))}
        </ul>
        {unknown.length > 0 && (
          <p className="quiet stats-hint">Not enough yet to say: {unknown.map((r) => r.label.toLowerCase()).join(", ")}.</p>
        )}
      </div>
    </div>
  );
};
