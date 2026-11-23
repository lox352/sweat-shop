import React, { useEffect, useMemo, useState } from "react";
import type { Colourway, Design, SlotId } from "../../pattern/design";
import { viewChart } from "../../reading/counted";
import { ballsOf, colourwayLabel, inkOn, lit, ownBalls, paletteOf, slotNames, type Overrides, type Palette } from "../../reading/palette";
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
 * told how to draw (onShow) - while the rest go quiet, so where it is
 * knitted is seen at both scales. The shades to change it to come up in a
 * second card over the whole of the first (see Sheet's stacked): they have
 * all the room under the stage, and the jumper over them shows the wool.
 *
 * A shade tapped there is only tried: the jumper is drawn in it, and nothing is changed until it is taken at the card's foot. Taken,
 * the second card goes down to the chart again, redrawn, for the next wool.
 * A ball of wool does every yarn of the design it is put in, so changing it
 * changes them together.
 *
 * The chart is the one from the neck: it is for finding a wool, not for
 * knitting from, and the yoke is where nearly every wool is.
 *
 * What is changed is the page's to keep - the design's, before a project
 * exists, or the project's - and Done goes back to it.
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
  /** Told the wools to draw the jumper in while a wool is chosen - that wool lit, in the shade being tried where one is - and that there are none once it is not. */
  onShow?: (palette: Palette | undefined) => void;
}> = ({ sweater, built, colourway, overrides, metres, onChange, onReset, onDone, first, onShow }) => {
  const { stitches, view: counted, views, holdRegions } = built;
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
  /** The shade being tried in that ball's place, until it is taken or let go. */
  const [tried, setTried] = useState<Chosen>();
  const palette = useMemo(
    () => paletteOf(colourway, tried && picking ? { ...overrides, ...Object.fromEntries(picking.map((slot) => [slot, tried])) } : overrides),
    [colourway, overrides, tried, picking],
  );
  const shown = useMemo(() => (picking ? lit(palette, picking) : palette), [palette, picking]);
  const choosing = !!chosen;
  useEffect(() => {
    onShow?.(choosing ? shown : undefined);
  }, [choosing, shown, onShow]);
  useEffect(() => () => onShow?.(undefined), [onShow]);
  // Another ball, or none: what was being tried for the last is let go.
  const choose = (slots: SlotId[] | undefined) => {
    setTried(undefined);
    setPicking(slots);
  };

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
    if (ball) choose(ball.slots);
  };
  const take = () => {
    if (picking && tried) onChange(picking, tried);
    choose(undefined);
  };
  const nameOf = (yarn: { name?: string; code?: string }) => `${yarn.name ?? "Your own"}${yarn.code ? ` ${yarn.code}` : ""}`;

  return (
    <>
      <Sheet full under={choosing} title="Change wool" eyebrow={colourwayLabel(colourway, overrides)} label="Customise the colours" className="customise" onClose={onDone}>
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
                  choose(ball.slots);
                  setFinding(ball.slots);
                }}
              />
            ))}
          </div>
          <div className="customise-foot">
            {own > 0 ? (
              <Button variant="quiet" onClick={onReset}>
                Back to {colourway.name}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={onDone}>
              Done
            </Button>
          </div>
        </section>
      </Sheet>
      {chosen && picking && (
        <Sheet
          stacked
          full
          title={nameOf(chosen.yarn)}
          eyebrow={`Replacing · ${
            picking.some((slot) => overrides[slot])
              ? `about ${Math.round(chosen.metres).toLocaleString()}m · yours`
              : `${chosen.balls} ball${chosen.balls === 1 ? "" : "s"} · about ${Math.round(chosen.metres).toLocaleString()}m`
          } · ${slotNames(picking)}`}
          lead={<span className="shade-chip customise-chip" style={{ background: chosen.yarn.hex, color: inkOn(chosen.yarn.hex) }} aria-hidden="true" />}
          label={`Wool for ${chosen.yarn.name}`}
          className="customise-shades"
          onClose={() => choose(undefined)}
        >
          {/* Each ball's shades are its own: they open on the shade it is in, and a search for one ball is not left for the next. */}
          <Shades
            key={picking.join()}
            current={chosen.yarn}
            suggest={colourway.wool}
            own={picking.some((slot) => overrides[slot])}
            tried={tried}
            onChoose={setTried}
            onPatterns={() => {
              onChange(picking, undefined);
              choose(undefined);
            }}
          />
          {/* Nothing is changed until the shade tried is taken here. */}
          <div className="customise-take" role="status">
            {tried ? (
              <>
                <span className="customise-swap" aria-hidden="true">
                  <span style={{ background: chosen.yarn.hex }} />
                  <span style={{ background: tried.hex }} />
                </span>
                <Button variant="primary" onClick={take}>
                  Use {nameOf(tried)}
                </Button>
                <Button variant="quiet" onClick={() => choose(undefined)}>
                  Cancel
                </Button>
              </>
            ) : (
              <span className="quiet">Tap a shade to try it on the jumper.</span>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
};

export default Customise;
