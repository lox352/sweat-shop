import { currentEdition, loadEdition } from "../library/editions";
import { joinedAt } from "../library/editions/difference";
import { type EditionFile, decodeEdition } from "../library/editions/format";
import { asEdition } from "../library/editions/own";
import { type Fitted, askForFit } from "../library/fit";
import type { SweaterStitches } from "../pattern/knitted";
import type { Linked } from "./link";
import { type Project, type ProjectFit, currentVersion } from "./projects";

/**
 * A jumper's knitting made again from its link (see link.ts), where the
 * jumper is not kept.
 *
 * A published edition is fetched: its file never changes, and is not taken
 * down. Knitting of a project's own is made as it was made, a step at a time
 * from the published edition it began as - the design's planner asked what
 * it was asked then, an update joined at the round it was joined at - and
 * what comes of it is named, as an edition is, by a hash of itself. The link
 * says what that name was. So the knitter is given the pattern they had,
 * stitch for stitch, or told it can't be had: never a pattern that is nearly
 * it. It can't be had where the planning has changed since the link was
 * made, which a backup is then the only copy of.
 */

/** Knitting made again: the edition a project is to knit, with its file where that is its own to keep, and its fit where it has one. */
export interface Remade {
  edition?: string;
  file?: EditionFile;
  fit?: ProjectFit;
  /** The last stitch it has. */
  last: number;
}

/** Why knitting could not be made again: `changed`, where it was made and is not what the link names. */
export class NotRemade extends Error {
  constructor(message: string, readonly changed = false) {
    super(message);
  }
}

const fetched = (linked: Linked, edition: string | undefined) =>
  loadEdition(linked.sweater.id, linked.sizeId, edition).catch((error: unknown) => {
    // The site has every edition it ever published. One it has not got was a project's own, from before a project kept how its knitting was made.
    if (error instanceof Error && /: 404$/.test(error.message)) {
      throw new NotRemade("Its pattern was this jumper's own, made before a link said how: it can't be made again from this one.", true);
    }
    throw new NotRemade("Its pattern could not be fetched. Check your connection and try again.");
  });

/**
 * Make a linked jumper's knitting again. `progress` is told how far it has
 * got, from 0 to 1, where there is planning to wait for.
 */
export const remake = (linked: Linked, progress?: (fraction: number) => void): { done: Promise<Remade>; cancel: () => void } => {
  let cancelled = false;
  let cancelNow = () => undefined as void;
  const { sweater, sizeId, made } = linked;

  const work = async (): Promise<Remade> => {
    if (!made) {
      const knitting = await fetched(linked, linked.edition);
      return { edition: linked.edition ?? currentEdition(sweater.id, sizeId), last: knitting.stitches.length - 1 };
    }
    let knitting: SweaterStitches | undefined = made.from ? await fetched(linked, made.from) : undefined;
    let file: EditionFile | undefined;
    let fitted: Fitted | undefined;
    let fittedFrom: string | undefined;
    for (const [nth, step] of made.steps.entries()) {
      if (cancelled) throw new NotRemade("Stopped.");
      if ("join" in step) {
        const theirs = await fetched(linked, step.join);
        const together = knitting && joinedAt(knitting, theirs, step.round);
        if (!together) throw new NotRemade("Its pattern can't be made again as it was: an update it was joined to no longer joins there.", true);
        knitting = together;
        file = await asEdition(knitting, sweater.id, sizeId);
      } else {
        const whole = step.round === undefined;
        if (!whole && !knitting) throw new NotRemade("Its pattern can't be made again: the link does not say what it began as.", true);
        // The published edition the first fit left, which a fit can be gone back from: see Refit.
        if (!fitted) fittedFrom = !whole && nth === 0 ? made.from : undefined;
        const found: Fitted[] = [];
        const asked = askForFit(
          { design: sweater.id, sizeId, ...(whole ? {} : { knitted: knitting, round: step.round }), tension: step.fit, ...(step.option ? { option: step.option } : {}) },
          { progress: (fraction) => progress?.((nth + fraction) / made.steps.length), fitted: (one) => found.push(one) },
        );
        cancelNow = asked.cancel;
        await asked.done.catch((error: Error) => {
          throw new NotRemade(error.message, true);
        });
        fitted = found[0];
        if (!fitted) throw new NotRemade("Its pattern can't be made again as it was.", true);
        file = fitted.file;
        knitting = decodeEdition(file);
      }
      progress?.((nth + 1) / made.steps.length);
    }
    if (!knitting || !file || file.edition !== linked.edition) {
      throw new NotRemade("Its pattern was recalculated, and can't be made again exactly as it was: the site's pattern-making has changed since this link was made.", true);
    }
    return {
      edition: file.edition,
      file,
      last: knitting.stitches.length - 1,
      ...(fitted
        ? {
            fit: {
              tension: fitted.tension,
              finished: fitted.finished,
              ...(fitted.round === undefined ? {} : { round: fitted.round }),
              ...(fittedFrom ? { from: fittedFrom } : {}),
              ...(fitted.option ? { option: fitted.option } : {}),
              ...(fitted.placement ? { placement: fitted.placement } : {}),
            },
          }
        : {}),
    };
  };

  return {
    done: work(),
    cancel: () => {
      cancelled = true;
      cancelNow();
    },
  };
};

/**
 * The project a linked jumper is, its knitting made again: the jumper
 * itself, where it is carried on - its id, name and place - or one like it,
 * begun at the cast-on under an id of its own.
 */
export const projectOf = (linked: Linked, remade: Remade, carriedOn: boolean): Project => {
  const now = new Date().toISOString();
  return {
    version: currentVersion,
    id: carriedOn ? linked.id : `project-${crypto.randomUUID()}`,
    ...(carriedOn && linked.name ? { name: linked.name } : {}),
    sweaterId: linked.sweater.id,
    sizeId: linked.sizeId,
    colourwayId: linked.colourwayId,
    ...(linked.trim ? { trim: linked.trim } : {}),
    ...(linked.shades ? { shades: linked.shades } : {}),
    progress: carriedOn ? Math.max(0, Math.min(linked.progress, remade.last)) : 0,
    ...(remade.edition ? { edition: remade.edition } : {}),
    ...(linked.tension ? { tension: linked.tension } : {}),
    ...(remade.fit ? { fit: remade.fit } : {}),
    ...(linked.made && remade.file ? { made: linked.made } : {}),
    ...(linked.upTo ? { upTo: linked.upTo } : {}),
    startedAt: (carriedOn && linked.startedAt) || now,
    updatedAt: now,
  };
};

/** A linked jumper begun on the pattern as written, where its own can't be made again: its design, size and wool, and its knitter's tension to recalculate it by. */
export const asWritten = (linked: Linked): Project => {
  const now = new Date().toISOString();
  const edition = currentEdition(linked.sweater.id, linked.sizeId);
  return {
    version: currentVersion,
    id: `project-${crypto.randomUUID()}`,
    sweaterId: linked.sweater.id,
    sizeId: linked.sizeId,
    colourwayId: linked.colourwayId,
    ...(linked.trim ? { trim: linked.trim } : {}),
    ...(linked.shades ? { shades: linked.shades } : {}),
    progress: 0,
    ...(edition ? { edition } : {}),
    ...(linked.tension ? { tension: linked.tension } : {}),
    startedAt: now,
    updatedAt: now,
  };
};
