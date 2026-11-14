import type { TimeSummary } from "./model";

/** "5 h 18 min", "38 min", "under a minute". */
export const duration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** "8–11 h", or one figure where the range is too narrow to matter: time left. */
export const range = ({ low, mid, high }: { low: number; mid: number; high: number }): string => {
  const lo = Math.round(low / 3600);
  const hi = Math.round(high / 3600);
  return hi >= 2 && lo !== hi ? `${lo}–${hi} h` : duration(mid);
};

/** "5 h 18 min knitted · about 8–9 h to go", or "Knitted in 15 h 23 min". */
export const timeLine = (time: TimeSummary, finished: boolean) =>
  finished
    ? `Knitted in ${duration(time.knitted)}`
    : `${duration(time.knitted)} knitted${time.left ? ` · about ${range(time.left)} to go` : ""}`;
