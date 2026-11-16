import React, { startTransition, useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { Placement, SlotId, SizeAbout, Tension } from "../../pattern/design";
import { defaultSize } from "../../reading/counted";
import { useSweater } from "../useSweater";
import { useColourway } from "../useColourway";
import { currentEdition } from "../../library/editions";
import type { Fitted } from "../../library/fit";
import { sameTension } from "../../reading/tension";
import { ballsOf, paletteOf, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
import { totals } from "../../reading/progress";
import { metresFor } from "../../reading/yardage";
import { chartPath, keepKnitting, startProject } from "../../projects/projects";
import PageLayout from "./ui/PageLayout";
import Button from "./ui/Button";
import SweaterModel from "./SweaterModel";
import WoolList from "./WoolList";
import { type Chosen } from "./YarnPicker";
import NextStep from "./ui/NextStep";
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
 * One design: what it is, what it is made of, and a way to start knitting it.
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

const SweaterPage: React.FC<{ sweaterId: string }> = ({ sweaterId }) => {
  const sweater = sweaterById(sweaterId)!;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("size");
  const [sizeId, setSizeId] = useState(
    (requested && sweater.sizes.some((size) => size.id === requested) ? requested : undefined) ??
      defaultSize(sweater).id,
  );
  const [colourwayId, setColourwayId] = useState(sweater.colourways[0].id);
  const [trim, setTrim] = useState<string>();
  /*
   * The wool a knitter has chosen for themselves, over the colourway they
   * started from. Starting again from another of the design's clears it.
   */
  const [own, setOwn] = useState<Overrides>({});
  const size = sweater.sizes.find((s) => s.id === sizeId) ?? sweater.sizes[0];
  const choicesRef = useRef<HTMLElement>(null);
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
  const anyApproximate = ballsOf(colourway, metres, own).some((ball) => ball.yarn.approximate);

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

  // The yoke's bands, for the strips that show the wool being chosen.
  const body = useMemo(() => ({ stitches, rounds: yoke }), [stitches, yoke]);

  return (
    <PageLayout
      title={sweater.name}
      eyebrow="a design"
      lede={`By ${sweater.designer}`}
    >
      <div className="sweater-layout">
        <div className="sweater-stage">
          <SweaterModel
            sweaterId={sweater.id}
            sizeId={size.id}
            palette={palette}
            progress={stitches[stitches.length - 1]?.id ?? 0}
          />
          <p className="quiet stage-note">
            Drag to turn it. {counts.total.toLocaleString()} stitches over {rounds.length} rounds.
          </p>
        </div>
        <div className="sweater-about">
          <p>{sweater.story}</p>
          <p className="quiet">{sweater.credit}</p>
        </div>
      </div>
      <div className="peerie-rule" aria-hidden="true" />

      <section className="section" ref={choicesRef}>
        <h2>Colourway</h2>
        <ColourwayChoice
          colourways={sweater.colourways}
          colourway={colourway}
          overrides={own}
          palette={palette}
          body={body}
          onStartFrom={(id) => {
            setColourwayId(id);
            setTrim(undefined);
            setOwn({});
          }}
          trim={sweater.trim}
          trimChosen={trim}
          onTrim={setTrim}
          until={choicesRef}
        />

        <h3>Your wool</h3>
        <WoolList
          colourway={colourway}
          metres={metres}
          stated={size.yardage !== undefined}
          overrides={own}
          onChange={choose}
          body={body}
          palette={palette}
        />

        <p className="quiet">
          {colourway.brand} {colourway.yarn}
          {colourway.ballMetres !== undefined && colourway.ballGrams !== undefined
            ? `, ${colourway.ballMetres}m per ${colourway.ballGrams}g ball`
            : ""}{" "}
          ·{" "}
          <a href={colourway.url} target="_blank" rel="noreferrer">
            {colourway.url.replace(/^https?:\/\//, "")}
          </a>
        </p>
        <p className="quiet">
          The colours come from the spinners' own photographs of the wool, so
          they are close rather than exact.
          {anyApproximate
            ? " Some shades use approximate colours where an exact match is " +
              "unavailable. These are marked in the wool list."
            : ""}
        </p>
      </section>

      <section className="section">
        <h2>Size</h2>
        <div className="chooser">
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
        <div className="size-figures">
          <Schematic size={size} />
          <Measurements size={size} />
        </div>
        <MyTension key={size.id} size={size} tension={tension} onChange={setTension}>
          {tension && sweater.fitting && !sameTension(size, tension) && (
            <StartFitted sweater={sweater} size={size} knitted={built} tension={tension} palette={palette} coloursOn={coloursOn} onStart={startFitted} />
          )}
        </MyTension>
        <p className="quiet">
          Each size is its own knitting - its own cast-on, increases and
          divide - and the chart follows the size you choose. The finished
          chest has about {Math.round(size.finished.chestCm - size.toFitChestCm)}cm of ease.
        </p>
      </section>

      <NextStep
        title="Ready to cast on?"
        detail={
          `${colourway.name}, size ${size.label}: ` +
          `${counts.total.toLocaleString()} stitches over ${rounds.length} rounds. ` +
          "Your progress is saved in this browser as you go."
        }
      >
        <Button variant="primary" size="lg" onClick={start}>
          Start knitting
        </Button>
      </NextStep>
    </PageLayout>
  );
};

export default Sweater;
