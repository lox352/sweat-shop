import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { SizeAbout, SlotId, Tension } from "../../pattern/design";
import { defaultSize } from "../../reading/counted";
import { useKnitted, useKnitting } from "../useSweater";
import { fitShare, useFit } from "../useFit";
import { useShapes } from "../useShape";
import { useColourway } from "../useColourway";
import { currentEdition } from "../../library/editions";
import { decodeEdition } from "../../library/editions/format";
import type { Fitted } from "../../library/fit";
import { sameTension, yarnPerStitch } from "../../reading/tension";
import { ballsOf, colourwayLabel, lit, paletteOf, trimmed, type Overrides } from "../../reading/palette";
import { totals } from "../../reading/progress";
import { metresFor } from "../../reading/yardage";
import { chartPath, keepKnitting, startProject } from "../../projects/projects";
import PageLayout from "./ui/PageLayout";
import StageLayout from "./ui/StageLayout";
import type { PageGroup } from "./ui/Pages";
import Button from "./ui/Button";
import SweaterModel, { OwnModel } from "./SweaterModel";
import Customise from "./Customise";
import { type Chosen } from "./Shades";
import { ColourwayGrid } from "./ColourwayChoice";
import { ColoursAdjust, TrimSheet } from "./ColoursAdjust";
import { useColourwayChoice } from "../useColourwayChoice";
import { useTabAddress } from "../useTabAddress";
import TensionChoice from "./TensionChoice";
import { Schematic } from "./Schematic";
import { Measurements } from "./Measurements";
import "./Sweater.css";

/**
 * One design: the jumper itself, kept on screen, and under it, a page at a
 * time, what it is, then what there is to choose - a size, with the tension
 * it is to be knitted at, and its colours - and at the end of them what was
 * chosen and the one way to start knitting it. See StageLayout and Pages.
 *
 * Every size of a sweater is different knitting - its own cast-on, its own
 * increases, its own divide - so changing size rebuilds the knitting, where
 * changing colourway only recolours it.
 *
 * And so is a size at another tension. The pattern's own is filled in beside
 * the sizes; a knitter whose swatch measures otherwise changes it, and has
 * the pattern recalculated for theirs where the design can (see
 * Design.fitting). While it is, the page stays the pattern's as written, one
 * bar following the working out and then the settling of it into its shape;
 * from then on the page is that pattern's: the jumper on the stage, the size
 * laid flat and its measurements, the colours and the wool they take, and
 * what Start knitting starts.
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
  // The tab shown is kept in the address: see useTabAddress. An address from when the tension had a tab of its own is given the page it is now chosen on, with the size.
  const { first, firstPage, onShown, pager, go } = useTabAddress(tabs, { tension: ["size", "choose"] });

  const [colourwayId, setColourwayId] = useState(sweater.colourways[0].id);
  const [trim, setTrim] = useState<string>();
  /*
   * The wool a knitter has chosen for themselves, over the colourway they
   * started from. Starting again from another of the design's clears it.
   */
  const [own, setOwn] = useState<Overrides>({});
  const size = sweater.sizes.find((s) => s.id === sizeId) ?? sweater.sizes[0];
  /** The knitter's own tension, where they have given one that is not the pattern's: see TensionChoice. */
  const [given, setGiven] = useState<Tension>();
  const tension = given && !sameTension(size, given) ? given : undefined;
  /** Counted up to fill the tension's fields in afresh, with the pattern's. */
  const [fields, setFields] = useState(0);
  /*
   * The pattern recalculated for that tension, once it is asked for: worked
   * out on the device (see useFit). Another size, or another tension, is
   * another question, and what was worked out for the last is not its answer.
   */
  const { state: fit, ask, reset } = useFit();
  const asking = `${size.id} ${tension?.stitchesPer10cm} ${tension?.roundsPer10cm}`;
  const [asked, setAsked] = useState<string>();
  useEffect(reset, [asking, reset]);
  const answer = asked === asking ? fit : ({ at: "rest" } as const);
  const recalculate = () => {
    if (!tension) return;
    setAsked(asking);
    ask({ design: sweater.id, sizeId: size.id, tension });
  };
  // From the cast-on a design lays a sweater out one way: its ways are of the rest of one part knitted (see Refit).
  const worked = answer.at === "shown" ? answer.found[0] : undefined;
  /*
   * Worked out, it is not shown yet: it is settled into its shape first, the
   * sweater as written staying on the stage meanwhile, and the one bar that
   * followed the working out goes on to follow that. The page becomes the
   * recalculated pattern's all at once. Its shape is the project's from the
   * start, once it is one (see useShapes).
   */
  const settling = useMemo(() => (worked ? { knittings: [decodeEdition(worked.file)], editions: [worked.file.edition] } : { knittings: [], editions: [] }), [worked]);
  const { fraction: settledSoFar, shapes } = useShapes(settling.knittings, settling.editions);
  const fitted = shapes ? worked : undefined;
  const working = answer.at === "working" || (!!worked && !shapes);
  const fraction = answer.at === "working" ? fitShare * answer.fraction : fitShare + (1 - fitShare) * settledSoFar;

  // The knitting the page is of: the pattern's, or the one recalculated.
  const written = useKnitting(sweater, size.id);
  const recalculated = fitted ? settling.knittings[0] : undefined;
  const built = useKnitted(sweater, recalculated ?? written);
  const { stitches, rounds, index, yoke } = built;
  /** The size as it will be knitted: recalculated, at the knitter's tension and what that comes to. */
  const sized: SizeAbout = useMemo(() => (fitted ? { ...size, ...fitted.tension, finished: fitted.finished } : size), [size, fitted]);
  /** What is up from the foot over the pages, if anything: the trim, or the colourway's wools to change. See Sheet. */
  const [sheet, setSheet] = useState<"trim" | "customise">();
  const closeSheet = useCallback(() => setSheet(undefined), []);
  /** The yarns lit on the jumper while one of its wools is being changed: see Customise. */
  const [lighting, setLighting] = useState<SlotId[]>();

  const published = useMemo(() => sweater.colourways.find((c) => c.id === colourwayId) ?? sweater.colourways[0], [sweater, colourwayId]);
  // A colourway that steps down the garment follows where a sweater recalculated puts its bands.
  const { colourway: laid } = useColourway(published, fitted?.placement);
  const colourway = useMemo(() => trimmed(laid, trim), [laid, trim]);
  const palette = useMemo(() => paletteOf(colourway, own), [colourway, own]);
  const onStage = useMemo(() => (lighting ? lit(palette, lighting) : palette), [palette, lighting]);
  // A sweater recalculated is not the one a printed list of wool was for, and its stitches are the knitter's.
  const metres = useMemo(
    () => (fitted ? metresFor({}, stitches, rounds, yarnPerStitch(size, fitted.tension)) : metresFor(size, stitches, rounds)),
    [size, fitted, stitches, rounds],
  );
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
    // A tension given here and not recalculated for goes with it, as the knitter's own: the jumper's page compares it with the pattern, and offers to fit the rest to it.
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

  const usePatterns = () => {
    setGiven(undefined);
    setFields((count) => count + 1);
  };
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
      <section className="size-tension" aria-labelledby="size-tension-heading">
        <h3 id="size-tension-heading">Tension</h3>
        {/* The pattern's tension is the size's: filled in afresh for a size written for another, unless the knitter has given their own. */}
        <TensionChoice key={`${size.stitchesPer10cm} ${size.roundsPer10cm} ${fields}`} pattern={size} tension={given} onChange={setGiven} />
        {/* Always there, and to be pressed only where there is something to recalculate for: a tension that is not the pattern's, not worked out already. */}
        <p className="my-tension-actions">
          {sweater.fitting && (
            <Button variant="primary" disabled={!tension || working || !!fitted} onClick={recalculate}>
              Recalculate the pattern
            </Button>
          )}
          {tension && (
            <Button variant="quiet" onClick={usePatterns}>
              Revert to original
            </Button>
          )}
        </p>
        {working && (
          <div role="status" className="size-working">
            {/* The one bar, and no more words: the stage says what it is of. */}
            <progress value={fraction} max={1} aria-label="How far recalculating the pattern has got" />
          </div>
        )}
        {(answer.at === "failed" || (answer.at === "shown" && !worked)) && (
          <p role="alert">
            <strong>The pattern can't be recalculated for that tension.</strong> {answer.at === "failed" ? answer.why : answer.unfitted.map((not) => not.why).join(" ")}
          </p>
        )}
        {fitted && (
          <p role="status" className="visually-hidden">
            The pattern is recalculated for your tension.
          </p>
        )}
      </section>
    </>
  );

  // At the foot of the colours' tab, what is done to the colourway chosen: see ColoursAdjust.
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
        <button type="button" onClick={() => go("size")}>
          <span className="ready-what">Tension</span>
          <span className="ready-chosen">
            {fitted ? (
              <>
                <strong>Recalculated for yours</strong>{" "}
                <span className="quiet">
                  {fitted.tension.stitchesPer10cm} stitches &amp; {fitted.tension.roundsPer10cm} rounds to 10cm
                </span>
              </>
            ) : working ? (
              <>
                <strong>Being recalculated for yours</strong>{" "}
                <span className="quiet">
                  {tension?.stitchesPer10cm} stitches &amp; {tension?.roundsPer10cm} rounds to 10cm
                </span>
              </>
            ) : (
              <>
                <strong>As the pattern</strong>{" "}
                <span className="quiet">
                  {size.stitchesPer10cm} stitches &amp; {size.roundsPer10cm} rounds to 10cm
                  {tension ? `; yours is ${tension.stitchesPer10cm} & ${tension.roundsPer10cm}` : ""}
                </span>
              </>
            )}
          </span>
        </button>
      </div>
      {/* Not while the pattern is being worked out: what would be started is not yet known. */}
      <Button variant="primary" size="lg" className="ready-start" disabled={working} onClick={fitted ? () => startFitted(fitted) : start}>
        Start knitting
      </Button>
      <p className="quiet ready-note">
        {working
          ? "The pattern is still being recalculated for your tension."
          : `${counts.total.toLocaleString()} stitches over ${rounds.length} rounds. Nothing is kept until you start.`}
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
        // The size, and the tension it is to be knitted at: what the pages after are of.
        { id: "choose", label: "Size and tension", content: choosing },
        { id: "flat", label: `Size ${size.label}${fitted ? " at your tension" : ""}, laid flat, to scale`, content: <Schematic size={sized} /> },
        { id: "measurements", label: `Size ${size.label}${fitted ? " at your tension" : ""}, finished`, content: <Measurements size={sized} /> },
      ],
    },
    {
      id: "colours",
      label: "Colours",
      foot: adjust,
      pages: choice.groups.map(([name, options]) => ({
        id: `group-${name ?? ""}`,
        label: name ?? "Colourways",
        content: <ColourwayGrid options={options} chosen={colourway.id} body={body} onChoose={choice.choose} />,
      })),
    },
    { id: "start", label: "Start", forward: true, pages: [{ id: "ready", label: "Ready to knit", content: ready }] },
  ];

  return (
    <>
      <StageLayout
        title={sweater.name}
        eyebrow="a design"
        stage={
          recalculated && fitted ? (
            <OwnModel knitting={recalculated} settled={shapes?.[0]} palette={onStage} progress={stitches[stitches.length - 1]?.id ?? 0} fill />
          ) : (
            <SweaterModel
              sweaterId={sweater.id}
              sizeId={size.id}
              palette={onStage}
              progress={stitches[stitches.length - 1]?.id ?? 0}
              fill
              note={working ? "Pattern being recalculated" : undefined}
            />
          )
        }
        // What the jumper on the stage is: its size, the tension it is recalculated for where it is, and its colours.
        badge={`${size.label} · ${fitted ? `${fitted.tension.stitchesPer10cm} sts & ${fitted.tension.roundsPer10cm} rounds · ` : ""}${colourwayLabel(colourway, own)}`}
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
