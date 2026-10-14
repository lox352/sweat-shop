import { Stitch } from "../types/Stitch";
import { StitchType, consumption } from "../types/StitchType";

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
 * Stitches put on hold: a run of the round they were held from, in order,
 * waiting on waste yarn under a holder's name - the step that put them there,
 * and the step that takes them up again, once there is one. Consecutive held
 * stitches are one region of the knitting, which could be taken up again at
 * any time: what is on hold is decided by those two steps alone.
 */
export interface Held {
  holder: string;
  stitches: number[];
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

  /** The stitches on the needles, from the beginning of the round. */
  private live: number[] = [];
  private readonly holders = new Map<string, number[]>();
  /** Stitches cast on in place of held ones, by holder: a sleeve's underarm. */
  private readonly edges = new Map<string, number[]>();

  private piece = "";
  /** The stitch the yarn runs on from, or undefined where new yarn starts. */
  private yarn: number | undefined;

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
    return this.live.length - this.cursor;
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
    this.piece = piece;
    return this;
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
    this.rounds.push(ids);
    this.labels.push(label);
    this.roundPieces.push(this.piece);
    this.roundKinds.push("round");
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
    this.working = true;
    this.made = [];
    this.next = [];
    this.cursor = -borrow;
    this.label = label;
    this.width = width;
    this.rise = rise;
    return this;
  }

  /** The next `n` stitches on the needle, taken off it. */
  private take(n: number): number[] {
    const out: number[] = [];
    const ring = this.live.length;
    for (let i = 0; i < n; i++) {
      if (ring === 0 || this.cursor >= ring) {
        throw new Error(`${this.label}: ran out of stitches on the needle`);
      }
      out.push(this.live[((this.cursor % ring) + ring) % ring]);
      this.cursor++;
    }
    return out;
  }

  /** Work one stitch, or one instruction - a k2tog is one stitch made of two. */
  knit(type: StitchType, slot: string, from?: number): Stitch {
    if (!this.working) throw new Error("start a round before knitting into it");
    const worked = this.take(consumption[type]);
    const links = [...worked];
    /*
     * A KFB makes two loops out of one stitch: the first is stored as the
     * KFB, the second as the make-one straight after it. That second loop
     * is worked into the same stitch, so it is held by it too, rather than
     * only by its neighbour.
     */
    const previous = this.yarn === undefined ? undefined : this.stitches[this.yarn];
    if (type === "m1" && previous?.type === "kfb") links.push(previous.links[0]);
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
    // A bound-off stitch is finished: nothing is left on the needle for it.
    if (type !== "bindOff") this.next.push(stitch.id);
    this.yarn = stitch.id;
    return stitch;
  }

  /**
   * Put the next `count` stitches on hold, part way through a round: a step.
   * They wait on waste yarn under `name` until a piece takes them back up.
   */
  hold(name: string, count: number): this {
    if (this.holders.has(name)) throw new Error(`there is already a holder called ${name}`);
    const held = this.take(count);
    this.holders.set(name, held);
    const step = this.step("hold");
    step.holder = name;
    step.count = count;
    this.holds.push({ holder: name, stitches: [...held], heldAt: step.id });
    return this;
  }

  /**
   * Cast on `count` stitches part way through a round - the body's underarm,
   * in the place of a sleeve's held stitches - and remember them as the edge
   * that sleeve will pick up from.
   */
  castOnHere(count: number, slot: string, edge: string): this {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) ids.push(this.knit("castOn", slot).id);
    this.edges.set(edge, ids);
    return this;
  }

  /**
   * Take a holder's stitches back onto the needles, to begin a piece with
   * them: a step. The yarn is new - it is joined at the underarm, not carried
   * on from wherever the last piece ended - so the first stitch made has
   * nothing before it.
   */
  resume(name: string): this {
    const held = this.holders.get(name);
    if (!held) throw new Error(`nothing is held under ${name}`);
    if (this.live.length > 0) throw new Error(`${name}: the needles still have stitches on them`);
    this.holders.delete(name);
    this.live = held;
    this.yarn = undefined;
    const step = this.step("resume");
    step.holder = name;
    step.count = held.length;
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
    if (this.cursor !== this.live.length) {
      throw new Error(
        `${this.label}: works ${this.cursor} of the ${this.live.length} stitches on the needle`,
      );
    }
    this.working = false;
    this.live = this.next;
    if (this.made.length > 0) {
      this.rounds.push(this.made);
      this.labels.push(this.label);
      this.roundPieces.push(this.piece);
      this.roundKinds.push("round");
    }
    return this;
  }

  /**
   * Work a short row: a stitch into each of the given places on the ring, in
   * the order given - the way the rounds go on the right side, back the other
   * way on the wrong. Each is worked into the stitch at its place, which it
   * then takes the place of, so the ring always holds the newest stitch at
   * every place, whatever row or round made it.
   *
   * A row from the wrong side is purled, and a purl seen from the right side
   * is a knit; that is what is stored. See Stitch.wrongSide.
   */
  row(label: string, width: number, rise: number, side: "right" | "wrong", places: number[], slot: string): this {
    if (this.working) throw new Error(`${label}: a round is still in progress`);
    const made: number[] = [];
    for (const place of places) {
      const worked = this.live[place];
      if (worked === undefined) throw new Error(`${label}: there is no stitch at ${place}`);
      const stitch = this.push({
        links: this.yarn === undefined ? [worked] : [worked, this.yarn],
        type: "k1",
        slot,
        piece: this.piece,
        width,
        rise,
        ...(side === "wrong" ? { wrongSide: true } : {}),
      });
      this.live[place] = stitch.id;
      this.yarn = stitch.id;
      made.push(stitch.id);
    }
    this.width = width;
    this.rise = rise;
    this.rounds.push(made);
    this.labels.push(label);
    this.roundPieces.push(this.piece);
    this.roundKinds.push(side);
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
    };
  }
}
