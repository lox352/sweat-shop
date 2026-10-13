import React, { useState } from "react";
import { Colourway, SlotId } from "../data/sweaters/types";
import { ballsOf, inkOn, type Overrides, type Palette } from "../knitting/palette";
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
  /** Metres of each slot the size knits up, estimated; see knitting/yardage. */
  metres: Record<string, number>;
  overrides: Overrides;
  onChange: (slots: SlotId[], chosen: Chosen | undefined) => void;
  /**
   * The yoke's bands in the wool being chosen: shown beside each ball with
   * only its yarns lit, and in the picker while a ball is being chosen.
   */
  body: Body;
  palette: Palette;
}

/** "Yarn A", or "Yarns A, C and G". */
const nameFor = (slots: SlotId[]): string =>
  slots.length === 1
    ? `Yarn ${slots[0]}`
    : `Yarns ${slots.slice(0, -1).join(", ")} and ${slots[slots.length - 1]}`;

const WoolList: React.FC<WoolListProps> = ({
  colourway,
  metres,
  overrides,
  onChange,
  body,
  palette,
}) => {
  /** Which ball is being chosen, by the yarns it does. */
  const [picking, setPicking] = useState<SlotId[] | undefined>();
  const balls = ballsOf(colourway, metres, overrides);
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
              >
                {ball.slots.join(" + ")}
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
        The metres are worked out from this size's stitches, with a tenth to
        spare, and the balls from{" "}
        {colourway.ballMetres ? `${colourway.ballMetres}m a ball` : "the yarn's ball length"}: an
        estimate, not a promise.
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
