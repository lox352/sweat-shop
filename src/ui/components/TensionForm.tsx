import React, { useState } from "react";
import type { Tension } from "../../pattern/design";
import { per10cm } from "../../reading/tension";
import Button from "./ui/Button";

/**
 * A knitter's tension, as they measure it: so many stitches counted over so
 * many centimetres, so many rounds. It only asks: what is made of the
 * tension is whoever shows it's.
 */
const TensionForm: React.FC<{
  tension: Tension | undefined;
  /** What the button says before a tension has been given. */
  first: string;
  /** A tension to show in the empty fields, in grey, as an example of what goes in them: the pattern's own. */
  example?: Tension;
  onChange: (tension: Tension | undefined) => void;
}> = ({ tension, first, example, onChange }) => {
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

  const field = (label: string, value: string, set: (value: string) => void, shown?: number) => (
    <label>
      <span className="visually-hidden">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        placeholder={shown === undefined ? undefined : String(shown)}
        aria-label={label}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );

  return (
    <form
      className="my-tension-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (entered && sensible) onChange(entered);
      }}
    >
      <p>
        {field("Stitches counted", stitches, setStitches, example?.stitchesPer10cm)} stitches over {field("Centimetres the stitches were counted over", stitchesOver, setStitchesOver)} cm
      </p>
      <p>
        {field("Rounds counted", rounds, setRounds, example?.roundsPer10cm)} rounds over {field("Centimetres the rounds were counted over", roundsOver, setRoundsOver)} cm
      </p>
      <p className="my-tension-actions">
        <Button type="submit" variant="primary" disabled={!sensible}>
          {tension ? "Update" : first}
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
  );
};

export default TensionForm;
