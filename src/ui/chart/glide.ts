/**
 * The chart's box scrolled to a place over a few frames by the page itself,
 * rather than by the browser's smooth scroll.
 *
 * A browser's smooth scroll goes its own way once set going. While the
 * chart is following the knitting, columns open to the left of the box as
 * it goes, and the sheet grows under it: a browser animates the scroll in
 * its own terms, from the sheet's far edge, and is carried past the stitch
 * by however much opened, then sent back; and asked again on the way, as
 * the chart must to keep it going to the right place, Safari begins its
 * easing afresh from a standstill each time, so the box moves in fits and
 * starts, and the chart shakes from side to side until it settles. Here the
 * scroll is written every frame, from where the box is going as it is now,
 * so nothing else decides where it is.
 *
 * Each axis goes on a cubic - Hermite's, as the tiles' lines do - from
 * where it is and as fast as it is going to its goal, coming to rest there.
 * Sent somewhere else on the way, it goes on from where it has got to, as
 * fast as it was going, with no jolt. Any scroll of the knitter's own - a
 * finger, a wheel, a key - stops it at once where it is.
 */

/** How long a glide takes, in milliseconds: longer the further it goes, within bounds. */
export const glideTime = (distance: number) => Math.min(550, Math.max(250, 200 + Math.sqrt(distance) * 8));
/** And never less than this, sent somewhere else on the way. */
const least = 120;
/** Further than this many of the box's widths away, or heights, a glide goes most of the way at once: see setOff. */
export const farOff = 1.5;

/**
 * Where a glide from `at` to `goal` sets off from, each way, in a box
 * `size` across that way: from where it is, or, going further than a box
 * and a half, from a box short of the goal, put there at once. The end of
 * a round is the far side of the chart from the next round's beginning,
 * and gliding there swept the whole chart past - every frame of it a strip
 * not seen before, to paint: across a yoke, frames of up to a tenth of a
 * second on a slow phone, for a blur no one could read on its way. So it
 * goes there and glides in the last box's width: the chart is seen going
 * the way it went, and the stitch is there sooner.
 */
export const setOff = (at: number, goal: number, size: number): number => {
  if (!(size > 0) || Math.abs(goal - at) <= size * farOff) return at;
  return goal - Math.sign(goal - at) * size;
};

export interface Point {
  left: number;
  top: number;
}

/** Where a cubic from `from`, going at `speed` a millisecond, to rest at `to` over `time`, is `t` in: and how fast. */
export const hermite = (from: number, speed: number, to: number, time: number, t: number): [number, number] => {
  const s = Math.min(1, Math.max(0, t / time));
  const s2 = s * s;
  const s3 = s2 * s;
  const at = (2 * s3 - 3 * s2 + 1) * from + (s3 - 2 * s2 + s) * time * speed + (-2 * s3 + 3 * s2) * to;
  const going = ((6 * s2 - 6 * s) / time) * from + (3 * s2 - 4 * s + 1) * speed + ((6 * s - 6 * s2) / time) * to;
  return [at, s >= 1 ? 0 : going];
};

/** What input from the knitter takes the scroll over. */
const theirs = ["touchstart", "wheel", "pointerdown", "keydown"] as const;

export class Glide {
  private from: Point = { left: 0, top: 0 };
  private speed: Point = { left: 0, top: 0 };
  private goal: Point = { left: 0, top: 0 };
  private start = 0;
  private time = 0;
  private frame = 0;
  /** How many frames running the box has been held at an edge short of where it was sent, and how much room it had. */
  private held = 0;
  private room = "";
  /**
   * Whether it waits a frame before it goes: setting off from afar (see
   * setOff), what it goes to is all to be painted, a frame's work and more
   * on a slow phone. Whatever else the tap that sent it changed - the
   * knitting panel's next instruction - is shown first, so the tap is seen
   * to have been taken at once, and the box goes in the frame after.
   */
  private waiting = false;
  /** And that its time is to be counted from the frame it goes in, there at once. */
  private restart = false;

  /** `onFrame` is told after each frame's scroll is written, to bring what is drawn up to it in the same frame. */
  constructor(
    private readonly box: HTMLElement,
    private readonly onFrame?: () => void,
  ) {
    for (const event of theirs) box.addEventListener(event, this.stop, { passive: true });
  }

  get going(): boolean {
    return this.frame !== 0;
  }

  /** Where the box is on its way, and how fast it is going, at `now`. */
  private state(now: number): { at: Point; speed: Point } {
    const t = now - this.start;
    const [left, speedLeft] = hermite(this.from.left, this.speed.left, this.goal.left, this.time, t);
    const [top, speedTop] = hermite(this.from.top, this.speed.top, this.goal.top, this.time, t);
    return { at: { left, top }, speed: { left: speedLeft, top: speedTop } };
  }

  /** Glide to `goal`: from where the box is, or, on the way already, from where it has got to and as fast as it was going. */
  to(goal: Point, now = performance.now()) {
    if (this.going) {
      const { at, speed } = this.state(now);
      const left = this.time - (now - this.start);
      this.from = at;
      this.speed = speed;
      this.time = Math.max(least, left);
    } else {
      // Put there by the first frame, along with what is drawn for it: see step.
      this.from = {
        left: setOff(this.box.scrollLeft, goal.left, this.box.clientWidth),
        top: setOff(this.box.scrollTop, goal.top, this.box.clientHeight),
      };
      this.speed = { left: 0, top: 0 };
      this.time = glideTime(Math.hypot(goal.left - this.from.left, goal.top - this.from.top));
      this.waiting = this.from.left !== this.box.scrollLeft || this.from.top !== this.box.scrollTop;
    }
    this.goal = { ...goal };
    this.start = now;
    this.held = 0;
    this.room = "";
    // Said on the box while it glides: for the scroll harness, and anything else that would know.
    this.box.dataset.gliding = "";
    if (!this.frame) this.frame = requestAnimationFrame(this.step);
  }

  private readonly step = (now: number) => {
    if (this.waiting) {
      this.waiting = false;
      this.restart = true;
      this.frame = requestAnimationFrame(this.step);
      return;
    }
    if (this.restart) {
      this.restart = false;
      this.start = now;
    }
    const done = now - this.start >= this.time;
    const { at } = done ? { at: this.goal } : this.state(now);
    this.frame = done ? 0 : requestAnimationFrame(this.step);
    const was = { left: this.box.scrollLeft, top: this.box.scrollTop };
    const room = `${this.box.scrollWidth}|${this.box.scrollHeight}`;
    this.box.scrollLeft = at.left;
    this.box.scrollTop = at.top;
    /*
     * Sent past where the box can scroll - a stitch at the chart's edge, the
     * middle of the box beyond it - the browser holds it at the edge, and
     * the box goes nowhere. A browser's smooth scroll stops there; so does
     * this, held a few frames with no more room made for it, or it would go
     * on counting as moving while nothing moved, and the chart never come
     * to rest. Room made - the sheet growing to take a stitch the box is
     * sent to - and it goes on.
     */
    const still = this.box.scrollLeft === was.left && this.box.scrollTop === was.top;
    const short = Math.abs(this.box.scrollLeft - at.left) > 0.5 || Math.abs(this.box.scrollTop - at.top) > 0.5;
    this.held = still && short && room === this.room ? this.held + 1 : 0;
    this.room = room;
    if (done || this.held >= 3) this.stop();
    this.onFrame?.();
  };

  /**
   * The whole way moved on by `by`: the box's scroll moved under it by as
   * much with nothing on screen moving (see TileView.absorb), it goes on
   * from there just as it was going.
   */
  shift(by: Point) {
    this.from = { left: this.from.left + by.left, top: this.from.top + by.top };
    this.goal = { left: this.goal.left + by.left, top: this.goal.top + by.top };
  }

  /** Stop where it is. */
  readonly stop = () => {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.waiting = false;
    this.restart = false;
    delete this.box.dataset.gliding;
  };

  destroy() {
    this.stop();
    for (const event of theirs) this.box.removeEventListener(event, this.stop);
  }
}
