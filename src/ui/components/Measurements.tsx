import React from "react";
import type { SizeAbout } from "../../pattern/design";

/** A size's finished measurements, as a pattern's schematic gives them. */
export const Measurements: React.FC<{ size: SizeAbout }> = ({ size }) => (
  <dl className="measurements">
    <div>
      <dt>Chest</dt>
      <dd>{size.finished.chestCm}cm</dd>
    </div>
    <div>
      <dt>Neck</dt>
      <dd>{size.finished.neckCm}cm</dd>
    </div>
    <div>
      <dt>Yoke depth</dt>
      <dd>{size.finished.yokeDepthCm}cm</dd>
    </div>
    <div>
      <dt>Body length</dt>
      <dd>{size.finished.bodyLengthCm}cm, underarm to hem</dd>
    </div>
    <div>
      <dt>Upper arm</dt>
      <dd>{size.finished.upperArmCm}cm</dd>
    </div>
    <div>
      <dt>Sleeve length</dt>
      <dd>{size.finished.sleeveLengthCm}cm, underarm to cuff</dd>
    </div>
    <div>
      <dt>Cuff</dt>
      <dd>{size.finished.cuffCm}cm</dd>
    </div>
    <div>
      <dt>Tension</dt>
      <dd>
        {size.stitchesPer10cm} sts &amp; {size.roundsPer10cm} rounds to 10cm
      </dd>
    </div>
    <div>
      <dt>Needles</dt>
      <dd>
        {size.ribNeedlesMm ? `${size.ribNeedlesMm}mm rib, ` : ""}
        {size.needlesMm}mm
      </dd>
    </div>
  </dl>
);
