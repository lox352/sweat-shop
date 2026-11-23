import React, { useState } from "react";
import type { SizeAbout, Tension } from "../../pattern/design";
import type { Fitted } from "../../library/fit";
import { sameTension } from "../../reading/tension";
import Button from "./ui/Button";
import Sheet from "./ui/Sheet";
import TensionChoice from "./TensionChoice";

/**
 * The tension a size is to be knitted at, changed in a card up from the foot
 * (see Sheet, the one card a trim and a colourway's wools are changed in):
 * what the pattern is written for, the knitter's own to put in, and the one
 * way on - the pattern recalculated for it, where the design can be.
 *
 * Nothing is changed until that is pressed: closing the card leaves the
 * tension as it was. Where a pattern recalculated is the page's already, the
 * card says what recalculating changed, and has the way back to the pattern
 * as written.
 */
const TensionSheet: React.FC<{
  size: SizeAbout;
  /** The knitter's own, where one is given; and the pattern recalculated for it, where it has been. */
  tension: Tension | undefined;
  fitted: Fitted | undefined;
  /** Whether the design can be recalculated: see Design.fitting. */
  fitting: boolean;
  /** What the colourway takes more of on the pattern recalculated, said with what changed. */
  added?: React.ReactNode;
  onTake: (tension: Tension) => void;
  onPatterns: () => void;
  onClose: () => void;
}> = ({ size, tension, fitted, fitting, added, onTake, onPatterns, onClose }) => {
  // What is in the fields, where it is a tension and not the pattern's: see TensionChoice.
  const [entered, setEntered] = useState(tension);
  // Another than the one the page is of already.
  const fresh = entered && !(fitted && sameTension(entered, fitted.tension)) && (fitting || !tension || !sameTension(entered, tension));
  return (
    <Sheet title="Your tension" eyebrow={`Size ${size.label}`} className="tension-sheet" onClose={onClose}>
      <div className="sheet-body">
        <p className="tension-sheet-about">
          The pattern is written for {size.stitchesPer10cm} stitches and {size.roundsPer10cm} rounds to 10cm.{" "}
          {fitting
            ? "If your swatch measures otherwise, put yours in and the pattern is recalculated to come out the same size."
            : "If your swatch measures otherwise, put yours in: your jumper's page will say what size it comes out."}
        </p>
        <TensionChoice pattern={size} tension={tension} onChange={setEntered} />
        <p className="my-tension-actions tension-sheet-actions">
          <Button variant="primary" disabled={!fresh} onClick={() => entered && onTake(entered)}>
            {fitting ? "Recalculate the pattern" : "Use this tension"}
          </Button>
          {tension && (
            <Button variant="quiet" onClick={onPatterns}>
              {fitted ? "Back to the pattern as written" : "Use the pattern's"}
            </Button>
          )}
        </p>
        {fitted && (
          <details className="tension-sheet-changed">
            <summary>What recalculating changed</summary>
            <ul>
              {fitted.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              {added}
            </ul>
            <pre className="refit-written">{fitted.written}</pre>
          </details>
        )}
      </div>
    </Sheet>
  );
};

export default TensionSheet;
