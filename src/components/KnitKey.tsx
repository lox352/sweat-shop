import React, { useEffect, useMemo } from "react";
import type { Hold, NeedleChange, Turn } from "../knitting/chart-marks";
import { Stitch } from "../types/Stitch";
import { Palette } from "../knitting/palette";
import { stitchKey } from "../knitting/stitch-key";
import { KeyList } from "../knitting/ChartHelp";
import type { StitchKeyId, StitchNote } from "../data/sweaters/types";

type Notes = Partial<Record<StitchKeyId, StitchNote>>;

/** The colours and every stitch in this sweater: the whole key. */
const FullKey: React.FC<{
  stitches: Stitch[];
  palette: Palette;
  notes?: Notes;
  current?: string;
  needles?: NeedleChange[];
  holds?: Hold[];
  turns?: Turn[];
}> = ({ stitches, palette, notes, current, needles, holds, turns }) => {
  // The stitch in hand first, where it is seen without scrolling.
  const entries = useMemo(() => {
    const all = stitchKey(stitches, notes);
    return [...all.filter((e) => e.id === current), ...all.filter((e) => e.id !== current)];
  }, [stitches, notes, current]);
  const yarns = Object.entries(palette).filter(
    ([, yarn], i, all) => all.findIndex(([, other]) => other.name === yarn.name && other.hex === yarn.hex) === i,
  );
  return (
    <div className="full-key">
      <ul className="full-key-yarns">
        {yarns.map(([slot, yarn]) => (
          <li key={slot}>
            <span className="swatch" style={{ background: yarn.hex }} /> {slot} · {yarn.name}
          </li>
        ))}
      </ul>
      <KeyList entries={entries} current={current} needles={needles} holds={holds} turns={turns} />
    </div>
  );
};

/**
 * The whole key while knitting, in a sheet over the lower part of the screen.
 *
 * Full-screen knitting has no room for the key below the chart, and the panel
 * already explains the stitches in the round in hand. This is for everything
 * else: which yarn is which, or a stitch further on.
 */
export const KeySheet: React.FC<{
  stitches: Stitch[];
  palette: Palette;
  notes?: Notes;
  current?: string;
  needles?: NeedleChange[];
  holds?: Hold[];
  turns?: Turn[];
  onClose: () => void;
}> = ({ stitches, palette, notes, current, needles, holds, turns, onClose }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="key-sheet" role="dialog" aria-label="Key">
      <div className="key-sheet-head">
        <strong>Key</strong>
        <button type="button" className="key-sheet-close" aria-label="Close the key" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="key-sheet-body">
        <FullKey
          stitches={stitches}
          palette={palette}
          notes={notes}
          current={current}
          needles={needles}
          holds={holds}
          turns={turns}
        />
      </div>
    </div>
  );
};
