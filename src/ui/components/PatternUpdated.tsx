import { useEffect, useState } from "react";
import type { Design } from "../../pattern/design";
import type { Stitch } from "../../pattern/Stitch";
import { type RoundIndex, roundNames } from "../../reading/progress";
import { whenKnitting } from "../../library/knitting";
import { carryOver, firstDifference } from "../../library/editions/difference";

/**
 * A note on a project whose design's knitting has moved on since it was
 * started: it still knits what it was started on (see library/editions),
 * and its knitter may move to the update when it suits them. Where the two
 * first differ says whether moving would touch anything already knitted.
 */
const PatternUpdated: React.FC<{
  sweater: Design;
  sizeId: string;
  stitches: Stitch[];
  index: RoundIndex;
  progress: number;
  /** Moving on: with where each place is in the update, where it has one. See editions' carryOver. */
  onSwitch: (moved: (progress: number) => number | undefined) => void;
  /** Said by whoever published the update, where it puts right a mistake: see the editions manifest. */
  errata?: string;
}> = ({ sweater, sizeId, stitches, index, progress, onSwitch, errata }) => {
  const [differs, setDiffers] = useState<{ id: number; round: string } | "same" | undefined>();
  const [moved, setMoved] = useState<(progress: number) => number | undefined>(() => (at: number) => at);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let open = true;
    // The size's knitting now; where it cannot be fetched, the note does without where the two differ.
    void whenKnitting(sweater, sizeId).then((now) => {
      if (!open) return;
      const id = firstDifference(stitches, now.stitches);
      setMoved(() => carryOver(stitches, now.stitches));
      if (id === undefined) return setDiffers("same");
      let at = id;
      while (at > 0 && !index.roundOf.has(at)) at--;
      const round = index.roundOf.get(at);
      setDiffers({ id, round: round ? roundNames(index)[round - 1] : `stitch ${id}` });
    }, () => undefined);
    return () => {
      open = false;
    };
  }, [sweater, sizeId, stitches, index]);

  return (
    <aside className="pattern-updated" aria-label="This pattern has been updated">
      <p>
        <strong>{errata ? "This pattern has been corrected since you started it." : "This pattern has been updated since you started it."}</strong>{" "}
        You are still knitting the version you started, so nothing has moved.
      </p>
      {errata && <p className="pattern-updated-errata">{errata}</p>}
      {differs && differs !== "same" && (
        <p>
          The update first differs at <strong>{differs.round}</strong>.{" "}
          {differs.id > progress
            ? "That is after where you are, so switching changes nothing you have knitted."
            : moved(progress) !== undefined
              ? "That is before where you are, but from here on the two are the same knitting: switching keeps your place, and charts some of what you have knitted differently."
              : "That is before where you are, and where you are is part of what changed: switching charts some of what you have knitted differently, and your place will need putting right with Knit up to here."}
        </p>
      )}
      {asking ? (
        <p className="pattern-updated-actions">
          Switch to the updated pattern?{" "}
          <button type="button" className="btn btn-primary" onClick={() => onSwitch(moved)}>
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
