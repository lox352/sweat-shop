import React, { useState } from "react";
import type { Tension } from "../../pattern/design";
import { per10cm, sameTension } from "../../reading/tension";
import "./MyTension.css";

/**
 * The tension a pattern is to be knitted at, chosen with its size: the
 * pattern's own, filled in, as a pattern says it - so many stitches and so
 * many rounds to 10cm - for a knitter to change to what their swatch
 * measures.
 *
 * It only asks, and says at once what is in its fields: the knitter's
 * tension where that is not the pattern's, and none where it is, or where
 * what is typed is not yet a tension. What is made of it is whoever shows
 * it's, and so is putting the pattern's back: shown afresh, it is filled in
 * again.
 */
const TensionChoice: React.FC<{
  /** What the pattern is written for. */
  pattern: Tension;
  /** The knitter's own, where they have given one that is not the pattern's. */
  tension: Tension | undefined;
  onChange: (tension: Tension | undefined) => void;
}> = ({ pattern, tension, onChange }) => {
  const [fields, setFields] = useState(() => ({
    stitches: String((tension ?? pattern).stitchesPer10cm),
    rounds: String((tension ?? pattern).roundsPer10cm),
  }));

  const set = (next: typeof fields) => {
    setFields(next);
    const entered = { stitchesPer10cm: per10cm(Number(next.stitches), 10), roundsPer10cm: per10cm(Number(next.rounds), 10) };
    // A tension anyone would knit this at: within half and twice the pattern's. Less is a number half typed - the 2 of 28 - and not yet a tension.
    const near = (own: number, written: number) => Number.isFinite(own) && own >= written / 2 && own <= written * 2;
    const sensible = near(entered.stitchesPer10cm, pattern.stitchesPer10cm) && near(entered.roundsPer10cm, pattern.roundsPer10cm);
    onChange(sensible && !sameTension(pattern, entered) ? entered : undefined);
  };

  const field = (label: string, key: keyof typeof fields) => (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      value={fields[key]}
      aria-label={label}
      onChange={(event) => set({ ...fields, [key]: event.target.value })}
    />
  );

  return (
    <form className="my-tension-form tension-choice" onSubmit={(event) => event.preventDefault()}>
      <p>
        {field("Stitches to 10cm", "stitches")} <span>stitches and</span> {field("Rounds to 10cm", "rounds")} <span>rounds to 10cm</span>
      </p>
    </form>
  );
};

export default TensionChoice;
