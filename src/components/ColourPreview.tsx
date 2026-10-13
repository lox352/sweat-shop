import { Stitch } from "../types/Stitch";
import "./ColourPreview.css";

/** The knitting a preview is drawn from. */
export interface Body {
  stitches: Stitch[];
  rounds: number[][];
}
