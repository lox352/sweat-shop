import { createContext } from "react";

/**
 * Where a panel may draw over the stage, in place of what is on it: the ways
 * a sweater could be fitted, side by side, where the one sweater was. None
 * for a panel that is not the one shown, or outside a stage altogether. See
 * StageLayout.
 */
export const StageSlot = createContext<HTMLElement | null>(null);
