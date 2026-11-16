import { useEffect, useMemo, useState } from "react";
import type { Colourway, Placement, Steps } from "../pattern/design";
import { loadSteps } from "../library/colourways";
import { placed } from "../reading/palette";

/**
 * A colourway as it is on a sweater: as the design has it, or, for one that
 * steps down the garment on a sweater laid out for one knitter, placed on
 * that (see reading/palette's placed). Its yarns by place are fetched the
 * first time they are wanted; until they arrive it is as the design has it.
 *
 * What comes back places any placement, for whatever compares several: the
 * colourway on the sweater in hand, and on each it might become.
 */
export const useColourway = (colourway: Colourway, placement: Placement | undefined) => {
  const [steps, setSteps] = useState<{ of: string; steps: Steps }>();
  const wanted = colourway.stepped ? colourway.id : undefined;
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void loadSteps(wanted).then((found) => {
      if (live && found) setSteps({ of: wanted, steps: found });
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  const table = wanted && steps?.of === wanted ? steps.steps : undefined;
  return useMemo(() => {
    const on = (where: Placement | undefined) => (table && where ? placed(colourway, table, where) : colourway);
    return { colourway: on(placement), on };
  }, [colourway, table, placement]);
};
