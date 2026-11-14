import { useEffect, useState } from "react";
import type { SweaterPattern } from "../data/sweaters/types";
import type { Stitch } from "../types/Stitch";
import { type RoundIndex, roundNames } from "../knitting/progress";
import { sweaterStitches } from "../knitting/useSweater";
import { firstDifference } from "../data/sweaters/editions/difference";
import { prepareKnitting } from "../data/sweaters/editions";

/**
 * A note on a project whose design's knitting has moved on since it was
 * started: it still knits what it was started on (see data/sweaters/editions),
 * and its knitter may move to the update when it suits them. Where the two
 * first differ says whether moving would touch anything already knitted.
 */
const PatternUpdated: React.FC<{
  sweater: SweaterPattern;
  sizeId: string;
  stitches: Stitch[];
  index: RoundIndex;
  progress: number;
  onSwitch: () => void;
}> = ({ sweater, sizeId, stitches, index, progress, onSwitch }) => {
  const [differs, setDiffers] = useState<{ id: number; round: string } | "same" | undefined>();
  const [asking, setAsking] = useState(false);

  // Building the knitting as it is now takes a moment: done once the page is up, not before it.
  useEffect(() => {
    let open = true;
    // The size's knitting now: its frozen copy where that can be had, or else worked out here, once the page is up.
    void (prepareKnitting(sweater.id, sizeId) ?? Promise.resolve()).then(() => {
      if (!open) return;
      const id = firstDifference(stitches, sweaterStitches(sweater, sizeId).stitches);
      if (id === undefined) return setDiffers("same");
      let at = id;
      while (at > 0 && !index.roundOf.has(at)) at--;
      const round = index.roundOf.get(at);
      setDiffers({ id, round: round ? roundNames(index)[round - 1] : `stitch ${id}` });
    });
    return () => {
      open = false;
    };
  }, [sweater, sizeId, stitches, index]);

  return (
    <aside className="pattern-updated" aria-label="This pattern has been updated">
      <p>
        <strong>This pattern has been updated since you started it.</strong> You are still knitting the version you
        started, so nothing has moved.
      </p>
      {differs && differs !== "same" && (
        <p>
          The update first differs at <strong>{differs.round}</strong>.{" "}
          {differs.id <= progress
            ? "That is before where you are: switching would chart some of what you have knitted differently, and your place may need putting right with Knit up to here."
            : "That is after where you are, so switching changes nothing you have knitted."}
        </p>
      )}
      {asking ? (
        <p className="pattern-updated-actions">
          Switch to the updated pattern?{" "}
          <button type="button" className="btn btn-primary" onClick={onSwitch}>
            Yes, switch
          </button>{" "}
          <button type="button" className="btn" onClick={() => setAsking(false)}>
            Not now
          </button>
        </p>
      ) : (
        <p className="pattern-updated-actions">
          <button type="button" className="btn" onClick={() => setAsking(true)}>
            Switch to the updated pattern
          </button>
        </p>
      )}
    </aside>
  );
};

export default PatternUpdated;
