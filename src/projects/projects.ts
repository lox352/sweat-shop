import { Overrides } from "../reading/palette";
import type { Measurements, Placement, Tension } from "../pattern/design";
import { deleteLog } from "./timing/log";
import { currentEdition, editionKey, editionOf } from "../library/editions";
import { dropShapesBut } from "../library/settled/own";
import type { EditionFile } from "../library/editions/format";
import { dropEditionsBut, keepEdition } from "../library/editions/own";

/**
 * A project is a sweater you are knitting.
 *
 * It is tiny, and deliberately so. The stitches are a pure function of the
 * design and the size, and the colours a pure function of the colourway, so
 * none of that is worth storing: an id, a couple of choices and how far you
 * have got is the whole of it. What it does keep is which edition of the
 * knitting it was started on (see library/editions), so that a chart
 * corrected under it never moves a stitch of a project part way through: the
 * knitter is offered the correction, and chooses when to take it.
 */

export const currentVersion = 1;

export interface Project {
  version: number;
  /** Full storage key, e.g. "project-1736300000000". */
  id: string;
  name?: string;
  sweaterId: string;
  sizeId: string;
  colourwayId: string;
  /** The trim chosen among the colourway's own, by its wool: see SweaterPattern.trim. */
  trim?: string;
  shades?: Overrides;
  /** Id of the last stitch worked. 0 means nothing knitted yet. */
  progress: number;
  /**
   * The edition of its size's knitting it knits: see library/editions.
   * Left out by a project saved before editions, which knits the size's edition now.
   */
  edition?: string;
  /**
   * The tension its knitter measured in their own knitting, where they have
   * said: what the pattern knits up to at it is shown beside what it was
   * written for. See reading/tension.
   */
  tension?: Tension;
  /**
   * Where the rest of its knitting was worked out again for its knitter (see
   * library/fit). Its edition is then its own, kept on the device: see
   * library/editions/own.
   */
  fit?: ProjectFit;
  /**
   * How its knitting was made, where that is its own: what it is made again
   * by, where it was not kept. See Made.
   */
  made?: Made;
  /**
   * The published edition its knitting is up to date with, where that is
   * not the edition it knits: knitting of its own (fitted, or joined to an
   * update part way through), or an older edition whose update changes
   * nothing ahead. It is offered an update once the size moves on from this.
   */
  upTo?: string;
  startedAt: string;
  updatedAt: string;
}

/** A project's knitting fitted to its knitter: at what tension, to what measurements, and from where. */
export interface ProjectFit {
  tension: Tension;
  /** What the sweater will measure. */
  finished: Measurements;
  /** The round the rest was planned from: every round to it is as the pattern had it. None, where the whole was planned, from the cast-on. */
  round?: number;
  /** The published edition it was fitted from, to go back to. */
  from?: string;
  /**
   * What it was fitted from, where that was knitting of the project's own -
   * fitted before, or joined to an update: kept on the device with all that
   * was said of it, to go back to, until the knitting passes `round`.
   */
  before?: Before;
  /** Which of the design's ways of laying the rest out. */
  option?: string;
  /**
   * Where the bands planned afresh sit: what a colourway that steps down the
   * garment is placed by (see reading/palette's placed). The knitter buys
   * wool by it, so it is theirs to keep, and not worked out again.
   */
  placement?: Placement;
}

/** Knitting of a project's own that a fit left: its edition, kept, and what the project said of it. */
export interface Before {
  edition: string;
  fit?: ProjectFit;
  made?: Made;
  upTo?: string;
}

/**
 * How knitting of a project's own was made (see library/editions/own): the
 * published edition it began as, and each thing done to it since, in order.
 *
 * Knitting of a project's own is held by no published file, and by nothing
 * but the device it was made on. What made it is small, and says it exactly:
 * the planning of a pattern is the same every time it is asked the same. So
 * a project keeps how its knitting was made, and that is what a link to it
 * carries, to make it again where it is not (see link.ts, and
 * library/remake).
 */
export interface Made {
  /** The published edition it began as. None, where it is a whole sweater planned from the cast-on, which begins as nothing. */
  from?: string;
  steps: Step[];
}

/** One thing done to a project's knitting to make it its own. */
export type Step =
  /** The rest planned for a tension from after a round, one of the design's ways (see library/fit): the whole, from the cast-on, with no round. */
  | { fit: Tension; round?: number; option?: string }
  /** The knitter's rounds to the end of one, then a published edition's from the same round in it: see editions/difference. */
  | { join: string; round: number };

const measures: (keyof Measurements)[] = ["chestCm", "neckCm", "yokeDepthCm", "bodyLengthCm", "upperArmCm", "sleeveLengthCm", "cuffCm"];

/** Whether something read back is a placement: a place from 0 to 1 for each band, and bands for each trim. */
const isPlacement = (value: unknown): value is Placement => {
  const placement = value as Partial<Placement> | null;
  return typeof placement === "object" && placement !== null && typeof placement.places === "object" && placement.places !== null &&
    Object.values(placement.places).every((place) => typeof place === "number" && place >= 0 && place <= 1) &&
    (placement.trims === undefined || (typeof placement.trims === "object" && placement.trims !== null &&
      Object.values(placement.trims).every((bands) => Array.isArray(bands) && bands.every((band) => typeof band === "string"))));
};

/** Whether something read back is a fit. */
export const isFit = (value: unknown): value is ProjectFit => {
  const fit = value as Partial<ProjectFit> | null;
  return typeof fit === "object" && fit !== null && isTension(fit.tension) &&
    typeof fit.finished === "object" && fit.finished !== null && measures.every((key) => Number.isFinite(fit.finished?.[key])) &&
    (fit.round === undefined || (Number.isSafeInteger(fit.round) && fit.round > 0)) &&
    (fit.from === undefined || (typeof fit.from === "string" && /^[0-9a-f]{1,64}$/.test(fit.from))) &&
    (fit.option === undefined || (typeof fit.option === "string" && fit.option.length <= 40)) &&
    (fit.placement === undefined || isPlacement(fit.placement)) &&
    (fit.before === undefined || isBefore(fit.before));
};

/** Whether something read back is what a fit left. What it left has itself nothing to go back to. */
const isBefore = (value: unknown): value is Before => {
  const before = value as Partial<Before> | null;
  return typeof before === "object" && before !== null && isEditionName(before.edition) &&
    (before.fit === undefined || (isFit(before.fit) && before.fit.from === undefined && before.fit.before === undefined)) &&
    (before.made === undefined || isMade(before.made)) &&
    (before.upTo === undefined || isEditionName(before.upTo));
};

const isEditionName = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{1,64}$/.test(value);
const isRound = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

/** Whether something read back is how a knitting was made. */
export const isMade = (value: unknown): value is Made => {
  const made = value as Partial<Made> | null;
  return typeof made === "object" && made !== null && (made.from === undefined || isEditionName(made.from)) &&
    Array.isArray(made.steps) && made.steps.length > 0 && made.steps.length <= 40 &&
    made.steps.every((step: Partial<{ fit: unknown; join: unknown; round: unknown; option: unknown }> | null) =>
      typeof step === "object" && step !== null &&
      ("fit" in step
        ? isTension(step.fit) && (step.round === undefined || isRound(step.round)) && (step.option === undefined || (typeof step.option === "string" && step.option.length <= 40))
        : isEditionName(step.join) && isRound(step.round)));
};

/**
 * How a project's knitting was made, as far as is known. A project fitted
 * before the making was kept says only what its last fit was: taken as the
 * only one, which it nearly always was, and found out where it was not when
 * what is made again is not the knitting it names (see library/remake).
 */
export const madeOf = (project: Pick<Project, "made" | "fit">): Made | undefined =>
  project.made ??
  (project.fit
    ? {
        ...(project.fit.round !== undefined && project.fit.from ? { from: project.fit.from } : {}),
        steps: [{ fit: project.fit.tension, ...(project.fit.round === undefined ? {} : { round: project.fit.round }), ...(project.fit.option ? { option: project.fit.option } : {}) }],
      }
    : undefined);

/**
 * A project's making with one thing more done.
 *
 * A project that says nothing of how its knitting was made knits a published
 * edition, and its making begins there. (An edition kept on the device is no
 * sign that it is the project's own: one the size has moved on from is kept
 * there too, for the projects still on it - see library/editions.) The one
 * project this is not so of joined an update before the making was kept; a
 * link to it names an edition the site never had, and says so when it is
 * opened: see remake.
 */
export const madeWith = (project: Project, step: Step): Made | undefined => {
  // A whole sweater from the cast-on begins as nothing: whatever was knitted before is no part of it.
  if ("fit" in step && step.round === undefined) return { steps: [step] };
  const before = madeOf(project);
  if (before) return { ...before, steps: [...before.steps, step] };
  const edition = editionOf(project);
  return edition ? { from: edition, steps: [step] } : undefined;
};

/**
 * A project with the rest of its knitting worked out again and taken (see
 * library/fit): `edition` the knitting that came of it, now the project's
 * own, and `upTo` the published edition it was worked out from.
 *
 * What it left is kept to go back to (see fitLeft), so that a knitter who
 * has the rest worked out for another tension, knits none of it, and has it
 * worked out for the tension they had, has the pattern they had: not one
 * planned again, which need not be the same. A published edition is named
 * (`from`); knitting of the project's own is kept with what was said of it
 * (`before`). A fit taken on a fit not knitted into - planned from the same
 * round - takes its place: it leaves what that one left, and is made as that
 * one was, the last step changed.
 */
export const fitTaken = (
  project: Project,
  fitted: { edition: string; tension: Tension; finished: Measurements; round?: number; option?: string; placement?: Placement },
  upTo: string | undefined,
): Project => {
  const { edition, round, option, placement } = fitted;
  const step: Step = { fit: fitted.tension, ...(round === undefined ? {} : { round }), ...(option ? { option } : {}) };
  const was = project.fit;
  // On a fit no round of which is knitted: this one is from the same round.
  const instead = was !== undefined && round !== undefined && was.round === round;
  const steps = madeOf(project)?.steps;
  const last = steps?.[steps.length - 1];
  const made =
    instead && steps && last && "fit" in last && last.round === round
      ? { ...madeOf(project)!, steps: [...steps.slice(0, -1), step] }
      : madeWith(project, step);
  // Knitting of its own, which no published file holds: what a fit before this one came to, with a round of it knitted, or an update joined.
  const own = round !== undefined && !instead && (was !== undefined || project.made !== undefined) && project.edition !== undefined;
  const left: Pick<ProjectFit, "from" | "before"> = instead
    ? { ...(was.from ? { from: was.from } : {}), ...(was.before ? { before: was.before } : {}) }
    : own
      ? { before: { edition: project.edition!, ...(was ? { fit: bare(was) } : {}), ...(project.made ? { made: project.made } : {}), ...(project.upTo ? { upTo: project.upTo } : {}) } }
      : // The published edition it left, through a whole sweater planned from the cast-on before this one.
        was ? (was.from ? { from: was.from } : {}) : project.made ? {} : editionOf(project) ? { from: editionOf(project) } : {};
  const { upTo: _, ...rest } = withMade(project, made);
  void _;
  return {
    ...rest,
    edition,
    fit: { tension: fitted.tension, finished: fitted.finished, ...(round === undefined ? {} : { round }), ...left, ...(option ? { option } : {}), ...(placement ? { placement } : {}) },
    ...(upTo ? { upTo } : {}),
  };
};

/** A fit with nothing to go back to: what a fit left has passed it. */
const bare = (fit: ProjectFit): ProjectFit => {
  const { from, before, ...rest } = fit;
  void from;
  void before;
  return rest;
};

/** What a project's fit left, as far as the project says: the published edition, or the knitting of its own. None, where it has no fit or kept nothing of what it left. */
export const fitLeaves = (project: Pick<Project, "fit">): { edition: string; own: boolean; tension?: Tension } | undefined =>
  project.fit?.from !== undefined
    ? { edition: project.fit.from, own: false }
    : project.fit?.before
      ? { edition: project.fit.before.edition, own: true, ...(project.fit.before.fit ? { tension: project.fit.before.fit.tension } : {}) }
      : undefined;

/**
 * A project gone back from its fit to what the fit left, exactly as it was:
 * a published edition, with nothing of its own to say how it was made; or
 * the knitting of its own it had, with its fit and its making. Unchanged,
 * where it has nothing to go back to.
 */
export const fitLeft = (project: Project): Project => {
  const { fit, upTo, made, ...rest } = project;
  void upTo;
  void made;
  if (fit?.from !== undefined) return { ...rest, edition: fit.from };
  const before = fit?.before;
  if (!before) return project;
  return { ...rest, edition: before.edition, ...(before.fit ? { fit: before.fit } : {}), ...(before.made ? { made: before.made } : {}), ...(before.upTo ? { upTo: before.upTo } : {}) };
};

/** A project whose knitting has passed the round its fit was planned from: what the fit left can't be gone back to, and is no longer kept. */
export const fitKnittedInto = (project: Project): Project => {
  if (!project.fit?.before) return project;
  const { before, ...fit } = project.fit;
  void before;
  return { ...project, fit };
};

/** A project with its making set, or with none. */
export const withMade = (project: Project, made: Made | undefined): Project => {
  const { made: was, ...rest } = project;
  void was;
  return made ? { ...rest, made } : rest;
};

/** Whether something read back is wool of a knitter's own, for yarns a design has: each a wool, a name, a shade number and a colour, or some of them. */
export const isShadesOf = (slots: readonly string[], value: unknown): value is Overrides =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.entries(value as Record<string, unknown>).every(([slot, shade]) =>
    slots.includes(slot) && typeof shade === "object" && shade !== null &&
    Object.keys(shade).every((key) => ["wool", "name", "code", "hex"].includes(key)) &&
    Object.values(shade).every((said) => typeof said === "string" && said.length <= 200) &&
    ((shade as { hex?: string }).hex === undefined || /^#[0-9a-f]{6}$/i.test((shade as { hex: string }).hex)));

/** Whether something read back is a tension: two sensible numbers. */
export const isTension = (value: unknown): value is Tension => {
  const tension = value as Partial<Tension> | null;
  const sensible = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 2 && n <= 200;
  return typeof tension === "object" && tension !== null && sensible(tension.stitchesPer10cm) && sensible(tension.roundsPer10cm);
};

const prefix = "project-";
const pending = new Map<string, Project>();
// The exact persisted value when saving first failed; undefined means unreadable.
const pendingBase = new Map<string, string | null | undefined>();
let storageNotice = "";
export const storageChanged = "projectStorageChanged";
export const getStorageNotice = () => storageNotice;
const notice = (message: string) => {
  storageNotice = message;
  queueMicrotask(() => window.dispatchEvent(new Event(storageChanged)));
};
export const retrySaving = () => {
  let recovered = false;
  for (const project of pending.values()) {
    try {
      const raw = localStorage.getItem(project.id);
      const conflict = raw !== pendingBase.get(project.id);
      const saved = conflict ? { ...project, id: `${prefix}${crypto.randomUUID()}`,
        name: `Recovered copy${project.name ? `: ${project.name}` : ""}` } : project;
      localStorage.setItem(saved.id, JSON.stringify(saved));
      pending.delete(project.id);
      pendingBase.delete(project.id);
      recovered ||= conflict;
    }
    catch { notice("Progress is not being saved. Keep this tab open and export a backup before leaving."); return; }
  }
  notice(recovered ? "Another tab changed this project while saving was unavailable. Your unsaved work was saved as a separate recovered copy in My projects." : "");
  notifyChanged();
};

/** Fired after any write, so open views can re-read. */
export const projectsChanged = "projectsChanged";

/** Marks a link as "open this straight into knitting mode". */
export const knittingParam = "knitting";

/** A project's overview: the sweater, its progress and its wool. */
export const overviewPath = (id: string) => `/project/${bareIdFor(id)}`;

/** A project's chart page, optionally opened straight into knitting. */
export const chartPath = (id: string, knitting = false) =>
  `/project/${bareIdFor(id)}/chart${knitting ? `?${knittingParam}=1` : ""}`;

export const storageKeyFor = (id: string) =>
  id.startsWith(prefix) ? id : `${prefix}${id}`;

export const bareIdFor = (id: string) => id.replace(new RegExp(`^${prefix}`), "");

export const notifyChanged = () =>
  queueMicrotask(() => window.dispatchEvent(new CustomEvent(projectsChanged)));

const isProject = (value: unknown): value is Project => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Project>;
  const validDate = (date: unknown) => date === undefined ||
    (typeof date === "string" && Number.isFinite(Date.parse(date)));
  if (!validDate(candidate.startedAt) || !validDate(candidate.updatedAt) ||
    (candidate.name !== undefined && typeof candidate.name !== "string") ||
    (candidate.trim !== undefined && typeof candidate.trim !== "string") ||
    (candidate.edition !== undefined && typeof candidate.edition !== "string") ||
    (candidate.tension !== undefined && !isTension(candidate.tension)) ||
    (candidate.fit !== undefined && !isFit(candidate.fit)) ||
    (candidate.made !== undefined && !isMade(candidate.made)) ||
    (candidate.upTo !== undefined && typeof candidate.upTo !== "string") ||
    (candidate.version !== undefined && candidate.version !== currentVersion)) return false;
  if (candidate.shades !== undefined) {
    if (!candidate.shades || typeof candidate.shades !== "object" || Array.isArray(candidate.shades)) return false;
    if (Object.values(candidate.shades).some(shade => !shade || typeof shade !== "object" ||
      Object.values(shade).some(v => typeof v !== "string"))) return false;
  }
  return (
    typeof candidate.sweaterId === "string" &&
    typeof candidate.sizeId === "string" &&
    typeof candidate.colourwayId === "string" &&
    typeof candidate.progress === "number" && Number.isSafeInteger(candidate.progress) && candidate.progress >= 0
  );
};

/**
 * Read one project.
 *
 * A single unreadable entry must never take down the page that lists them, so
 * anything that cannot be understood is reported as missing rather than thrown.
 */
export const readProject = (id: string): Project | undefined => {
  if (pending.has(storageKeyFor(id))) return pending.get(storageKeyFor(id));
  try {
    const raw = localStorage.getItem(storageKeyFor(id));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isProject(parsed)) return undefined;
    const savedAt = new Date(Number(bareIdFor(storageKeyFor(id))));
    const stamp = Number.isFinite(savedAt.getTime())
      ? savedAt.toISOString()
      : new Date(0).toISOString();
    return {
      ...parsed,
      version: currentVersion,
      id: storageKeyFor(id),
      startedAt: parsed.startedAt ?? stamp,
      updatedAt: parsed.updatedAt ?? parsed.startedAt ?? stamp,
    };
  } catch {
    return undefined;
  }
};

export const listProjects = (): Project[] => {
  const out = new Map(pending);
  try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const project = readProject(key);
    if (project) out.set(project.id, project);
  }
  } catch { notice("Browser storage is unavailable. Keep this tab open and export a backup before leaving."); }
  return [...out.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const writeProject = (project: Project): Project => {
  const saved = readProject(project.id);
  if (saved && saved.updatedAt !== project.updatedAt) {
    notice("This project changed in another tab. The latest saved version has been loaded; check your position before continuing.");
    return saved;
  }
  const updated = { ...project, version: currentVersion, updatedAt: new Date(Math.max(Date.now(), Date.parse(project.updatedAt) + 1)).toISOString() };
  if (pending.has(updated.id)) {
    pending.set(updated.id, updated);
    retrySaving();
    return readProject(updated.id) ?? updated;
  }
  let base: string | null | undefined;
  try {
    base = localStorage.getItem(updated.id);
    localStorage.setItem(updated.id, JSON.stringify(updated));
    pending.delete(updated.id);
    if (pending.size === 0) notice("");
    notifyChanged();
  } catch {
    pending.set(updated.id, updated);
    pendingBase.set(updated.id, base);
    notice("Progress is not being saved. Keep this tab open and export a backup before leaving.");
  }
  return updated;
};

export const startProject = (
  sweaterId: string,
  sizeId: string,
  colourwayId: string,
  /** Any wool chosen before starting, on the design's own page. */
  shades: Overrides = {},
  /** And any trim. */
  trim?: string,
  /** Knitting of its own to begin on, worked out for its knitter before the cast-on (see library/fit), already kept on the device. */
  own?: Pick<Project, "edition" | "tension" | "fit" | "made" | "upTo">,
): Project => {
  const edition = own?.edition ?? currentEdition(sweaterId, sizeId);
  return writeProject({
    version: currentVersion,
    id: `${prefix}${crypto.randomUUID()}`,
    sweaterId,
    sizeId,
    colourwayId,
    ...(trim ? { trim } : {}),
    shades: Object.keys(shades).length > 0 ? shades : undefined,
    progress: 0,
    ...(edition ? { edition } : {}),
    ...(own?.tension ? { tension: own.tension } : {}),
    ...(own?.fit ? { fit: own.fit } : {}),
    ...(own?.made ? { made: own.made } : {}),
    ...(own?.upTo ? { upTo: own.upTo } : {}),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const deleteProject = (id: string) => {
  try {
    localStorage.removeItem(storageKeyFor(id));
    deleteLog(storageKeyFor(id));
    pending.delete(storageKeyFor(id));
    pendingBase.delete(storageKeyFor(id));
    // And any knitting that was its own.
    dropUnknitted();
    notifyChanged();
  } catch {
    notice("The project could not be deleted from browser storage. Please try again.");
  }
};

/** Keep knitting that is a project's own on the device (see library/editions/own), saying so where there is no room for it. */
export const keepKnitting = (file: EditionFile): boolean => {
  if (keepEdition(file)) return true;
  notice("There is no room on this device to keep the pattern worked out for you. Export a backup, and delete a project you no longer need.");
  return false;
};

/** Drop any knitting kept on the device that no project knits now, and any shape settled for it. */
export const dropUnknitted = () => {
  const projects = listProjects();
  // What a project knits, and what its fit left that it may still go back to.
  dropEditionsBut(projects.flatMap((project) => [project, ...(project.fit?.before ? [{ sweaterId: project.sweaterId, sizeId: project.sizeId, edition: project.fit.before.edition }] : [])]));
  void dropShapesBut(projects.flatMap((project) => (project.edition ? [editionKey(project.sweaterId, project.sizeId, project.edition)] : [])));
};

export const renameProject = (id: string, name: string) => {
  const project = readProject(id);
  if (project) writeProject({ ...project, name: name.trim() || undefined });
};
