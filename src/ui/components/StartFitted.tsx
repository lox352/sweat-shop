import React, { useEffect } from "react";
import type { Design, Placement, Shade, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import type { Fitted } from "../../library/fit";
import type { Palette } from "../../reading/palette";
import { useFit } from "../useFit";
import FitPreview from "./FitPreview";
import Button from "./ui/Button";

/**
 * A pattern worked out for a knitter's tension before it is begun: offered,
 * on a design's page, where the design can plan a whole sweater (see
 * Design.fitting) and the tension given is not the pattern's own.
 *
 * As a project's refit is: asked for, worked out on the device with a bar
 * for how far it has got, and shown beside the pattern as it is before
 * anything is started. The asking is useFit's and the showing FitPreview's.
 */
const StartFitted: React.FC<{
  sweater: Design;
  size: SizeAbout;
  /** The size's knitting as the pattern has it, to compare with. */
  knitted: SweaterStitches;
  tension: Tension;
  palette: Palette;
  coloursOn: (placement: Placement | undefined) => { palette: Palette; added: Shade[] };
  onStart: (fitted: Fitted) => void;
}> = ({ sweater, size, knitted, tension, palette, coloursOn, onStart }) => {
  const { state, ask, reset } = useFit();
  // Another tension, or another size, is another question.
  const key = `${size.id} ${tension.stitchesPer10cm} ${tension.roundsPer10cm}`;
  useEffect(reset, [key, reset]);
  const work = () => ask({ design: sweater.id, sizeId: size.id, tension });

  return (
    <div className="refit">
      <h3>A pattern for your tension</h3>
      {state.at === "rest" && (
        <>
          <p>
            The pattern can be worked out for your tension from the cast-on, so that it comes to the size's measurements in your stitches and not the
            pattern's.
          </p>
          <p className="quiet">It is worked out on this device, and can take up to a minute. Nothing is started until you have seen it.</p>
          <p>
            <Button variant="primary" onClick={work}>
              Work the pattern out
            </Button>
          </p>
        </>
      )}
      {state.at === "working" && (
        <div role="status">
          <p>Working your pattern out. This can take up to a minute.</p>
          <progress value={state.fraction} max={1} aria-label="How far the working out has got" />
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
          knitted={knitted}
          progress={0}
          tension={tension}
          found={state.found}
          unfitted={state.unfitted}
          options={sweater.fitting?.options ?? []}
          palette={palette}
          coloursOn={coloursOn}
          roundNames={[]}
          take="Start knitting this"
          onTake={onStart}
          onLeave={reset}
        />
      )}
    </div>
  );
};

export default StartFitted;
