import React, { lazy, Suspense, useMemo, useState } from "react";
import type { FitOption, Measurements, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import { decodeEdition } from "../../library/editions/format";
import type { Fitted, Unfitted } from "../../library/fit";
import type { Palette } from "../../reading/palette";
import { atTension } from "../../reading/tension";
import PreviewBoundary from "./PreviewBoundary";
import Button from "./ui/Button";

/** The sweaters side by side: three.js, so fetched only where a preview is shown. */
const SweaterComparison = lazy(() => import("../model/SweaterComparison"));

const rows: { key: keyof Measurements; label: string }[] = [
  { key: "chestCm", label: "Chest" },
  { key: "upperArmCm", label: "Upper arm" },
  { key: "yokeDepthCm", label: "Yoke depth" },
  { key: "bodyLengthCm", label: "Body length" },
  { key: "sleeveLengthCm", label: "Sleeve length" },
  { key: "cuffCm", label: "Cuff" },
];

/**
 * What working the rest of a sweater out again comes to, before any of it is
 * taken: the sweater as it was beside each way the design can lay the rest
 * out, drawn to one scale; and for the way chosen, where it changes from,
 * what the knitter should know, what it will measure, and the rest written
 * out. It only shows: asking is useFit's, and taking is whoever shows it's.
 */
const FitPreview: React.FC<{
  size: SizeAbout;
  /** The knitting in hand, how far it is knitted, and the tension it is being fitted to. */
  knitted: SweaterStitches;
  progress: number;
  tension: Tension;
  /** Each way worked out, those that could not be, and what the design calls them. */
  found: Fitted[];
  unfitted: Unfitted[];
  options: FitOption[];
  /** The way to show first, where one was taken before. */
  first?: string;
  palette: Palette;
  /** What the knitting calls each of its rounds, from 0: see progress.roundNames. */
  roundNames: string[];
  /** What taking it is called. */
  take: string;
  onTake: (fitted: Fitted) => void;
  onLeave: () => void;
}> = ({ size, knitted, progress, tension, found, unfitted, options, first, palette, roundNames, take, onTake, onLeave }) => {
  const [chosen, setChosen] = useState(() => (found.some((one) => one.option === first) ? first : found[0]?.option));
  const fitted = found.find((one) => one.option === chosen) ?? found[0];
  const labelOf = (option: string | undefined) => options.find((one) => one.id === option)?.label ?? "Worked out for you";
  // As it was, in the knitter's own stitches; then each way, as the knitting it would be.
  const candidates = useMemo(
    () => [
      { id: "was", label: "As the pattern has it", knitting: atTension(knitted, tension) },
      ...found.map((one) => ({ id: one.option ?? "fitted", label: labelOf(one.option), knitting: decodeEdition(one.file) })),
    ],
    // What a way is called does not change while it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [knitted, tension, found],
  );
  if (!fitted) return null;
  const nameOf = (round: number) => roundNames[round - 1] ?? `round ${round}`;

  return (
    <div role="status" className="refit-shown">
      <PreviewBoundary>
        <Suspense fallback={<p role="status">Drawing them side by side…</p>}>
          <SweaterComparison candidates={candidates} chosen={fitted.option ?? "fitted"} palette={palette} />
        </Suspense>
      </PreviewBoundary>
      {found.length + unfitted.length > 1 && (
        <fieldset className="refit-options">
          <legend>How the rest is laid out</legend>
          {options.map((one) => {
            const failed = unfitted.find((not) => not.option === one.id);
            return (
              <label key={one.id}>
                <input type="radio" name="refit-option" checked={fitted.option === one.id} disabled={!!failed} onChange={() => setChosen(one.id)} />
                <span>
                  <strong>{one.label}.</strong> {failed ? failed.why : one.detail}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      <p>
        <strong>From the end of {nameOf(fitted.round)}.</strong>{" "}
        {progress < (knitted.rounds[fitted.round - 1]?.at(-1) ?? 0) ? "Knit to there as the pattern has it. The rest changes from there:" : "The rest changes from there:"}
      </p>
      <ul>
        {fitted.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <table className="my-tension-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measurement</span>
            </th>
            <th scope="col">Size</th>
            <th scope="col">Fitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{size.finished[key]}cm</td>
              <td>{fitted.finished[key]}cm</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>The rest, written out</summary>
        <pre className="refit-written">{fitted.written}</pre>
      </details>
      <p className="my-tension-actions">
        <Button variant="primary" onClick={() => onTake(fitted)}>
          {take}
        </Button>
        <Button variant="quiet" onClick={onLeave}>
          Not now
        </Button>
      </p>
    </div>
  );
};

export default FitPreview;
