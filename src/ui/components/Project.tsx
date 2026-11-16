import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { Placement, SlotId, Tension } from "../../pattern/design";
import { useSweater } from "../useSweater";
import { useColourway } from "../useColourway";
import { viewChart } from "../../reading/counted";
import { currentEdition, editionOf, isSuperseded, errataOf } from "../../library/editions";
import PatternUpdated from "./PatternUpdated";
import MyTension from "./MyTension";
import Refit from "./Refit";
import { type Fitted, mayFit } from "../../library/fit";
import { asEdition } from "../../library/editions/own";
import type { SweaterStitches } from "../../pattern/knitted";
import { sameTension, yarnPerStitch } from "../../reading/tension";
import { makeOnesAtMarkers } from "../../reading/marker-routes";
import type { ChartView } from "../../reading/views";
import { keyOf, paletteOf, slotNames, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
import { totals, positionOf, currentRun, whereYouAre, roundNames, roundWhats } from "../../reading/progress";
import { keyEntryAt } from "../../reading/stitch-key";
import { faceAfter, holdsIn, needleChangesIn, turnsIn } from "../chart/chart-marks";
import { metresFor } from "../../reading/yardage";
import {
  Project as SavedProject,
  chartPath,
  knittingParam,
  overviewPath,
  readProject,
  projectsChanged,
  writeProject,
  keepKnitting,
  dropUnknitted,
} from "../../projects/projects";
import PageLayout from "./ui/PageLayout";
import Button from "./ui/Button";
import ProgressRing from "./ProgressRing";
import SweaterModel from "./SweaterModel";
import Chart from "../chart/Chart";
import KnittingPanel from "./KnittingPanel";
import { KeySheet } from "./KnitKey";
import { recordProgress } from "../../projects/timing/log";
import { useKnittingTime, useTimeDetail, useTimeRecording } from "../useKnittingTime";
import { TimeFigures, TimeLine } from "./KnittingTime";
import { SpeedsSheet, StatsPanel, StitchTime } from "./StatsView";
import { statsOverlay, type Layer } from "../chart/timing-overlay";
import WoolList from "./WoolList";
import { type Chosen } from "./YarnPicker";
import NextStep from "./ui/NextStep";
import ViewTabs from "../chart/ViewTabs";
import ColourwayChoice from "./ColourwayChoice";
import "./Project.css";

/** Marks a chart page's address as open on Explore statistics. */
const statsParam = "stats";

/** "Under 1%", "3%": how far through, never rounded up to done. */
const percentKnitted = (worked: number, percent: number) =>
  `${worked > 0 && percent < 1 ? "Under 1" : Math.floor(percent)}%`;

/** No wool chosen of the knitter's own: one object, so what is drawn from it is not drawn again for nothing. */
const noShades: Overrides = {};

/**
 * The end of the chart page while you are not knitting: how far you have
 * got, and the ways on from here.
 */
const ChartPageFoot: React.FC<{
  percent: number;
  worked: number;
  total: number;
  where: string;
  finished: boolean;
  overview: string;
  onKnit: () => void;
  time?: React.ReactNode;
  /** Opens Explore statistics; absent while there is no time to explore. */
  onStats?: () => void;
}> = ({ percent, worked, total, where, finished, overview, onKnit, time, onStats }) => (
  <section className="section chart-foot" aria-label="Your progress">
    <div className="chart-foot-head">
      <div className="chart-foot-figure">
        <em>{finished ? "100%" : percentKnitted(worked, percent)}</em>
        <span className="quiet">knitted</span>
      </div>
      <Link to="/" className="btn btn-quiet">
        Home
      </Link>
    </div>
    <div className="chart-foot-track">
      <span className="project-card-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
    <p className="quiet">
      {finished
        ? `Finished · ${total.toLocaleString()} stitches`
        : `${where} · ${worked.toLocaleString()} of ${total.toLocaleString()} stitches`}
    </p>
    {time}
    <div className="chart-foot-actions">
      <Link to={overview} className="btn btn-secondary">
        Overview
      </Link>
      {onStats && (
        <Button variant="secondary" onClick={onStats}>
          Statistics
        </Button>
      )}
      <Button variant="primary" size="lg" className="chart-foot-knit" onClick={onKnit}>
        {finished ? "See the last stitch" : worked > 0 ? "Keep knitting" : "Start knitting"}
      </Button>
    </div>
  </section>
);

/**
 * A project: one sweater, one knitter, one row counter.
 *
 * Progress is written straight to storage on every change, because the thing
 * that actually happens to a knitting app is that the phone locks mid-round.
 * Undo steps back through every change made in this visit, and lives only in
 * memory: it is for a run tapped twice or a jump to the wrong stitch, not a
 * record of the project.
 */
/** How many changes Undo can step back through. */
const undoLimit = 100;

const Project: React.FC<{ view: "overview" | "chart" }> = ({ view }) => {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const [project, setProject] = useState<SavedProject | undefined>(() =>
    projectId ? readProject(projectId) : undefined,
  );
  /** Where progress was before each change, most recent last. */
  const [history, setHistory] = useState<number[]>([]);
  const currentProject = useRef(project);
  const adopt = useCallback((next: SavedProject | undefined) => {
    currentProject.current = next;
    setProject(next);
  }, []);
  const change = useCallback((edit: (current: SavedProject) => SavedProject) => {
    const current = currentProject.current;
    if (current) adopt(writeProject(edit(current)));
  }, [adopt]);

  const knitting = params.get(knittingParam) === "1";
  const sweater = project ? sweaterById(project.sweaterId) : undefined;
  // The update taken as published: every stitch knitted is the same in it, so the project's place is where it was. See PatternUpdated.
  const takeUpdate = useCallback(() => {
    change((current) => {
      const edition = currentEdition(current.sweaterId, current.sizeId);
      if (!edition) return current;
      const { upTo, ...rest } = current;
      void upTo;
      return { ...rest, edition };
    });
    dropUnknitted();
  }, [change]);
  // An update that changes nothing ahead, seen: the project knits on what it has, which is up to date with it.
  const seeUpdate = useCallback(() => {
    change((current) => ({ ...current, edition: editionOf(current), upTo: currentEdition(current.sweaterId, current.sizeId) }));
  }, [change]);
  // The update taken from a round: the knitter's rounds to it and the update's from there, knitting of the project's own.
  const joinUpdate = useCallback(async (knitting: SweaterStitches) => {
    const current = currentProject.current;
    if (!current) return;
    const file = await asEdition(knitting, current.sweaterId, current.sizeId);
    if (!keepKnitting(file)) return;
    change((now) => ({ ...now, edition: file.edition, upTo: currentEdition(now.sweaterId, now.sizeId) }));
    dropUnknitted();
  }, [change]);
  useTimeRecording(project && sweater && view === "chart" ? project.id : undefined, knitting);

  useEffect(() => {
    adopt(projectId ? readProject(projectId) : undefined);
    setHistory([]);
    const refresh = (event: StorageEvent) => {
      if (event.key === null || event.key === `project-${projectId}`) {
        adopt(projectId ? readProject(projectId) : undefined);
        setHistory([]);
      }
    };
    window.addEventListener("storage", refresh);
    const refreshLocal = () => {
      const next = projectId ? readProject(projectId) : undefined;
      if (next?.updatedAt !== currentProject.current?.updatedAt) setHistory([]);
      adopt(next);
    };
    window.addEventListener(projectsChanged, refreshLocal);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(projectsChanged, refreshLocal);
    };
  }, [projectId, adopt]);

  /** Move progress, and write the change into the knitting-time log if it was saved. */
  const moveTo = useCallback((next: number, undo = false) => {
    const current = currentProject.current;
    if (!current || next === current.progress) return false;
    change(project => ({ ...project, progress: next }));
    const saved = currentProject.current;
    if (saved?.progress !== next) return false;
    recordProgress(saved.id, current.progress, next, undo);
    return true;
  }, [change]);

  const setProgress = useCallback(
    (next: number) => {
      const from = currentProject.current?.progress;
      if (from !== undefined && moveTo(Math.max(next, 0))) {
        setHistory((past) => [...past.slice(-(undoLimit - 1)), from]);
      }
    },
    [moveTo],
  );

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (previous === undefined) return;
    moveTo(previous, true);
    setHistory((past) => past.slice(0, -1));
  }, [history, moveTo]);

  const setColourway = useCallback((colourwayId: string) => {
    // Starting again from one of the design's: every yarn becomes its own.
    change(current => ({ ...current, colourwayId, shades: undefined, trim: undefined }));
  }, [change]);

  const setTrim = useCallback((trim: string | undefined) => {
    change(current => ({ ...current, trim }));
  }, [change]);

  const setTension = useCallback((tension: Tension | undefined) => {
    change((current) => {
      const without = { ...current };
      delete without.tension;
      return tension ? { ...without, tension } : without;
    });
  }, [change]);

  // The rest worked out for the knitter's tension, taken: the knitting is now the project's own, every stitch worked where it was. See Refit.
  const takeFit = useCallback((fitted: Fitted) => {
    if (!keepKnitting(fitted.file)) return;
    change((current) => ({
      ...current,
      edition: fitted.file.edition,
      fit: {
        tension: fitted.tension,
        finished: fitted.finished,
        round: fitted.round,
        // The published edition it left, through any fit before this one.
        from: current.fit ? current.fit.from : editionOf(current),
        ...(fitted.option ? { option: fitted.option } : {}),
        ...(fitted.placement ? { placement: fitted.placement } : {}),
      },
      // Worked out from the pattern as it is now.
      upTo: currentEdition(current.sweaterId, current.sizeId),
    }));
    dropUnknitted();
  }, [change]);

  const leaveFit = useCallback(() => {
    change((current) => {
      const { fit, upTo, ...rest } = current;
      void upTo;
      return fit?.from ? { ...rest, edition: fit.from } : current;
    });
    dropUnknitted();
  }, [change]);

  const setShade = useCallback((slots: SlotId[], chosen: Chosen | undefined) => {
    change((current) => {
      const shades = { ...current.shades };
      slots.forEach((slot) => {
        if (chosen) shades[slot] = chosen;
        else delete shades[slot];
      });
      return {
        ...current,
        shades: Object.keys(shades).length > 0 ? shades : undefined,
      };
    });
  }, [change]);

  /*
   * Opening or closing the knitting rearranges everything around the chart:
   * knitting fills the screen, without the header and title above it. Hold
   * the chart where it is on screen rather than letting it jump: by its top
   * right corner, as the box is scrolled across from the right and columns
   * open and close away from it.
   */
  const chartHeld = useRef<{ right: number; top: number }>();
  useLayoutEffect(() => {
    const was = chartHeld.current;
    chartHeld.current = undefined;
    const sheet = document.querySelector(".chart-sheets");
    const scroller = sheet?.closest<HTMLElement>(".chart-scroll");
    if (!was || !sheet || !scroller) return;
    window.scrollBy({ top: sheet.getBoundingClientRect().top - was.top, behavior: "instant" });
    const now = sheet.getBoundingClientRect();
    scroller.scrollTop += now.top - was.top;
    scroller.scrollLeft += now.right - was.right;
  }, [knitting]);

  if (!project || !sweater) {
    return (
      <PageLayout title="No such project">
        <p>
          It may have been deleted, or saved in another browser.{" "}
          <Link to="/">Back to the designs</Link>.
        </p>
      </PageLayout>
    );
  }

  // Knitting happens on the chart page; an old link that asked for it on the
  // overview is sent there.
  if (view === "overview" && knitting) {
    return <Navigate to={chartPath(project.id, true)} replace />;
  }

  return (
    <ProjectView
      view={view}
      sweaterId={sweater.id}
      project={project}
      knitting={knitting}
      setKnitting={(on) => {
        const sheet = document.querySelector(".chart-sheets")?.getBoundingClientRect();
        chartHeld.current = sheet && { right: sheet.right, top: sheet.top };
        const next = new URLSearchParams(params);
        if (on) next.set(knittingParam, "1");
        else next.delete(knittingParam);
        setParams(next, { replace: true });
      }}
      setProgress={setProgress}
      undo={undo}
      canUndo={history.length > 0}
      setColourway={setColourway}
      setTrim={setTrim}
      setShade={setShade}
      setTension={setTension}
      takeUpdate={takeUpdate}
      seeUpdate={seeUpdate}
      joinUpdate={joinUpdate}
      takeFit={takeFit}
      leaveFit={leaveFit}
    />
  );
};

const ProjectView: React.FC<{
  view: "overview" | "chart";
  sweaterId: string;
  project: SavedProject;
  knitting: boolean;
  setKnitting: (on: boolean) => void;
  setProgress: (next: number) => void;
  undo: () => void;
  canUndo: boolean;
  setColourway: (id: string) => void;
  setTrim: (trim: string | undefined) => void;
  setShade: (slots: SlotId[], chosen: Chosen | undefined) => void;
  setTension: (tension: Tension | undefined) => void;
  takeUpdate: () => void;
  seeUpdate: () => void;
  joinUpdate: (knitting: SweaterStitches) => void;
  takeFit: (fitted: Fitted) => void;
  leaveFit: () => void;
}> = ({
  view,
  sweaterId,
  project,
  knitting,
  setKnitting,
  setProgress,
  undo,
  canUndo,
  setColourway,
  setTrim,
  setShade,
  setTension,
  takeUpdate,
  seeUpdate,
  joinUpdate,
  takeFit,
  leaveFit,
}) => {
  const sweater = sweaterById(sweaterId)!;
  const size = sweater.sizes.find((s) => s.id === project.sizeId) ?? sweater.sizes[0];
  // The rounds as the knitter counts them where the knitting has got to: see reading/view.
  const edition = editionOf(project);
  const built = useSweater(sweater, size.id, project.progress, edition);
  const { stitches, rounds, index, yoke, holdRegions, view: counted, views, following } = built;
  /*
   * Which of the chart's views it shows: the one the knitting is in while you
   * knit, and otherwise the one you pick, or that one again. See reading/views.
   */
  const [chosenView, setChosenView] = useState<string>();
  useEffect(() => {
    if (knitting) setChosenView(undefined);
  }, [knitting]);
  /*
   * The tabs are the views of the finished pattern. Part way through a round
   * that puts stitches on hold one lot after another, the knitting is on a
   * stage on the way to the next of them (see reading/views): its tab is
   * that view's, and shows the stage.
   */
  const knittingIn = views[following];
  const finished = useMemo(() => views.filter((one) => !one.stageOf), [views]);
  const tabOf = (view?: ChartView) => view?.stageOf ?? view?.id;
  const chosen = !knitting ? views.find((one) => one.id === chosenView) : undefined;
  const shownView = chosen && chosen.id !== tabOf(knittingIn) ? chosen : knittingIn;
  const chart = shownView ? viewChart(built, counted, shownView) : { layout: counted.layout, markers: counted.markers };
  const makeOnes = useMemo(() => makeOnesAtMarkers({ stitches, knitting: built.knitting }), [stitches, built.knitting]);
  // The colourway as it is on this sweater: one that steps down the garment, placed where the project's own planning put its bands.
  const published = useMemo(() => sweater.colourways.find((c) => c.id === project.colourwayId) ?? sweater.colourways[0], [sweater, project.colourwayId]);
  const { colourway: laid, on: laidOn } = useColourway(published, project.fit?.placement);
  const colourway = useMemo(() => trimmed(laid, project.trim), [laid, project.trim]);
  const palette = useMemo(() => paletteOf(colourway, project.shades), [colourway, project.shades]);
  // And as it would be on a sweater planned otherwise, with the wools that would add: for a fit's preview.
  const coloursOn = useCallback(
    (placement: Placement | undefined) => {
      const there = trimmed(laidOn(placement), project.trim);
      return { palette: paletteOf(there, project.shades), added: woolsAdded(colourway, there) };
    },
    [laidOn, colourway, project.trim, project.shades],
  );
  // The design's knitting has moved on since this project began: it says so, and offers the update.
  const updated = isSuperseded(sweater.id, size.id, project.upTo ?? edition) ? (
    <PatternUpdated
      sweater={sweater}
      size={size}
      knitted={built}
      index={index}
      progress={project.progress}
      tension={project.tension}
      fit={project.fit}
      palette={palette}
      coloursOn={coloursOn}
      errata={errataOf(sweater.id, size.id)}
      onSeen={seeUpdate}
      onSwitch={takeUpdate}
      onJoin={joinUpdate}
      onFit={takeFit}
    />
  ) : null;
  const tabs = finished.length > 1 && shownView && (
    <ViewTabs
      views={finished}
      shown={tabOf(shownView)!}
      current={tabOf(knittingIn)}
      onShow={setChosenView}
    />
  );

  // Fitted to its knitter, the knitting is in their stitches, not the size's: what it measures, and the yarn a stitch takes.
  const fitted = useMemo(() => project.fit && { finished: project.fit.finished, ...project.fit.tension }, [project.fit]);
  const metres = useMemo(
    () => (fitted ? metresFor({}, stitches, rounds, yarnPerStitch(size, fitted)) : metresFor(size, stitches, rounds)),
    [size, fitted, stitches, rounds],
  );

  const counts = totals(index, project.progress);
  const position = positionOf(stitches, project.progress, index);
  const time = useKnittingTime(project.id, stitches, project.progress);

  // Every view of the chart names each round as the knitting panel does.
  const names = useMemo(() => roundNames(index), [index]);
  const whats = useMemo(() => roundWhats(index), [index]);

  // Explore statistics: open while the address says so, and there is time to explore.
  const [params, setParams] = useSearchParams();
  const exploring = view === "chart" && !knitting && params.get(statsParam) === "1" && time !== undefined;
  const detail = useTimeDetail(exploring ? project.id : undefined, stitches, counted.rounds);
  const [layer, setLayer] = useState<Layer>("pace");
  const overlay = useMemo(() => (detail ? statsOverlay(detail, layer) : undefined), [detail, layer]);
  const [speedsOpen, setSpeedsOpen] = useState(false);
  const closeSpeeds = useCallback(() => setSpeedsOpen(false), []);
  const setExploring = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set(statsParam, "1");
    else next.delete(statsParam);
    setParams(next, { replace: true });
    setSpeedsOpen(false);
  };

  // The yoke's bands, for the strips that show the wool being chosen.
  const body = useMemo(() => ({ stitches, rounds: yoke }), [stitches, yoke]);

  // The full key, over the lower part of the screen while knitting.
  const [keyOpen, setKeyOpen] = useState(false);
  const closeKey = useCallback(() => setKeyOpen(false), []);
  useEffect(() => {
    if (!knitting) setKeyOpen(false);
  }, [knitting]);
  const run = currentRun(stitches, project.progress, index);
  // Which side is towards you, for the key to read the chart's symbols from: see Chart.
  const turnIds = useMemo(
    () => stitches.filter((stitch) => stitch.type === "turn").map((stitch) => stitch.id),
    [stitches],
  );
  const face = faceAfter(turnIds, project.progress);
  const currentStitch = run ? keyEntryAt(stitches, run.startId, sweater.stitchNotes)?.id : undefined;

  const title = project.name ?? sweater.name;
  // A jumper with a name of its own says which design it is in the small line; one without is that design, yours.
  const eyebrow = `${project.name ? sweater.name : "your jumper"} · ${size.label}`;
  const knitLabel = counts.worked > 0 ? "Keep knitting" : "Start knitting";

  if (exploring && detail && time) {
    return (
      <PageLayout title={title} eyebrow={eyebrow} showTitle={false} className="knit-screen">
        <section className="section chart-page" data-view={shownView?.id}>
          {!knitting && tabs}
          <Chart
            key={shownView?.id}
            stitches={stitches}
            rounds={counted.rounds}
            layout={chart.layout}
            markers={chart.markers}
            palette={palette}
            progress={project.progress}
            // Looking back: the edge of the knitting near the top, what is done below it.
            follow
            followAt={0.85}
            labels={whats}
            names={names}
            stitchNotes={sweater.stitchNotes}
            pieces={sweater.pieces}
            kinds={counted.kinds}
            roundPieces={counted.pieces}
            holdRegions={holdRegions}
            overlay={overlay}
            pickerNote={(id) => <StitchTime time={detail} id={id} round={index.roundOf.get(id)} />}
          />
        </section>
        <StatsPanel
          summary={time}
          time={detail}
          finished={position.finished}
          layer={layer}
          onLayer={setLayer}
          onSpeeds={() => setSpeedsOpen(true)}
          onClose={() => setExploring(false)}
        />
        {speedsOpen && <SpeedsSheet stitches={stitches} notes={sweater.stitchNotes} time={detail} onClose={closeSpeeds} />}
      </PageLayout>
    );
  }

  if (view === "chart") {
    return (
      <PageLayout
        title={title}
        eyebrow={eyebrow}
        showTitle={!knitting}
        className={knitting ? "knit-screen" : undefined}
      >
        <section className="section chart-page" data-view={shownView?.id}>
          {!knitting && updated}
          {!knitting && tabs}
          <Chart
            key={shownView?.id}
            stitches={stitches}
            rounds={counted.rounds}
            layout={chart.layout}
            markers={chart.markers}
            palette={palette}
            progress={project.progress}
            follow={knitting}
            onJump={knitting ? setProgress : undefined}
            labels={whats}
            names={names}
            stitchNotes={sweater.stitchNotes}
            pieces={sweater.pieces}
            kinds={counted.kinds}
            roundPieces={counted.pieces}
            holdRegions={holdRegions}
          />
          <ul className="chart-key">
            {keyOf(sweater.slots, palette).map(({ slots, yarn }) => (
              <li key={slots[0]}>
                <span className="swatch" style={{ background: yarn.hex }} />
                {slotNames(slots)} · {yarn.name}
              </li>
            ))}
          </ul>
        </section>

        {knitting ? (
          <KnittingPanel
            stitches={stitches}
            index={index}
            palette={palette}
            progress={project.progress}
            setProgress={setProgress}
            onStop={() => setKnitting(false)}
            canUndo={canUndo}
            onUndo={undo}
            notes={sweater.stitchNotes}
            onOpenKey={() => setKeyOpen(true)}
            makeOnesAtMarkers={makeOnes}
          />
        ) : (
          <ChartPageFoot
            percent={counts.percent}
            worked={counts.worked}
            total={counts.total}
            where={whereYouAre(position)}
            finished={position.finished}
            overview={overviewPath(project.id)}
            onKnit={() => setKnitting(true)}
            time={time && <TimeLine time={time} finished={position.finished} className="chart-foot-time" />}
            onStats={time && (() => setExploring(true))}
          />
        )}
        {knitting && keyOpen && (
          <KeySheet
            stitches={stitches}
            palette={palette}
            notes={sweater.stitchNotes}
            current={currentStitch}
            needles={needleChangesIn(stitches, rounds, names)}
            holds={holdsIn(stitches, rounds, sweater.pieces)}
            turns={turnsIn(stitches, rounds)}
            face={face}
            onClose={closeKey}
          />
        )}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={title}
      eyebrow={eyebrow}
    >
      {updated}
      <div className="project-layout">
        <div className="project-stage">
          <SweaterModel
            sweaterId={sweater.id}
            sizeId={size.id}
            edition={edition}
            palette={palette}
            progress={project.progress}
          />
          <p className="quiet stage-note">The wool fills in as you knit. Drag to turn it.</p>
        </div>
        <div className="project-figures">
          <ProgressRing percent={counts.percent} />
          <dl className="measurements">
            <div>
              <dt>Knitted</dt>
              <dd>
                {counts.worked.toLocaleString()} of {counts.total.toLocaleString()} stitches
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{position.finished ? "Finished" : whereYouAre(position)}</dd>
            </div>
            <div>
              <dt>Left to go</dt>
              <dd>{counts.remaining.toLocaleString()} stitches</dd>
            </div>
            {time && <TimeFigures time={time} finished={position.finished} />}
          </dl>
        </div>
      </div>
      <div className="peerie-rule" aria-hidden="true" />
      <section className="section">
        <h2>Your wool</h2>
        {/*
          The design's own colourways first, because they are where most
          people start, then the wool itself. Choosing one sets every yarn
          at once; a row below changes any of them afterwards.
        */}
        <ColourwayChoice
          colourways={sweater.colourways}
          colourway={colourway}
          overrides={project.shades ?? noShades}
          body={body}
          onStartFrom={setColourway}
          trim={sweater.trim}
          trimChosen={project.trim}
          onTrim={setTrim}
        />
        <WoolList
          colourway={colourway}
          metres={metres}
          stated={size.yardage !== undefined && !fitted}
          overrides={project.shades ?? noShades}
          onChange={setShade}
          body={body}
          palette={palette}
        />
      </section>

      <MyTension key={project.id} size={size} fitted={fitted} tension={project.tension} onChange={setTension}>
        {/* Where the rest is worked out for this tension already, it says so; where it could be, it offers to. */}
        {project.tension && (sameTension(fitted ?? size, project.tension) ? !!fitted : mayFit(sweater, built, project.progress)) && (
          <Refit
            sweater={sweater}
            size={size}
            knitted={built}
            progress={project.progress}
            tension={project.tension}
            fit={project.fit}
            palette={palette}
            coloursOn={coloursOn}
            roundNames={names}
            onTake={takeFit}
            onGoBack={leaveFit}
          />
        )}
      </MyTension>

      <NextStep
        title={position.finished ? "All knitted" : counts.worked > 0 ? "Carry on" : "Ready to cast on?"}
        detail={
          position.finished
            ? "Every stitch is done. The chart is still there to look back over."
            : counts.worked > 0
              ? `You are on the ${whereYouAre(position).toLowerCase()}. The chart opens where you left off.`
              : `${counts.total.toLocaleString()} stitches over ${position.totalRounds} rounds, from the neck down. The chart follows you round by round.`
        }
      >
        {position.finished ? (
          <Link to={chartPath(project.id)} className="btn btn-primary btn-lg">
            Open the chart
          </Link>
        ) : (
          <>
            <Link to={chartPath(project.id)} className="btn btn-secondary">
              View the chart
            </Link>
            <Link to={chartPath(project.id, true)} className="btn btn-primary btn-lg">
              {knitLabel}
            </Link>
          </>
        )}
      </NextStep>
    </PageLayout>
  );
};

export default Project;
