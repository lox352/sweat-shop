import { useEffect, useState } from "react";
import type { Design, Placement, Shade, SizeAbout, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import { type RoundIndex, roundNames } from "../../reading/progress";
import { whenKnitting } from "../../library/knitting";
import { type Update, updateFor } from "../../library/editions/difference";
import { type Fitted, mayFit } from "../../library/fit";
import type { ProjectFit } from "../../projects/projects";
import type { Palette } from "../../reading/palette";
import Refit from "./Refit";

const rounds = (count: number) => `${count} round${count === 1 ? "" : "s"}`;

/**
 * A note on a project whose design's knitting has moved on since it was
 * started. It still knits what it was started on, and nothing is ever done
 * to what is knitted: what the update is to this knitter depends on where it
 * falls from their needles (see editions/difference), and the note says
 * which, and offers what can be had - nothing to decide, the update from
 * here, the update from a round ahead, or the rest worked out afresh.
 */
const PatternUpdated: React.FC<{
  sweater: Design;
  size: SizeAbout;
  knitted: SweaterStitches;
  index: RoundIndex;
  progress: number;
  /** The knitter's own tension, where they have said, and where their knitting is fitted to it. */
  tension: Tension | undefined;
  fit: ProjectFit | undefined;
  palette: Palette;
  /** The colourway as it would be on a sweater planned otherwise, and the wools that would add: see useColourway. */
  coloursOn: (placement: Placement | undefined) => { palette: Palette; added: Shade[] };
  /** Said by whoever published the update, where it puts right a mistake: see the editions manifest. */
  errata?: string;
  /** Told of an update that changes nothing ahead: nothing more to say of it. */
  onSeen: () => void;
  /** Taking the update as published: every stitch knitted is the same in it. */
  onSwitch: () => void;
  /** Taking the update from a round: the knitter's rounds to it, and the update's from there. */
  onJoin: (knitting: SweaterStitches) => void;
  /** Taking the rest worked out afresh from the updated pattern. */
  onFit: (fitted: Fitted) => void;
}> = ({ sweater, size, knitted, index, progress, tension, fit, palette, coloursOn, errata, onSeen, onSwitch, onJoin, onFit }) => {
  const [update, setUpdate] = useState<Update>();

  useEffect(() => {
    let open = true;
    // The size's knitting now; where it cannot be fetched, the note does without how the two differ.
    void whenKnitting(sweater, size.id).then((now) => {
      if (!open) return;
      const found = updateFor(knitted, now, progress);
      // Knitting fitted to its knitter is not the pattern's to join an update to: only ever worked out again.
      setUpdate(fit && found.kind !== "behind" ? { kind: "apart" } : found);
    }, () => undefined);
    return () => {
      open = false;
    };
    // Where the knitter is when the note is first shown: it does not change under them as they knit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweater, size.id, knitted, fit]);

  const names = roundNames(index);
  const lead = errata ? "This pattern has been corrected since you started it." : "This pattern has been updated since you started it.";

  if (update?.kind === "behind") {
    const [first, last] = [update.changed[0], update.changed[update.changed.length - 1]];
    return (
      <aside className="pattern-updated" aria-label="This pattern has been updated">
        <p>
          <strong>{lead}</strong>{" "}
          {first
            ? `The change is in what you have already knitted, ${first === last ? names[first - 1] : `from ${names[first - 1]} to ${names[last - 1]}`}. `
            : ""}
          Nothing ahead of you changes, and your chart stays as you knitted it.
        </p>
        {errata && <p className="pattern-updated-errata">{errata}</p>}
        <p className="pattern-updated-actions">
          <button type="button" className="btn" onClick={onSeen}>
            Understood
          </button>
        </p>
      </aside>
    );
  }

  return (
    <aside className="pattern-updated" aria-label="This pattern has been updated">
      <p>
        <strong>{lead}</strong> You are still knitting the version you started, and nothing you have knitted is ever changed.
      </p>
      {errata && <p className="pattern-updated-errata">{errata}</p>}
      {update?.kind === "ahead" && (
        <>
          <p>
            Everything you have knitted is the same in the update. {rounds(update.changed.length)} ahead of you {update.changed.length === 1 ? "is" : "are"}{" "}
            different.
          </p>
          <p className="pattern-updated-actions">
            <button type="button" className="btn btn-primary" onClick={onSwitch}>
              Update from here
            </button>
          </p>
        </>
      )}
      {update?.kind === "joined" && (
        <>
          <p>
            The update differs from what you have knitted, and is the same pattern again at <strong>{names[update.round - 1]}</strong>. Your rounds to the
            end of that one stay as they are, and the update is knitted from there: {rounds(update.changed.length)} ahead of you{" "}
            {update.changed.length === 1 ? "is" : "are"} different.
          </p>
          <p className="pattern-updated-actions">
            <button type="button" className="btn btn-primary" onClick={() => onJoin(update.knitting)}>
              Update from the end of {names[update.round - 1]}
            </button>
          </p>
        </>
      )}
      {update?.kind === "apart" &&
        (mayFit(sweater, knitted, progress) ? (
          <Refit
            sweater={sweater}
            size={size}
            knitted={knitted}
            progress={progress}
            tension={tension ?? { stitchesPer10cm: size.stitchesPer10cm, roundsPer10cm: size.roundsPer10cm }}
            fit={undefined}
            palette={palette}
            coloursOn={coloursOn}
            roundNames={names}
            title="Work the rest out from the updated pattern"
            lead={
              fit
                ? "The rest of your pattern was worked out for your tension from the pattern as it was. It can be worked out again from the pattern as it is now."
                : "The update is on other stitch counts from where you are on, so it can't be joined to your knitting as it is. The rest can be worked out again from the updated pattern, for the stitches on your needles."
            }
            onTake={onFit}
            onGoBack={() => undefined}
          />
        ) : (
          <p>The update is on other stitch counts from where you are on, so it can't be joined to your knitting. You knit on as you were.</p>
        ))}
    </aside>
  );
};

export default PatternUpdated;
