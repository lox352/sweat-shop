import React, { useEffect } from "react";
import type { Design, Placement, Shade, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import type { Fitted } from "../../library/fit";
import type { ProjectFit } from "../../projects/projects";
import type { Palette } from "../../reading/palette";
import { sameTension } from "../../reading/tension";
import { fitShare, useFit } from "../useFit";
import FitPreview from "./FitPreview";
import Button from "./ui/Button";

/**
 * The rest of the sweater worked out again for the knitter's own tension:
 * offered where the design can (see Design.fitting) and the tension is not
 * what the knitting in hand was written for.
 *
 * It is worked out on the device, which nothing else of a pattern is (see
 * library/fit), so it says it may take a while before it starts, shows how
 * far it has got, and shows what it comes to (FitPreview) before anything is
 * taken. What is knitted is never touched. The asking is useFit's and the
 * showing FitPreview's: this is where a project offers the one and takes the
 * other.
 */
const Refit: React.FC<{
  sweater: Design;
  size: SizeAbout;
  knitted: SweaterStitches;
  progress: number;
  tension: Tension;
  fit: ProjectFit | undefined;
  /** What the fit left, where it is kept to go back to: the tension it was for, and whether it was knitting of the project's own (see projects' fitTaken). */
  back?: { tension: Tension; own: boolean };
  palette: Palette;
  /** The colourway as it would be on a sweater planned otherwise, and the wools that would add: see useColourway. */
  coloursOn: (placement: Placement | undefined) => { palette: Palette; added: Shade[] };
  /** What the knitting calls each of its rounds, from 0: see progress.roundNames. */
  roundNames: string[];
  /** What it is called and why it is offered, where that is not the knitter's tension: an update that can't be joined to their knitting (see PatternUpdated). */
  title?: string;
  lead?: string;
  onTake: (fitted: Fitted) => void;
  onGoBack: () => void;
}> = ({ sweater, size, knitted, progress, tension, fit, back, palette, coloursOn, roundNames, title = "Recalculate the rest", lead, onTake, onGoBack }) => {
  const { state, ask, reset } = useFit();
  // A tension changed is another question: what was worked out for the last is put away.
  const key = `${tension.stitchesPer10cm} ${tension.roundsPer10cm}`;
  useEffect(reset, [key, reset]);
  const work = () => ask({ design: sweater.id, sizeId: size.id, knitted, progress, tension });

  const fittedNow = fit && sameTension(fit.tension, tension);
  // Every round to the one it was fitted from is as the pattern had it: until the knitting passes it, the pattern as it was can be gone back to.
  const canGoBack = fit !== undefined && back !== undefined && progress <= (fit.round === undefined ? 0 : (knitted.rounds[fit.round - 1]?.at(-1) ?? -1));
  const goBack = back?.own ? "Go back to the pattern as it was" : "Go back to the pattern as written";

  // The tension the pattern was for before the rest was recalculated, and none of that rest knitted: the pattern it was is the answer, exactly, and
  // nothing is worked out. Planned again from here it need not come to the same.
  if (!fittedNow && canGoBack && sameTension(back.tension, tension) && state.at === "rest") {
    return (
      <div className="refit">
        <h3>{title}</h3>
        <p>
          This is the tension your pattern was {back.own ? "worked out for" : "written for"} before the rest was recalculated, and none of the recalculated rest is knitted yet. You can go back
          to that pattern exactly as it was.
        </p>
        <p className="my-tension-actions refit-actions">
          <Button variant="primary" onClick={onGoBack}>
            {goBack}
          </Button>
        </p>
      </div>
    );
  }

  if (fittedNow && state.at === "rest") {
    return (
      <div className="refit">
        {fit.round === undefined ? (
          <p>Your pattern is recalculated for this tension, from the cast-on.</p>
        ) : (
          <p>
            The rest of your pattern is recalculated for this tension, from the end of <strong>{roundNames[fit.round - 1] ?? `round ${fit.round}`}</strong>.
            Every round to there is as the pattern had it.
          </p>
        )}
        {canGoBack && (
          <p>
            <Button variant="quiet" onClick={onGoBack}>
              {goBack}
            </Button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="refit">
      <h3>{title}</h3>
      {state.at === "rest" && (
        <>
          <p>
            {lead ??
              "The rest of the pattern can be recalculated from where you are, so that it comes as near the size as it can at your tension. What you have knitted stays as it is."}
          </p>
          <p className="quiet">It is done on this device, and the sweater settled into its shape to show you beside the one you would have if you kept knitting, which can take several minutes. Nothing changes until you have seen it.</p>
          <p className="my-tension-actions refit-actions">
            <Button variant="primary" onClick={work}>
              Recalculate the rest
            </Button>
          </p>
        </>
      )}
      {state.at === "working" && (
        <div role="status" className="refit-working">
          {/* The bar first, and where it stays: what is said under it changes as the work goes on (see FitPreview). */}
          <progress value={state.fraction * fitShare} max={1} aria-label="How far the working out has got" />
          <p>Recalculating the rest of your sweater. This can take up to a minute, and settling it to show you several more.</p>
        </div>
      )}
      {state.at === "failed" && (
        <div role="alert">
          <p>{state.why}</p>
          <p>
            <Button onClick={work}>Try again</Button>
          </p>
        </div>
      )}
      {state.at === "shown" && (
        <FitPreview
          size={size}
          written={fit ? { finished: fit.finished, ...fit.tension } : undefined}
          knitted={knitted}
          progress={progress}
          tension={tension}
          found={state.found}
          unfitted={state.unfitted}
          options={sweater.fitting?.options ?? []}
          first={fit?.option}
          palette={palette}
          coloursOn={coloursOn}
          roundNames={roundNames}
          take="Knit the rest this way"
          onTake={(fitted) => {
            onTake(fitted);
            reset();
          }}
          onLeave={reset}
        />
      )}
    </div>
  );
};

export default Refit;
