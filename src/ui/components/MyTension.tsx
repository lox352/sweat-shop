import React, { useState } from "react";
import type { Measurements, SizeAbout, Tension } from "../../pattern/design";
import { asKnitted, per10cm, sameTension } from "../../reading/tension";
import Button from "./ui/Button";
import "./MyTension.css";

const rows: { key: keyof Measurements; label: string }[] = [
  { key: "chestCm", label: "Chest" },
  { key: "upperArmCm", label: "Upper arm" },
  { key: "neckCm", label: "Neck" },
  { key: "cuffCm", label: "Cuff" },
  { key: "yokeDepthCm", label: "Yoke depth" },
  { key: "bodyLengthCm", label: "Body length" },
  { key: "sleeveLengthCm", label: "Sleeve length" },
];

const signed = (cm: number) => `${cm > 0 ? "+" : cm < 0 ? "−" : ""}${Math.abs(cm)}cm`;

/**
 * A knitter's own tension, and what the pattern knits up to at it.
 *
 * A pattern only comes out at its measurements at the tension it was written
 * for. Measured in the knitting itself - so many stitches over so many
 * centimetres, so many rounds - a different tension says, before the sweater
 * is finished, how far off it will be: see reading/tension.
 */
const MyTension: React.FC<{
  size: SizeAbout;
  tension: Tension | undefined;
  onChange: (tension: Tension | undefined) => void;
}> = ({ size, tension, onChange }) => {
  const [stitches, setStitches] = useState(tension ? String(tension.stitchesPer10cm) : "");
  const [stitchesOver, setStitchesOver] = useState("10");
  const [rounds, setRounds] = useState(tension ? String(tension.roundsPer10cm) : "");
  const [roundsOver, setRoundsOver] = useState("10");
  const numbers = [stitches, stitchesOver, rounds, roundsOver].map(Number);
  const valid = numbers.every((n) => Number.isFinite(n) && n > 0);
  const entered: Tension | undefined = valid
    ? { stitchesPer10cm: per10cm(numbers[0], numbers[1]), roundsPer10cm: per10cm(numbers[2], numbers[3]) }
    : undefined;
  const sensible = !!entered && [entered.stitchesPer10cm, entered.roundsPer10cm].every((n) => n >= 2 && n <= 200);
  const knitted = tension && asKnitted(size.finished, size, tension);

  const field = (label: string, value: string, set: (value: string) => void) => (
    <label>
      <span className="visually-hidden">{label}</span>
      <input type="number" inputMode="decimal" min="0" step="any" value={value} aria-label={label} onChange={(event) => set(event.target.value)} />
    </label>
  );

  return (
    <section className="section my-tension" aria-labelledby="my-tension-heading">
      <h2 id="my-tension-heading">Your tension</h2>
      <p className="quiet">
        The pattern is written for {size.stitchesPer10cm} stitches and {size.roundsPer10cm} rounds to 10cm. Lay your knitting flat and
        count what you have over a measured length, the longer the better.
      </p>
      <form
        className="my-tension-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (entered && sensible) onChange(entered);
        }}
      >
        <p>
          {field("Stitches counted", stitches, setStitches)} stitches over {field("Centimetres the stitches were counted over", stitchesOver, setStitchesOver)} cm
        </p>
        <p>
          {field("Rounds counted", rounds, setRounds)} rounds over {field("Centimetres the rounds were counted over", roundsOver, setRoundsOver)} cm
        </p>
        <p className="my-tension-actions">
          <Button type="submit" variant="primary" disabled={!sensible}>
            {tension ? "Update" : "Compare with the pattern"}
          </Button>
          {tension && (
            <Button
              variant="quiet"
              onClick={() => {
                onChange(undefined);
                setStitches("");
                setRounds("");
              }}
            >
              Clear
            </Button>
          )}
        </p>
      </form>
      {tension && knitted && (
        <div role="status">
          <p>
            <strong>
              {tension.stitchesPer10cm} stitches and {tension.roundsPer10cm} rounds to 10cm.
            </strong>{" "}
            {sameTension(size, tension)
              ? "That is the pattern's tension: knitted as written, it comes out as designed."
              : "Knitted as written at that tension, this sweater comes out:"}
          </p>
          {!sameTension(size, tension) && (
            <table className="my-tension-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Measurement</span>
                  </th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Yours</th>
                  <th scope="col">
                    <span className="visually-hidden">Difference</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, label }) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{size.finished[key]}cm</td>
                    <td>{knitted[key]}cm</td>
                    <td className="quiet">{signed(Math.round((knitted[key] - size.finished[key]) * 2) / 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};

export default MyTension;
