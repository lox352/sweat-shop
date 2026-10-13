import { Overrides } from "../knitting/palette";
import { deleteLog } from "../knitting/timing/log";

/**
 * A project is a sweater you are knitting.
 *
 * It is tiny, and deliberately so. The stitches are a pure function of the
 * design and the size, and the colours a pure function of the colourway, so
 * none of that is worth storing: an id, a couple of choices and how far you
 * have got is the whole of it. That also means a project saved today still
 * opens after a chart is corrected, because it never held a copy of one.
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
  shades?: Overrides;
  /** Id of the last stitch worked. 0 means nothing knitted yet. */
  progress: number;
  startedAt: string;
  updatedAt: string;
}

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
 * Read one project, migrating it forward if it was written by an older build.
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
): Project =>
  writeProject({
    version: currentVersion,
    id: `${prefix}${crypto.randomUUID()}`,
    sweaterId,
    sizeId,
    colourwayId,
    shades: Object.keys(shades).length > 0 ? shades : undefined,
    progress: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

export const deleteProject = (id: string) => {
  try {
    localStorage.removeItem(storageKeyFor(id));
    deleteLog(storageKeyFor(id));
    pending.delete(storageKeyFor(id));
    pendingBase.delete(storageKeyFor(id));
    notifyChanged();
  } catch {
    notice("The project could not be deleted from browser storage. Please try again.");
  }
};

export const renameProject = (id: string, name: string) => {
  const project = readProject(id);
  if (project) writeProject({ ...project, name: name.trim() || undefined });
};
