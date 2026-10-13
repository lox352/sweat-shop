/**
 * The knitting-time log: every change of progress, and the page's own
 * comings and goings, appended as they happen and never rewritten.
 *
 * Kept beside a project rather than in it, under its own key, so that a
 * write here never touches the project itself (its "last changed", or the
 * checks that stop two tabs overwriting each other's progress).
 *
 * Each row is small, and relative to the one before:
 *
 *   [seconds since the last row, change in progress]            a tap
 *   [seconds since the last row, change in progress, 1]         an undo
 *   [seconds since the last row, change in progress, 2]         progress that changed
 *                                                               while nothing was
 *                                                               recording: not timed
 *   [seconds since the last row, 0, 10 + event]                 the page: knitting
 *                                                               opened, closed with the
 *                                                               X, loaded, hidden, shown
 *
 * The first row's seconds are since 1970. The page's events aren't read yet;
 * they are kept so that a later reading can use them (the explore branch
 * found them worth most for knitters who only tap at the end of a round).
 */
import { readSettings } from "../../helpers/settings";

export const pageEvents = ["enter", "exit", "load", "hide", "show"] as const;
export type PageEvent = (typeof pageEvents)[number];

export type Row = number[];

/** A change of progress, as read back from the log. */
export interface Action {
  /** When, in ms since 1970, by the device's clock. */
  t: number;
  from: number;
  to: number;
  undo?: boolean;
  /** Changed while nothing was recording: where it got to, but not when. */
  untimed?: boolean;
}

const prefix = "time-";
/**
 * More than enough for the largest sweater tapped stitch by stitch - about a
 * hundred and twenty-five thousand - at a few bytes a row; past it, the log
 * stops growing.
 */
export const maxRows = 150_000;
export const logChanged = "timeLogChanged";

/** Beside the project's own key: "time-" and its id, without "project-". */
export const logKeyFor = (projectId: string) => `${prefix}${projectId.replace(/^project-/, "")}`;

/** Well formed: rows of two or three whole numbers, flags and events known. */
export const isLog = (value: unknown): value is Row[] =>
  Array.isArray(value) &&
  value.length <= maxRows &&
  value.every(
    (row) =>
      Array.isArray(row) &&
      (row.length === 2 || row.length === 3) &&
      row.every((n) => Number.isSafeInteger(n)) &&
      (row.length === 2 || [1, 2].includes(row[2]) || (row[1] === 0 && row[2] >= 10 && row[2] < 10 + pageEvents.length)),
  );

export const readLog = (projectId: string): Row[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(logKeyFor(projectId)) ?? "[]");
    return isLog(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeLog = (projectId: string, rows: Row[]) => {
  try {
    localStorage.setItem(logKeyFor(projectId), JSON.stringify(rows));
  } catch {
    // Storage full or unavailable: the time just isn't recorded.
  }
  queueMicrotask(() => window.dispatchEvent(new Event(logChanged)));
};

export const deleteLog = (projectId: string) => {
  try {
    localStorage.removeItem(logKeyFor(projectId));
  } catch {
    // Nothing more can be done about it.
  }
};

/** Where the log's clock and progress had got to after its last row. */
const tail = (rows: Row[]) => {
  let seconds = 0;
  let progress = 0;
  for (const [ds, dp] of rows) {
    seconds += ds;
    progress += dp;
  }
  return { seconds, progress };
};

/** Add rows, given where the log had got to and the seconds since its last row. */
const append = (projectId: string, build: (lastProgress: number, since: number) => Row[]) => {
  if (readSettings().noStatistics) return;
  const rows = readLog(projectId);
  if (rows.length >= maxRows) return;
  const last = tail(rows);
  const now = Math.round(Date.now() / 1000);
  writeLog(projectId, [...rows, ...build(last.progress, now - last.seconds)].slice(0, maxRows));
};

/** Progress changed from `from` to `to`, by a tap, a jump on the chart or an undo. */
export const recordProgress = (projectId: string, from: number, to: number, undo = false) => {
  if (from === to) return;
  append(projectId, (lastProgress, since) => {
    const rows: Row[] = [];
    // Progress moved while nothing recorded it: another device, a restore, or recording off.
    if (lastProgress !== from) rows.push([since, from - lastProgress, 2]);
    rows.push([rows.length ? 0 : since, to - from, ...(undo ? [1] : [])]);
    return rows;
  });
};

/** Something happened to the page while knitting. */
export const recordPageEvent = (projectId: string, event: PageEvent) => {
  append(projectId, (_, since) => [[since, 0, 10 + pageEvents.indexOf(event)]]);
};

/** The changes of progress in a log, in order. */
export const actionsOf = (rows: Row[]): Action[] => {
  const actions: Action[] = [];
  let seconds = 0;
  let progress = 0;
  for (const [ds, dp, flag] of rows) {
    seconds += ds;
    if (flag !== undefined && flag >= 10) continue;
    const from = progress;
    progress += dp;
    actions.push({
      t: seconds * 1000,
      from,
      to: progress,
      ...(flag === 1 ? { undo: true } : {}),
      ...(flag === 2 ? { untimed: true } : {}),
    });
  }
  return actions;
};
