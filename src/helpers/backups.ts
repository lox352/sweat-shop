import { sweaterById } from "../data/sweaters";
import { sweaterStitches } from "../knitting/useSweater";
import { currentVersion, listProjects, type Project, writeProject } from "./projects";
import { isLog, readLog, writeLog, type Row } from "../knitting/timing/log";

/** A project as a backup holds it: with its knitting-time log, if it has one. */
export type BackupProject = Project & { timeLog?: Row[] };

/** Room for knitting-time logs, which run to hundreds of KB for a sweater. */
export const maxBackupBytes = 10_000_000;

export const backupText = () => JSON.stringify({ format: "sweat-shop-projects", version: 1,
  exportedAt: new Date().toISOString(), projects: listProjects().map((project): BackupProject => {
    const timeLog = readLog(project.id);
    return timeLog.length > 0 ? { ...project, timeLog } : project;
  }) });

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
      p.progress >= sweaterStitches(sweater, p.sizeId).stitches.length ||
      (p.name !== undefined && (typeof p.name !== "string" || p.name.length > 200)) ||
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
      shades: p.shades, startedAt: p.startedAt, updatedAt: new Date().toISOString(),
      ...(p.timeLog ? { timeLog: p.timeLog } : {}) };
  });
}

/** Restore as copies: never overwrite a knitter's existing work. */
export const restoreBackup = (projects: BackupProject[]) =>
  projects.map(({ timeLog, ...project }) => {
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
