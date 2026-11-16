import React, { startTransition, useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { Placement, SlotId, SizeAbout, Tension } from "../../pattern/design";
import { defaultSize } from "../../reading/counted";
import { useSweater } from "../useSweater";
import { useColourway } from "../useColourway";
import { currentEdition } from "../../library/editions";
import type { Fitted } from "../../library/fit";
import { sameTension } from "../../reading/tension";
import { ballsOf, colourwayLabel, paletteOf, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
import { totals } from "../../reading/progress";
import { metresFor } from "../../reading/yardage";
import { chartPath, keepKnitting, startProject } from "../../projects/projects";
import PageLayout from "./ui/PageLayout";
import StageLayout from "./ui/StageLayout";
import Button from "./ui/Button";
import SweaterModel from "./SweaterModel";
import WoolList from "./WoolList";
import { type Chosen } from "./YarnPicker";
import ColourwayChoice from "./ColourwayChoice";
import MyTension from "./MyTension";
import StartFitted from "./StartFitted";
import { Schematic } from "./Schematic";
import "./Sweater.css";

/** A size's finished measurements, as a pattern's schematic gives them. */
export const Measurements: React.FC<{ size: SizeAbout }> = ({ size }) => (
  <dl className="measurements">
    <div>
      <dt>Chest</dt>
      <dd>{size.finished.chestCm}cm</dd>
    </div>
    <div>
      <dt>Neck</dt>
      <dd>{size.finished.neckCm}cm</dd>
    </div>
    <div>
      <dt>Yoke depth</dt>
      <dd>{size.finished.yokeDepthCm}cm</dd>
    </div>
    <div>
      <dt>Body length</dt>
      <dd>{size.finished.bodyLengthCm}cm, underarm to hem</dd>
    </div>
    <div>
      <dt>Upper arm</dt>
      <dd>{size.finished.upperArmCm}cm</dd>
    </div>
    <div>
      <dt>Sleeve length</dt>
      <dd>{size.finished.sleeveLengthCm}cm, underarm to cuff</dd>
    </div>
    <div>
      <dt>Cuff</dt>
      <dd>{size.finished.cuffCm}cm</dd>
    </div>
    <div>
      <dt>Tension</dt>
      <dd>
        {size.stitchesPer10cm} sts &amp; {size.roundsPer10cm} rounds to 10cm
      </dd>
    </div>
    <div>
      <dt>Needles</dt>
      <dd>
        {size.ribNeedlesMm ? `${size.ribNeedlesMm}mm rib, ` : ""}
        {size.needlesMm}mm
      </dd>
    </div>
  </dl>
);

/**
 * One design: the jumper itself, kept on screen, and under it what there is
 * to choose - a size, its colours, a tension - with the one way to start
 * knitting it. See StageLayout.
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

const tabs = ["size", "colours", "tension", "about"] as const;

const SweaterPage: React.FC<{ sweaterId: string }> = ({ sweaterId }) => {
  const sweater = sweaterById(sweaterId)!;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get("size");
  const [sizeId, setSizeId] = useState(
    (requested && sweater.sizes.some((size) => size.id === requested) ? requested : undefined) ??
      defaultSize(sweater).id,
  );
  // The panel shown is part of the address, so a reload keeps it; choosing another replaces it, so back leaves the design and does not walk the panels.
  const shown = tabs.find((tab) => tab === params.get("tab")) ?? "size";
  const show = (tab: string) =>
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        if (tab === "size") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
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

  const published = useMemo(() => sweater.colourways.find((c) => c.id === colourwayId) ?? sweater.colourways[0], [sweater, colourwayId]);
  const { on: laidOn } = useColourway(published, undefined);
  const colourway = useMemo(() => trimmed(published, trim), [published, trim]);
  const palette = useMemo(() => paletteOf(colourway, own), [colourway, own]);
  // The colourway as it would be on a sweater planned for the knitter, with the wools that would add: for the preview of one.
  const coloursOn = useCallback(
    (placement: Placement | undefined) => {
      const there = trimmed(laidOn(placement), trim);
      return { palette: paletteOf(there, own), added: woolsAdded(colourway, there) };
    },
    [laidOn, colourway, trim, own],
  );
  const metres = useMemo(() => metresFor(size, stitches, rounds), [size, stitches, rounds]);
  const counts = totals(index, 0);
  const balls = useMemo(() => ballsOf(colourway, metres, own).filter((ball) => ball.metres > 0), [colourway, metres, own]);
  const anyApproximate = balls.some((ball) => ball.yarn.approximate);

  /*
   * A ball of wool does every yarn of the design it is put in, so choosing
   * one sets them together. See WoolList.
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

  // A project is made only now, so browsing designs never leaves one behind.
  const start = () => {
    const project = startProject(sweater.id, size.id, colourway.id, own, trim);
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
      ...(from ? { upTo: from } : {}),
    });
    navigate(chartPath(project.id, true));
  };

  // The yoke's bands, for the strips that show each colourway.
  const body = useMemo(() => ({ stitches, rounds: yoke }), [stitches, yoke]);
  const bought = balls.reduce((total, ball) => total + ball.balls, 0);

  const sizePanel = (
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
        The finished chest has about {Math.round(size.finished.chestCm - size.toFitChestCm)}cm of ease. Each size is its own knitting - its own cast-on,
        increases and divide - and the chart follows the size you choose.
      </p>
      <div className="size-figures">
        <Schematic size={size} />
        <Measurements size={size} />
      </div>
    </>
  );

  const coloursPanel = (
    <>
      <ColourwayChoice
        colourways={sweater.colourways}
        colourway={colourway}
        overrides={own}
        body={body}
        onStartFrom={(id) => {
          setColourwayId(id);
          setTrim(undefined);
          setOwn({});
        }}
        trim={sweater.trim}
        trimChosen={trim}
        onTrim={setTrim}
      />
      <h2>Your wool</h2>
      <WoolList colourway={colourway} metres={metres} stated={size.yardage !== undefined} overrides={own} onChange={choose} body={body} palette={palette} />
      <p className="quiet">
        {colourway.brand} {colourway.yarn}
        {colourway.ballMetres !== undefined && colourway.ballGrams !== undefined ? `, ${colourway.ballMetres}m per ${colourway.ballGrams}g ball` : ""} ·{" "}
        <a href={colourway.url} target="_blank" rel="noreferrer">
          {colourway.url.replace(/^https?:\/\//, "")}
        </a>
      </p>
      <p className="quiet">
        The colours come from the spinners' own photographs of the wool, so they are close rather than exact.
        {anyApproximate ? " Some shades use approximate colours where an exact match is unavailable. These are marked in the wool list." : ""}
      </p>
    </>
  );

  const tensionPanel = (
    <MyTension key={size.id} size={size} tension={tension} onChange={setTension}>
      {tension && sweater.fitting && !sameTension(size, tension) && (
        <StartFitted sweater={sweater} size={size} knitted={built} tension={tension} palette={palette} coloursOn={coloursOn} onStart={startFitted} />
      )}
    </MyTension>
  );

  const aboutPanel = (
    <div className="sweater-about">
      <p>{sweater.story}</p>
      <p>By {sweater.designer}.</p>
      <p className="quiet">{sweater.credit}</p>
      <p className="quiet">
        In size {size.label}: {counts.total.toLocaleString()} stitches over {rounds.length} rounds.
      </p>
    </div>
  );

  return (
    <StageLayout
      title={sweater.name}
      eyebrow="a design"
      stage={<SweaterModel sweaterId={sweater.id} sizeId={size.id} palette={palette} progress={stitches[stitches.length - 1]?.id ?? 0} fill />}
      tabsLabel="This design"
      panels={[
        { id: "size", label: "Size", content: sizePanel },
        { id: "colours", label: "Colours", content: coloursPanel },
        { id: "tension", label: "Tension", content: tensionPanel },
        { id: "about", label: "About", content: aboutPanel },
      ]}
      shown={shown}
      onShow={show}
      bar={
        <>
          <div className="stage-bar-text">
            <strong>
              {size.label} · {colourwayLabel(colourway, own)}
            </strong>
            <span className="quiet">
              {balls.length} {balls.length === 1 ? "shade" : "shades"} · {bought} {bought === 1 ? "ball" : "balls"}
            </span>
          </div>
          <Button variant="primary" onClick={start}>
            Start knitting
          </Button>
        </>
      }
    />
  );
};

export default Sweater;
