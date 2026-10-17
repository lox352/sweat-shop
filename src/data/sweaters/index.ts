import { SweaterPattern } from "./types";
import hamefarin from "./hamefarin";
import paulKlee from "./paul-klee";
import woolWeekSampler from "./wool-week-sampler";

/**
 * Every design the site knows about.
 *
 * Adding one is adding one file beside this one and one line here. Nothing
 * about the site assumes how many there are.
 */
export const sweaters: SweaterPattern[] = [hamefarin, paulKlee, woolWeekSampler];

export const sweaterById = (id: string): SweaterPattern | undefined =>
  sweaters.find((sweater) => sweater.id === id);

export * from "./types";
