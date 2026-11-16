import { createContext } from "react";

/**
 * Where a panel may draw over the stage, in place of what is on it: the ways
 * a sweater could be fitted, side by side, where the one sweater was.
 *
 * None (null) for a panel of a stage that is not the one shown: what it
 * would draw there is then not drawn at all. Outside a stage altogether
 * (undefined) there is nowhere to draw it but where it is. See StageLayout.
 */
export const StageSlot = createContext<HTMLElement | null | undefined>(undefined);
