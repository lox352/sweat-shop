import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sweaters, sweaterById } from "../../library/catalogue";
import {
  Project,
  bareIdFor,
  chartPath,
  overviewPath,
  listProjects,
  projectsChanged,
} from "../../projects/projects";
import { countedAt, yokeRounds } from "../../reading/counted";
import { useKnitting } from "../useSweater";
import KnittingBoundary from "./KnittingBoundary";
import type { SweaterStitches } from "../../pattern/knitted";
import type { Design } from "../../pattern/design";
import { editionOf } from "../../library/editions";
import { positionOf, totals } from "../../reading/progress";
import { colourwayLabel, paletteOf, trimmed } from "../../reading/palette";
import PageLayout from "./ui/PageLayout";
import BodyStrip from "./BodyStrip";
import { useKnittingTime } from "../useKnittingTime";
import { timeLine } from "../../projects/timing/format";
import "./Home.css";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** How far through a project is, and what it is called. */
const describe = (project: Project, sweater: Design, built: SweaterStitches) => {
  const size = sweater.sizes.find((s) => s.id === project.sizeId) ?? sweater.sizes[0];
  const { stitches } = built;
  // Counted as the project's own pages count it, from the beginning of the round in force.
  const { index } = countedAt(sweater, built, project.progress);
  const counts = totals(index, project.progress);
  const position = positionOf(stitches, project.progress, index);
  const colourway = trimmed(sweater.colourways.find((c) => c.id === project.colourwayId) ?? sweater.colourways[0], project.trim);
  return { sweater, counts, position, colourway, size, stitches, yoke: yokeRounds(built) };
};

type CardProps = { project: Project };

/** A project's card, once its knitting is to hand: see useKnitting. A project of a design no longer known has none. */
const ProjectCard: React.FC<CardProps> = (props) => {
  const sweater = sweaterById(props.project.sweaterId);
  return sweater ? (
    <KnittingBoundary compact>
      <Suspense fallback={<li className="project-card" aria-busy="true" />}>
        <KnownProjectCard {...props} sweater={sweater} />
      </Suspense>
    </KnittingBoundary>
  ) : null;
};

const KnownProjectCard: React.FC<CardProps & { sweater: Design }> = ({ project, sweater: design }) => {
  const sizeId = (design.sizes.find((s) => s.id === project.sizeId) ?? design.sizes[0]).id;
  // The edition the project knits: see library/editions.
  const built = useKnitting(design, sizeId, editionOf(project));
  const described = describe(project, design, built);
  const time = useKnittingTime(project.id, described.stitches, project.progress);
  const { sweater, counts, position, colourway, size, stitches, yoke } = described;
  const id = bareIdFor(project.id);
  const palette = paletteOf(colourway, project.shades);
  const done = counts.percent >= 100;
  const status = done
    ? `Finished · ${counts.total.toLocaleString()} stitches`
    : `${position.piece ? `${position.piece.label}, round ${position.row} · ` : ""}` +
      `started ${formatDate(project.startedAt)}`;

  /*
   * The yoke in this project's own wool, with a line along its foot for how
   * far through the whole sweater the knitting is. The card opens the jumper,
   * where it is looked after; its one button goes straight to the needles.
   */
  return (
    <li className="project-card">
      <Link to={overviewPath(id)} className="project-card-body">
        <span className="project-card-picture">
          <BodyStrip stitches={stitches} rounds={yoke} palette={palette} className="design-card-body" />
          <span className="project-card-bar" aria-hidden="true">
            <span style={{ width: `${counts.percent}%` }} />
          </span>
        </span>
        <span className="project-card-text">
          <strong>{project.name ?? sweater.name}</strong>
          <span className="quiet">
            {project.name ? `${sweater.name} · ` : ""}
            {size.label} · {colourwayLabel(colourway, project.shades)}
          </span>
          <span className="quiet">
            {done
              ? status
              : `${counts.worked > 0 && counts.percent < 1 ? "Under 1" : Math.floor(counts.percent)}% knitted · ${status}`}
          </span>
          {time && <span className="quiet">{timeLine(time, done)}</span>}
        </span>
      </Link>
      {!done && (
        <div className="project-card-actions">
          <Link to={chartPath(id, true)} className="btn btn-primary">
            {counts.worked > 0 ? "Keep knitting" : "Start knitting"}
          </Link>
        </div>
      )}
    </li>
  );
};

/** A design's yoke, in its first colourway, across its card. */
const DesignStrip: React.FC<{ sweater: Design }> = ({ sweater }) => {
  const built = useKnitting(sweater, sweater.sizes[0].id);
  const palette = useMemo(() => paletteOf(sweater.colourways[0]), [sweater]);
  return <BodyStrip stitches={built.stitches} rounds={yokeRounds(built)} palette={palette} className="design-card-body" />;
};

const Home: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  const refresh = useCallback(() => setProjects(listProjects()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(projectsChanged, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(projectsChanged, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return (
    <PageLayout
      home
      title="Sweat Shop"
      eyebrow="Fair Isle yokes, from the top down"
      lede={
        <>
          A place to knit a Fair Isle jumper. Pick a design, a size and your
          wool, and watch the sweater come up stitch by stitch as you knit it.
        </>
      }
    >
      {projects.length > 0 && (
        <section className="section">
          <h2>On your needles</h2>
          <ul className="project-list">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ul>
        </section>
      )}

      <div className="peerie-rule" aria-hidden="true" />

      <section className="section">
        <h2>The designs</h2>
        <ul className="design-list">
          {sweaters.map((sweater) => {
            return (
              <li key={sweater.id}>
                <Link to={`/sweater/${sweater.id}`} className="design-card">
                  <KnittingBoundary compact>
                    <Suspense fallback={<div className="design-card-body" aria-busy="true" />}>
                      <DesignStrip sweater={sweater} />
                    </Suspense>
                  </KnittingBoundary>
                  <span className="design-card-text">
                    <span className="eyebrow">
                      {sweater.sizes.length} sizes · {sweater.colourways.length} colourways
                    </span>
                    <strong>{sweater.name}</strong>
                    <span className="quiet">{sweater.designer}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

    </PageLayout>
  );
};

export default Home;
