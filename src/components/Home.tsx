import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sweaters, sweaterById } from "../data/sweaters";
import {
  Project,
  bareIdFor,
  deleteProject,
  chartPath,
  overviewPath,
  listProjects,
  projectsChanged,
  renameProject,
} from "../helpers/projects";
import { countedAt, sweaterStitches, yokeRounds } from "../knitting/useSweater";
import { positionOf, totals } from "../knitting/progress";
import { colourwayLabel, paletteOf, trimmed } from "../knitting/palette";
import PageLayout from "./ui/PageLayout";
import Button from "./ui/Button";
import Dialog from "./ui/Dialog";
import NameDialog from "./ui/NameDialog";
import BodyStrip from "./BodyStrip";
import { useKnittingTime } from "../knitting/timing/useKnittingTime";
import { timeLine } from "../knitting/timing/format";
import type { Stitch } from "../types/Stitch";
import "./Home.css";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** How far through a project is, and what it is called. */
const describe = (project: Project) => {
  const sweater = sweaterById(project.sweaterId);
  if (!sweater) return undefined;
  const size = sweater.sizes.find((s) => s.id === project.sizeId) ?? sweater.sizes[0];
  const built = sweaterStitches(sweater, size.id);
  const { stitches } = built;
  // Counted as the project's own pages count it, from the beginning of the round in force.
  const { index } = countedAt(sweater, built, project.progress);
  const counts = totals(index, project.progress);
  const position = positionOf(stitches, project.progress, index);
  const colourway = trimmed(sweater.colourways.find((c) => c.id === project.colourwayId) ?? sweater.colourways[0], project.trim);
  return { sweater, counts, position, colourway, size, stitches, yoke: yokeRounds(built) };
};

const noStitches: Stitch[] = [];

const ProjectCard: React.FC<{
  project: Project;
  onRename: () => void;
  onDelete: () => void;
}> = ({ project, onRename, onDelete }) => {
  const navigate = useNavigate();
  const described = describe(project);
  const time = useKnittingTime(project.id, described?.stitches ?? noStitches, project.progress);
  if (!described) return null;
  const { sweater, counts, position, colourway, size, stitches, yoke } = described;
  const id = bareIdFor(project.id);
  const palette = paletteOf(colourway, project.shades);
  const done = counts.percent >= 100;

  const actions = (
    <div className="project-card-actions">
      <Button
        variant="primary"
        onClick={() => navigate(done ? overviewPath(id) : chartPath(id, true))}
      >
        {done ? "See it" : counts.worked > 0 ? "Keep knitting" : "Start knitting"}
      </Button>
      {!done && (
        <Button variant="secondary" onClick={() => navigate(overviewPath(id))}>
          Overview
        </Button>
      )}
    </div>
  );
  const status = done
    ? `Finished · ${counts.total.toLocaleString()} stitches`
    : `${position.piece ? `${position.piece.label}, round ${position.row} · ` : ""}` +
      `started ${formatDate(project.startedAt)}`;

  /*
   * The yoke in this project's own wool, with a line along its foot for how
   * far through the whole sweater the knitting is. Only its buttons go
   * anywhere: the card itself is for reading.
   */
  return (
    <li className="project-card">
      <div className="project-card-body">
        <span className="project-card-picture">
          <BodyStrip
            stitches={stitches}
            rounds={yoke}
            palette={palette}
            className="design-card-body"
          />
          <span className="project-card-bar" aria-hidden="true">
            <span style={{ width: `${counts.percent}%` }} />
          </span>
        </span>
        <span className="project-card-text">
          <span className="project-card-head">
            <strong>{project.name ?? sweater.name}</strong>
            {/* Looking after the project, out of the way at the top right. */}
            <span className="project-card-manage">
              <Button variant="quiet" onClick={onRename}>
                Rename
              </Button>
              <Button variant="quiet" onClick={onDelete}>
                Delete
              </Button>
            </span>
          </span>
          <span className="quiet">
            {size.label} · {colourwayLabel(colourway, project.shades)}
          </span>
          <span className="quiet">
            {done
              ? status
              : `${counts.worked > 0 && counts.percent < 1 ? "Under 1" : Math.floor(counts.percent)}% knitted · ${status}`}
          </span>
          {time && <span className="quiet">{timeLine(time, done)}</span>}
        </span>
      </div>
      {actions}
    </li>
  );
};

const Home: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [renaming, setRenaming] = useState<Project>();
  const [deleting, setDeleting] = useState<Project>();

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
              <ProjectCard
                key={project.id}
                project={project}
                onRename={() => setRenaming(project)}
                onDelete={() => setDeleting(project)}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="peerie-rule" aria-hidden="true" />

      <section className="section">
        <h2>The designs</h2>
        <ul className="design-list">
          {sweaters.map((sweater) => {
            const palette = paletteOf(sweater.colourways[0]);
            const built = sweaterStitches(sweater, sweater.sizes[0].id);
            return (
              <li key={sweater.id}>
                <Link to={`/sweater/${sweater.id}`} className="design-card">
                  <BodyStrip
                    stitches={built.stitches}
                    rounds={yokeRounds(built)}
                    palette={palette}
                    className="design-card-body"
                  />
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
        <p className="quiet">
          Choose a design to explore its sizes, wool and chart.
        </p>
      </section>

      {renaming && (
        <NameDialog
          open
          title="Name this project"
          text="Something to tell it apart from the others."
          initialValue={renaming.name ?? ""}
          onCancel={() => setRenaming(undefined)}
          onConfirm={(name) => {
            renameProject(renaming.id, name);
            setRenaming(undefined);
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
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => {
            deleteProject(deleting.id);
            setDeleting(undefined);
          }}
        />
      )}
    </PageLayout>
  );
};

export default Home;
