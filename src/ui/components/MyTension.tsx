import React, { useEffect, useRef } from "react";
import type { Measurements, SizeAbout, Tension } from "../../pattern/design";
import { asKnitted, sameTension } from "../../reading/tension";
import TensionForm from "./TensionForm";
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
  /** What the knitting in hand was written for, where that is not the size's own: the rest fitted to its knitter (see Refit). */
  fitted?: { finished: Measurements } & Tension;
  tension: Tension | undefined;
  onChange: (tension: Tension | undefined) => void;
  /** Anything more to say of the tension, below what it comes out at. */
  children?: React.ReactNode;
}> = ({ size, fitted, tension, onChange, children }) => {
  const written = fitted ?? size;
  const knitted = tension && asKnitted(written.finished, written, tension);
  // A sweater fitted comes as near the size as what was knitted lets it: the table says how near.
  const table = tension && (fitted || !sameTension(written, tension));

  /*
   * A tension given is answered below the form, which on a phone is below
   * the foot of the panel: the answer is brought up to where it is seen. Not
   * as the page opens with a tension already given, only when one is.
   */
  const answer = useRef<HTMLDivElement>(null);
  const given = useRef(tension);
  useEffect(() => {
    const was = given.current;
    given.current = tension;
    if (!tension || (was && was.stitchesPer10cm === tension.stitchesPer10cm && was.roundsPer10cm === tension.roundsPer10cm)) return;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    answer.current?.scrollIntoView?.({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, [tension]);

  return (
    <section className="section my-tension" aria-labelledby="my-tension-heading">
      <h2 id="my-tension-heading">Your tension</h2>
      <p className="quiet">
        {fitted ? "The rest of your pattern is worked out for" : "The pattern is written for"} {written.stitchesPer10cm} stitches and{" "}
        {written.roundsPer10cm} rounds to 10cm. Lay your knitting flat and
        count what you have over a measured length, the longer the better.
      </p>
      <TensionForm tension={tension} first="Compare with the pattern" onChange={onChange} />
      {tension && knitted && (
        <div role="status" ref={answer} className="my-tension-answer">
          <p>
            <strong>
              {tension.stitchesPer10cm} stitches and {tension.roundsPer10cm} rounds to 10cm.
            </strong>{" "}
            {!sameTension(written, tension)
              ? "Knitted as written at that tension, this sweater comes out:"
              : fitted
                ? "That is the tension the rest is worked out for. It comes out:"
                : "That is the pattern's tension: knitted as written, it comes out as designed."}
          </p>
          {table && (
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
      {children}
    </section>
  );
};

export default MyTension;
