import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../data/sweaters";
import { SlotId } from "../data/sweaters/types";
import { useSweater, viewChart } from "../knitting/useSweater";
import type { ChartView } from "../knitting/views";
import { colourwayLabel, paletteOf, trimmed, yarnFor } from "../knitting/palette";
import { totals, positionOf, currentRun, whereYouAre, roundNames, roundWhats } from "../knitting/progress";
import { keyEntryAt } from "../knitting/stitch-key";
import { faceAfter, holdsIn, needleChangesIn, turnsIn } from "../knitting/chart-marks";
import { metresFor } from "../knitting/yardage";
import {
  Project as SavedProject,
  chartPath,
  knittingParam,
  overviewPath,
  readProject,
  projectsChanged,
  writeProject,
} from "../helpers/projects";
import PageLayout from "./ui/PageLayout";
import Button from "./ui/Button";
import ProgressRing from "./ProgressRing";
import SweaterModel from "./SweaterModel";
import Chart from "../knitting/Chart";
import KnittingPanel from "./KnittingPanel";
import { KeySheet } from "./KnitKey";
import { recordProgress } from "../knitting/timing/log";
import { useKnittingTime, useTimeDetail, useTimeRecording } from "../knitting/timing/useKnittingTime";
import { TimeFigures, TimeLine } from "./KnittingTime";
import { SpeedsSheet, StatsPanel, StitchTime } from "./StatsView";
import { statsOverlay, type Layer } from "../knitting/timing/overlay";
import WoolList from "./WoolList";
import { type Chosen } from "./YarnPicker";
import NextStep from "./ui/NextStep";
import ColourwayChoice from "./ColourwayChoice";
import "./Project.css";

/** Marks a chart page's address as open on Explore statistics. */
const statsParam = "stats";

/** "Under 1%", "3%": how far through, never rounded up to done. */
const percentKnitted = (worked: number, percent: number) =>
  `${worked > 0 && percent < 1 ? "Under 1" : Math.floor(percent)}%`;

/**
 * The chart's views as tabs over it: from the neck, the body and each sleeve,
 * each its own chart, with the one the knitting is in marked. See
 * knitting/views.
 */
const ViewTabs: React.FC<{
  views: ChartView[];
  shown: string;
  current?: string;
  onShow: (view: string) => void;
}> = ({ views, shown, current, onShow }) => (
  <div className="view-tabs" role="tablist" aria-label="Views of the chart">
    {views.map((view) => (
      <button
        key={view.id}
        type="button"
        role="tab"
        aria-selected={view.id === shown}
        className={`view-tab${view.id === shown ? " is-shown" : ""}`}
        onClick={() => onShow(view.id)}
      >
        {view.label}
        {view.id === current && <span className="quiet">knitting</span>}
      </button>
    ))}
  </div>
);

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
        {finished ? "See the last stitch" : worked > 0 ? "Resume knitting" : "Start knitting"}
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

  const setTrim = useCallback((trim: string) => {
    change(current => ({ ...current, trim }));
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
  setTrim: (trim: string) => void;
  setShade: (slots: SlotId[], chosen: Chosen | undefined) => void;
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
}) => {
  const sweater = sweaterById(sweaterId)!;
  const size = sweater.sizes.find((s) => s.id === project.sizeId) ?? sweater.sizes[0];
  // The rounds as the knitter counts them where the knitting has got to: see knitting/view.
  const built = useSweater(sweater, size.id, project.progress);
  const { stitches, rounds, index, yoke, holdRegions, view: counted, views, following } = built;
  /*
   * Which of the chart's views it shows: the one the knitting is in while you
   * knit, and otherwise the one you pick, or that one again. See knitting/views.
   */
  const [chosenView, setChosenView] = useState<string>();
  useEffect(() => {
    if (knitting) setChosenView(undefined);
  }, [knitting]);
  const shownView = (!knitting && views.find((one) => one.id === chosenView)) || views[following];
  const chart = shownView ? viewChart(built, counted, shownView) : { layout: counted.layout, markers: counted.markers };
  const tabs = views.length > 1 && shownView && (
    <ViewTabs
      views={views}
      shown={shownView.id}
      current={views[following]?.id}
      onShow={setChosenView}
    />
  );

  const colourway = useMemo(
    () => trimmed(sweater.colourways.find((c) => c.id === project.colourwayId) ?? sweater.colourways[0], project.trim),
    [sweater, project.colourwayId, project.trim],
  );
  const palette = useMemo(() => paletteOf(colourway, project.shades), [colourway, project.shades]);
  const metres = useMemo(() => metresFor(size, stitches, rounds), [size, stitches, rounds]);

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

  const choicesRef = useRef<HTMLElement>(null);
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
  const eyebrow = `${sweater.name} · ${size.label} · ${colourwayLabel(colourway, project.shades)}`;
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
            {sweater.slots.map((slot) => (
              <li key={slot}>
                <span className="swatch" style={{ background: yarnFor(palette, slot).hex }} />
                {slot} · {yarnFor(palette, slot).name}
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
      aside={
        <Link to={chartPath(project.id, !position.finished)} className="btn btn-primary">
          {position.finished ? "Open the chart" : knitLabel}
        </Link>
      }
    >
      <div className="project-layout">
        <div className="project-stage">
          <SweaterModel
            sweaterId={sweater.id}
            sizeId={size.id}
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
      <section className="section" ref={choicesRef}>
        <h2>Your wool</h2>
        {/*
          The design's own colourways first, because they are where most
          people start, then the wool itself. Choosing one sets every yarn
          at once; a row below changes any of them afterwards.
        */}
        <ColourwayChoice
          colourways={sweater.colourways}
          colourway={colourway}
          overrides={project.shades ?? {}}
          palette={palette}
          body={body}
          onStartFrom={setColourway}
          trim={sweater.trim}
          onTrim={setTrim}
          until={choicesRef}
        />
        <WoolList
          colourway={colourway}
          metres={metres}
          stated={size.yardage !== undefined}
          overrides={project.shades ?? {}}
          onChange={setShade}
          body={body}
          palette={palette}
        />
      </section>

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
