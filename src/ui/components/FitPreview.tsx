import React, { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FitOption, Measurements, Placement, Shade, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import { decodeEdition } from "../../library/editions/format";
import type { Fitted, Unfitted } from "../../library/fit";
import type { Palette } from "../../reading/palette";
import { asKnitted, atTension, sameTension } from "../../reading/tension";
import { measured } from "./measured";
import { fitShare } from "../useFit";
import { useShapes } from "../useShape";
import PreviewBoundary from "./PreviewBoundary";
import Button from "./ui/Button";
import { StageSlot } from "./ui/stage-slot";

/** The sweaters side by side: three.js, so fetched only where a preview is shown. */
const SweaterComparison = lazy(() => import("../model/SweaterComparison"));

/**
 * What a pattern recalculated for its knitter comes to, before any of it is
 * taken: for the way chosen, what it will measure, where it changes from,
 * what the knitter should know, and the rest written out. It only shows:
 * asking is useFit's, and taking is whoever shows it's.
 *
 * What it is set beside is what the knitter is choosing between. Before a
 * sweater is begun (`beside` "designed") that is the design itself: the
 * sweater as designed, at the pattern's tension, beside the one recalculated
 * at theirs, each at its true size - the question is what the recalculating
 * costs the design. Once it is begun ("kept") it is the sweater they will
 * have if they keep knitting as written, in their own stitches, beside the
 * one they will have if the rest is recalculated from where they are.
 *
 * The measurements are all three, side by side: the pattern's, the pattern
 * knitted as written at their tension, and the recalculated one's.
 *
 * Nothing of it is shown until every sweater has been settled into its
 * shape (see useShapes): they are compared as they will hang, not laid out
 * flat, and the bar that followed the working out goes on to follow that.
 * It is the slowest thing the site does, minutes on a phone, and it says so.
 */
const FitPreview: React.FC<{
  size: SizeAbout;
  /** What it is set beside: the sweater as designed, or the one there will be if the knitting carries on as written. */
  beside: "designed" | "kept";
  /** What the knitting in hand is written for, where that is not the size's own: a sweater fitted already, being fitted again. */
  written?: { finished: Measurements } & Tension;
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
  /** The colourway on the sweater in hand, and as it would be on each way: see useColourway. */
  palette: Palette;
  coloursOn: (placement: Placement | undefined) => { palette: Palette; added: Shade[] };
  /** What the knitting calls each of its rounds, from 0: see progress.roundNames. */
  roundNames: string[];
  /** What taking it is called. */
  take: string;
  onTake: (fitted: Fitted) => void;
  onLeave: () => void;
  /** Told the way being shown while it is, and that none is once it is put away: for a page whose own way forward should then be this one. */
  onChosen?: (fitted: Fitted | undefined) => void;
}> = ({ size, beside, written = size, knitted, progress, tension, found, unfitted, options, first, palette, coloursOn, roundNames, take, onTake, onLeave, onChosen }) => {
  const [chosen, setChosen] = useState(() => (found.some((one) => one.option === first) ? first : found[0]?.option));
  const fitted = found.find((one) => one.option === chosen) ?? found[0];
  const labelOf = (option: string | undefined) => options.find((one) => one.id === option)?.label ?? "Recalculated";
  // What it is set beside - the design as it is, or the knitting carried on in the knitter's own stitches - then each way, as the knitting it would be.
  const knittings = useMemo(
    () => [beside === "designed" ? knitted : atTension(knitted, tension), ...found.map((one) => decodeEdition(one.file))],
    // The knitting in hand is the same knitting however often whoever holds it is drawn again (see useSweater), and a tension is its two numbers: they are settled once, not once a drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [knitted.knitting, tension.stitchesPer10cm, tension.roundsPer10cm, found, beside],
  );
  // How wide a stitch of each is, in centimetres: the design's are the pattern's, and the rest the knitter's. Drawn by it, each is its true size beside the others.
  const ownStitchCm = 10 / tension.stitchesPer10cm;
  const besideStitchCm = beside === "designed" ? 10 / size.stitchesPer10cm : ownStitchCm;
  // Each way is, taken, a project's own knitting, by its edition; the pattern as it was is nobody's.
  const editions = useMemo(() => [undefined, ...found.map((one) => one.file.edition)], [found]);
  const { fraction, shapes } = useShapes(knittings, editions);
  const candidates = useMemo(
    () => [
      { id: "was", label: beside === "designed" ? "As designed" : "If you keep knitting", knitting: knittings[0], palette, settled: shapes?.[0], stitchCm: besideStitchCm },
      // Each in the colourway as it would be on it: a colourway that steps down the garment follows where the years would sit.
      ...found.map((one, at) => ({
        id: one.option ?? "fitted",
        label: labelOf(one.option),
        knitting: knittings[at + 1],
        palette: coloursOn(one.placement).palette,
        settled: shapes?.[at + 1],
        stitchCm: ownStitchCm,
      })),
    ],
    // What a way is called does not change while it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [knittings, found, palette, coloursOn, shapes, besideStitchCm, ownStitchCm],
  );
  // Shown only once settled: until then no way is being shown.
  const shown = shapes ? fitted : undefined;
  useEffect(() => {
    onChosen?.(shown);
    return () => onChosen?.(undefined);
  }, [shown, onChosen]);
  // On a page with a stage, they are compared there, where the one sweater was.
  const stage = useContext(StageSlot);
  /*
   * It comes minutes after it was asked for, to a page that has been read
   * down meanwhile: what it scrolls in is brought back to its top, where the
   * knitter's tension is and what it comes to begins.
   */
  const root = useRef<HTMLDivElement>(null);
  const ready = !!shapes;
  useEffect(() => {
    if (!ready) return;
    for (let box = root.current?.parentElement; box; box = box.parentElement) {
      const scrolls = getComputedStyle(box).overflowY;
      if (scrolls === "auto" || scrolls === "scroll") {
        box.scrollTop = 0;
        return;
      }
    }
  }, [ready]);
  if (!fitted) return null;
  if (!shapes) {
    return (
      <div role="status" className="refit-working">
        <progress value={fitShare + (1 - fitShare) * fraction} max={1} aria-label="How far the settling has got" />
        <p>
          Recalculated. Now settling {knittings.length === 2 ? "both sweaters" : "each sweater"} into {knittings.length === 2 ? "their" : "its"} shape, to show you
          them side by side. This is the slow part, and can take several minutes.
        </p>
      </div>
    );
  }
  const { added } = coloursOn(fitted.placement);
  const compared = (
    <PreviewBoundary>
      <Suspense fallback={<p role="status">Drawing them side by side…</p>}>
        <SweaterComparison candidates={candidates} chosen={fitted.option ?? "fitted"} fill={stage !== undefined} />
      </Suspense>
    </PreviewBoundary>
  );
  const nameOf = (round: number) => roundNames[round - 1] ?? `round ${round}`;
  // Knitted as written at the knitter's tension: what recalculating is instead of. Not said where their tension is the one it is written for.
  const asWritten = sameTension(written, tension) ? undefined : asKnitted(written.finished, written, tension);

  return (
    <div role="status" className="refit-shown" ref={root}>
      {/* On the stage while its panel is the one shown; where there is no stage, here. */}
      {stage === undefined ? compared : stage ? createPortal(compared, stage) : null}
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
      <table className="my-tension-table my-tension-compared">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measurement</span>
            </th>
            <th scope="col">Pattern</th>
            {asWritten && <th scope="col">{beside === "designed" ? "As written" : "Keep knitting"}</th>}
            <th scope="col">Recalculated</th>
          </tr>
        </thead>
        <tbody>
          {measured.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{size.finished[key]}cm</td>
              {asWritten && <td className="quiet">{asWritten[key]}cm</td>}
              <td>
                <strong>{fitted.finished[key]}cm</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {fitted.round === undefined ? (
        <p>
          <strong>From the cast-on.</strong> The whole pattern, recalculated for your tension:
        </p>
      ) : (
        <p>
          <strong>From the end of {nameOf(fitted.round)}.</strong>{" "}
          {progress < (knitted.rounds[fitted.round - 1]?.at(-1) ?? 0) ? "Knit to there as the pattern has it. The rest changes from there:" : "The rest changes from there:"}
        </p>
      )}
      <ul>
        {fitted.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        {added.length > 0 && (
          <li>
            This colourway steps down the sweater, so the years still to come take the yarns for where they now sit. That adds {added.length}{" "}
            {added.length === 1 ? "yarn" : "yarns"} to what the pattern listed: {added.map((shade) => (shade.code ? `${shade.name} (${shade.code})` : shade.name)).join(", ")}.
          </li>
        )}
      </ul>
      <details>
        <summary>{fitted.round === undefined ? "The pattern, written out" : "The rest, written out"}</summary>
        <pre className="refit-written">{fitted.written}</pre>
      </details>
      <p className="my-tension-actions refit-actions">
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
