/**
 * How pace is coloured and said: against the knitter's own usual, in seven
 * steps from much quicker (blue) through about usual (a warm grey) to much
 * slower (red).
 */
export const paceColours = ["#256abf", "#6da7ec", "#b7d3f6", "#ebe7e1", "#f3b7b6", "#e66767", "#c53d3c"];
const cuts = [0.75, 0.87, 0.95, 1.05, 1.15, 1.33];
/** Which of the seven, for a pace this many times the usual. */
export const paceStep = (ratio: number) => cuts.filter((c) => ratio > c).length;
export const usualStep = 3;
export const paceWords = ["much quicker", "quicker", "a little quicker", "about usual", "a little slower", "slower", "much slower"];

/** One sitting from the next: muted, and different enough side by side. */
export const sittingColours = ["#c9b27c", "#7f9c8b", "#b98474", "#8d8fb3", "#a7a15c", "#6f8fa6"];

/** "2.4 s", "40 s". */
export const seconds = (s: number) => (s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`);

/** "Tue 22 Sep", in the device's own way. */
export const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
export const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
