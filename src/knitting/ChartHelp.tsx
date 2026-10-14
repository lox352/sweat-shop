import React, { useMemo } from "react";
import { Stitch, joinsCastOn } from "../types/Stitch";
import { StitchType } from "../types/StitchType";
import { Mark, forkMark, makeOneMark, markFor } from "../helpers/stitch-marks";
import { Palette, yarnFor } from "./palette";
import { indexRounds, roundParts, runInstruction } from "./progress";
import { KeyEntry, stitchKey } from "./stitch-key";
import type { Hold, NeedleChange, Turn } from "./chart-marks";
import type { StitchKeyId, StitchNote } from "../data/sweaters/types";

const Cell: React.FC<{ type?: StitchType; mark?: Mark; x: number }> = ({ type, mark = type && markFor(type), x }) => {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect width="1" height="1" className="key-cell" />
      {mark?.strokes?.map((points, i) => (
        <polyline key={i} points={points.map((p) => p.join(",")).join(" ")} className="key-mark" />
      ))}
      {mark?.dot && <circle cx={mark.dot.x} cy={mark.dot.y} r={mark.dot.r} className="key-dot" />}
    </g>
  );
};

/**
 * The join in the round as the chart draws it: the round leaving one end of
 * a stitch and coming back in at the other.
 */
const JoinSwatch: React.FC = () => (
  <svg className="key-swatch" width="48" height="24" viewBox="-0.6 -0.04 2.2 1.08" aria-hidden="true">
    <Cell x={0} />
    <path
      d="M0 0.5H-0.5M-0.32 0.32L-0.5 0.5L-0.32 0.68M1.5 0.5H1M1.18 0.32L1 0.5L1.18 0.68"
      className="key-join"
    />
  </svg>
);

/** A KFB is drawn as the pair of cells it makes: the stitch, and the new one to its left. */
export const Swatch: React.FC<{ entry: KeyEntry }> = ({ entry }) => {
  if (entry.id === "join") return <JoinSwatch />;
  const pair = entry.id === "kfb";
  return (
    <svg
      className="key-swatch"
      width={pair ? 48 : 24}
      height="24"
      viewBox={`-0.04 -0.04 ${(pair ? 2 : 1) + 0.08} 1.08`}
      aria-hidden="true"
    >
      {pair ? (
        <>
          <Cell x={0} />
          <Cell x={1} mark={forkMark(0.5, [0.5, -0.5])} />
        </>
      ) : entry.id === "m1" ? (
        <Cell x={0} mark={makeOneMark(entry.lean)} />
      ) : (
        <Cell type={entry.type} x={0} />
      )}
    </svg>
  );
};

/** A short row's turn: a hook round and back, as the chart draws it. */
export const TurnSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 16H17V7H6M10 3L6 7L10 11" className="key-hold" />
  </svg>
);

/** The hatch as the chart draws it over the other side's rounds. */
export const HatchSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" className="key-hatch-ground" />
    {[-12, -6, 0, 6, 12, 18].map((at) => (
      <line key={at} x1={at} y1={24} x2={at + 24} y2={0} className="chart-hatch-line" />
    ))}
  </svg>
);

/** What the hatch on the chart means. */
export const hatchSaying =
  "Worked with the other side of the sweater towards you, on the far side of " +
  "a turn from where you are now. The chart shows it from the side you are " +
  "working on, so it is mirrored, and a knit there is a purl from here, and a " +
  "purl a knit.";

/** Stitches put on hold: a bar with an arrow down it, as the chart draws it. */
export const HoldSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2V21M7 16L12 21L17 16" className="key-hold" />
  </svg>
);

/** A change of needles, dashed as the chart draws it. */
export const NeedlesSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <line x1="0" y1="12" x2="24" y2="12" className="key-needles" />
  </svg>
);

/**
 * Where the needles change, in words: "to 3mm after round 14". A pattern
 * that changes by the round rather than the section - 2026's, which puts
 * every single-colour round on the smaller needles - does so often, so the
 * rounds are gathered by the size they change to.
 */
function NeedlesText({ changes }: { changes: NeedleChange[] }) {
  const sizes = [...new Set(changes.map((change) => change.to))];
  const phrases = sizes.map((size) => {
    const after = changes.filter((change) => change.to === size).map((change) => change.after);
    return `to ${size}mm after ${after.length === 1 ? "round" : "rounds"} ${after.join(", ")}`;
  });
  return (
    <>
      Where the dashed rule crosses the chart, change needles:{" "}
      {phrases.join("; ")}. Knitting stops at each for you to change, and
      tapping a stitch says which needles it is worked on.
    </>
  );
}

/**
 * Where the sleeves go on hold, in words: "the right sleeve's 80, then the
 * left sleeve's 80".
 */
function HoldsText({ holds }: { holds: Hold[] }) {
  const which = holds.map((hold) => `the ${hold.label.toLowerCase()}'s ${hold.count}`).join(", then ");
  return (
    <>
      Where a bar with an arrow down it stands in a round, slip the next
      stitches onto waste yarn: {which}. The stitches cast on straight after
      each bar are that sleeve's underarm, cast on in its place, and the
      sleeve picks them up again with its held stitches when its turn comes.
    </>
  );
}

/**
 * What the marks on this sweater's chart mean, and how to work each one.
 *
 * Only the stitches the design uses, in the words it uses; see stitch-key.ts.
 */
export function StitchLegend({ stitches, notes, needles, holds, turns }: {
  stitches: Stitch[];
  notes?: Partial<Record<StitchKeyId, StitchNote>>;
  needles?: NeedleChange[];
  holds?: Hold[];
  turns?: Turn[];
}) {
  const entries = useMemo(() => stitchKey(stitches, notes), [stitches, notes]);
  return (
    <details className="chart-help">
      <summary>Stitch-symbol key</summary>
      <KeyList entries={entries} needles={needles} holds={holds} turns={turns} />
    </details>
  );
}

/** The key's entries, each with its mark and how to work it. */
export function KeyList({ entries, current, needles, holds, turns }: {
  entries: KeyEntry[];
  current?: string;
  /** Where the needles change, explained after the stitches. */
  needles?: NeedleChange[];
  /** Where a sleeve's stitches go on hold, likewise. */
  holds?: Hold[];
  /** And where a short row turns. */
  turns?: Turn[];
}) {
  return (
    <ul className="stitch-key">
      {entries.map((entry) => (
        <li key={entry.id} className={entry.id === current ? "stitch-key-current" : undefined}>
          <Swatch entry={entry} />
          <div>
            <strong>{entry.label}</strong>
            {entry.abbreviation && <span className="stitch-abbr"> {entry.abbreviation}</span>}
            {entry.id === current && <span className="stitch-key-here"> · you are here</span>}
            <p>{entry.how}</p>
            {entry.note && <p className="stitch-note">{entry.note}</p>}
          </div>
        </li>
      ))}
      {needles && needles.length > 0 && (
        <li className="stitch-key-needles">
          <NeedlesSwatch />
          <div>
            <strong>Change needles</strong>
            <p>
              <NeedlesText changes={needles} />
            </p>
          </div>
        </li>
      )}
      {holds && holds.length > 0 && (
        <li className="stitch-key-hold">
          <HoldSwatch />
          <div>
            <strong>Put stitches on hold</strong>
            <p>
              <HoldsText holds={holds} />
            </p>
          </div>
        </li>
      )}
      {turns && turns.length > 0 && (
        <li className="stitch-key-turn">
          <TurnSwatch />
          <div>
            <strong>Turn: a short row</strong>
            <p>
              Where a hook turns back at the end of a row part way across the
              chart, turn the work and work back the other way: the rows
              across the back of the neck, {turns.length / 2} pairs of them,
              each reaching further than the last. The first stitch after
              each turn is a double stitch - slipped, with the yarn pulled up
              over the needle so its two legs sit on it - and is worked as one
              when a row or round comes back to it. A row back is worked from
              the wrong side, where knits become purls, so it is purled, and
              drawn as purls. The chart turns over with the work: it always
              shows the side towards you, and hatches what was worked from
              the other.
            </p>
          </div>
        </li>
      )}
      {turns && turns.length > 0 && (
        <li className="stitch-key-hatch">
          <HatchSwatch />
          <div>
            <strong>Hatched</strong>
            <p>{hatchSaying}</p>
          </div>
        </li>
      )}
    </ul>
  );
}

export function TextRound({ stitches, rounds, round, labels, palette, pieces = [] }: {
  stitches: Stitch[]; rounds: number[][]; round: number; labels?: string[]; palette: Palette;
  /** The sweater's pieces, to name a sleeve put on hold. */
  pieces?: { id: string; label: string }[];
}) {
  const ids = rounds[round - 1] ?? [];
  const index = indexRounds(rounds, labels);
  const parts = roundParts(stitches, ids, index);
  const pieceLabel = (id?: string) => (pieces.find((piece) => piece.id === id)?.label ?? id ?? "").toLowerCase();
  return <div><p>Round {round}: {labels?.[round - 1]}. Read in working order.</p>
    <ol>{parts.map(part => "run" in part
      ? <li key={part.run.startId}>{runInstruction(part.run)} in {yarnFor(palette, part.run.slot).name}</li>
      : part.step.type === "hold"
        ? <li key={part.step.id}>Put the next {part.step.count} stitches on hold for the {pieceLabel(part.step.holder)}.</li>
        : null)}
      {stitches[(ids.at(-1) ?? 0) + 1]?.type === "join" && <li>{joinsCastOn(stitches, (ids.at(-1) ?? 0) + 1)
        ? "Cast on one more stitch and join in the round, lifting the first stitch cast on over it."
        : "Without turning, join in the round across the gap."}</li>}
      {stitches[(ids.at(-1) ?? 0) + 1]?.type === "turn" && <li>Turn, and make a double stitch.</li>}</ol>
  </div>;
}
