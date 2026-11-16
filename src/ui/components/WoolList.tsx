import React from "react";
import { Colourway, SlotId } from "../../pattern/design";
import { ballsOf, shownSlots, slotNames, type Overrides } from "../../reading/palette";
import "./WoolList.css";

/**
 * The wool a sweater is being knitted in: what to buy, a row a ball.
 *
 * A row is a ball and not a yarn of the pattern, which matters where a
 * colourway puts one ball in several - see ballsOf. Tapping a row opens that
 * ball to be changed, where the jumper and the chart show what it changes:
 * see Customise.
 */
interface WoolListProps {
  colourway: Colourway;
  /** Metres of each slot the size knits up: the pattern's own, or estimated; see reading/yardage. */
  metres: Record<string, number>;
  /** Whether the metres are the pattern's own rather than estimated. */
  stated?: boolean;
  overrides: Overrides;
  /** A ball chosen to be changed, by the yarns it does. */
  onPick: (slots: SlotId[]) => void;
}

const WoolList: React.FC<WoolListProps> = ({
  colourway,
  metres,
  stated,
  overrides,
  onPick,
}) => {
  // Only the wool this size knits: a smaller size leaves the last bands' colours out.
  const balls = ballsOf(colourway, metres, overrides).filter((ball) => ball.metres > 0);
  const yours = Object.keys(overrides).length > 0;

  return (
    <>
      <ul className="wool-list">
        {balls.map((ball) => (
          <li key={ball.slots.join()}>
            <button
              type="button"
              className="wool-row"
              onClick={() => onPick(ball.slots)}
            >
              <span className="wool-row-swatch" style={{ background: ball.yarn.hex }} aria-hidden="true" />
              <span className="wool-row-what">
                <strong>{ball.yarn.name}</strong>
                {ball.yarn.code ? ` (${ball.yarn.code})` : ""}
                <span className="quiet wool-row-count">
                  {ball.slots.some((slot) => overrides[slot])
                    ? `About ${Math.round(ball.metres).toLocaleString()}m · yours`
                    : `${ball.balls} ball${ball.balls === 1 ? "" : "s"} · about ${Math.round(ball.metres).toLocaleString()}m`}
                  {ball.yarn.approximate ? " · colour approximate" : ""}
                  {/* Where it is in the pattern, last and small: for matching a ball to the chart's key. */}
                  <span title={shownSlots(ball.slots).length > 3 ? shownSlots(ball.slots).join(" + ") : undefined}> · {slotNames(ball.slots)}</span>
                </span>
              </span>
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

    </>
  );
};

// Drawn again only when what it lists changes: see ColourwayChoice.
export default React.memo(WoolList);
