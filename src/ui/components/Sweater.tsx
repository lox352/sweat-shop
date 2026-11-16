import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { Placement, SlotId, Tension } from "../../pattern/design";
import { defaultSize } from "../../reading/counted";
import { useSweater } from "../useSweater";
import { useColourway } from "../useColourway";
import { currentEdition } from "../../library/editions";
import type { Fitted } from "../../library/fit";
import { sameTension } from "../../reading/tension";
import { ballsOf, colourwayLabel, inkOn, lit, paletteOf, trimIdOf, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
import { totals } from "../../reading/progress";
import { metresFor } from "../../reading/yardage";
import { chartPath, keepKnitting, startProject } from "../../projects/projects";
import PageLayout from "./ui/PageLayout";
import StageLayout from "./ui/StageLayout";
import Sheet from "./ui/Sheet";
import type { PageGroup, PagesHandle } from "./ui/Pages";
import Button from "./ui/Button";
import SweaterModel from "./SweaterModel";
import Customise from "./Customise";
import { type Chosen } from "./Shades";
import { ColourwayGrid, TrimChoice } from "./ColourwayChoice";
import { useColourwayChoice } from "../useColourwayChoice";
import MyTension from "./MyTension";
import StartFitted from "./StartFitted";
import { Schematic } from "./Schematic";
import { Measurements } from "./Measurements";
import "./Sweater.css";

/**
 * One design: the jumper itself, kept on screen, and under it, a page at a
 * time, what there is to choose - a size, its colours, a tension - and at
 * the end of them what was chosen and the one way to start knitting it. See
 * StageLayout and Pages.
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

const tabs = ["size", "colours", "tension", "start"] as const;

const SweaterPage: React.FC<{ sweaterId: string }> = ({ sweaterId }) => {
  const sweater = sweaterById(sweaterId)!;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get("size");
  const [sizeId, setSizeId] = useState(
    (requested && sweater.sizes.some((size) => size.id === requested) ? requested : undefined) ??
      defaultSize(sweater).id,
  );
  /*
   * The tab shown is the pages' own to know, and changes at once (see Pages).
   * It is part of the address too, so a reload keeps it - but written there
   * after, once the pages have come to rest, and replacing what was there, so
   * back leaves the design and does not walk its tabs. An address from before
   * the last tab was Start, asking for About, is given Start.
   */
  const asked = params.get("tab") === "about" ? "start" : params.get("tab");
  const first = useRef(tabs.find((tab) => tab === asked) ?? "size").current;
  const written = useRef<string>(first);
  const settling = useRef<number>();
  const onShown = useCallback(
    (tab: string) => {
      window.clearTimeout(settling.current);
      settling.current = window.setTimeout(() => {
        if (written.current === tab) return;
        written.current = tab;
        setParams(
          (now) => {
            const next = new URLSearchParams(now);
            if (tab === "size") next.delete("tab");
            else next.set("tab", tab);
            return next;
          },
          { replace: true },
        );
      }, 600);
    },
    [setParams],
  );
  useEffect(() => () => window.clearTimeout(settling.current), []);
  const pager = useRef<PagesHandle>(null);
  const go = (tab: (typeof tabs)[number]) => pager.current?.go(tab);
  // An address that comes to ask for another tab while the page is open - back or forward, a link followed - is gone to.
  const wanted = tabs.find((tab) => tab === asked) ?? "size";
  useEffect(() => {
    if (wanted === written.current) return;
    written.current = wanted;
    pager.current?.go(wanted);
  }, [wanted]);

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

  /*
   * Under every page of colourways, what is done to the one chosen: its trim
   * and its wools, each in a card up from the foot. The same row on each
   * page, held at the page's foot while the colourways scroll over it.
   */
  const trims = sweater.trim && colourway.trims && colourway.trims.length > 1 ? colourway.trims : undefined;
  const trimNow = trims && (trims.find((one) => trimIdOf(one) === trim) ?? (published.shades.some((s) => s.slot === sweater.trim!.slot) ? colourway.shades.find((s) => s.slot === sweater.trim!.slot) : undefined));
  const adjust = (
    <div className="colours-adjust">
      {trims && sweater.trim && (
        <button type="button" className="colours-adjust-one" aria-haspopup="dialog" onClick={() => setSheet("trim")}>
          {trimNow && <span className="shade-chip" style={{ background: trimNow.hex, color: inkOn(trimNow.hex) }} aria-hidden="true" />}
          <span className="colours-adjust-what">
            <strong>{sweater.trim.label}</strong>
            <span className="quiet">{trimNow?.name ?? "Darkest beside each"}</span>
          </span>
        </button>
      )}
      <button type="button" className="colours-adjust-one" aria-haspopup="dialog" onClick={() => setSheet("customise")}>
        <span className="colours-adjust-what">
          <strong>Customise</strong>
          <span className="quiet">{changed > 0 ? `${changed} ${changed === 1 ? "wool" : "wools"} your own` : "Change any wool"}</span>
        </span>
      </button>
    </div>
  );

  const tensionPanel = (
    <MyTension key={size.id} size={size} tension={tension} onChange={setTension}>
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
        <button type="button" onClick={() => go("tension")}>
          <span className="ready-what">Tension</span>
          <span className="ready-chosen">
            {shownFit ? (
              <>
                <strong>Worked out for yours</strong>{" "}
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
    {
      id: "size",
      label: "Size",
      pages: [
        { id: "choose", label: "Choose a size", content: choosing },
        { id: "flat", label: `Size ${size.label}, laid flat, to scale`, content: <Schematic size={size} /> },
        { id: "measurements", label: `Size ${size.label}, finished`, content: <Measurements size={size} /> },
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
    { id: "tension", label: "Tension", pages: [{ id: "tension", label: "Your tension", content: tensionPanel }] },
    {
      id: "start",
      label: "Start",
      forward: true,
      pages: [
        { id: "ready", label: "Ready to knit", content: ready },
        { id: "about", label: "About this design", content: about },
      ],
    },
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
          ) : sheet === "trim" && sweater.trim && trims ? (
            <Sheet title={sweater.trim.label} eyebrow={colourway.name} onClose={closeSheet}>
              <div className="sheet-body">
                <TrimChoice trim={sweater.trim} colourway={colourway} given={published} chosen={trim} onTrim={setTrim} bare />
              </div>
            </Sheet>
          ) : undefined
        }
      />
      {choice.confirm}
    </>
  );
};

export default Sweater;
