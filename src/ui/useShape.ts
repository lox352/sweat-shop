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
    let cancel = () => {};
    void (async () => {
      // Settled here on an earlier visit, by the physics as it still is.
      const kept = await ownShape(key, physicsNow);
      if (!live) return;
      if (kept) {
        known.set(kept.shape, kept.positions);
        return show({ settled: kept.positions, waiting: false });
      }
      let named: string | undefined;
      const asking = settleInWorker(knitting.knitting, {
        shape: (name) => {
          named = name;
          if (!known.has(name) && !isPublished(name)) return;
          // The shape of this very fabric is to hand, or published: nothing to settle.
          asking.cancel();
          void (known.has(name) ? Promise.resolve(known.get(name)) : loadSettled(name)).then((positions) => {
            if (positions) known.set(name, positions);
            show({ settled: positions, waiting: false });
          });
        },
        progress: (fraction) => show({ waiting: false, settling: fraction }),
      });
      cancel = asking.cancel;
      show({ waiting: false, settling: 0 });
      asking.settled.then(
        ({ positions, rested }) => {
          if (!rested || !named) return show({ waiting: false, unsettled: true });
          const fabric = fabricPositions(knitting.stitches, positions);
          known.set(named, fabric);
          show({ settled: fabric, waiting: false });
          void keepShape(key, physicsNow, named, fabric);
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
