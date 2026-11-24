import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { ballsOf, colourwayLabel, lit, paletteOf, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
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
  renameProject,
  deleteProject,
  keepKnitting,
  dropUnknitted,
  madeWith,
  withMade,
  storageKeyFor,
} from "../../projects/projects";
import { addressOf, linkOf, linkParam, readLink } from "../../projects/link";
import { askToKeep } from "../../projects/keeping";
import Restore from "./Restore";
import PageLayout from "./ui/PageLayout";
import StageLayout from "./ui/StageLayout";
import Dialog from "./ui/Dialog";
import NameDialog from "./ui/NameDialog";
import Button from "./ui/Button";
import SweaterModel from "./SweaterModel";
import Chart from "../chart/Chart";
import KnittingPanel from "./KnittingPanel";
import { KeySheet } from "./KnitKey";
import { recordProgress } from "../../projects/timing/log";
import { useKnittingTime, useTimeDetail, useTimeRecording } from "../useKnittingTime";
import { TimeFigures } from "./KnittingTime";
import { formatDate } from "../../projects/timing/format";
import { SpeedsSheet, StatsPanel, StitchTime } from "./StatsView";
import { statsOverlay, type Layer } from "../chart/timing-overlay";
import WoolList from "./WoolList";
import { type Chosen } from "./Shades";
import ViewTabs from "../chart/ViewTabs";
import { sceneFor } from "../chart/view-scene";
import { ColourwayGrid } from "./ColourwayChoice";
import { yokePicture } from "./bodyPicture";
import { ColoursAdjust, TrimSheet } from "./ColoursAdjust";
import { useColourwayChoice } from "../useColourwayChoice";
import { useTabAddress } from "../useTabAddress";
import type { PageGroup } from "./ui/Pages";
import Customise from "./Customise";
import { Schematic } from "./Schematic";
import { Measurements } from "./Measurements";
import "./Project.css";

/** Marks a chart page's address as open on Explore statistics. */
const statsParam = "stats";

/** "Under 1%", "3%": how far through, never rounded up to done. */
const percentKnitted = (worked: number, percent: number) =>
  `${worked > 0 && percent < 1 ? "Under 1" : Math.floor(percent)}%`;

/** No wool chosen of the knitter's own: one object, so what is drawn from it is not drawn again for nothing. */
const noShades: Overrides = {};

/**
 * Under the chart while you look around it and are not knitting: where the
 * knitting is, the key and the time spent, and the way back to the needles.
 */
const LookBar: React.FC<{
  percent: number;
  worked: number;
  where: string;
  finished: boolean;
  onKnit: () => void;
  onKey: () => void;
  /** Opens the time spent, over the chart; absent while there is none to show. */
  onStats?: () => void;
}> = ({ percent, worked, where, finished, onKnit, onKey, onStats }) => (
  <section className="stage-bar look-bar" aria-label="Your progress">
    <div className="stage-bar-text">
      <strong>{finished ? "Finished" : where}</strong>
      <span className="quiet">{finished ? "100%" : percentKnitted(worked, percent)} knitted</span>
    </div>
    <Button variant="quiet" onClick={onKey}>
      Key
    </Button>
    {onStats && (
      <Button variant="quiet" onClick={onStats}>
        Time
      </Button>
    )}
    <Button variant="primary" onClick={onKnit}>
      {finished ? "See the last stitch" : worked > 0 ? "Keep knitting" : "Start knitting"}
    </Button>
  </section>
);

/**
 * A jumper's link, to keep or to send: its address, which says everything
 * that makes it (see projects/link). Copied, or handed to whatever the
 * device shares with, where it has that.
 */
const JumperLink: React.FC<{ project: SavedProject; title: string }> = ({ project, title }) => {
  const [said, setSaid] = useState("");
  // Shown to be copied by hand, where the browser will not copy it.
  const [shown, setShown] = useState<string>();
  const copy = async () => {
    const address = addressOf(project);
    try {
      await navigator.clipboard.writeText(address);
      setSaid("Link copied.");
    } catch {
      setShown(address);
    }
  };
  const share = () => {
    // Put away without sending is no failure, and nothing to say.
    void navigator.share({ title, url: addressOf(project) }).catch(() => undefined);
  };
  return (
    <div className="jumper-link">
      <p className="quiet">
        This jumper is kept in this browser, which may clear it. Its link makes it again anywhere, with its pattern, its wool and your place: keep a copy, or
        send it to someone to knit one like it.
      </p>
      <p className="jumper-manage">
        <Button onClick={copy}>Copy link</Button>
        {typeof navigator.share === "function" && <Button onClick={share}>Share link</Button>}
        <span className="quiet" role="status">
          {said}
        </span>
      </p>
      {shown && <input className="jumper-link-shown" readOnly aria-label="This jumper's link" value={shown} onFocus={(event) => event.target.select()} />}
    </div>
  );
};

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

/** How near the knitting is to a view of the chart, in stitches, for it to be laid out ahead: a round or two of a yoke. */
const aheadOfView = 1000;

/** A value once it has stopped changing for a while: the first at once, and each after when nothing has followed it. */
const useSettled = <T,>(value: T, ms: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const waiting = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(waiting);
  }, [value, ms]);
  return settled;
};

/** The tabs of a jumper's page, under its stage: each a few pages side by side. */
const jumperTabs = ["progress", "wool", "fit"] as const;

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
  /*
   * The jumper's link, kept in its address as the jumper changes (see
   * projects/link), replacing what was there. Whatever holds the address
   * then holds the jumper as it last was.
   *
   * Progress changes a stitch at a time, and writing the address draws the
   * page again: so it is written once the knitting has paused, not at every
   * tap, where it would get in the way of the next. And at once as the page
   * is put away - the phone locked mid-round, the tab left - straight into
   * the address, as nothing is drawn then; the router is told when the page
   * is back.
   */
  const linkNow = useMemo(() => (project && sweater ? linkOf(project) : undefined), [project, sweater]);
  // A jumper that was not here and now is - made again from its link (see Restore) - has waited for nothing: its link is written at once.
  const link = useSettled(linkNow, 3000) ?? linkNow;
  // An old address that asks for the knitting on the jumper's page is being sent on to the chart (see below), which is where it is written.
  const sentOn = view === "overview" && knitting;
  const { pathname } = useLocation();
  useEffect(() => {
    if (!link || sentOn || params.get(linkParam) === link) return;
    /*
     * Only into the address this page is the page of. An address changed
     * from outside the page - typed, or gone back to - is the browser's at
     * once and the page's a moment after; written in between, the link
     * would be written over where the knitter was going, and they would
     * stay where they were. The page is drawn again when it has caught up,
     * and the link is written then.
     */
    const [path, search = ""] = window.location.hash.slice(1).split("?");
    // All but the link itself, which is written straight into the address as the page is put away (see below).
    const but = (all: URLSearchParams) => {
      const rest = new URLSearchParams(all);
      rest.delete(linkParam);
      return rest.toString();
    };
    if (path !== pathname || but(new URLSearchParams(search)) !== but(params)) return;
    const next = new URLSearchParams(params);
    next.set(linkParam, link);
    setParams(next, { replace: true });
  }, [link, sentOn, pathname, params, setParams]);
  useEffect(() => {
    if (!linkNow || sentOn) return;
    const putAway = () => {
      if (document.visibilityState !== "hidden") return;
      const [path, search = ""] = window.location.hash.split("?");
      const now = new URLSearchParams(search);
      if (now.get(linkParam) === linkNow) return;
      now.set(linkParam, linkNow);
      window.history.replaceState(window.history.state, "", `${path}?${now}`);
    };
    document.addEventListener("visibilitychange", putAway);
    window.addEventListener("pagehide", putAway);
    return () => {
      document.removeEventListener("visibilitychange", putAway);
      window.removeEventListener("pagehide", putAway);
    };
  }, [linkNow, sentOn]);
  // And the browser asked to keep what it stores, now that there is a jumper to keep.
  useEffect(() => {
    if (project) askToKeep();
  }, [project]);
  // The update taken as published: every stitch knitted is the same in it, so the project's place is where it was. See PatternUpdated.
  const takeUpdate = useCallback(() => {
    change((current) => {
      const edition = currentEdition(current.sweaterId, current.sizeId);
      if (!edition) return current;
      // A published edition again: nothing of its own to say how it was made.
      const { upTo, made, ...rest } = current;
      void upTo;
      void made;
      return { ...rest, edition };
    });
    dropUnknitted();
  }, [change]);
  // An update that changes nothing ahead, seen: the project knits on what it has, which is up to date with it.
  const seeUpdate = useCallback(() => {
    change((current) => ({ ...current, edition: editionOf(current), upTo: currentEdition(current.sweaterId, current.sizeId) }));
  }, [change]);
  // The update taken from a round: the knitter's rounds to it and the update's from there, knitting of the project's own.
  const joinUpdate = useCallback(async (knitting: SweaterStitches, round: number) => {
    const current = currentProject.current;
    if (!current) return;
    const file = await asEdition(knitting, current.sweaterId, current.sizeId);
    if (!keepKnitting(file)) return;
    change((now) => {
      const to = currentEdition(now.sweaterId, now.sizeId);
      return { ...withMade(now, to ? madeWith(now, { join: to, round }) : undefined), edition: file.edition, upTo: to };
    });
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
      ...withMade(current, madeWith(current, { fit: fitted.tension, ...(fitted.round === undefined ? {} : { round: fitted.round }), ...(fitted.option ? { option: fitted.option } : {}) })),
      edition: fitted.file.edition,
      fit: {
        tension: fitted.tension,
        finished: fitted.finished,
        round: fitted.round,
        // The published edition it left, through any fit before this one: none, where what it left was knitting of its own - joined to an update - which is not kept to go back to.
        from: current.fit ? current.fit.from : current.made ? undefined : editionOf(current),
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
      const { fit, upTo, made, ...rest } = current;
      void upTo;
      void made;
      // Back to a published edition: nothing of its own to say how it was made.
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

  // Every wool back to the colourway's own; the trim, which is the colourway's, stays as chosen.
  const resetShades = useCallback(() => {
    change((current) => ({ ...current, shades: undefined }));
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
    // Its address may say what it is all the same, and it is offered to be made again: see Restore.
    const linked = readLink(params.get(linkParam));
    if (linked && projectId && storageKeyFor(projectId) === linked.id) return <Restore linked={linked} />;
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
      resetShades={resetShades}
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
  resetShades: () => void;
  setTension: (tension: Tension | undefined) => void;
  takeUpdate: () => void;
  seeUpdate: () => void;
  joinUpdate: (knitting: SweaterStitches, round: number) => void;
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
  resetShades,
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
  /*
   * The view the knitting comes to next, laid out ahead while it is near:
   * a sleeve put on hold takes the chart to what is left on the needles, a
   * view laid out for the first time as it is shown, and the tap that put
   * it on hold took nearly two fifths of a second on a phone. Laid out a
   * moment after a tap, while the stitches before it are knitted, and its
   * chart made (see below), it is to hand then.
   */
  const nextView = useMemo(
    () => (knitting ? views.filter((one) => one.begins > project.progress).sort((a, b) => a.begins - b.begins)[0] : undefined),
    [knitting, views, project.progress],
  );
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
  // Not while knitting, where it isn't shown: see useKnittingTime.
  const time = useKnittingTime(view === "chart" && knitting ? undefined : project.id, stitches, project.progress);

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

  // The yoke's bands, for the strips that show the wool being chosen: placed, where a strip would shear them.
  const placed = yokePicture(built);
  const body = useMemo(() => ({ stitches, rounds: yoke, front: placed }), [stitches, yoke, placed]);

  // The full key, over the lower part of the screen while knitting.
  const [keyOpen, setKeyOpen] = useState(false);
  const closeKey = useCallback(() => setKeyOpen(false), []);
  useEffect(() => setKeyOpen(false), [knitting]);
  // The chart is a view over the jumper's page: the way out of it, in the corner every view's is in.
  const close = (
    <Link to={overviewPath(project.id)} className="chart-close" aria-label="Close the chart">
      {/* Drawn, not typed: the site's faces have no cross, and a phone puts a boxed question mark in its place. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </Link>
  );
  /*
   * The jumper's page: which tab it shows, and what comes up over it. The
   * tab is kept in the address (see useTabAddress), and known here as well,
   * at once, for what the stage shows over it.
   */
  const navigate = useNavigate();
  const { first, onShown: tabShown, pager } = useTabAddress(jumperTabs);
  const [shownTab, setShownTab] = useState<string>(first);
  const onShown = useCallback(
    (tab: string) => {
      setShownTab(tab);
      tabShown(tab);
    },
    [tabShown],
  );
  /** What is up from the foot over the pages, if anything: the trim, or the colourway's wools to change. See Sheet and Customise. */
  const [sheet, setSheet] = useState<"trim" | "customise">();
  const closeSheet = useCallback(() => setSheet(undefined), []);
  /** The ball Customise opens on, where a row of the wool list asked for it. */
  const [customiseOn, setCustomiseOn] = useState<SlotId[]>();
  const customiseFrom = useCallback((slots: SlotId[] | undefined) => {
    setCustomiseOn(slots);
    setSheet("customise");
  }, []);
  // The design's colourways, to start again from: a page a group, as on the design's page.
  const choice = useColourwayChoice({ colourways: sweater.colourways, colourway, overrides: project.shades ?? noShades, onStartFrom: setColourway });
  /** The yarns lit on the jumper while one of its wools is being changed. */
  const [lighting, setLighting] = useState<SlotId[]>();
  const onStage = useMemo(() => (lighting ? lit(palette, lighting) : palette), [palette, lighting]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Only the wool this size knits: a smaller size leaves the last bands' colours out.
  const balls = useMemo(() => ballsOf(colourway, metres, project.shades).filter((ball) => ball.metres > 0), [colourway, metres, project.shades]);
  const run = currentRun(stitches, project.progress, index);
  // Which side is towards you, for the key to read the chart's symbols from: see Chart.
  const turnIds = useMemo(
    () => stitches.filter((stitch) => stitch.type === "turn").map((stitch) => stitch.id),
    [stitches],
  );
  const face = faceAfter(turnIds, project.progress);
  /*
   * And its chart made, as the chart will ask for it there: see sceneFor. So
   * too, from the jumper's page, the chart of the view the knitting is in,
   * which Keep knitting opens: the first time in a visit, it was made in
   * the tap, half a second on a phone.
   */
  const makeOneLean = sweater.stitchNotes?.m1?.lean;
  const ahead =
    view === "overview" ? knittingIn : nextView && nextView.begins - project.progress <= aheadOfView ? nextView : undefined;
  useEffect(() => {
    if (!ahead) return;
    // Laid out, then its chart made, each a task of its own, so that a tap waits for one at most.
    let timer = setTimeout(() => {
      const { layout, markers } = viewChart(built, counted, ahead);
      timer = setTimeout(() => {
        sceneFor(layout, { stitches, rounds: counted.rounds, face, makeOneLean, markers, names, pieces: sweater.pieces, holdRegions });
      }, 50);
    }, view === "overview" ? 1200 : 600);
    return () => clearTimeout(timer);
  }, [ahead, view, project.progress, built, counted, stitches, face, makeOneLean, names, sweater.pieces, holdRegions]);
  const currentStitch = run ? keyEntryAt(stitches, run.startId, sweater.stitchNotes)?.id : undefined;

  const title = project.name ?? sweater.name;
  // A jumper with a name of its own says which design it is in the small line; one without is that design, yours.
  const eyebrow = `${project.name ? sweater.name : "your jumper"} · ${size.label}`;
  const knitLabel = counts.worked > 0 ? "Keep knitting" : "Start knitting";

  if (exploring && detail && time) {
    return (
      <PageLayout title={title} eyebrow={eyebrow} showTitle={false} className="knit-screen is-looking is-timing">
        <section className="section chart-page" data-view={shownView?.id}>
          {tabs}
          {close}
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
      <PageLayout title={title} eyebrow={eyebrow} showTitle={false} className={knitting ? "knit-screen" : "knit-screen is-looking"}>
        <section className="section chart-page" data-view={shownView?.id}>
          {!knitting && tabs}
          {close}
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
          <LookBar
            percent={counts.percent}
            worked={counts.worked}
            where={whereYouAre(position)}
            finished={position.finished}
            onKnit={() => setKnitting(true)}
            onKey={() => setKeyOpen(true)}
            onStats={time && (() => setExploring(true))}
          />
        )}
        {keyOpen && (
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

  const bought = balls.reduce((total, ball) => total + ball.balls, 0);
  // What the sweater measures: the size's own, or what the rest was fitted to.
  const worn = fitted ? { ...size, ...fitted } : size;

  /*
   * Where the knitting is: how far, the chart at the needle to say where
   * that is in the pattern, and the one way forward. The page a jumper opens
   * on, and all of it in the room there is.
   */
  const nowPage = (
    <div className="jumper-now">
      <p className="jumper-progress">
        <em>{position.finished ? "100%" : percentKnitted(counts.worked, counts.percent)}</em>
        <span className="quiet jumper-progress-counts">
          <span>
            {counts.worked.toLocaleString()} of {counts.total.toLocaleString()} stitches
          </span>
          {!position.finished && <span>{counts.remaining.toLocaleString()} to go</span>}
        </span>
        <span className="jumper-track" aria-hidden="true">
          <span style={{ width: `${counts.percent}%` }} />
        </span>
      </p>
      {/* The whole of the chart is a tap away. */}
      <Link to={chartPath(project.id)} className="chart-window" aria-label="View chart">
        <div className="chart-fills" {...{ inert: "" }}>
          <section className="chart-page">
            <Chart
              stitches={stitches}
              rounds={counted.rounds}
              layout={counted.layout}
              markers={counted.markers}
              palette={palette}
              progress={project.progress}
              follow
              stitchNotes={sweater.stitchNotes}
              pieces={sweater.pieces}
              kinds={counted.kinds}
              roundPieces={counted.pieces}
              holdRegions={holdRegions}
            />
          </section>
        </div>
        <span className="chart-window-label">
          <strong>{position.finished ? "Finished" : whereYouAre(position)}</strong>
          <span className="quiet">View chart</span>
        </span>
      </Link>
      <Link to={chartPath(project.id, !position.finished)} className="btn btn-primary btn-lg jumper-knit">
        {position.finished ? "Open the chart" : knitLabel}
      </Link>
    </div>
  );

  const timePage = time && (
    <>
      <dl className="measurements jumper-time">
        <TimeFigures time={time} finished={position.finished} />
      </dl>
      <p>
        <Link to={`${chartPath(project.id)}?${statsParam}=1`}>See your time on the chart</Link>
      </p>
    </>
  );

  // The jumper as a thing kept: what it is and since when, naming it, and doing away with it.
  const keptPage = (
    <>
      <p className="jumper-kept">
        <strong>{sweater.name}</strong>
        <span className="quiet">
          Size {size.label} · started {formatDate(project.startedAt)}
        </span>
      </p>
      <p className="jumper-manage">
        <Button onClick={() => setRenaming(true)}>Rename</Button>
        <Button onClick={() => setDeleting(true)}>Delete</Button>
      </p>
      <JumperLink project={project} title={project.name ?? sweater.name} />
    </>
  );

  // At the foot of its wool's tab, what is done to the colourway in use: see ColoursAdjust.
  const adjust = (
    <ColoursAdjust
      trim={sweater.trim}
      colourway={colourway}
      given={published}
      trimChosen={project.trim}
      own={choice.own}
      onTrim={() => setSheet("trim")}
      onWool={() => customiseFrom(undefined)}
    />
  );

  const woolPage = (
    <>
      <p className="your-colourway">
        <strong>{colourwayLabel(colourway, project.shades)}</strong>{" "}
        <span className="quiet">
          · {balls.length} {balls.length === 1 ? "shade" : "shades"} · {bought} {bought === 1 ? "ball" : "balls"}
        </span>
      </p>
      <WoolList
        colourway={colourway}
        metres={metres}
        stated={size.yardage !== undefined && !fitted}
        overrides={project.shades ?? noShades}
        onPick={customiseFrom}
      />
    </>
  );

  // Whether the rest can still be recalculated: the design can, and the whole sweater is still one round on the needles.
  const canFit = mayFit(sweater, built, project.progress);
  const tensionPage = (
    <MyTension key={project.id} size={size} fitted={fitted} tension={project.tension} onChange={setTension} recalculates={canFit}>
      {/* Where the rest is recalculated for this tension already, it says so; where it could be, it offers to; and where it is too late to, it says why nothing is offered. */}
      {project.tension && !sameTension(fitted ?? size, project.tension) && sweater.fitting && !canFit && (
        <p className="quiet refit-late">
          {sweater.fitting.partWay
            ? "The rest can only be recalculated while the whole yoke is still on the needles. Yours is past that, so the pattern carries on as written."
            : "This design can only be recalculated for a tension before it is cast on, so this pattern carries on as written. To knit it at your tension, start another from the design's page and give your tension there."}
        </p>
      )}
      {project.tension && (sameTension(fitted ?? size, project.tension) ? !!fitted : canFit) && (
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
  );

  /*
   * The same three tabs a jumper has always had, each now a few pages side
   * by side (see Pages). Progress is the way forward, and opens on it: the
   * button that was in a bar at the foot is on its first page.
   */
  const groups: PageGroup[] = [
    {
      id: "progress",
      label: "Progress",
      forward: true,
      pages: [
        // A pattern that has moved on is said before anything else of the knitting.
        ...(updated ? [{ id: "updated", label: "Pattern updated", content: updated }] : []),
        { id: "now", label: "Where you are", content: nowPage },
        ...(timePage ? [{ id: "time", label: "Your time", content: timePage }] : []),
        { id: "kept", label: "This jumper", content: keptPage },
      ],
    },
    {
      id: "wool",
      label: "Wool",
      foot: adjust,
      pages: [
        { id: "list", label: "Your wool", content: woolPage },
        // The design's colourways, to start again from: the same pages its own page has.
        ...choice.groups.map(([name, options]) => ({
          id: `group-${name ?? ""}`,
          label: name ?? "Colourways",
          content: <ColourwayGrid options={options} chosen={colourway.id} body={body} onChoose={choice.choose} />,
        })),
      ],
    },
    {
      id: "fit",
      label: "Fit",
      pages: [
        { id: "tension", label: "Your tension", content: tensionPage },
        { id: "flat", label: `Size ${size.label}, laid flat, to scale`, content: <Schematic size={worn} /> },
        { id: "measurements", label: `Size ${size.label}, finished`, content: <Measurements size={worn} /> },
      ],
    },
  ];

  return (
    <>
      <StageLayout
        title={title}
        eyebrow={eyebrow}
        stage={
          <SweaterModel
            sweaterId={sweater.id}
            sizeId={size.id}
            edition={edition}
            palette={onStage}
            // Over its wool the jumper is drawn whole in it, knitted or not: a colourway chosen there is seen on it at once, as on the design's page. Elsewhere, only as far as it is knitted.
            progress={shownTab === "wool" ? (stitches[stitches.length - 1]?.id ?? 0) : project.progress}
            fill
          />
        }
        badge={colourwayLabel(colourway, project.shades)}
        tabsLabel="This jumper"
        groups={groups}
        first={first}
        onShown={onShown}
        pages={pager}
        sheet={
          sheet === "customise" ? (
            <Customise
              sweater={sweater}
              built={built}
              colourway={colourway}
              overrides={project.shades ?? noShades}
              metres={metres}
              onChange={setShade}
              onReset={resetShades}
              onDone={closeSheet}
              first={customiseOn}
              onLight={setLighting}
            />
          ) : sheet === "trim" ? (
            <TrimSheet trim={sweater.trim} colourway={colourway} given={published} chosen={project.trim} onTrim={setTrim} onClose={closeSheet} />
          ) : undefined
        }
      />
      {choice.confirm}
      {renaming && (
        <NameDialog
          open
          title="Name this project"
          text="Something to tell it apart from the others."
          initialValue={project.name ?? ""}
          onCancel={() => setRenaming(false)}
          onConfirm={(name) => {
            renameProject(project.id, name);
            setRenaming(false);
          }}
        />
      )}
      {deleting && (
        <Dialog
          open
          title="Delete this project?"
          text="This only forgets how far you had got. The design itself is not going anywhere."
          confirmLabel="Delete"
          confirmVariant="danger"
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            deleteProject(project.id);
            navigate("/");
          }}
        />
      )}
    </>
  );
};

export default Project;
