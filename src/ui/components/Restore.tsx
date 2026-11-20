import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Linked } from "../../projects/link";
import { keepKnitting, overviewPath, writeProject } from "../../projects/projects";
import { NotRemade, asWritten, projectOf, remake } from "../../projects/remake";
import { colourwayLabel, trimmed } from "../../reading/palette";
import PageLayout from "./ui/PageLayout";
import Button from "./ui/Button";

type State = { at: "rest" } | { at: "working"; fraction: number } | { at: "failed"; why: string; changed: boolean };

/**
 * A jumper's address opened where the jumper is not kept: someone else's,
 * sent to be knitted, or the knitter's own in a browser that has cleared
 * what it kept. The address says everything that made it (see
 * projects/link), so it is offered here to be made again - carried on from
 * where the link last had it, or begun at the cast-on as one like it.
 *
 * Its pattern is fetched, or where it was recalculated for its knitter, made
 * again as it was and checked (see projects/remake): that is waited for
 * with a bar, as the recalculating was. Where it can't be had as it was,
 * that is said, and the pattern as written offered in its place with the
 * knitter's tension kept to recalculate it by.
 */
const Restore: React.FC<{ linked: Linked }> = ({ linked }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ at: "rest" });
  const asked = useRef<{ cancel: () => void }>();
  useEffect(() => () => asked.current?.cancel(), []);

  const { sweater } = linked;
  const size = sweater.sizes.find((one) => one.id === linked.sizeId) ?? sweater.sizes[0];
  const colourway = trimmed(sweater.colourways.find((one) => one.id === linked.colourwayId) ?? sweater.colourways[0], linked.trim);
  const begun = linked.progress > 0;
  // The tension its pattern was last recalculated for, where it was.
  const fitted = linked.made?.steps.flatMap((step) => ("fit" in step ? [step.fit] : [])).at(-1);

  const make = (carriedOn: boolean) => {
    asked.current?.cancel();
    setState({ at: "working", fraction: 0 });
    const request = remake(linked, (fraction) => setState((now) => (now.at === "working" ? { at: "working", fraction } : now)));
    asked.current = request;
    request.done.then(
      (remade) => {
        if (remade.file && !keepKnitting(remade.file)) return setState({ at: "failed", why: "There is no room on this device to keep its pattern.", changed: false });
        const project = writeProject(projectOf(linked, remade, carriedOn));
        // The jumper itself is at the address this is: the page finds it there (see Project). One like it has an address of its own.
        navigate(overviewPath(project.id), { replace: true });
      },
      (error: unknown) => setState({ at: "failed", why: error instanceof Error ? error.message : "Its pattern could not be made again.", changed: error instanceof NotRemade && error.changed }),
    );
  };

  const startAsWritten = () => {
    const project = writeProject(asWritten(linked));
    navigate(overviewPath(project.id), { replace: true });
  };

  return (
    <PageLayout title={linked.name ?? sweater.name} eyebrow="A jumper, by its link">
      <p>
        <strong>This jumper is not kept on this device.</strong> Its link says what it is, and it can be made again here: {sweater.name}, size {size.label}, in{" "}
        {colourwayLabel(colourway, linked.shades)}
        {fitted ? `, its pattern recalculated for ${fitted.stitchesPer10cm} stitches and ${fitted.roundsPer10cm} rounds to 10cm` : ""}.
      </p>
      {state.at === "rest" && (
        <>
          {begun && (
            <p className="quiet">
              If it is yours, from a browser that has since cleared what it kept, carry on: it comes back as the link last had it, though not the time you had
              spent on it. If it is someone else's, start one like it of your own.
            </p>
          )}
          <p className="restore-actions">
            {begun && (
              <Button variant="primary" onClick={() => make(true)}>
                Carry on where it was
              </Button>
            )}
            {/* Not begun, it is the same jumper whoever opens it: it keeps the address it came by, which then opens it and makes no other. */}
            <Button variant={begun ? "secondary" : "primary"} onClick={() => make(!begun)}>
              {begun ? "Start one like it" : "Start knitting it"}
            </Button>
          </p>
        </>
      )}
      {state.at === "working" && (
        <div role="status" className="restore-working">
          <progress value={linked.made ? state.fraction : undefined} max={1} aria-label="How far the making of its pattern has got" />
          <p className="quiet">{linked.made ? "Making its pattern again, as it was recalculated. This can take a minute or two." : "Fetching its pattern…"}</p>
        </div>
      )}
      {state.at === "failed" && (
        <div role="alert">
          <p>{state.why}</p>
          {state.changed ? (
            <>
              <p className="quiet">
                A backup file saved from the device it was on has the pattern itself, and restores it exactly. Or it can be started here on the pattern as
                written, in the same wool{linked.tension ? ", with its tension kept to recalculate it by" : ""}.
              </p>
              <p className="restore-actions">
                <Button onClick={startAsWritten}>Start on the pattern as written</Button>
              </p>
            </>
          ) : (
            <p className="restore-actions">
              <Button onClick={() => setState({ at: "rest" })}>Try again</Button>
            </p>
          )}
        </div>
      )}
      <p>
        <Link to="/">Back to the designs</Link>
      </p>
    </PageLayout>
  );
};

export default Restore;
