import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Stitch } from "../../types/Stitch";
import { useSettings } from "../../helpers/settings";
import { actionsOf, isLog, logChanged, logKeyFor, recordPageEvent } from "./log";
import { summarise, type TimeSummary } from "./model";
import { detail, type TimeDetail } from "./detail";

const subscribe = (notify: () => void) => {
  window.addEventListener(logChanged, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(logChanged, notify);
    window.removeEventListener("storage", notify);
  };
};

const rawLog = (projectId: string) => {
  try {
    return localStorage.getItem(logKeyFor(projectId)) ?? "";
  } catch {
    return "";
  }
};

/**
 * How long a project has taken and has left, kept up to date as its log
 * grows; undefined while there is nothing to say, or the knitter has asked
 * for no statistics.
 */
export const useKnittingTime = (
  projectId: string,
  stitches: Stitch[],
  progress: number,
): TimeSummary | undefined => {
  const { noStatistics } = useSettings();
  const raw = useSyncExternalStore(subscribe, () => rawLog(projectId), () => "");
  return useMemo(() => {
    if (noStatistics || !raw) return undefined;
    let rows: unknown;
    try {
      rows = JSON.parse(raw);
    } catch {
      return undefined;
    }
    if (!isLog(rows)) return undefined;
    const summary = summarise(actionsOf(rows), stitches, progress);
    return summary && summary.knitted >= 60 ? summary : undefined;
  }, [noStatistics, raw, stitches, progress]);
};

/**
 * The finer grain of a project's time, for Explore statistics: undefined
 * without a project (so nothing is worked out until it is wanted), without a
 * log, or when the knitter has asked for no statistics.
 */
export const useTimeDetail = (
  projectId: string | undefined,
  stitches: Stitch[],
  rounds: number[][],
): TimeDetail | undefined => {
  const { noStatistics } = useSettings();
  const raw = useSyncExternalStore(subscribe, () => (projectId ? rawLog(projectId) : ""), () => "");
  return useMemo(() => {
    if (noStatistics || !raw) return undefined;
    let rows: unknown;
    try {
      rows = JSON.parse(raw);
    } catch {
      return undefined;
    }
    if (!isLog(rows)) return undefined;
    const actions = actionsOf(rows);
    return actions.length > 0 ? detail(actions, stitches, rounds) : undefined;
  }, [noStatistics, raw, stitches, rounds]);
};

// Where the site was first opened, to tell a page loaded straight into
// knitting from knitting opened by its button.
const landedAt = typeof window === "undefined" ? "" : window.location.hash;
let projectPagesOpened = 0;
/** A close on leaving the page, held back a moment in case the page is only being remounted. */
const leaving = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Writes the page's own comings and goings into the log while knitting:
 * knitting opened (by its button, or by loading the page straight into it)
 * and closed (with the X, or by leaving the page), and the page going out of
 * sight and coming back - a locked phone, another app or tab, or the browser
 * closed.
 */
export const useTimeRecording = (projectId: string | undefined, knitting: boolean) => {
  const recorded = useRef<{ projectId: string; knitting: boolean }>();
  const knittingNow = useRef(knitting);
  knittingNow.current = knitting;

  useEffect(() => {
    if (!projectId) return;
    const last = recorded.current;
    recorded.current = { projectId, knitting };
    if (last?.projectId === projectId) {
      if (last.knitting !== knitting) recordPageEvent(projectId, knitting ? "enter" : "exit");
      return;
    }
    const landed = projectPagesOpened++ === 0 && window.location.hash === landedAt;
    if (knitting) recordPageEvent(projectId, landed ? "load" : "enter");
  }, [projectId, knitting]);

  // Leaving the page while knitting closes it too.
  useEffect(() => {
    if (!projectId) return;
    clearTimeout(leaving.get(projectId));
    leaving.delete(projectId);
    return () => {
      if (!knittingNow.current) return;
      leaving.set(
        projectId,
        setTimeout(() => {
          leaving.delete(projectId);
          recordPageEvent(projectId, "exit");
        }, 0),
      );
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !knitting) return;
    let hidden = document.visibilityState === "hidden";
    const set = (now: boolean) => {
      if (now === hidden) return;
      hidden = now;
      recordPageEvent(projectId, now ? "hide" : "show");
    };
    const onVisibility = () => set(document.visibilityState === "hidden");
    const onPageHide = () => set(true);
    const onPageShow = () => set(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [projectId, knitting]);
};
