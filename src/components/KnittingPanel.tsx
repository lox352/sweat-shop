import React, { useCallback, useEffect, useMemo } from "react";
import { Stitch } from "../types/Stitch";
import {
  Run,
  RoundIndex,
  currentRun,
  endOfRound,
  positionOf,
  roundName,
  runInstruction,
  runWord,
  totals,
  upcomingRuns,
} from "../knitting/progress";
import { Palette, inkOn, yarnFor } from "../knitting/palette";
import Button from "./ui/Button";
import { KeyEntry, keyEntryAt, stitchKey } from "../knitting/stitch-key";
import { HowTo, NeedlesSwatch, Swatch as StitchSwatch } from "../knitting/ChartHelp";
import type { StitchKeyId, StitchNote } from "../data/sweaters/types";
import "./KnittingPanel.css";

interface KnittingPanelProps {
  stitches: Stitch[];
  index: RoundIndex;
  palette: Palette;
  progress: number;
  setProgress: (progress: number) => void;
  onStop: () => void;
  canUndo: boolean;
  onUndo: () => void;
  /** What the pattern says about its stitches. */
  notes?: Partial<Record<StitchKeyId, StitchNote>>;
  /** Opens the whole key: the colours and every stitch. */
  onOpenKey?: () => void;
}

/**
 * The stitches this round needs explaining, in the key's order: anything but
 * a plain knit. For the whole round rather than the stitch in hand, so that it
 * says what is coming before you reach it, and so it does not appear and
 * vanish every two stitches across a rib, taking the chart's height with it.
 */
const roundEntries = (
  stitches: Stitch[],
  ids: number[],
  notes?: Partial<Record<StitchKeyId, StitchNote>>,
): KeyEntry[] => {
  const seen = new Map<string, KeyEntry>();
  ids.forEach((id) => {
    const entry = keyEntryAt(stitches, id, notes);
    if (entry && entry.id !== "k1" && !seen.has(entry.id)) seen.set(entry.id, entry);
  });
  const order = stitchKey(stitches, notes).map((entry) => entry.id);
  return [...seen.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
};

/**
 * How to work this round's special stitches, the one in hand marked - and,
 * for the one in hand, step by step where it has steps: casting on, at the
 * neck or an underarm, when the stitches to cast on are next.
 */
const StitchHint: React.FC<{ entries: KeyEntry[]; current?: string }> = ({ entries, current }) => (
  <ul className="knitting-hint" aria-label="Stitches in this round">
    {entries.map((entry) => (
      <li key={entry.id} className={entry.id === current ? "knitting-hint-now" : undefined}>
        <StitchSwatch entry={entry} />
        <div>
          <p>
            <strong>
              {entry.label}
              {entry.abbreviation && <span className="stitch-abbr"> {entry.abbreviation}</span>}
            </strong>{" "}
            {entry.how}
            {entry.note && <span className="stitch-note"> {entry.note}</span>}
          </p>
          {entry.id === current && <HowTo entry={entry} />}
        </div>
      </li>
    ))}
  </ul>
);

const Swatch: React.FC<{ run: Run; palette: Palette; small?: boolean }> = ({
  run,
  palette,
  small,
}) => {
  const yarn = yarnFor(palette, run.slot);
  return (
    <span
      className={`run-swatch${small ? " run-swatch-small" : ""}`}
      style={{ background: yarn.hex, color: inkOn(yarn.hex) }}
      title={`${runInstruction(run)} in ${yarn.name}`}
    >
      {run.length}
    </span>
  );
};

/**
 * A step's heading - the same for every kind of step, with the symbol the
 * key gives it, so a join, a change of needles and a hold read alike.
 *
 * A step is part of the order of work but no fabric: nothing is knitted, but
 * it has to be done, and done in its place, so it is worked like a stitch -
 * one tap, and Undo takes it back.
 */
const StepHeading: React.FC<{ symbol: React.ReactNode; children: React.ReactNode }> = ({
  symbol,
  children,
}) => (
  <strong className="knitting-step-heading">
    <span className="knitting-step-symbol">{symbol}</span>
    <span>{children}</span>
  </strong>
);

/** The join's heading takes a single arrow, the way the round carries on. */
const JoinArrow: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 1 1" aria-hidden="true">
    <path d="M0.95 0.5H0.08M0.3 0.28L0.08 0.5L0.3 0.72" className="key-join" />
  </svg>
);

/** Stitches set aside, down a short line of waste yarn. */
const HoldSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 1 1" aria-hidden="true">
    <path d="M0.15 0.3H0.85M0.5 0.3V0.82M0.32 0.64L0.5 0.82L0.68 0.64" className="key-join" />
  </svg>
);

/** Held stitches taken back up onto the needle. */
const ResumeSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 1 1" aria-hidden="true">
    <path d="M0.15 0.7H0.85M0.5 0.7V0.18M0.32 0.36L0.5 0.18L0.68 0.36" className="key-join" />
  </svg>
);

/**
 * Dividing the yoke: a sleeve's stitches set aside, part way through the
 * round, for the underarm to be cast on in their place.
 */
const HoldStep: React.FC<{ count: number; piece: string }> = ({ count, piece }) => (
  <div className="knitting-step">
    <StepHeading symbol={<HoldSwatch />}>Put {count} stitches on hold</StepHeading>
    <span className="quiet">
      Slip the next {count} stitches onto waste yarn for the {piece.toLowerCase()},
      and leave them there until you begin it. Then cast on the underarm in
      their place, pulling the yarn snug across the gap. On the chart they are
      crosshatched while they wait, and so is everything to be knitted from
      them.
    </span>
  </div>
);

/**
 * Beginning a piece from held stitches: a sleeve, picked up round its
 * armhole from the middle of the underarm.
 */
const ResumeStep: React.FC<{ count: number; piece: string }> = ({ count, piece }) => (
  <div className="knitting-step">
    <StepHeading symbol={<ResumeSwatch />}>Begin the {piece.toLowerCase()}</StepHeading>
    <span className="quiet">
      Put the {count} held stitches back on your needles. Join new yarn at the
      middle of the underarm: the round starts there, picking up stitches out
      of the edge the body cast on. On the chart the crosshatch comes off the{" "}
      {piece.toLowerCase()}: it is on your needles again.
    </span>
  </div>
);

/** The work turned round, as the chart draws a short row's end. */
const TurnSwatch: React.FC = () => (
  <svg className="key-swatch" width="24" height="24" viewBox="0 0 1 1" aria-hidden="true">
    <path d="M0.78 0.3H0.38A0.2 0.2 0 0 0 0.38 0.7H0.62M0.5 0.58L0.62 0.7L0.5 0.82" className="key-join" />
  </svg>
);

/**
 * The end of a short row: turn the work, and make the double stitch that
 * keeps the turn from leaving a hole.
 *
 * Working it turns the chart over too, as a turn does on the hat site: from
 * here the other side of the sweater is towards you, and the chart shows it.
 */
const TurnStep: React.FC<{ side: "right" | "wrong" }> = ({ side }) => (
  <div className="knitting-step">
    <StepHeading symbol={<TurnSwatch />}>Turn, and make a double stitch</StepHeading>
    <span className="quiet">
      Turn the work so the {side} side faces you. With the yarn at the front,
      slip the first stitch purlwise, then pull the yarn up over the needle to
      the back, so the stitch&rsquo;s two legs sit on the needle as a double
      stitch.{" "}
      {side === "wrong"
        ? "Bring the yarn to the front between the needles and purl on from the next stitch: on this side, knits become purls."
        : "Knit on from the next stitch."}{" "}
      When a row or round reaches the double stitch, work its two legs
      together as one.{" "}
      {side === "wrong"
        ? "The chart turns over to match, every stitch shown as it looks from the wrong side - knits as purls, purls as knits - and what was knitted from the right side hatched."
        : "The chart turns back over, every stitch shown as it looks from the right side again, and what was purled from the wrong side hatched."}
    </span>
  </div>
);

/**
 * A change of needles: a step between rounds. The size is the one the design
 * gives for the size being knitted.
 */
const NeedlesStep: React.FC<{ to: number; from?: number }> = ({ to, from }) => (
  <div className="knitting-step">
    <StepHeading symbol={<NeedlesSwatch />}>Change to {to}mm needles</StepHeading>
    <span className="quiet">
      {from !== undefined && `From the ${from}mm ones, `}
      {from !== undefined ? "before" : "Before"} you knit the next round. The
      chart marks the change with a dashed rule.
    </span>
  </div>
);

/**
 * Joining the cast-on into a round: one stitch more is cast on and lifted
 * off again where the two ends meet.
 */
const JoinStep: React.FC = () => (
  <div className="knitting-step">
    <StepHeading symbol={<JoinArrow />}>Join in the round</StepHeading>
    <span className="quiet">
      Cast on one more stitch. Then, without twisting the cast-on, slip it to
      the left needle, lift the first stitch cast on over it and off, and slip
      it back to the right needle. Place a marker for the start of the round:
      the middle of the back.
    </span>
  </div>
);

const UndoButton: React.FC<{ onUndo: () => void; canUndo: boolean }> = ({
  onUndo,
  canUndo,
}) => (
  <Button variant="quiet" className="knitting-undo" onClick={onUndo} disabled={!canUndo}>
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5.5 3.5L2.5 6.5l3 3M2.5 6.5h7a4 4 0 0 1 0 8H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    Undo
  </Button>
);

/**
 * The view you use while actually knitting.
 *
 * Written for someone holding needles. The things in large type are the round,
 * the stitch within it, and what to work before anything changes - which in
 * Fair Isle is the only instruction that matters. A percentage is not
 * something you can act on, so it is demoted to a bar.
 *
 * A run ends where the stitch changes as well as where the yarn does, so the
 * button says "Purl 2 in Port Wine" and not "Work 126 in Port Wine" across a
 * whole round of twisted rib. That makes runs short in a rib, which is what a
 * rib is; "End of round" is there for when you do not want telling twice.
 *
 * The big button is the thing you actually do: work to the end of the run in
 * front of you. "End of round" is beside it for when you would rather not be
 * told twice, and Undo steps back through anything tapped by mistake. To go
 * anywhere else, tap the stitch on the chart. A single stitch forward or back
 * is still on the arrow keys, for anyone with a keyboard to hand.
 */
const KnittingPanel: React.FC<KnittingPanelProps> = ({
  stitches,
  index,
  palette,
  progress,
  setProgress,
  onStop,
  canUndo,
  onUndo,
  notes,
  onOpenKey,
}) => {
  const position = positionOf(stitches, progress, index);
  const run = currentRun(stitches, progress, index);
  const roundIds = index.rounds[position.round - 1];
  const inRound = useMemo(
    () => (roundIds ? roundEntries(stitches, roundIds, notes) : []),
    [stitches, roundIds, notes],
  );
  const current = run ? keyEntryAt(stitches, run.startId, notes)?.id : undefined;
  const ahead = upcomingRuns(stitches, run?.endId ?? progress, index, 2);
  const counts = totals(index, progress);

  const step = useCallback(
    (delta: number) => {
      if (delta > 0) {
        const next = currentRun(stitches, progress, index);
        if (next?.type === "kfb" && next.startId === progress + 1) {
          setProgress(next.endId);
          return;
        }
      } else if (delta < 0) {
        const current = stitches[progress];
        const previous = stitches[progress - 1];
        if (current?.type === "m1" && previous?.type === "kfb") {
          setProgress(progress - 2);
          return;
        }
      }
      setProgress(progress + delta);
    },
    [stitches, index, progress, setProgress],
  );

  const finishRun = useCallback(() => {
    if (run) setProgress(run.endId);
  }, [run, setProgress]);

  const finishRound = useCallback(() => {
    // No further than a step part way round: see endOfRound.
    const end = endOfRound(progress, index, stitches);
    if (end !== undefined) setProgress(end);
  }, [progress, index, stitches, setProgress]);

  // Your hands are busy, so the common actions need to be reachable without
  // aiming at anything.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, button, select, a, textarea, summary, dialog, [role=button]") ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onUndo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case " ":
        case "ArrowRight":
          event.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          step(-1);
          break;
        case "Enter":
          event.preventDefault();
          finishRun();
          break;
        case "ArrowUp":
          event.preventDefault();
          finishRound();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, finishRun, finishRound, onUndo]);

  const pieceLabel = (id: string) => index.pieces.find((piece) => piece.id === id)?.label ?? id;
  const where = position.piece
    ? `${position.piece.label}, ${roundName(position)}`
    : `Round ${position.round}`;
  /*
   * On a short row, which of the run of them this is: "3 of 7 short rows"
   * says more than which of the yoke's rounds it is.
   */
  const shortRows = useMemo(() => {
    if (position.kind === "round") return undefined;
    let [start, end] = [position.round - 1, position.round - 1];
    while (start > 0 && (index.roundKinds[start - 1] ?? "round") !== "round") start--;
    while (end + 1 < index.roundKinds.length && (index.roundKinds[end + 1] ?? "round") !== "round") end++;
    return { at: position.round - start, of: end - start + 1 };
  }, [position.kind, position.round, index.roundKinds]);

  if (
    position.joinNext ||
    position.needlesNext !== undefined ||
    position.holdNext ||
    position.resumeNext ||
    position.turnNext
  ) {
    return (
      <div className="knitting-panel">
        <div className="knitting-bar" aria-hidden="true">
          <span style={{ width: `${counts.percent}%` }} />
        </div>
        <button
          type="button"
          className="knitting-close"
          onClick={onStop}
          aria-label="Stop knitting"
          title="Stop knitting"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {position.holdNext
            ? `${where}, stitch ${position.stitchInRound}. Put ${position.holdNext.count} stitches on hold.`
            : position.resumeNext
              ? `Begin the ${pieceLabel(position.resumeNext.holder).toLowerCase()}.`
              : position.turnNext
                ? `${where} done. Turn, and make a double stitch.`
                : position.joinNext
                  ? `${where} done. Join in the round.`
                  : `${where} done. Change to ${position.needlesNext}mm needles.`}
        </p>
        {position.holdNext ? (
          <HoldStep count={position.holdNext.count} piece={pieceLabel(position.holdNext.holder)} />
        ) : position.resumeNext ? (
          <ResumeStep count={position.resumeNext.count} piece={pieceLabel(position.resumeNext.holder)} />
        ) : position.turnNext ? (
          <TurnStep side={position.turnNext.side} />
        ) : position.joinNext ? (
          <JoinStep />
        ) : (
          <NeedlesStep to={position.needlesNext ?? 0} from={stitches[progress]?.needles} />
        )}
        <div className="knitting-actions">
          <UndoButton onUndo={onUndo} canUndo={canUndo} />
          {onOpenKey && (
            <Button variant="secondary" className="knitting-key" onClick={onOpenKey}>
              Key
            </Button>
          )}
          {/* Laid out as the usual panel is: Undo and Key, then the one thing to do. */}
          <Button
            variant="primary"
            size="lg"
            className="knitting-go"
            onClick={() => setProgress(progress + 1)}
          >
            {position.holdNext
              ? "Held: carry on"
              : position.resumeNext
                ? "On the needles: carry on"
                : position.turnNext
                  ? "Turned: carry on"
                  : position.joinNext
                    ? "Joined: carry on"
                    : "Changed: carry on"}
          </Button>
        </div>
      </div>
    );
  }

  if (position.finished) {
    return (
      <div className="knitting-panel knitting-panel-done">
        <div className="knitting-bar" aria-hidden="true">
          <span style={{ width: "100%" }} />
        </div>
        <div className="knitting-done">
          <strong>That is the last stitch.</strong>
          <span className="quiet">
            Break the yarn and fasten off. Weave in the ends, close any gap at
            the underarms with the tails, then wash the sweater and lay it flat
            to dry to its measurements.
          </span>
        </div>
        <div className="knitting-done-actions">
          <UndoButton onUndo={onUndo} canUndo={canUndo} />
          <Button variant="primary" onClick={onStop}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="knitting-panel">
      {/* How far through the sweater, as the panel's top edge. */}
      <div className="knitting-bar" aria-hidden="true">
        <span style={{ width: `${counts.percent}%` }} />
      </div>
      <button
        type="button"
        className="knitting-close"
        onClick={onStop}
        aria-label="Stop knitting"
        title="Stop knitting"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {where}, stitch {position.stitchInRound}.
        {run && ` ${runInstruction(run)} in ${yarnFor(palette, run.slot).name}.`}
      </p>
      <div className="knitting-readout">
        {shortRows ? (
          <span className="knitting-figure">
            <em>{shortRows.at}</em>
            <span className="quiet">
              of {shortRows.of} short rows{position.piece && ` · ${position.piece.label}`}
            </span>
          </span>
        ) : (
          <span className="knitting-figure">
            <em>{position.pieceRound}</em>
            <span className="quiet">
              of {position.piece ? position.piece.last - position.piece.first + 1 : position.totalRounds} rounds
              {position.piece && ` · ${position.piece.label}`}
            </span>
          </span>
        )}
        <span className="knitting-figure">
          <em>{position.stitchInRound}</em>
          <span className="quiet">of {position.stitchesInRound} stitches</span>
        </span>
        {run && (
          <span className="knitting-figure knitting-run">
            <Swatch run={run} palette={palette} />
            <span className="quiet">
              {runWord(run)} in {yarnFor(palette, run.slot).name}
              {ahead.length > 0 && (
                <>
                  , then{" "}
                  {ahead.map((next, position) => (
                    <React.Fragment key={next.startId}>
                      {position > 0 && ", "}
                      <Swatch run={next} palette={palette} small />
                      {/*
                        A bare number is a knit, which is what most of a Fair
                        Isle round is. Anything else says so.
                      */}
                      {(next.type !== "k1" || next.wrongSide) && ` ${runWord(next)}`}
                    </React.Fragment>
                  ))}
                </>
              )}
            </span>
          </span>
        )}
      </div>


      {inRound.length > 0 && <StitchHint entries={inRound} current={current} />}

      <div className="knitting-actions">
        <UndoButton onUndo={onUndo} canUndo={canUndo} />
        {onOpenKey && (
          <Button variant="secondary" className="knitting-key" onClick={onOpenKey}>
            Key
          </Button>
        )}
        <Button variant="secondary" className="knitting-round" onClick={finishRound}>
          {shortRows ? "End of row" : "End of round"}
        </Button>
        <Button variant="primary" size="lg" className="knitting-go" onClick={finishRun}>
          {run
            ? `${runInstruction(run)} in ${yarnFor(palette, run.slot).name}`
            : "Work on"}
        </Button>
      </div>
    </div>
  );
};

export default KnittingPanel;
