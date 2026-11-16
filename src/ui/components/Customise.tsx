import React, { useEffect, useMemo, useState } from "react";
import type { Colourway, Design, SlotId } from "../../pattern/design";
import { viewChart } from "../../reading/counted";
import { ballsOf, colourwayLabel, inkOn, lit, ownBalls, paletteOf, slotNames, type Overrides } from "../../reading/palette";
import type { useSweater } from "../useSweater";
import Chart from "../chart/Chart";
import Shades, { type Chosen } from "./Shades";
import Sheet from "./ui/Sheet";
import Button from "./ui/Button";
import "./Customise.css";

/**
 * A colourway made the knitter's own, in a card up from the foot of the
 * page it was opened from: the chart for its stitches and its wools under
 * it, with the jumper still on its stage above.
 *
 * A stitch tapped on the chart, or a wool in the strip, chooses that wool:
 * it stays lit on the chart - and on the jumper, which whoever shows this is
 * told to light (onLight) - while the rest go quiet, so where it is knitted
 * is seen at both scales, and the shades to change it to take the chart's
 * place but for a strip of it. A ball of wool does every yarn of the design
 * it is put in, so changing it changes them together.
 *
 * The chart is the one from the neck: it is for finding a wool, not for
 * knitting from, and the yoke is where nearly every wool is.
 *
 * What is changed is the page's to keep - the design's, before a project
 * exists, or the project's - and the cross goes back to it.
 */
const Customise: React.FC<{
  sweater: Design;
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
  /** The ball it opens on, by the yarns it does, where one was chosen from a list of them. */
  first?: SlotId[];
  /** Told the yarns to light on the jumper, while a wool is chosen, and that there are none once it is not. */
  onLight?: (slots: SlotId[] | undefined) => void;
}> = ({ sweater, built, colourway, overrides, metres, onChange, onReset, onDone, first, onLight }) => {
  const { stitches, view: counted, views, holdRegions } = built;
  const palette = useMemo(() => paletteOf(colourway, overrides), [colourway, overrides]);
  // Only the wool this size knits: a smaller size leaves the last bands' colours out.
  const balls = useMemo(() => ballsOf(colourway, metres, overrides).filter((ball) => ball.metres > 0), [colourway, metres, overrides]);
  /** The ball being chosen, by the yarns it does: those stay the ones changed, whatever other ball its wool comes to match. */
  const [picking, setPicking] = useState(first);
  /*
   * A wool chosen by name - from the strip, or a row of the wool list - is
   * shown on the chart where it is first knitted, since the chart opens on
   * the cast-on and most wools are nowhere near it. One chosen by a stitch
   * tapped is under the finger already, and the chart stays where it is.
   */
  const [finding, setFinding] = useState(first);
  const chosen = picking && balls.find((ball) => ball.slots.includes(picking[0]));
  const shown = useMemo(() => (picking ? lit(palette, picking) : palette), [palette, picking]);
  useEffect(() => {
    onLight?.(chosen ? picking : undefined);
    // By what is lit, not by the array that says so.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen ? picking?.join() : undefined, onLight]);
  useEffect(() => () => onLight?.(undefined), [onLight]);

  // The chart from the neck: the first of the finished pattern's views.
  const view = useMemo(() => views.find((one) => !one.stageOf), [views]);
  const chart = view ? viewChart(built, counted, view) : { layout: counted.layout, markers: counted.markers };
  const cells = chart.layout?.cells;
  const found = useMemo(() => {
    if (!finding || !cells) return undefined;
    const slots = new Set<string>(finding);
    return stitches.find((stitch) => slots.has(stitch.slot) && cells.has(stitch.id))?.id;
  }, [finding, cells, stitches]);
  const own = ownBalls(colourway, overrides);

  const pick = (id: number) => {
    const ball = balls.find((one) => one.slots.includes(stitches[id]?.slot));
    if (ball) setPicking(ball.slots);
  };

  return (
    <Sheet
      full
      // With a wool chosen the card is that wool's: its name at the top, and the way back to them all.
      title={chosen ? `${chosen.yarn.name}${chosen.yarn.code ? ` ${chosen.yarn.code}` : ""}` : "Customise"}
      eyebrow={
        chosen && picking
          ? `${
              picking.some((slot) => overrides[slot])
                ? `About ${Math.round(chosen.metres).toLocaleString()}m · yours`
                : `${chosen.balls} ball${chosen.balls === 1 ? "" : "s"} · about ${Math.round(chosen.metres).toLocaleString()}m`
            } · ${slotNames(picking)}`
          : colourwayLabel(colourway, overrides)
      }
      lead={chosen && <span className="shade-chip customise-chip" style={{ background: chosen.yarn.hex, color: inkOn(chosen.yarn.hex) }} aria-hidden="true" />}
      aside={
        chosen && (
          <Button variant="quiet" onClick={() => setPicking(undefined)}>
            All wools
          </Button>
        )
      }
      label="Customise the colours"
      className={chosen ? "customise is-choosing" : "customise"}
      onClose={onDone}
    >
      <div className="customise-chart chart-fills">
        <section className="chart-page" data-view={view?.id}>
          <Chart
            stitches={stitches}
            rounds={counted.rounds}
            layout={chart.layout}
            markers={chart.markers}
            palette={shown}
            // A chart draws what is knitted faded, as done with: here nothing is, so every stitch is in its wool; and it opens on the first of them, where the piece begins.
            progress={0}
            follow
            showAt={found}
            // Up the window a way, so the rounds either side of it are seen too.
            followAt={0.4}
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
          {/* Each ball's shades are its own: the list opens on the shade it is in, and a search for one ball is not left for the next. */}
          <Shades
            key={picking.join()}
            current={chosen.yarn}
            suggest={colourway.wool}
            own={picking.some((slot) => overrides[slot])}
            onChoose={(choice) => onChange(picking, choice)}
          />
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
                onClick={() => {
                  setPicking(ball.slots);
                  setFinding(ball.slots);
                }}
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
    </Sheet>
  );
};

export default Customise;
