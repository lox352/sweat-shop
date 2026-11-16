import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Colourway, Design, SlotId } from "../../pattern/design";
import { viewChart } from "../../reading/counted";
import { ballsOf, colourwayLabel, inkOn, lit, ownBalls, paletteOf, slotNames, type Overrides } from "../../reading/palette";
import type { useSweater } from "../useSweater";
import Chart from "../chart/Chart";
import ViewTabs from "../chart/ViewTabs";
import SweaterModel from "./SweaterModel";
import { Shades, type Chosen } from "./YarnPicker";
import TitleBlock from "./ui/TitleBlock";
import Button from "./ui/Button";
import "./Customise.css";

/**
 * A colourway made the knitter's own: the jumper for the whole of it, the
 * chart for its stitches, and its wools along the foot, on one screen.
 *
 * A stitch tapped on the chart, or a wool in the strip, chooses that wool:
 * it stays lit on the jumper and the chart while the rest go quiet, so where
 * it is knitted is seen at both scales, and the shades to change it to rise
 * from the foot. A ball of wool does every yarn of the design it is put in,
 * so changing it changes them together.
 *
 * A view over a page - the design's, before a project exists, or the
 * project's: what is changed is the page's to keep, and Done goes back to it.
 */
const Customise: React.FC<{
  sweater: Design;
  sizeId: string;
  /** The edition a project knits, where it is not the size's own now. */
  edition?: string;
  built: ReturnType<typeof useSweater>;
  /** The base: the colourway started from, with its trim. */
  colourway: Colourway;
  overrides: Overrides;
  /** Metres of each slot the size knits up: see reading/yardage. */
  metres: Record<string, number>;
  onChange: (slots: SlotId[], chosen: Chosen | undefined) => void;
  /** Every wool back to the base's. */
  onReset: () => void;
  onDone: () => void;
}> = ({ sweater, sizeId, edition, built, colourway, overrides, metres, onChange, onReset, onDone }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    // The screen itself, not its first button, is what was opened.
    element.focus();
  }, []);

  const { stitches, view: counted, views, holdRegions } = built;
  const palette = useMemo(() => paletteOf(colourway, overrides), [colourway, overrides]);
  // Only the wool this size knits: a smaller size leaves the last bands' colours out.
  const balls = useMemo(() => ballsOf(colourway, metres, overrides).filter((ball) => ball.metres > 0), [colourway, metres, overrides]);
  /** The ball being chosen, by the yarns it does: those stay the ones changed, whatever other ball its wool comes to match. */
  const [picking, setPicking] = useState<SlotId[]>();
  const chosen = picking && balls.find((ball) => ball.slots.includes(picking[0]));
  const shown = useMemo(() => (picking ? lit(palette, picking) : palette), [palette, picking]);

  // The chart's views of the finished pattern: from the neck, the body, each sleeve.
  const finished = useMemo(() => views.filter((one) => !one.stageOf), [views]);
  const [viewId, setViewId] = useState(finished[0]?.id);
  const view = finished.find((one) => one.id === viewId) ?? finished[0];
  const chart = view ? viewChart(built, counted, view) : { layout: counted.layout, markers: counted.markers };
  const last = stitches[stitches.length - 1]?.id ?? 0;
  const own = ownBalls(colourway, overrides);

  const pick = (id: number) => {
    const ball = balls.find((one) => one.slots.includes(stitches[id]?.slot));
    if (ball) setPicking(ball.slots);
  };

  return (
    <dialog
      ref={dialog}
      className={chosen ? "customise is-choosing" : "customise"}
      tabIndex={-1}
      aria-label="Customise the colours"
      onCancel={(event) => {
        event.preventDefault();
        onDone();
      }}
    >
      <TitleBlock
        title="Customise"
        eyebrow={colourwayLabel(colourway, overrides)}
        out={
          <Button variant="quiet" onClick={onDone}>
            Done
          </Button>
        }
      />
      <div className="customise-stage">
        <SweaterModel sweaterId={sweater.id} sizeId={sizeId} edition={edition} palette={shown} progress={last} fill />
      </div>
      <div className="customise-chart chart-fills">
        {finished.length > 1 && view && <ViewTabs views={finished} shown={view.id} onShow={setViewId} />}
        <section className="chart-page" data-view={view?.id}>
          <Chart
            key={view?.id}
            stitches={stitches}
            rounds={counted.rounds}
            layout={chart.layout}
            markers={chart.markers}
            palette={shown}
            // A chart draws what is knitted faded, as done with: here nothing is, so every stitch is in its wool; and it opens on the first of them, where the piece begins.
            progress={0}
            follow
            onPick={pick}
            stitchNotes={sweater.stitchNotes}
            pieces={sweater.pieces}
            kinds={counted.kinds}
            roundPieces={counted.pieces}
            holdRegions={holdRegions}
          />
        </section>
      </div>
      {chosen && picking ? (
        <section className="customise-sheet" aria-label={`Wool for ${chosen.yarn.name}`}>
          <div className="customise-sheet-head">
            <span className="shade-chip" style={{ background: chosen.yarn.hex, color: inkOn(chosen.yarn.hex) }} aria-hidden="true" />
            <div className="customise-sheet-name">
              <strong>
                {chosen.yarn.name}
                {chosen.yarn.code ? <span className="quiet"> {chosen.yarn.code}</span> : null}
              </strong>
              <span className="quiet">
                {picking.some((slot) => overrides[slot])
                  ? `About ${Math.round(chosen.metres).toLocaleString()}m · yours`
                  : `${chosen.balls} ball${chosen.balls === 1 ? "" : "s"} · about ${Math.round(chosen.metres).toLocaleString()}m`}{" "}
                · {slotNames(picking)}
              </span>
            </div>
            <Button variant="quiet" onClick={() => setPicking(undefined)}>
              All wools
            </Button>
          </div>
          <Shades current={chosen.yarn} suggest={colourway.wool} onChoose={(choice) => onChange(picking, choice)} />
        </section>
      ) : (
        <section className="customise-wools" aria-label="Your wools">
          <p>
            <strong>Your wools</strong> <span className="quiet">· {balls.length} · tap a stitch or a wool</span>
          </p>
          <div className="customise-strip">
            {balls.map((ball) => (
              <button
                key={ball.slots.join()}
                type="button"
                className="customise-wool"
                style={{ background: ball.yarn.hex }}
                aria-label={`${ball.yarn.name}${ball.yarn.code ? ` (${ball.yarn.code})` : ""}`}
                title={ball.yarn.name}
                onClick={() => setPicking(ball.slots)}
              />
            ))}
          </div>
          {own > 0 && (
            <Button variant="quiet" onClick={onReset}>
              Back to {colourway.name}
            </Button>
          )}
        </section>
      )}
    </dialog>
  );
};

export default Customise;
