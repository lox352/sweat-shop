import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sweaterById } from "../../library/catalogue";
import type { SizeAbout, SlotId, Tension } from "../../pattern/design";
import type { SweaterStitches } from "../../pattern/knitted";
import { defaultSize } from "../../reading/counted";
import { useKnitted, useKnitting } from "../useSweater";
import { fitShare, useFit } from "../useFit";
import { useShapes } from "../useShape";
import { useColourway } from "../useColourway";
import { currentEdition } from "../../library/editions";
import { decodeEdition } from "../../library/editions/format";
import type { Fitted } from "../../library/fit";
import { asKnitted, sameTension, yarnPerStitch } from "../../reading/tension";
import { ballsOf, colourwayLabel, lit, paletteOf, trimmed, woolsAdded, type Overrides } from "../../reading/palette";
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
 * Design.fitting). It is worked out and then settled into its shape, under
 * one bar, and only then is the page that pattern's: the jumper on the
 * stage, the size laid flat and its measurements, the colours and the wool
 * they take, and what Start knitting starts.
 */
/** No knitting to settle: the one list, so that asking for none is asked once. */
const none: SweaterStitches[] = [];
const noEditions: string[] = [];

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
  const found = answer.at === "working" || answer.at === "shown" ? answer.found[0] : undefined;
  /*
   * What was worked out is settled into its shape before any of it is shown,
   * as soon as it is found: the page becomes the recalculated pattern's once,
   * with its jumper hanging as it will, and not laid out flat first. The one
   * bar follows both, the working out and then the settling.
   */
  const settling = useMemo(() => (found ? { knittings: [decodeEdition(found.file)], editions: [found.file.edition] } : { knittings: none, editions: noEditions }), [found]);
  const { fraction: settledSoFar, shapes } = useShapes(settling.knittings, settling.editions);
  const fitted = answer.at === "shown" && shapes ? found : undefined;
  const working = answer.at === "working" || (answer.at === "shown" && !!found && !shapes);
  const soFar = found ? fitShare + (1 - fitShare) * settledSoFar : answer.at === "working" ? answer.fraction * fitShare : 0;

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
  // What that adds to the wools the design lists.
  const added = useMemo(() => woolsAdded(trimmed(published, trim), colourway), [published, trim, colourway]);
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
  // What the pattern comes out at knitted as written at the knitter's tension: what recalculating is instead of.
  const asWritten = tension && asKnitted(size.finished, size, tension);
  /*
   * What a changed tension brings up is under the fields, and on a phone
   * under the page's foot: it is brought into view as it comes, once, so the
   * way on is seen and not found by scrolling.
   */
  const offered = !!tension && answer.at === "rest";
  const offer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (offered) offer.current?.scrollIntoView({ block: "nearest" });
  }, [offered]);

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
        <p className="quiet size-tension-about">
          The pattern is written for {size.stitchesPer10cm} stitches and {size.roundsPer10cm} rounds to 10cm.{" "}
          {sweater.fitting
            ? "If your swatch measures otherwise, put yours in and the pattern can be recalculated to come out the same size."
            : "If your swatch measures otherwise, put yours in to see what size it would come out."}
        </p>
        {/* The pattern's tension is the size's: filled in afresh for a size written for another, unless the knitter has given their own. */}
        <TensionChoice key={`${size.stitchesPer10cm} ${size.roundsPer10cm} ${fields}`} pattern={size} tension={given} onChange={setGiven} />
        {offered && asWritten && (
          <p role="status">
            As written, {size.label} would come out {asWritten.chestCm}cm round the chest at that tension, not {size.finished.chestCm}cm.
          </p>
        )}
        {/* The way to recalculate is there from the first, where the design can be, and only to be pressed once there is a tension of the knitter's to recalculate for: it is seen before it is wanted. Once it is done, what it came to is in its place. */}
        {!working && !fitted && (sweater.fitting || offered) && (
          <div className="my-tension-actions size-tension-actions" ref={offer}>
            {sweater.fitting && (
              <Button variant="primary" disabled={!offered} onClick={recalculate}>
                Recalculate the pattern
              </Button>
            )}
            {offered && (
              <Button variant="quiet" onClick={usePatterns}>
                Use the pattern's
              </Button>
            )}
          </div>
        )}
        {working && (
          <div role="status" className="size-working">
            <progress value={soFar} max={1} aria-label="How far the recalculating has got" />
            <p>Recalculating the pattern, then settling the sweater into its shape to show you. This can take a few minutes.</p>
          </div>
        )}
        {(answer.at === "failed" || (answer.at === "shown" && !found)) && (
          <div role="alert">
            <p>
              <strong>The pattern can't be recalculated for that tension.</strong> {answer.at === "failed" ? answer.why : answer.unfitted.map((not) => not.why).join(" ")}
            </p>
            <p className="my-tension-actions">
              <Button variant="quiet" onClick={usePatterns}>
                Use the pattern's
              </Button>
            </p>
          </div>
        )}
        {fitted && (
          <div role="status" className="size-recalculated">
            <p>
              <strong>Recalculated.</strong>
            </p>
            <ul>
              {fitted.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              {added.length > 0 && (
                <li>
                  This colourway steps down the sweater, so each year takes the yarns for where it now sits. That adds {added.length} {added.length === 1 ? "yarn" : "yarns"} to
                  what the pattern listed: {added.map((shade) => (shade.code ? `${shade.name} (${shade.code})` : shade.name)).join(", ")}.
                </li>
              )}
            </ul>
            <details>
              <summary>The pattern, written out</summary>
              <pre className="refit-written">{fitted.written}</pre>
            </details>
            <p className="my-tension-actions">
              <Button variant="quiet" onClick={usePatterns}>
                Back to the pattern as written
              </Button>
            </p>
          </div>
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
        { id: "choose", label: "Size", content: choosing },
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
            <SweaterModel sweaterId={sweater.id} sizeId={size.id} palette={onStage} progress={stitches[stitches.length - 1]?.id ?? 0} fill />
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
