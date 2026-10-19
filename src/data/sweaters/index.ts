import { SweaterPattern } from "./types";
import hamefarin from "./hamefarin";
import paulKlee from "./paul-klee";
import woolWeekSampler from "./wool-week-sampler";
import stripsLinedNewest from "./wool-week-strips-lined-newest";
import stripsLinedOldest from "./wool-week-strips-lined-oldest";
import stripsOnceOldest from "./wool-week-strips-once-oldest";
import stripsOnceNewest from "./wool-week-strips-once-newest";
import stripsOnceEasiest from "./wool-week-strips-once-easiest";

/**
 * Every design the site knows about.
 *
 * Adding one is adding one file beside this one and one line here. Nothing
 * about the site assumes how many there are.
 */
export const sweaters: SweaterPattern[] = [
  hamefarin,
  paulKlee,
  woolWeekSampler,
  // The strip samplers, one file each: see wool-week/strips.
  stripsLinedNewest,
  stripsLinedOldest,
  stripsOnceOldest,
  stripsOnceNewest,
  stripsOnceEasiest,
];

export const sweaterById = (id: string): SweaterPattern | undefined =>
  sweaters.find((sweater) => sweater.id === id);

export * from "./types";
