import React, { useContext, useEffect, useState } from "react";
import type { Measurements, SizeAbout, Tension } from "../../pattern/design";
import { measured } from "./measured";
import { asKnitted, sameTension } from "../../reading/tension";
import TensionForm from "./TensionForm";
import Button from "./ui/Button";
import { StageSlot } from "./ui/stage-slot";
import "./MyTension.css";

const signed = (cm: number) => `${cm > 0 ? "+" : cm < 0 ? "−" : ""}${Math.abs(cm)}cm`;

const said = (tension: Tension) => `${tension.stitchesPer10cm} stitches and ${tension.roundsPer10cm} rounds to 10cm`;

/**
 * A pattern's tension, and a knitter's own.
 *
 * On a jumper's own page: before one is started its tension is chosen with
 * its size (see TensionChoice, and Sweater).
 *
 * A pattern only comes out at its measurements at the tension it was written
 * for, so that is said first, as a pattern says it: a knitter whose knitting
 * matches has nothing to do here. One whose knitting doesn't gives theirs,
 * and is shown what the pattern then comes out at knitted as written (see
 * reading/tension) - which is what there is to decide by - and, where the
 * design can, offered the rest recalculated for it (the children: see Refit).
 *
 * Once a tension is given it is a line, with the way to change it, and not a
 * form: what follows from it is what the page is then about.
 */
const MyTension: React.FC<{
  size: SizeAbout;
  /** What the knitting in hand was written for, where that is not the size's own: the rest fitted to its knitter (see Refit). */
  fitted?: { finished: Measurements } & Tension;
  tension: Tension | undefined;
  onChange: (tension: Tension | undefined) => void;
  /** Whether the rest can be recalculated for a tension, as things are: said before one is given. */
  recalculates?: boolean;
  /** Anything more to say of the tension, below what it comes out at. */
  children?: React.ReactNode;
}> = ({ size, fitted, tension, onChange, recalculates = false, children }) => {
  const written = fitted ?? size;
  const knitted = tension && asKnitted(written.finished, written, tension);
  const same = !!tension && sameTension(written, tension);
  // A sweater fitted comes as near the size as what was knitted lets it: the table says how near.
  const table = tension && (fitted || !same);

  const stage = useContext(StageSlot);
  // Asked for until there is one; and again when the one given is to be changed.
  const [editing, setEditing] = useState(!tension);
  useEffect(() => {
    if (!tension) setEditing(true);
  }, [tension]);

  const lead = `If your knitting measures the same, there is nothing to do here. If it doesn't, lay it flat, count what you have over a measured length - the longer the better - and give it here.${
    recalculates ? " The rest of the pattern can be recalculated for it, while the whole yoke is still on the needles." : ""
  }`;

  return (
    <section className="section my-tension" aria-labelledby="my-tension-heading">
      <h2 id="my-tension-heading">Your tension</h2>
      <p className="my-tension-written">
        {fitted ? "The rest of your pattern is written for" : "This pattern is written for"} <strong>{said(written)}</strong>
        {fitted ? "" : `, on ${size.needlesMm}mm needles`}.
      </p>
      {editing || !tension ? (
        <>
          <p className="quiet">{lead}</p>
          <TensionForm
            tension={tension}
            first="Compare with the pattern"
            example={written}
            onChange={(next) => {
              onChange(next);
              if (next) setEditing(false);
            }}
            onCancel={tension ? () => setEditing(false) : undefined}
          />
        </>
      ) : (
        <div role="status" className="my-tension-answer">
          <p className="my-tension-yours">
            <span>
              Yours is <strong>{said(tension)}</strong>.
            </span>
            <Button variant="quiet" onClick={() => setEditing(true)}>
              Change
            </Button>
          </p>
          {same && !fitted && <p>That is the pattern's tension: knitted as written, it comes out as designed.</p>}
          {table && knitted && (
            // Put away while a pattern recalculated is on show: its own table has these figures, beside what it comes to (see FitPreview).
            <div className="my-tension-as-written">
              <p>
                {same ? "That is the tension the rest is recalculated for. It comes out:" : "If you keep knitting the pattern as written, your sweater comes out:"}
              </p>
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
                  {measured.map(({ key, label }) => (
                    <tr key={key}>
                      <th scope="row">{label}</th>
                      <td>{size.finished[key]}cm</td>
                      <td>{knitted[key]}cm</td>
                      <td className="quiet">{signed(Math.round((knitted[key] - size.finished[key]) * 2) / 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Kept while the tension is being changed, and only put away: what was recalculated took minutes, and Cancel comes back to it. */}
      <div className="my-tension-more" hidden={editing && !!tension}>
        {/* And nothing of it over the stage meanwhile: the one jumper is back while the tension it was for is in question. */}
        <StageSlot.Provider value={editing && tension ? null : stage}>{children}</StageSlot.Provider>
      </div>
    </section>
  );
};

export default MyTension;
