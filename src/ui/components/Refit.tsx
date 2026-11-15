import React, { useEffect, useRef, useState } from "react";
import type { Design, Measurements, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import { type Fitted, askForFit } from "../../library/fit";
import type { ProjectFit } from "../../projects/projects";
import { sameTension } from "../../reading/tension";
import Button from "./ui/Button";

const rows: { key: keyof Measurements; label: string }[] = [
  { key: "chestCm", label: "Chest" },
  { key: "upperArmCm", label: "Upper arm" },
  { key: "yokeDepthCm", label: "Yoke depth" },
  { key: "bodyLengthCm", label: "Body length" },
  { key: "sleeveLengthCm", label: "Sleeve length" },
  { key: "cuffCm", label: "Cuff" },
];

type Step = { at: "rest" } | { at: "working"; fraction: number } | { at: "shown"; fitted: Fitted } | { at: "failed"; why: string };

/**
 * The rest of the sweater worked out again for the knitter's own tension:
 * offered where the design can (see Design.fitting) and the tension is not
 * what the knitting in hand was written for.
 *
 * It is worked out on the device, which nothing else of a pattern is (see
 * library/fit), so it says it may take a while before it starts, shows how
 * far it has got, and shows what it comes to - where it changes from, what it
 * will measure, the rest written out - before anything is taken. What is
 * knitted is never touched.
 */
const Refit: React.FC<{
  sweater: Design;
  size: SizeAbout;
  knitted: SweaterStitches;
  progress: number;
  tension: Tension;
  fit: ProjectFit | undefined;
  /** What the knitting calls each of its rounds, from 0: see progress.roundNames. */
  roundNames: string[];
  onTake: (fitted: Fitted) => void;
  onGoBack: () => void;
}> = ({ sweater, size, knitted, progress, tension, fit, roundNames, onTake, onGoBack }) => {
  const options = sweater.fitting?.options ?? [];
  const [step, setStep] = useState<Step>({ at: "rest" });
  const [option, setOption] = useState<string | undefined>(fit?.option ?? options[0]?.id);
  const asked = useRef<{ cancel: () => void }>();
  useEffect(() => () => asked.current?.cancel(), []);
  // A tension changed is another question: what was worked out for the last is put away.
  const key = `${tension.stitchesPer10cm} ${tension.roundsPer10cm}`;
  useEffect(() => {
    asked.current?.cancel();
    setStep({ at: "rest" });
  }, [key]);

  const ask = (chosen: string | undefined) => {
    asked.current?.cancel();
    setOption(chosen);
    setStep({ at: "working", fraction: 0 });
    const request = askForFit({ design: sweater.id, sizeId: size.id, knitted, progress, tension, option: chosen }, (fraction) =>
      setStep((now) => (now.at === "working" ? { at: "working", fraction } : now)),
    );
    asked.current = request;
    request.fitted.then(
      (fitted) => setStep({ at: "shown", fitted }),
      (error: Error) => setStep({ at: "failed", why: error.message }),
    );
  };

  const fittedNow = fit && sameTension(fit.tension, tension);
  // Every round to the one it was fitted from is as the pattern had it: until the knitting passes it, the pattern as written can be gone back to.
  const canGoBack = fit?.from !== undefined && progress <= (knitted.rounds[fit.round - 1]?.at(-1) ?? -1);
  const nameOf = (round: number) => roundNames[round - 1] ?? `round ${round}`;

  if (fittedNow && step.at === "rest") {
    return (
      <div className="refit">
        <p>
          The rest of your pattern is worked out for this tension, from the end of <strong>{nameOf(fit.round)}</strong>. Every round to there is as the
          pattern had it.
        </p>
        {canGoBack && (
          <p>
            <Button variant="quiet" onClick={onGoBack}>
              Go back to the pattern as written
            </Button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="refit">
      <h3>Fit the rest to your tension</h3>
      {step.at === "rest" && (
        <>
          <p>
            The rest of the pattern can be worked out again from where you are, so that it comes as near the size as it can at your tension. What you
            have knitted stays as it is.
          </p>
          <p className="quiet">It is worked out on this device, and can take up to a minute. Nothing changes until you have seen it.</p>
          <p>
            <Button variant="primary" onClick={() => ask(option)}>
              Work out the rest
            </Button>
          </p>
        </>
      )}
      {step.at === "working" && (
        <div role="status">
          <p>Working out the rest of your sweater. This can take up to a minute.</p>
          <progress value={step.fraction} max={1} aria-label="How far the working out has got" />
        </div>
      )}
      {step.at === "failed" && (
        <div role="alert">
          <p>{step.why}</p>
          <p>
            <Button onClick={() => ask(option)}>Try again</Button>
          </p>
        </div>
      )}
      {step.at === "shown" && (
        <div role="status" className="refit-shown">
          <p>
            <strong>From the end of {nameOf(step.fitted.round)}.</strong>{" "}
            {progress < (knitted.rounds[step.fitted.round - 1]?.at(-1) ?? 0)
              ? "Knit to there as the pattern has it. The rest changes from there:"
              : "The rest changes from there:"}
          </p>
          <ul>
            {step.fitted.notes.map((note) => (
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
                  <td>{step.fitted.finished[key]}cm</td>
                </tr>
              ))}
            </tbody>
          </table>
          {options.length > 1 && (
            <fieldset className="refit-options">
              <legend>How the rest is laid out</legend>
              {options.map((one) => (
                <label key={one.id}>
                  <input type="radio" name="refit-option" checked={option === one.id} onChange={() => ask(one.id)} />
                  <span>
                    <strong>{one.label}.</strong> {one.detail}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <details>
            <summary>The rest, written out</summary>
            <pre className="refit-written">{step.fitted.written}</pre>
          </details>
          <p className="my-tension-actions">
            <Button
              variant="primary"
              onClick={() => {
                onTake(step.fitted);
                setStep({ at: "rest" });
              }}
            >
              Knit the rest this way
            </Button>
            <Button variant="quiet" onClick={() => setStep({ at: "rest" })}>
              Not now
            </Button>
          </p>
        </div>
      )}
    </div>
  );
};

export default Refit;
