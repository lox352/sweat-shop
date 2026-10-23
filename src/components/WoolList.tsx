import React, { useState } from "react";
import { Colourway, SlotId } from "../data/sweaters/types";
import { ballsOf, inkOn, shownSlots, slotNames, type Overrides, type Palette } from "../knitting/palette";
import YarnPicker, { type Chosen } from "./YarnPicker";
import BodyStrip from "./BodyStrip";
import { type Body } from "./ColourPreview";
import "./WoolList.css";

/**
 * The wool a sweater is being knitted in: what to buy, and what to change.
 *
 * One list rather than two. There used to be a shopping list and, behind a
 * "your own colours" tile, a second list of the same wool with a way to
 * change it - the same colours written out twice, and a tile whose only job
 * was to reveal the second one. A row here does both: it says what the ball
 * is and how many to buy, and it opens the picker.
 *
 * A row is a ball and not a yarn of the pattern, which matters where a
 * colourway puts one ball in several - see ballsOf. So changing the row that
 * says "A + C + G" changes all three, which is what somebody swapping a ball
 * of Graeff for one of their own means.
 */
interface WoolListProps {
  colourway: Colourway;
  /** Metres of each slot the size knits up: the pattern's own, or estimated; see knitting/yardage. */
  metres: Record<string, number>;
  /** Whether the metres are the pattern's own rather than estimated. */
  stated?: boolean;
  overrides: Overrides;
  onChange: (slots: SlotId[], chosen: Chosen | undefined) => void;
  /**
   * The yoke's bands in the wool being chosen: shown beside each ball with
   * only its yarns lit, and in the picker while a ball is being chosen.
   */
  body: Body;
  palette: Palette;
}

/** "Yarn A", or "Yarns A, C and G": a slot's shades round by round (see shownSlots) as the slot itself. */
const nameFor = (all: SlotId[]): string => {
  const slots = shownSlots(all);
  return slots.length === 1 ? `Yarn ${slots[0]}` : `Yarns ${slots.slice(0, -1).join(", ")} and ${slots[slots.length - 1]}`;
};

/**
 * "A + C + G" on the ball's chip - or, where a ball does a great many yarns,
 * as one of the Wool Week strip samplers' does every hat's darkest, the
 * first and how many more, the whole list in its title.
 */
const chipFor = (slots: SlotId[]): string => slotNames(slots);

const WoolList: React.FC<WoolListProps> = ({
  colourway,
  metres,
  stated,
  overrides,
  onChange,
  body,
  palette,
}) => {
  /** Which ball is being chosen, by the yarns it does. */
  const [picking, setPicking] = useState<SlotId[] | undefined>();
  // Only the wool this size knits: a smaller size leaves the last bands' colours out.
  const balls = ballsOf(colourway, metres, overrides).filter((ball) => ball.metres > 0);
  const chosen = picking && balls.find((ball) => ball.slots[0] === picking[0]);
  const yours = Object.keys(overrides).length > 0;

  return (
    <>
      <ul className="wool-list">
        {balls.map((ball) => (
          <li key={ball.slots.join()}>
            <button
              type="button"
              className="wool-row"
              onClick={() => setPicking(ball.slots)}
            >
              <span
                className="shade-chip"
                style={{ background: ball.yarn.hex, color: inkOn(ball.yarn.hex) }}
                title={shownSlots(ball.slots).length > 3 ? shownSlots(ball.slots).join(" + ") : undefined}
              >
                {chipFor(ball.slots)}
              </span>
              <span className="wool-row-what">
                <strong>{ball.yarn.name}</strong>
                {ball.yarn.code ? ` (${ball.yarn.code})` : ""}
                <span className="quiet wool-row-count">
                  {ball.slots.some(slot => overrides[slot])
                    ? `About ${Math.round(ball.metres).toLocaleString()}m · yours`
                    : `${ball.balls} ball${ball.balls === 1 ? "" : "s"} · about ${Math.round(ball.metres).toLocaleString()}m`}
                  {ball.yarn.approximate ? " · colour approximate" : ""}
                </span>
              </span>
              <BodyStrip
                {...body}
                palette={palette}
                highlight={ball.slots}
                className="wool-row-motif"
              />
              <span className="wool-row-change">Change</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="wool-list-restore">
        {stated
          ? "The metres are the pattern's own, for this size, and the balls from "
          : "The metres are worked out from this size's stitches, with a tenth to spare, and the balls from "}
        {colourway.ballMetres ? `${colourway.ballMetres}m a ball` : "the yarn's ball length"}
        {stated ? "." : ": an estimate, not a promise."}
        {yours &&
          " For wool of your own, buy by the metres, from a yarn of the same weight, and check your swatch."}
      </p>

      {picking && chosen && (
        <YarnPicker
          open
          label={nameFor(chosen.slots)}
          current={chosen.yarn}
          suggest={colourway.wool}
          onChoose={(choice) => onChange(chosen.slots, choice)}
          onClose={() => setPicking(undefined)}
          preview={<BodyStrip {...body} palette={palette} className="picker-preview" />}
        />
      )}
    </>
  );
};

export default WoolList;
