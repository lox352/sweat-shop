import { sweaterById } from "../library/catalogue";
import type { Design } from "../pattern/design";
import { editionOf } from "../library/editions";
import { type EditionFile, decodeEdition } from "../library/editions/format";
import { keepEdition, ownEdition } from "../library/editions/own";
import { knittingToHand } from "../library/knitting";
import { currentVersion, isFit, isTension, listProjects, type Project, writeProject } from "./projects";
import { isLog, readLog, writeLog, type Row } from "./timing/log";

/** A project as a backup holds it: with its knitting-time log, if it has one, and its knitting, where that is its own (see library/editions/own). */
export type BackupProject = Project & { timeLog?: Row[]; knitting?: EditionFile };

/** Whether a backup's knitting is the edition its project says it knits, and reads as one. */
const isOwnKnitting = (p: BackupProject): boolean => {
  const file = p.knitting;
  if (!file || file.design !== p.sweaterId || file.size !== p.sizeId || file.edition !== p.edition) return false;
  try {
    return decodeEdition(file).stitches.length > 0;
  } catch {
    return false;
  }
};

/** Room for knitting-time logs, which run to hundreds of KB for a sweater. */
export const maxBackupBytes = 10_000_000;

export const backupText = () => JSON.stringify({ format: "sweat-shop-projects", version: 1,
  exportedAt: new Date().toISOString(), projects: listProjects().map((project): BackupProject => {
    const timeLog = readLog(project.id);
    const knitting = project.fit && project.edition ? ownEdition(project.sweaterId, project.sizeId, project.edition) : undefined;
    return { ...project, ...(timeLog.length > 0 ? { timeLog } : {}), ...(knitting ? { knitting } : {}) };
  }) });

/**
 * Whether a project's progress is past the end of its knitting - where that
 * can be told. A project knits its own edition (see library/editions),
 * and a pattern is not fetched to find its end: until its knitting is to hand
 * there is nothing to hold its progress against, and a finished sweater must
 * not be refused for it.
 */
const pastTheEnd = (sweater: Design, p: BackupProject): boolean => {
  const knitting = knittingToHand(sweater, p.sizeId, editionOf(p));
  return !!knitting && p.progress >= knitting.stitches.length;
};

export function parseBackup(text: string): BackupProject[] {
  if (text.length > maxBackupBytes) throw new Error("Backup is too large (maximum 10 MB).");
  const data = JSON.parse(text);
  if (data?.format !== "sweat-shop-projects" || data.version !== 1 ||
    !Array.isArray(data.projects) || data.projects.length > 1000) throw new Error("Not a supported Sweat Shop backup.");
  return data.projects.map((p: BackupProject): BackupProject => {
    const sweater = p && sweaterById(p.sweaterId);
    if (!sweater || !sweater.sizes.some(s => s.id === p.sizeId) ||
      !sweater.colourways.some(c => c.id === p.colourwayId) ||
      p.version !== currentVersion || !Number.isSafeInteger(p.progress) || p.progress < 0 ||
      (p.edition !== undefined && (typeof p.edition !== "string" || !/^[0-9a-f]{1,64}$/.test(p.edition))) ||
      (p.tension !== undefined && !isTension(p.tension)) ||
      // A project fitted to its knitter knits knitting of its own, which must come with it.
      (p.fit !== undefined && (!isFit(p.fit) || !isOwnKnitting(p))) ||
      (p.fit === undefined && p.knitting !== undefined) ||
      pastTheEnd(sweater, p) ||
      (p.name !== undefined && (typeof p.name !== "string" || p.name.length > 200)) ||
      (p.trim !== undefined && (typeof p.trim !== "string" || p.trim.length > 200)) ||
      typeof p.startedAt !== "string" || !Number.isFinite(Date.parse(p.startedAt))) {
      throw new Error("A project contains an unknown pattern, size, colourway or invalid progress.");
    }
    if (p.shades !== undefined) {
      if (!p.shades || typeof p.shades !== "object" || Array.isArray(p.shades)) throw new Error("Invalid yarn choices.");
      for (const [slot, shade] of Object.entries(p.shades)) {
        if (!sweater.slots.some(known => known === slot) || !shade || typeof shade !== "object" ||
          Object.keys(shade).some(k => !["wool", "name", "code", "hex"].includes(k)) ||
          Object.values(shade).some(v => typeof v !== "string" || v.length > 200) ||
          (shade.hex !== undefined && !/^#[0-9a-f]{6}$/i.test(shade.hex))) throw new Error("Invalid yarn choices.");
      }
    }
    if (p.timeLog !== undefined && !isLog(p.timeLog)) throw new Error("Invalid knitting times.");
    return { version: currentVersion, id: `project-${crypto.randomUUID()}`, name: p.name,
      sweaterId: p.sweaterId, sizeId: p.sizeId, colourwayId: p.colourwayId, progress: p.progress,
      ...(p.trim ? { trim: p.trim } : {}),
      // The edition of the knitting it knits, kept so a restored project knits what it did: see library/editions.
      ...(p.edition ? { edition: p.edition } : {}),
      ...(p.tension ? { tension: { stitchesPer10cm: p.tension.stitchesPer10cm, roundsPer10cm: p.tension.roundsPer10cm } } : {}),
      ...(p.fit ? { fit: p.fit, knitting: p.knitting } : {}),
      shades: p.shades, startedAt: p.startedAt, updatedAt: new Date().toISOString(),
      ...(p.timeLog ? { timeLog: p.timeLog } : {}) };
  });
}

/** Restore as copies: never overwrite a knitter's existing work. */
export const restoreBackup = (projects: BackupProject[]) =>
  projects.map(({ timeLog, knitting, ...project }) => {
    if (knitting && !keepEdition(knitting)) throw new Error("There is no room on this device for a project's own pattern.");
    const saved = writeProject(project);
    if (timeLog) writeLog(saved.id, timeLog);
    return saved;
  });

export function downloadBackup() {
  const url = URL.createObjectURL(new Blob([backupText()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sweat-shop-projects-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
