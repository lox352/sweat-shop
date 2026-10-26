import { Stitch } from "../types/Stitch";
import { StitchType, boundOff, consumption, makesTwo } from "../types/StitchType";

/**
 * The knitting, as a knitter has it: the stitches on the needles.
 *
 * The hat site's Knitter only ever knew "the round below", because a hat is
 * one tube and every round of it is worked into the last. A top-down sweater
 * is not. At the underarms it puts the sleeve stitches aside on waste yarn,
 * casts on new stitches in their place and carries on round the body alone;
 * much later each sleeve takes its held stitches back up and picks up more
 * out of those underarm cast-ons. None of that is a round worked into a
 * round, and all of it is what a knitter actually does with the stitches in
 * their hands.
 *
 * So this keeps exactly that: `live`, the ring of stitches on the needles in
 * order from the beginning of the round, and the holders the rest are waiting
 * on. Working a stitch takes as many off the ring as it consumes and puts the
 * one it makes onto the next ring; holding moves some to waste yarn; casting
 * on adds some from nothing. A hat is the special case in which the ring is
 * always the round just worked.
 *
 * Every stitch links to the stitches it works, then to the stitch before it,
 * which the yarn runs on from - except where the yarn starts, at the cast-on
 * and at a piece begun with new yarn. A picked-up stitch also records the
 * edge stitch it came out of. Those links are the whole of the topology: the
 * chart is laid out from them, and the physics is built from them.
 *
 * Positions are not made here. The knitting is the same knitting however it
 * is posed, so that is physics/pose.ts's business.
 */
/** A round, or a short row worked from one side or the other. */
export type RoundKind = "round" | "right" | "wrong";

/**
 * And among the rounds from the seam, as the physics counts them, one can be
 * part of the way round: the last of a piece whose beginning of the round
 * was moved off its seam, which ends at the beginning and not at the seam.
 */
export type SeamKind = RoundKind | "part";

/** What the marker the rounds begin at is called until a pattern places another. */
export const beginning = "the beginning of the round";

/**
 * Stitches put on hold: a run of the round they were held from, in order,
 * waiting on waste yarn under a holder's name - the step that put them there,
 * and the step that takes them up again, once there is one. Consecutive held
 * stitches are one region of the knitting, which could be taken up again at
 * any time: what is on hold is decided by those two steps alone.
 */
export interface Held {
  holder: string;
  /** The held stitches, in the order they sit round the needle: one block, however many steps put it on hold. */
  stitches: number[];
  /**
   * Each step that put some of them on hold, and the ones it did. A block is
   * usually held in one; a sleeve can be held a part at a time, with cast-on
   * stitches between the parts, so long as nothing else is worked between
   * them - or as the round begins and as it ends, a block that straddles its
   * beginning.
   */
  parts: { at: number; stitches: number[] }[];
  /**
   * The stitches cast on in their place, where there are any: a sleeve's
   * underarm, which the body knits on from and the sleeve picks up out of
   * when it takes its held stitches up again.
   */
  edge?: number[];
  heldAt: number;
  resumedAt?: number;
}

export default class Needles {
  readonly stitches: Stitch[] = [];
  /** Stitch ids in each round, in the order they are worked. */
  readonly rounds: number[][] = [];
  readonly labels: string[] = [];
  /** The piece each round belongs to. */
  readonly roundPieces: string[] = [];
  /**
   * Whether each "round" is one, or a short row: part of the way round,
   * knitted on the right side or purled back on the wrong.
   */
  readonly roundKinds: RoundKind[] = [];
  /** Every run of stitches put on hold, in the order they were held. */
  readonly holds: Held[] = [];
  /**
   * The rounds again as the physics stands on them: worked from each piece's
   * seam, where its first round began, rather than from wherever the pattern
   * has its beginning of the round - see physics/knitting. While the
   * beginning is at the seam, these are the rounds; once it has moved, each
   * round runs on past the seam and these are cut there instead.
   */
  readonly objective: { rounds: number[][]; kinds: SeamKind[]; pieces: string[] } = {
    rounds: [],
    kinds: [],
    pieces: [],
  };

  /** The stitches on the needles, from the beginning of the round. */
  private live: number[] = [];
  private readonly holders = new Map<string, number[]>();
  /** Where on the round in progress each holder's block was taken from, to know whether more held under it is the same block: see hold. */
  private readonly holding = new Map<string, { round: number; from: number; to: number }>();
  /** How many rounds have been begun: which round in progress a holding was in. */
  private roundsBegun = 0;
  /** Stitches cast on in place of held ones, by holder: a sleeve's underarm. */
  private readonly edges = new Map<string, number[]>();

  private piece = "";
  /** The stitch the yarn runs on from, or undefined where new yarn starts. */
  private yarn: number | undefined;

  /**
   * Where the rounds begin: a place on the ring, counted from its seam - the
   * place the piece's first round began. Nought, the seam itself, until a
   * pattern places a new beginning; see placeMarker.
   */
  private start = 0;
  /** A new beginning placed in the round in progress, from the next round on: after how many of its stitches. */
  private beginsAt?: number;
  /** Where the ring's next rounds begin once the stitches up to a new beginning are knitted on to it: see walk. */
  private walkTo?: number;
  /** The marker the rounds begin at, and the one placed to be their new beginning. */
  private beginningMarker = beginning;
  private newBeginning?: string;
  /** The markers on the needles, by what they mark. */
  private readonly markers = new Set<string>([beginning]);
  /**
   * The round from the seam the work is in: the stitches made since it last
   * came round past the seam, and the piece they are of.
   */
  private course: number[] = [];
  private coursePiece = "";
  /** The round in progress has taken the stitch at the seam, so the next stitch made begins a round from the seam. */
  private crossed = false;
  /** How many stitches the round in progress had put on the next ring when it came round past the seam. */
  private seamAt?: number;

  /* The round in progress. */
  private working = false;
  private made: number[] = [];
  private next: number[] = [];
  private cursor = 0;
  private label = "";
  private width = 2;
  private rise = 1.6;

  /** How many stitches are on the needles. */
  get count(): number {
    return this.live.length;
  }

  /** How many are left to work in the round in progress. */
  get remaining(): number {
    return this.end - this.cursor;
  }

  /** Where the round in progress ends: where it began, all the way round, or a new beginning walked to. */
  private get end(): number {
    if (this.walkTo === undefined) return this.start + this.live.length;
    return this.start + ((this.walkTo - this.start + this.live.length) % this.live.length);
  }

  /** The stitches waiting on a holder, by name. */
  held(name: string): number[] | undefined {
    return this.holders.get(name);
  }

  private get lastId(): number {
    return this.stitches.length - 1;
  }

  private push(stitch: Omit<Stitch, "id">): Stitch {
    const made = { id: this.stitches.length, ...stitch };
    this.stitches.push(made);
    return made;
  }

  /** Begin a piece: the rounds that follow belong to it. */
  startPiece(piece: string): this {
    if (piece !== this.piece) this.closeCourse("part");
    this.piece = piece;
    return this;
  }

  /**
   * Close the round from the seam the work is in: "round" where it came all
   * the way round to the seam, or "part" where its piece ended at a
   * beginning of the round moved off the seam.
   */
  private closeCourse(kind: SeamKind) {
    if (this.course.length === 0) return;
    this.objective.rounds.push(this.course);
    this.objective.kinds.push(kind);
    this.objective.pieces.push(this.coursePiece);
    this.course = [];
  }

  /** A stitch made in the round in progress, into the round from the seam it falls in. */
  private onCourse(id: number) {
    if (this.crossed) {
      this.closeCourse("round");
      this.crossed = false;
    }
    if (this.course.length === 0) this.coursePiece = this.piece;
    this.course.push(id);
  }

  /**
   * Cast on `count` stitches for the neck.
   *
   * As a ring of `count`, once joined, with one more before them: the
   * phantom stitch 0, which nothing is worked into. It is the extra stitch
   * that joining the round casts on and lifts over, and keeping it as id 0
   * means a project that has knitted nothing has progress 0, and every real
   * stitch is counted from 1.
   */
  castOn(count: number, slot: string, width: number, rise: number, label: string): this {
    if (this.stitches.length > 0) throw new Error("the neck is cast on once, first");
    this.width = width;
    this.rise = rise;
    this.push({ links: [], type: "castOn", slot, piece: this.piece, width, rise });
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const stitch = this.push({
        links: i === 0 ? [] : [this.lastId],
        type: "castOn",
        slot,
        piece: this.piece,
        width,
        rise,
      });
      ids.push(stitch.id);
    }
    this.record(ids, label, "round");
    this.objective.rounds.push([...ids]);
    this.objective.kinds.push("round");
    this.objective.pieces.push(this.piece);
    this.live = ids;
    this.yarn = ids[ids.length - 1];
    return this;
  }

  /**
   * Join the cast-on into a round: a step. The first stitch cast on is
   * lifted over the last, so the last stands beside the first and closes the
   * ring - which is the link the first stitch gets here, to the stitch that
   * is now before it.
   */
  join(): this {
    const first = this.stitches[this.rounds[0]?.[0] ?? -1];
    if (!first) throw new Error("nothing to join: cast on first");
    first.links = [this.rounds[0][this.rounds[0].length - 1]];
    this.step("join");
    return this;
  }

  /** Change to needles of another size, between rounds: a step. */
  changeNeedles(millimetres: number): this {
    this.step("needles").needles = millimetres;
    return this;
  }

  private step(type: StitchType): Stitch {
    return this.push({
      links: [],
      type,
      slot: this.stitches[this.lastId]?.slot ?? "A",
      piece: this.piece,
      width: this.width,
      rise: this.rise,
    });
  }

  /**
   * Begin a round.
   *
   * `borrow` is how many stitches before the beginning of the round to start
   * working from, which a round opening on a centred double decrease needs:
   * see engine's borrowFor. The ring is walked round and round, so a stitch
   * borrowed off its end is simply the one before its start, and every
   * stitch of it is still worked exactly once.
   */
  startRound(label: string, width: number, rise: number, borrow = 0): this {
    if (this.working) throw new Error(`a round is already in progress: ${this.label}`);
    if (this.walkTo !== undefined) throw new Error(`${label}: knit on to the new beginning of the round first`);
    this.working = true;
    this.roundsBegun++;
    this.made = [];
    this.next = [];
    this.crossed = false;
    this.seamAt = undefined;
    this.beginsAt = undefined;
    // A round begun at the seam begins a round from the seam with its first stitch.
    if (this.start === 0) this.closeCourse("round");
    this.cursor = this.start - borrow;
    this.label = label;
    this.width = width;
    this.rise = rise;
    return this;
  }

  /**
   * The next `n` stitches on the needle, taken off it. Taking the stitch at
   * the seam, in a round begun anywhere else, comes round past it: the next
   * stitch made begins a round from the seam.
   */
  private take(n: number): number[] {
    const out: number[] = [];
    const ring = this.live.length;
    for (let i = 0; i < n; i++) {
      if (ring === 0 || this.cursor >= this.end) {
        throw new Error(`${this.label}: ran out of stitches on the needle`);
      }
      const place = ((this.cursor % ring) + ring) % ring;
      if (place === 0 && this.start !== 0) {
        this.crossed = true;
        this.seamAt = this.next.length;
      }
      out.push(this.live[place]);
      this.cursor++;
    }
    return out;
  }

  /** Work one stitch, or one instruction - a k2tog is one stitch made of two. */
  knit(type: StitchType, slot: string, from?: number): Stitch {
    if (!this.working) throw new Error("start a round before knitting into it");
    // Slipping a stitch and passing the last cast on over it binds that one off.
    if (type === "sl1po") {
      const passed = this.yarn === undefined ? undefined : this.stitches[this.yarn];
      if (passed?.type !== "castOn" || this.next[this.next.length - 1] !== passed.id) {
        throw new Error(`${this.label}: there is no stitch just cast on to pass over`);
      }
      this.next.pop();
    }
    const worked = this.take(consumption[type]);
    const links = [...worked];
    /*
     * A KFB or a KBF makes two loops out of one stitch: the first is stored
     * as itself, the second as the make-one straight after it. That second loop
     * is worked into the same stitch, so it is held by it too, rather than
     * only by its neighbour.
     */
    const previous = this.yarn === undefined ? undefined : this.stitches[this.yarn];
    if (type === "m1" && makesTwo(previous?.type)) links.push(previous!.links[0]);
    if (this.yarn !== undefined) links.push(this.yarn);
    const stitch = this.push({
      links,
      type,
      slot,
      piece: this.piece,
      width: this.width,
      rise: this.rise,
      ...(from === undefined ? {} : { from }),
    });
    this.made.push(stitch.id);
    this.onCourse(stitch.id);
    // A bound-off stitch is finished: nothing is left on the needle for it.
    if (!boundOff(type)) this.next.push(stitch.id);
    this.yarn = stitch.id;
    return stitch;
  }

  /**
   * Place a stitch marker on the needle here, part way through a round: a
   * step. Placed as the round's new beginning, it is where the rounds begin
   * from the next one on: this round still ends at the old beginning, which
   * comes off there, and the stitches from it to the new one are knitted on
   * as a round of their own - see walk.
   */
  placeMarker(name: string, begins = false): this {
    if (this.markers.has(name)) throw new Error(`there is already a marker for ${name}`);
    if (begins) {
      if (!this.working) throw new Error(`${name}: a new beginning of the round is placed part way through a round`);
      if (this.beginsAt !== undefined) throw new Error(`${name}: this round has a new beginning already`);
      this.beginsAt = this.next.length;
      this.newBeginning = name;
    }
    this.markers.add(name);
    const step = this.step("marker");
    step.marker = name;
    if (begins) step.begins = true;
    return this;
  }

  /** Take a marker off the needle: a step. */
  removeMarker(name: string): this {
    if (!this.markers.delete(name)) throw new Error(`there is no marker for ${name} to take off`);
    const step = this.step("marker");
    step.marker = name;
    step.removed = true;
    return this;
  }

  /**
   * Knit on from the old beginning of the round to the new one placed in the
   * round just ended - "knit to marker" - as a round of its own, short of
   * the whole way round. The rounds after it begin at the new beginning.
   */
  walk(label: string, slot: string, width: number, rise: number): this {
    if (this.walkTo === undefined) throw new Error(`${label}: no new beginning of the round to knit on to`);
    const to = this.walkTo;
    // The old beginning comes off where the walk sets out from it.
    this.removeMarker(this.beginningMarker);
    this.beginningMarker = this.newBeginning!;
    this.newBeginning = undefined;
    this.working = true;
    this.made = [];
    this.next = [];
    this.crossed = false;
    this.seamAt = undefined;
    this.beginsAt = undefined;
    this.label = label;
    this.width = width;
    this.rise = rise;
    if (this.start === 0) this.closeCourse("round");
    this.cursor = this.start;
    while (this.remaining > 0) this.knit("k1", slot);
    this.working = false;
    // The ring as it was, but each stitch walked over now the one knitted into it.
    const ring = this.live.length;
    const live = [...this.live];
    this.next.forEach((id, k) => (live[(this.start + k) % ring] = id));
    this.live = live;
    this.walkTo = undefined;
    this.start = to;
    if (this.made.length > 0) this.record(this.made, this.label, "round");
    return this;
  }

  /**
   * Put the next `count` stitches on hold, part way through a round: a step.
   * They wait on waste yarn under `name` until a piece takes them back up.
   *
   * More may go onto a holder already holding some, to be one block with
   * them, taken up together: the stitches straight after them on the needle,
   * with nothing worked since but stitches cast on, which play no part in
   * it; or, for a block that straddles the beginning of the round, held as
   * the round began, the stitches the round ends with, which come before
   * them round the needle. Any others are not one block with them.
   */
  hold(name: string, count: number, wrap = false): this {
    const from = this.cursor;
    const record = this.holds.find((one) => one.holder === name && one.resumedAt === undefined);
    const before = this.holding.get(name);
    let first = false;
    if (record) {
      const same = before?.round === this.roundsBegun;
      if (same && from === before.to) {
        // Straight after them.
      } else if (same && before.from === this.start && from + count === this.end) {
        first = true;
      } else {
        throw new Error(`${this.label}: the stitches held under ${name} and these are not one block on the needle`);
      }
    } else if (this.holders.has(name)) {
      throw new Error(`there is already a holder called ${name}`);
    }
    const held = this.take(count);
    const step = this.step("hold");
    step.holder = name;
    step.count = count;
    if (wrap) step.wrap = true;
    const part = { at: step.id, stitches: [...held] };
    if (record) {
      record.stitches = first ? [...held, ...record.stitches] : [...record.stitches, ...held];
      record.parts.push(part);
      this.holders.set(name, record.stitches);
      this.holding.set(name, first ? { ...before!, from } : { ...before!, to: this.cursor });
    } else {
      this.holders.set(name, held);
      this.holding.set(name, { round: this.roundsBegun, from, to: this.cursor });
      this.holds.push({ holder: name, stitches: [...held], parts: [part], heldAt: step.id });
    }
    return this;
  }

  /**
   * Cast on `count` stitches part way through a round - the body's underarm,
   * in the place of a sleeve's held stitches - and remember them as the edge
   * that sleeve will pick up from.
   */
  castOnHere(
    count: number,
    slot: string,
    edge: string,
    passOver = false,
    /** A marker placed part way through them: "CO 3, PM for new beginning of round, CO 3". */
    marker?: { after: number; name: string; begins?: boolean },
  ): this {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      if (marker?.after === i) this.placeMarker(marker.name, marker.begins);
      ids.push(this.knit("castOn", slot).id);
    }
    if (marker && marker.after >= count) this.placeMarker(marker.name, marker.begins);
    // One more, to be passed over the next stitch: no part of the edge left.
    if (passOver) this.knit("castOn", slot);
    // In the order cast on, after any cast on for the same holder already.
    const all = [...(this.edges.get(edge) ?? []), ...ids];
    this.edges.set(edge, all);
    const held = this.holds.find((one) => one.holder === edge && one.resumedAt === undefined);
    if (held) held.edge = all;
    return this;
  }

  /**
   * Take a holder's stitches back onto the needles, to begin a piece with
   * them: a step, which says which needles they go onto where `millimetres`
   * is given. The yarn is new - it is joined at the underarm, not carried
   * on from wherever the last piece ended - so the first stitch made has
   * nothing before it.
   */
  resume(name: string, millimetres?: number): this {
    const held = this.holders.get(name);
    if (!held) throw new Error(`nothing is held under ${name}`);
    if (this.live.length > 0) throw new Error(`${name}: the needles still have stitches on them`);
    this.holders.delete(name);
    this.holding.delete(name);
    this.live = held;
    // A ring of its own, its rounds beginning at its own seam.
    this.start = 0;
    this.yarn = undefined;
    const step = this.step("resume");
    step.holder = name;
    step.count = held.length;
    if (millimetres !== undefined) step.needles = millimetres;
    const record = this.holds.find((one) => one.holder === name && one.resumedAt === undefined);
    if (record) record.resumedAt = step.id;
    return this;
  }

  /** The edge cast on in place of a holder's stitches, in the order cast on. */
  edge(name: string): number[] {
    const edge = this.edges.get(name);
    if (!edge) throw new Error(`no edge was cast on for ${name}`);
    return edge;
  }

  /** Close the round in progress; every stitch on the needle must be worked or held. */
  endRound(): this {
    if (!this.working) return this;
    if (this.cursor !== this.end) {
      throw new Error(
        `${this.label}: works ${this.cursor - this.start} of the ${this.live.length} stitches on the needle`,
      );
    }
    this.working = false;
    const began = this.start;
    let next = this.next;
    let start = 0;
    let beginsAt = this.beginsAt;
    /*
     * The next ring is counted from the seam again: a round begun anywhere
     * else made the stitches from its beginning round to the seam first, and
     * those belong at the end. Its beginning, and any new beginning placed
     * in it, move round with them.
     */
    if (began !== 0) {
      if (this.seamAt === undefined) throw new Error(`${this.label}: never came round past the seam`);
      const at = this.seamAt;
      const length = next.length;
      next = [...next.slice(at), ...next.slice(0, at)];
      start = (length - at) % Math.max(length, 1);
      if (beginsAt !== undefined) beginsAt = (beginsAt - at + length) % length;
    } else {
      // Begun at the seam, it ends there: so does the round from the seam.
      this.closeCourse("round");
    }
    this.live = next;
    this.start = start;
    this.walkTo = beginsAt;
    this.beginsAt = undefined;
    if (this.made.length > 0) this.record(this.made, this.label, "round");
    return this;
  }

  /** A round or short row finished, as the pattern counts it. */
  private record(made: number[], label: string, kind: RoundKind) {
    this.rounds.push(made);
    this.labels.push(label);
    this.roundPieces.push(this.piece);
    this.roundKinds.push(kind);
  }

  /**
   * Work a short row: a stitch into each of the given places on the ring, in
   * the order given - the way the rounds go on the right side, back the other
   * way on the wrong. Each is worked into the stitch at its place, which it
   * then takes the place of, so the ring always holds the newest stitch at
   * every place, whatever row or round made it.
   *
   * A row from the wrong side is purled, and a purl seen from the right side
   * is a knit; that is what is stored. See Stitch.wrongSide. So is its
   * increase: a PFB puts its new stitch on its left as it is purled, as a KFB
   * does, which seen from the right side is on its right - a KBF.
   */
  row(
    label: string,
    width: number,
    rise: number,
    side: "right" | "wrong",
    places: number[],
    slot: string,
    /** What to work at each place, in step with `places`: a knit unless it says an increase. */
    work: ("k1" | "kfb")[] = [],
  ): this {
    if (this.working) throw new Error(`${label}: a round is still in progress`);
    if (this.start !== 0 || this.walkTo !== undefined) {
      throw new Error(`${label}: short rows are worked from a beginning of the round at the seam`);
    }
    // A row is a round from the seam of its own, cut only at its turns.
    this.closeCourse("round");
    const made: number[] = [];
    // A place an increase was worked at holds both its loops, in the order they sit round the needle.
    const replaced = new Map<number, number[]>();
    const make = (type: StitchType, links: number[]): Stitch => {
      const stitch = this.push({
        links: this.yarn === undefined ? links : [...links, this.yarn],
        type,
        slot,
        piece: this.piece,
        width,
        rise,
        ...(side === "wrong" ? { wrongSide: true } : {}),
      });
      this.yarn = stitch.id;
      made.push(stitch.id);
      return stitch;
    };
    places.forEach((place, index) => {
      const worked = this.live[place];
      if (worked === undefined) throw new Error(`${label}: there is no stitch at ${place}`);
      if (replaced.has(place)) throw new Error(`${label}: works the stitch at ${place} twice`);
      if (work[index] === "kfb") {
        const first = make(side === "wrong" ? "kbf" : "kfb", [worked]);
        // Its second loop, worked into the same stitch: see knit.
        const second = make("m1", [worked]);
        // From the wrong side the needle runs the other way round, so the second loop sits before the first.
        replaced.set(place, side === "wrong" ? [second.id, first.id] : [first.id, second.id]);
      } else {
        replaced.set(place, [make("k1", [worked]).id]);
      }
    });
    this.live = this.live.flatMap((id, place) => replaced.get(place) ?? [id]);
    this.width = width;
    this.rise = rise;
    this.record(made, label, side);
    this.objective.rounds.push([...made]);
    this.objective.kinds.push(side);
    this.objective.pieces.push(this.piece);
    return this;
  }

  /**
   * Turn the work at the end of a short row: a step. The stitch just worked
   * is made a double stitch for the row back - slipped, with the yarn pulled
   * up over the needle so that both its legs sit there - and is worked as
   * one stitch when a later row or round comes to it, which is where its
   * place on the ring already has it.
   */
  turn(): this {
    this.step("turn");
    return this;
  }

  finish() {
    this.endRound();
    if (this.walkTo !== undefined) throw new Error("the stitches up to a new beginning of the round were never knitted on");
    this.closeCourse("part");
    if (this.holders.size > 0) {
      throw new Error(`stitches are still on hold: ${[...this.holders.keys()].join(", ")}`);
    }
    return {
      stitches: this.stitches,
      rounds: this.rounds,
      roundLabels: this.labels,
      roundPieces: this.roundPieces,
      roundKinds: this.roundKinds,
      holds: this.holds,
      objective: this.objective,
    };
  }
}
