import { useEffect, useState } from "react";
import type { SweaterStitches } from "../pattern/knitted";
import { currentEdition, editionKey } from "../library/editions";
import { isOwn } from "../library/editions/own";
import { isPublished, loadSettled, settledShape } from "../library/settled";
import { fabricPositions } from "../library/settled/format";
import { keepShape, ownShape } from "../library/settled/own";
import { physicsNow } from "../physics/naming";
import { settleInWorker } from "../physics/settling";

/**
 * "?settled=0" draws the sweater blocked, as it starts, rather than where it
 * came to rest, which is the only way to see what the settling is worth.
 */
const settledWanted = () =>
  typeof window === "undefined" ||
  new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("settled") !== "0";

/** Shapes already to hand this visit, by name, so moving between pages neither fetches nor settles them again. */
const known = new Map<string, Float32Array>();

/** The shape of each knitting settled before it was anyone's project (see useShapes), by its edition: taken, it is drawn in it at once. */
const shapeOfOwn = new Map<string, string>();

/**
 * Where a knitting's fabric comes to rest, however that is to be had: to
 * hand already, published and fetched, or settled here, off the page's
 * thread, saying how far that has got. Its shape's name with it (see
 * physics/naming); nothing, where it was settled here and did not come to
 * rest. A shape got is to hand for the rest of the visit.
 */
export const settleShape = (
  knitting: SweaterStitches,
  on: { progress?: (fraction: number) => void } = {},
): { settled: Promise<{ name: string; fabric: Float32Array } | undefined>; cancel: () => void } => {
  let cancel = () => {};
  const settled = new Promise<{ name: string; fabric: Float32Array } | undefined>((resolve, reject) => {
    let named: string | undefined;
    const asking = settleInWorker(knitting.knitting, {
      shape: (name) => {
        named = name;
        if (!known.has(name) && !isPublished(name)) return;
        // The shape of this very fabric is to hand, or published: nothing to settle.
        asking.cancel();
        void (known.has(name) ? Promise.resolve(known.get(name)) : loadSettled(name)).then((fabric) => {
          if (fabric) known.set(name, fabric);
          resolve(fabric && { name, fabric });
        }, reject);
      },
      progress: on.progress,
    });
    cancel = asking.cancel;
    asking.settled.then(({ positions, rested }) => {
      if (!rested || !named) return resolve(undefined);
      const fabric = fabricPositions(knitting.stitches, positions);
      known.set(named, fabric);
      resolve({ name: named, fabric });
    }, reject);
  });
  return { settled, cancel: () => cancel() };
};

export interface Shape {
  /** Where the knitting's fabric came to rest, once that is known: see library/settled. */
  settled?: Float32Array;
  /** A published shape is on its way: nothing should be drawn until it has had its chance, so the sweater is never seen jumping into it. */
  waiting: boolean;
  /** Being settled on this device, and how far that has got, 0 to 1. Drawn blocked meanwhile. */
  settling?: number;
  /** It was settled here and did not come to rest: it stays drawn blocked. */
  unsettled?: boolean;
}

/**
 * The shape a knitting is drawn in, and the one place that is decided.
 *
 * - A published edition has a published shape, settled once for everybody:
 *   fetched, and nothing drawn until it has answered.
 * - A project's own knitting (see library/editions/own) has none. It is drawn
 *   blocked at once, and settled here, off the page's thread, with how far
 *   that has got; then it is drawn where it came to rest, and the shape is
 *   kept on the device for the next visit. Where its fabric is one a
 *   published shape is of, that is fetched instead.
 * - Anything else - an edition published and not yet settled - is drawn
 *   blocked, as it always was.
 */
export const useShape = (sweaterId: string, sizeId: string, edition: string | undefined, knitting: SweaterStitches | undefined): Shape => {
  const published = settledWanted() ? settledShape(sweaterId, sizeId, edition) : undefined;
  const key = editionKey(sweaterId, sizeId, edition ?? currentEdition(sweaterId, sizeId) ?? "");
  const [shape, setShape] = useState<Shape>(() => (published && known.has(published) ? { settled: known.get(published), waiting: false } : { waiting: !!published }));

  useEffect(() => {
    let live = true;
    const show = (next: Shape) => {
      if (live) setShape(next);
    };
    if (published) {
      if (known.has(published)) return show({ settled: known.get(published), waiting: false });
      show({ waiting: true });
      void loadSettled(published).then((positions) => {
        if (positions) known.set(published, positions);
        show({ settled: positions, waiting: false });
      });
      return () => {
        live = false;
      };
    }
    show({ waiting: false });
    if (!settledWanted() || !knitting || !edition || !isOwn(sweaterId, sizeId, edition)) return;
    // Settled this visit, while it was being shown before it was taken: there is nothing to wait for.
    const shown = shapeOfOwn.get(edition);
    const toHand = shown && known.get(shown);
    if (shown && toHand) {
      show({ settled: toHand, waiting: false });
      void keepShape(key, physicsNow, shown, toHand);
      return;
    }
    let cancel = () => {};
    void (async () => {
      // Settled here on an earlier visit, by the physics as it still is.
      const kept = await ownShape(key, physicsNow);
      if (!live) return;
      if (kept) {
        known.set(kept.shape, kept.positions);
        return show({ settled: kept.positions, waiting: false });
      }
      const asking = settleShape(knitting, { progress: (fraction) => show({ waiting: false, settling: fraction }) });
      cancel = asking.cancel;
      show({ waiting: false, settling: 0 });
      asking.settled.then(
        (shape) => {
          if (!shape) return show({ waiting: false, unsettled: true });
          show({ settled: shape.fabric, waiting: false });
          // A shape that is nobody's but this knitting's is kept on the device, wherever it was settled: here, or before it was taken (see useShapes).
          if (!isPublished(shape.name)) void keepShape(key, physicsNow, shape.name, shape.fabric);
        },
        () => show({ waiting: false, unsettled: true }),
      );
    })();
    return () => {
      live = false;
      cancel();
    };
    // The knitting is the edition's: one changes with the other.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published, key]);

  return shape;
};

/**
 * Where each of several knittings comes to rest, for whoever would show them
 * together and not before every one is settled: how far the settling of them
 * all has got, from 0 to 1, and, once all are done, each one's fabric - or
 * nothing for one that did not come to rest. Settled side by side, each in a
 * worker of its own.
 */
export const useShapes = (
  knittings: SweaterStitches[],
  /** The edition each would be as a project's own knitting, for those that would: its shape is then that project's from the start. */
  editions: (string | undefined)[] = [],
): { fraction: number; shapes?: (Float32Array | undefined)[] } => {
  const [state, setState] = useState<{ of: SweaterStitches[]; fraction: number; shapes?: (Float32Array | undefined)[] }>({ of: knittings, fraction: 0 });
  useEffect(() => {
    let live = true;
    const fractions = knittings.map(() => 0);
    const shapes: (Float32Array | undefined)[] = knittings.map(() => undefined);
    let left = knittings.length;
    const say = () => {
      if (!live) return;
      const fraction = fractions.reduce((sum, one) => sum + one, 0) / Math.max(fractions.length, 1);
      setState(left === 0 ? { of: knittings, fraction: 1, shapes } : { of: knittings, fraction });
    };
    say();
    const askings = knittings.map((knitting, at) => {
      const asking = settleShape(knitting, {
        progress: (fraction) => {
          fractions[at] = fraction;
          say();
        },
      });
      const done = (fabric?: Float32Array) => {
        shapes[at] = fabric;
        fractions[at] = 1;
        left--;
        say();
      };
      asking.settled.then(
        (shape) => {
          const edition = editions[at];
          if (shape && edition) shapeOfOwn.set(edition, shape.name);
          done(shape?.fabric);
        },
        () => done(),
      );
      return asking;
    });
    return () => {
      live = false;
      askings.forEach((asking) => asking.cancel());
    };
    // The editions are the knittings': one changes with the other.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knittings]);
  // Other knittings are another question: what was settled for the last is not theirs.
  return state.of === knittings ? state : { fraction: 0 };
};
