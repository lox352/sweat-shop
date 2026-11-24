import { Stitch } from "../../pattern/Stitch";
import type { FrontPicture } from "./bodyPicture";
import "./ColourPreview.css";

/** The knitting a preview is drawn from. */
export interface Body {
  stitches: Stitch[];
  rounds: number[][];
  /** The yoke placed about the middle of the front, where a strip of it would shear its bands: see yokePicture. */
  front?: FrontPicture;
}
