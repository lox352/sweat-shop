interface RestSettings {
  restMovement: number;
  restSeconds: number;
  minimumFrames: number;
  timeStep: number;
}
/**
 * Decides when the hat has come to rest.
 *
 * Fed how far the average stitch travelled in the step, as a fraction of a
 * stitch's width, and true once that has stayed under the threshold for
 * `settleRestSeconds` of simulated time - a stray step back over it restarts
 * the count. Counting steps rather than frames means the answer does not
 * depend on how fast the machine draws, which is the whole point of stepping
 * the world by hand.
 *
 * Distance and not speed: see restMovement. A hat's mean velocity settles to
 * a floor and stays there, so a rule written on speed will wait for ever on
 * some hats and cannot be fixed by moving the number.
 *
 * The first quiet step is not the end of the movement: the fabric is still
 * easing into shape when it first goes quiet, so stopping there froze the hat
 * a moment early.
 */
export function createRestDetector(settings: RestSettings) {
  let steps = 0;
  let quiet = 0;
  const needed = Math.ceil(settings.restSeconds / settings.timeStep);
  return (moved: number) => {
    steps++;
    quiet =
      moved < settings.restMovement && steps >= settings.minimumFrames
        ? quiet + 1
        : 0;
    return quiet >= needed;
  };
}
/** What the settle took, for the diagnostics and the measurement suite. */
export interface SettleMetrics {
  steps: number;
  wallMs: number;
  height: number;
  meanMotion: number;
}
