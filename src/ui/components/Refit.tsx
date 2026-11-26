import React, { useEffect, useRef } from "react";
import type { Design, Placement, Shade, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import { loadEdition } from "../../library/editions";
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
 *
 * The rest is planned on from the round the knitter is in. Where it is
 * recalculated already and none of that rest is knitted, it is worked out
 * from the pattern that left, not from the rest in hand: recalculations
 * don't build on each other, and the one taken takes the other's place (see
 * projects' fitTaken). So a rest that was planned from a round further on
 * than the knitter is - the end of a band, before a band could be planned on
 * from part way - can be planned again from where they are.
 */
const Refit: React.FC<{
  sweater: Design;
  size: SizeAbout;
  knitted: SweaterStitches;
  progress: number;
  tension: Tension;
  fit: ProjectFit | undefined;
  /** What the fit left, where it is kept to go back to: its edition, the tension it was for, and whether it was knitting of the project's own (see projects' fitTaken). */
  back?: { edition: string; tension: Tension; own: boolean };
  /** Whether the rest might still be worked out again from where the knitting is: see library/fit's mayFit. Taken to be so where it is not said. */
  canFit?: boolean;
  /** The rounds the project's earlier recalculations were planned from, the oldest first: see projects' Made. */
  earlier?: number[];
  palette: Palette;
  /** The colourway as it would be on a sweater planned otherwise, and the wools that would add: see useColourway. */
  coloursOn: (placement: Placement | undefined) => { palette: Palette; added: Shade[] };
  /** What the knitting calls each of its rounds, from 0: see progress.roundNames. */
  roundNames: string[];
  /** What it is called and why it is offered, where that is not the knitter's tension: an update that can't be joined to their knitting (see PatternUpdated). */
  title?: string;
  lead?: string;
  /** `instead`, where it was worked out from what the fit in hand left, and so takes its place. */
  onTake: (fitted: Fitted, instead: boolean) => void;
  onGoBack: () => void;
}> = ({ sweater, size, knitted, progress, tension, fit, back, canFit = true, earlier = [], palette, coloursOn, roundNames, title = "Recalculate the rest", lead, onTake, onGoBack }) => {
  const { state, ask, reset, fail } = useFit();
  // A tension changed is another question: what was worked out for the last is put away.
  const key = `${tension.stitchesPer10cm} ${tension.roundsPer10cm}`;
  useEffect(reset, [key, reset]);

  const fittedNow = fit && sameTension(fit.tension, tension);
  // Every round to the one it was fitted from is as the pattern had it: until the knitting passes it, the pattern as it was can be gone back to.
  const canGoBack = fit !== undefined && back !== undefined && progress <= (fit.round === undefined ? 0 : (knitted.rounds[fit.round - 1]?.at(-1) ?? -1));
  const goBack = back?.own ? "Go back to the pattern as it was" : "Go back to the pattern as written";
  // None of the fit's rest knitted: the rest is worked out from the pattern it left, whose every round to here is the knitting's, and takes its place.
  const instead = useRef(false);
  const work = () => {
    // (A whole sweater planned from the cast-on left nothing its knitting can be carried on from: asked of again, it is what is knitted.)
    instead.current = canGoBack && fit.round !== undefined;
    if (!instead.current) return ask({ design: sweater.id, sizeId: size.id, knitted, progress, tension, ...(earlier.length ? { earlier } : {}) });
    const before = earlier.slice(0, -1);
    loadEdition(sweater.id, size.id, back!.edition).then(
      (left) => ask({ design: sweater.id, sizeId: size.id, knitted: left, progress, tension, ...(before.length ? { earlier: before } : {}) }),
      () => fail("The rest could not be worked out: the pattern it was recalculated from could not be fetched. Check your connection and try again."),
    );
  };
  // The round the knitting is in, from 1; and whether the rest in hand was planned from a later one, with rounds between that could be planned too.
  const here = knitted.rounds.findIndex((ids) => (ids.at(-1) ?? -1) >= progress) + 1;
  const sooner = fittedNow && canFit && !!sweater.fitting?.anyRound && fit.round !== undefined && here > 0 && here < fit.round;

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
        {sooner && (
          <>
            <p>
              You are at <strong>{roundNames[here - 1] ?? `round ${here}`}</strong>, before that. The rest can be recalculated from where you are instead, so the rounds
              between are worked out for your tension too. Nothing changes until you have seen it.
            </p>
            <p className="my-tension-actions refit-actions">
              <Button onClick={work}>Recalculate from where you are</Button>
            </p>
          </>
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
            onTake(fitted, instead.current);
            reset();
          }}
          onLeave={reset}
        />
      )}
    </div>
  );
};

export default Refit;
