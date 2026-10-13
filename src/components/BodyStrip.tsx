import React, { useEffect, useMemo, useRef, useState } from "react";
import { SlotId } from "../data/sweaters/types";
import { Stitch } from "../types/Stitch";
import { Palette } from "../knitting/palette";
import "./ColourPreview.css";
import { bodyRounds, stitchScale, usePainting } from "./bodyPicture";

/**
 * The yoke as worn: its bands, stacked, in the wool being chosen.
 *
 * Not a chart - a chart is the knitting in the order it is worked - but the
 * part of the sweater everyone looks at, whole, with every yarn in it. Drawn
 * a pixel a stitch and scaled up square, because it is thousands of stitches
 * and is redrawn on every change of wool.
 *
 * Scaled up on the canvas itself, not by the browser: each stitch a square
 * of whole screen pixels, drawn at the strip's own height and the screen's
 * own density, so the picture is shown pixel for pixel. Left to the browser,
 * a one-pixel-a-stitch picture is only kept sharp where it honours
 * `image-rendering: pixelated` for backgrounds; where it doesn't (Safari on
 * a desktop, notably), it is smoothed into a blur.
 */

/** The height an element is drawn at, in screen pixels; 0 until it is known. */
const useDeviceHeight = (ref: React.RefObject<HTMLElement>) => {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeight(element.getBoundingClientRect().height * (window.devicePixelRatio || 1));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Zooming, or moving the window to a screen of another density.
    let density: MediaQueryList | undefined;
    const watchDensity = () => {
      density?.removeEventListener("change", onDensity);
      density = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      density?.addEventListener("change", onDensity);
    };
    const onDensity = () => {
      measure();
      watchDensity();
    };
    watchDensity();
    measure();
    return () => {
      observer.disconnect();
      density?.removeEventListener("change", onDensity);
    };
  }, [ref]);
  return height;
};

const BodyStrip: React.FC<{
  stitches: Stitch[];
  rounds: number[][];
  palette: Palette;
  /** Fade every stitch but these yarns', to show where they are knitted. */
  highlight?: SlotId[];
  className?: string;
}> = ({ stitches, rounds, palette, highlight, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const deviceHeight = useDeviceHeight(ref);
  const body = useMemo(() => bodyRounds(rounds, stitches), [rounds, stitches]);

  /*
   * Painted once per change of wool, a pixel a stitch, and used
   * as the strip's background: scaled up square to the strip's height and
   * repeated sideways to fill it. A round goes all the way round the yoke, so
   * the next repeat along is simply more of the yoke - which is what lets a
   * strip wider than the body's own proportions be filled edge to edge.
   */
  const scale = stitchScale(deviceHeight, body.length);
  const painted = usePainting(body, stitches, palette, scale, highlight);

  let picture: React.CSSProperties | undefined;
  if (painted) {
    picture = { backgroundImage: `url(${painted.url})` };
    if (deviceHeight > 0) {
      const density = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
      // Pinned to whole screen pixels, so nothing is shifted by half of one:
      // stitch 1 at the right-hand edge, and centred up and down, where it
      // runs under or over the strip by at most half a stitch each way.
      const top = Math.round((deviceHeight - painted.height) / 2);
      picture.backgroundSize = `${painted.width / density}px ${painted.height / density}px`;
      picture.backgroundPosition = `right 0 top ${top / density}px`;
    }
  }

  return (
    <div
      className={["body-strip", className].filter(Boolean).join(" ")}
      ref={ref}
      style={picture}
      aria-hidden="true"
    />
  );
};

export default BodyStrip;
