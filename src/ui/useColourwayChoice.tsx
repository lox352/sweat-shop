import { useCallback, useMemo, useState } from "react";
import type { Colourway } from "../pattern/design";
import { ownBalls, type Overrides } from "../reading/palette";
import Dialog from "./components/ui/Dialog";

/** A design's colourways in its groups, in the order they first come; one group, unnamed, where it has none. */
const groupsOf = (colourways: Colourway[]): [string | undefined, Colourway[]][] => {
  const groups = new Map<string | undefined, Colourway[]>();
  for (const c of colourways) groups.set(c.family, [...(groups.get(c.family) ?? []), c]);
  return [...groups];
};

/**
 * Choosing among a design's colourways, for whoever lays the choice out: the
 * colourways in their groups, choosing one, and the asking first that goes
 * with it.
 *
 * Each colourway is a base to start from. Choosing one sets every yarn to
 * it, and the jumper on the stage wears it at once. Once a yarn is changed
 * the sweater is the knitter's own, from that base; starting again from
 * another asks first, since it can't be undone.
 */
export const useColourwayChoice = ({
  colourways,
  colourway,
  overrides,
  onStartFrom,
}: {
  colourways: Colourway[];
  colourway: Colourway;
  overrides: Overrides;
  onStartFrom: (colourwayId: string) => void;
}) => {
  const [asking, setAsking] = useState<Colourway>();
  const groups = useMemo(() => groupsOf(colourways), [colourways]);
  const own = ownBalls(colourway, overrides);
  const inUse = colourway.id;
  const choose = useCallback(
    (option: Colourway) => {
      if (own > 0) setAsking(option);
      else if (option.id !== inUse) onStartFrom(option.id);
    },
    [own, inUse, onStartFrom],
  );
  const confirm = (
    <Dialog
      open={asking !== undefined}
      title={`Start again from ${asking?.name ?? ""}?`}
      text={`Every yarn changes to ${asking?.name ?? ""}'s, including the ${own === 1 ? "one" : own} of your own.`}
      confirmLabel="Start again"
      onConfirm={() => {
        if (asking) onStartFrom(asking.id);
        setAsking(undefined);
      }}
      onCancel={() => setAsking(undefined)}
    />
  );
  return { groups, own, choose, confirm };
};
