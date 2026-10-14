/**
 * The physics settings: the hat site's, carried over where they mean the
 * same thing, and the dials a sweater adds.
 *
 * Nothing on the site reads these. The site draws sweaters already settled;
 * only scripts/settle.mjs and scripts/bench.mjs run the solver, and the
 * bench can override any of them to see what it is worth.
 */
export interface Tuning {
  /** Seconds of simulated time a step. */
  timeStep: number;
  /** Substeps a step: the forces are applied, and the ropes solved, this often. */
  substeps: number;
  /** Passes over every rope a substep. */
  iterations: number;
  /** How quickly motion dies away, per second. */
  damping: number;
  /**
   * Gravity, along the way each piece was knitted: down the yoke and the
   * body, and down each sleeve's arm.
   *
   * Earth's, in the units the sweater is laid out in, as on the hat site and
   * for its reason: strong enough to pull every rope taut, which is what
   * makes a settle land on the shape the rope lengths give it rather than on
   * whatever shape it happened to fall into.
   */
  gravity: number;
  /**
   * An outward push from the middle of each round, as an acceleration, so it
   * reads against gravity: what holds a round out to the circle its own
   * stitches make, rather than wandering in and out on its way round. See
   * the hat site's tuning, where five was measured against the alternatives:
   * enough to hold the fabric out, not so much that every round is pushed to
   * its stop at once.
   */
  pressure: number;
  /** The yoke's push, separately, since it is held up by little else. */
  yokePressure: number;
  /**
   * How much of gravity the yoke feels, as a share of it. A yoke is blocked
   * spread over the shoulders, and with nothing under it a yoke that feels
   * all of gravity falls into a steep cone round the neck, every round
   * gathered into far less than its own length - its bands crumple and its
   * motifs read as noise. Held out by its push alone, it keeps the spread a
   * yoke has on a body, and the body and sleeves hanging from it still pull
   * it into shape.
   */
  yokeGravity: number;
  /**
   * How still the sweater has to be to count as settled: how far the average
   * stitch moves in a step, as a fraction of a stitch's width. Distance, not
   * speed - see the hat site's constants for why a speed never gets there.
   */
  restMovement: number;
  /** For how long, in simulated seconds, it has to stay that still. */
  restSeconds: number;
  /** Steps before it may count as still at all. */
  minimumSteps: number;
  /** Steps after which it gives up and says so. */
  maximumSteps: number;
}

export const defaultTuning: Tuning = {
  timeStep: 0.15,
  substeps: 2,
  iterations: 12,
  damping: 3,
  gravity: 9.81,
  pressure: 5,
  yokePressure: 5,
  yokeGravity: 0,
  restMovement: 0.003,
  restSeconds: 2,
  minimumSteps: 10,
  maximumSteps: 4000,
};
