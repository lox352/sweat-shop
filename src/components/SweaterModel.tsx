import React from "react";
import { Stitch } from "../types/Stitch";
import { Palette } from "../knitting/palette";

/** How tall the stage is, so nothing on the page moves when it arrives. */
export const sweaterCanvasHeight = 420;

export interface SweaterModelProps {
  sweaterId: string;
  sizeId: string;
  stitches: Stitch[];
  rounds: number[][];
  roundHeight: number;
  palette: Palette;
  /** Id of the last stitch worked; earlier stitches are shown in their wool. */
  progress: number;
}

/**
 * The sweater in three dimensions. Its pose and its settled shape arrive in
 * the next milestone; until then the stage keeps its place on the page.
 */
const SweaterModel: React.FC<SweaterModelProps> = () => (
  <div className="sweater-canvas" style={{ height: sweaterCanvasHeight }} role="img" aria-label="The sweater in three dimensions" />
);

export default SweaterModel;
