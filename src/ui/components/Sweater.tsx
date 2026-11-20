import React, { startTransition, useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { Placement, SlotId, Tension } from "../../pattern/design";
import { defaultSize } from "../../reading/counted";
import { useSweater } from "../useSweater";
import { useColourway } from "../useColourway";
import { currentEdition } from "../../library/editions";
import type { Fitted } from "../../library/fit";
import { sameTension } from "../../reading/tension";
import { ballsOf, colourwayLabel, lit, paletteOf, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
import { totals } from "../../reading/progress";
import { metresFor } from "../../reading/yardage";
import { chartPath, keepKnitting, startProject } from "../../projects/projects";
import PageLayout from "./ui/PageLayout";
import StageLayout from "./ui/StageLayout";
import type { PageGroup } from "./ui/Pages";
import Button from "./ui/Button";
import SweaterModel from "./SweaterModel";
import Customise from "./Customise";
import { type Chosen } from "./Shades";
import { ColourwayGrid } from "./ColourwayChoice";
import { ColoursAdjust, TrimSheet } from "./ColoursAdjust";
import { useColourwayChoice } from "../useColourwayChoice";
import { useTabAddress } from "../useTabAddress";
import MyTension from "./MyTension";
import StartFitted from "./StartFitted";
import { Schematic } from "./Schematic";
import { Measurements } from "./Measurements";
import "./Sweater.css";

/**
 * One design: the jumper itself, kept on screen, and under it, a page at a
 * time, what it is, then what there is to choose - a size, with the
 * knitter's own tension, and its colours - and at the end of them what was
 * chosen and the one way to start knitting it. See StageLayout and Pages.
 *
 * Every size of a sweater is different knitting - its own cast-on, its own
 * increases, its own divide - so changing size rebuilds the knitting, where
 * changing colourway only recolours it.
 */
const Sweater: React.FC = () => {
  const { sweaterId } = useParams();
  const sweater = sweaterId ? sweaterById(sweaterId) : undefined;
  if (!sweater) {
    return (
      <PageLayout title="Not a design we know">
        <p>
          <Link to="/">Back to the designs</Link>
        </p>
      </PageLayout>
    );
  }
  return <SweaterPage key={sweater.id} sweaterId={sweater.id} />;
};

const tabs = ["about", "size", "colours", "start"] as const;

const SweaterPage: React.FC<{ sweaterId: string }> = ({ sweaterId }) => {
  const sweater = sweaterById(sweaterId)!;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("size");
  const [sizeId, setSizeId] = useState(
    (requested && sweater.sizes.some((size) => size.id === requested) ? requested : undefined) ??
      defaultSize(sweater).id,
  );
  // The tab shown is kept in the address: see useTabAddress. An address from when the tension had a tab of its own is given its page, which is the size's.
  const { first, firstPage, onShown, pager, go } = useTabAddress(tabs, { tension: ["size", "tension"] });

  const [colourwayId, setColourwayId] = useState(sweater.colourways[0].id);
  const [trim, setTrim] = useState<string>();
  /*
   * The wool a knitter has chosen for themselves, over the colourway they
   * started from. Starting again from another of the design's clears it.
   */
  const [own, setOwn] = useState<Overrides>({});
  const size = sweater.sizes.find((s) => s.id === sizeId) ?? sweater.sizes[0];
  const built = useSweater(sweater, size.id);
  const { stitches, rounds, index, yoke } = built;
  /** The knitter's own tension, where they have one before they begin: see StartFitted. */
  const [tension, setTension] = useState<Tension>();
  /** A pattern worked out for that tension, while it is being shown: starting then starts that one, not the pattern as written. */
  const [shownFit, setShownFit] = useState<Fitted>();
  /** What is up from the foot over the pages, if anything: the trim, or the colourway's wools to change. See Sheet. */
  const [sheet, setSheet] = useState<"trim" | "customise">();
  const closeSheet = useCallback(() => setSheet(undefined), []);
  /** The yarns lit on the jumper while one of its wools is being changed: see Customise. */
  const [lighting, setLighting] = useState<SlotId[]>();

  const published = useMemo(() => sweater.colourways.find((c) => c.id === colourwayId) ?? sweater.colourways[0], [sweater, colourwayId]);
  const { on: laidOn } = useColourway(published, undefined);
  const colourway = useMemo(() => trimmed(published, trim), [published, trim]);
  const palette = useMemo(() => paletteOf(colourway, own), [colourway, own]);
  const onStage = useMemo(() => (lighting ? lit(palette, lighting) : palette), [palette, lighting]);
  // The colourway as it would be on a sweater planned for the knitter, with the wools that would add: for the preview of one.
  const coloursOn = useCallback(
    (placement: Placement | undefined) => {
      const there = trimmed(laidOn(placement), trim);
      return { palette: paletteOf(there, own), added: woolsAdded(colourway, there) };
    },
    [laidOn, colourway, trim, own],
  );
  const metres = useMemo(() => metresFor(size, stitches, rounds), [size, stitches, rounds]);
  const counts = useMemo(() => totals(index, 0), [index]);
  const balls = useMemo(() => ballsOf(colourway, metres, own).filter((ball) => ball.metres > 0), [colourway, metres, own]);
  const anyApproximate = balls.some((ball) => ball.yarn.approximate);

  /*
   * A ball of wool does every yarn of the design it is put in, so choosing
   * one sets them together. See Customise.
   */
  const choose = useCallback(
    (slots: SlotId[], chosen: Chosen | undefined) =>
      setOwn((current) => {
        const next = { ...current };
        slots.forEach((slot) => {
          if (chosen) next[slot] = chosen;
          else delete next[slot];
        });
        return next;
      }),
    [],
  );
  const resetOwn = useCallback(() => setOwn({}), []);
  // Starting from another of the design's colourways: every yarn its own again, and its own trim.
  const startFrom = useCallback((id: string) => {
    setColourwayId(id);
    setTrim(undefined);
    setOwn({});
  }, []);
  const choice = useColourwayChoice({ colourways: sweater.colourways, colourway, overrides: own, onStartFrom: startFrom });

  // A project is made only now, so browsing designs never leaves one behind.
  const start = () => {
    // A tension given here goes with it, as the knitter's own: the jumper's page compares it with the pattern, and offers to fit the rest to it.
    const project = startProject(sweater.id, size.id, colourway.id, own, trim, tension ? { tension } : undefined);
    navigate(chartPath(project.id, true));
  };
  // And one begun on a pattern worked out for its knitter: the knitting its own from the cast-on, kept on the device first.
  const startFitted = (fitted: Fitted) => {
    if (!keepKnitting(fitted.file)) return;
    const from = currentEdition(sweater.id, size.id);
    const project = startProject(sweater.id, size.id, colourway.id, own, trim, {
      edition: fitted.file.edition,
      tension: fitted.tension,
      fit: {
        tension: fitted.tension,
        finished: fitted.finished,
        ...(from ? { from } : {}),
        ...(fitted.option ? { option: fitted.option } : {}),
        ...(fitted.placement ? { placement: fitted.placement } : {}),
      },
      // How it was made, to be made again where it is not kept: see projects' Made.
      made: { steps: [{ fit: fitted.tension, ...(fitted.option ? { option: fitted.option } : {}) }] },
      ...(from ? { upTo: from } : {}),
    });
    navigate(chartPath(project.id, true));
  };

  // The yoke's bands, for the strips that show each colourway.
  const body = useMemo(() => ({ stitches, rounds: yoke }), [stitches, yoke]);
  const bought = balls.reduce((total, ball) => total + ball.balls, 0);
  const changed = choice.own;

  const choosing = (
    <>
      <div className="size-chooser">
        {sweater.sizes.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`size-option${option.id === size.id ? " is-chosen" : ""}`}
            aria-pressed={option.id === size.id}
            onClick={() => startTransition(() => setSizeId(option.id))}
          >
            <strong>{option.label}</strong>
            <span className="quiet">{option.fits ?? `to fit ${option.toFitChestCm}cm`}</span>
          </button>
        ))}
      </div>
      <p className="quiet">
        About {Math.round(size.finished.chestCm - size.toFitChestCm)}cm of ease at the chest. Each size is its own knitting, and the chart follows the one you choose.
      </p>
    </>
  );

  // Under every page of colourways, what is done to the one chosen: see ColoursAdjust.
  const adjust = (
    <ColoursAdjust
      trim={sweater.trim}
      colourway={colourway}
      given={published}
      trimChosen={trim}
      own={changed}
      onTrim={() => setSheet("trim")}
      onWool={() => setSheet("customise")}
    />
  );

  const tensionPanel = (
    <MyTension key={size.id} size={size} tension={tension} onChange={setTension} recalculates={!!sweater.fitting} partWay={!!sweater.fitting?.partWay}>
      {tension && sweater.fitting && !sameTension(size, tension) && (
        <StartFitted sweater={sweater} size={size} knitted={built} tension={tension} palette={palette} coloursOn={coloursOn} onStart={startFitted} onShown={setShownFit} />
      )}
    </MyTension>
  );

  /*
   * The end of the pages: what was chosen, each line the way back to where
   * it is chosen, and the one way forward.
   */
  const ready = (
    <div className="ready">
      <div className="ready-choices">
        <button type="button" onClick={() => go("size")}>
          <span className="ready-what">Size</span>
          <span className="ready-chosen">
            <strong>{size.label}</strong> <span className="quiet">{size.fits ?? `to fit ${size.toFitChestCm}cm`}</span>
          </span>
        </button>
        <button type="button" onClick={() => go("colours")}>
          <span className="ready-what">Colours</span>
          <span className="ready-chosen">
            <strong>{colourwayLabel(colourway, own)}</strong>{" "}
            <span className="quiet">
              {balls.length} {balls.length === 1 ? "shade" : "shades"}, {bought} {bought === 1 ? "ball" : "balls"}
            </span>
          </span>
        </button>
        <button type="button" onClick={() => go("size", "tension")}>
          <span className="ready-what">Tension</span>
          <span className="ready-chosen">
            {shownFit ? (
              <>
                <strong>Recalculated for yours</strong>{" "}
                <span className="quiet">
                  {shownFit.tension.stitchesPer10cm} stitches &amp; {shownFit.tension.roundsPer10cm} rounds to 10cm
                </span>
              </>
            ) : (
              <>
                <strong>As the pattern</strong>{" "}
                <span className="quiet">
                  {size.stitchesPer10cm} stitches &amp; {size.roundsPer10cm} rounds to 10cm
                  {tension && !sameTension(size, tension) ? `; yours is ${tension.stitchesPer10cm} & ${tension.roundsPer10cm}` : ""}
                </span>
              </>
            )}
          </span>
        </button>
      </div>
      <Button variant="primary" size="lg" className="ready-start" onClick={shownFit ? () => startFitted(shownFit) : start}>
        Start knitting
      </Button>
      <p className="quiet ready-note">
        {counts.total.toLocaleString()} stitches over {rounds.length} rounds. Nothing is kept until you start.
      </p>
    </div>
  );

  const about = (
    <div className="sweater-about">
      <p>{sweater.story}</p>
      <p>By {sweater.designer}.</p>
      <p className="quiet">{sweater.credit}</p>
      <p className="quiet">
        {colourway.brand} {colourway.yarn}
        {colourway.ballMetres !== undefined && colourway.ballGrams !== undefined ? `, ${colourway.ballMetres}m per ${colourway.ballGrams}g ball` : ""} ·{" "}
        <a href={colourway.url} target="_blank" rel="noreferrer">
          {colourway.url.replace(/^https?:\/\//, "")}
        </a>
        . The colours come from the spinners' own photographs of the wool, so they are close rather than exact.
        {anyApproximate ? " Some shades use approximate colours where an exact match is unavailable." : ""}
      </p>
    </div>
  );

  const groups: PageGroup[] = [
    // What the design is, before anything is chosen of it.
    { id: "about", label: "About", pages: [{ id: "about", label: "About this design", content: about }] },
    {
      id: "size",
      label: "Size",
      pages: [
        { id: "choose", label: "Choose a size", content: choosing },
        { id: "flat", label: `Size ${size.label}, laid flat, to scale`, content: <Schematic size={size} /> },
        { id: "measurements", label: `Size ${size.label}, finished`, content: <Measurements size={size} /> },
        // The knitter's own tension is what the size comes out at in their hands: the last of its pages.
        { id: "tension", label: "Your tension", content: tensionPanel },
      ],
    },
    {
      id: "colours",
      label: "Colours",
      pages: choice.groups.map(([name, options]) => ({
        id: `group-${name ?? ""}`,
        label: name ?? "Colourways",
        content: (
          <>
            <ColourwayGrid options={options} chosen={colourway.id} body={body} onChoose={choice.choose} />
            {adjust}
          </>
        ),
      })),
    },
    { id: "start", label: "Start", forward: true, pages: [{ id: "ready", label: "Ready to knit", content: ready }] },
  ];

  return (
    <>
      <StageLayout
        title={sweater.name}
        eyebrow="a design"
        stage={<SweaterModel sweaterId={sweater.id} sizeId={size.id} palette={onStage} progress={stitches[stitches.length - 1]?.id ?? 0} fill />}
        badge={`${size.label} · ${colourwayLabel(colourway, own)}`}
        tabsLabel="This design"
        groups={groups}
        first={first}
        firstPage={firstPage}
        onShown={onShown}
        pages={pager}
        sheet={
          sheet === "customise" ? (
            <Customise
              sweater={sweater}
              built={built}
              colourway={colourway}
              overrides={own}
              metres={metres}
              onChange={choose}
              onReset={resetOwn}
              onDone={closeSheet}
              onLight={setLighting}
            />
          ) : sheet === "trim" ? (
            <TrimSheet trim={sweater.trim} colourway={colourway} given={published} chosen={trim} onTrim={setTrim} onClose={closeSheet} />
          ) : undefined
        }
      />
      {choice.confirm}
    </>
  );
};

export default Sweater;
