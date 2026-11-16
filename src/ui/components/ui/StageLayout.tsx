import React, { useEffect, useRef, useState } from "react";
import "./PageLayout.css";
import "./StageLayout.css";
import StorageNotice from "../StorageNotice";
import OfflineStatus from "../OfflineStatus";
import TitleBlock from "./TitleBlock";
import { StageSlot } from "./stage-slot";

export interface StagePanel {
  id: string;
  label: string;
  content: React.ReactNode;
  /** What it holds is laid out a page at a time (see Pages), each page the panel's own size: the panel itself then does not scroll. */
  paged?: boolean;
}

/**
 * A page with the jumper kept on screen: the title block, the jumper on its
 * stage, and under it one panel at a time, chosen by tabs, with a bar at the
 * foot for the one way forward.
 *
 * The page itself does not scroll, and the jumper is one size and stays
 * where it is, so a size or a colour chosen is seen on it at once. What a
 * panel holds is laid out for the room under it: a page at a time, side by
 * side, where it divides into pages (see Pages), and otherwise scrolling
 * inside the panel. On a wide screen the stage stands beside the panel.
 *
 * Every panel stays mounted while another is shown, so a pattern worked out
 * in one is still there after a look at another.
 */
const StageLayout: React.FC<{
  title: string;
  eyebrow?: React.ReactNode;
  stage: React.ReactNode;
  panels: StagePanel[];
  /** The panel shown, by its id, and choosing another. */
  shown: string;
  onShow: (id: string) => void;
  /** What the tabs are of, for a screen reader: "This design". */
  tabsLabel: string;
  bar: React.ReactNode;
  /** A page looked at before anything is kept: on a phone, its panels do not end by saying where projects are kept and that the site is ready offline. */
  browsing?: boolean;
}> = ({ title, eyebrow, stage, panels, shown, onShow, tabsLabel, bar, browsing }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Another panel begins at its top.
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [shown]);
  const paged = panels.find((panel) => panel.id === shown)?.paged;
  return (
    <div className={browsing ? "page stage-layout is-browsing" : "page stage-layout"}>
      <TitleBlock title={title} eyebrow={eyebrow} />
      <StorageNotice />
      <div className="stage">
        <div className="stage-over" ref={setSlot} />
        <div className="stage-own">{stage}</div>
      </div>
      <div className="stage-side">
        <div className="stage-tabs screen-only" role="tablist" aria-label={tabsLabel}>
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              role="tab"
              id={`stage-tab-${panel.id}`}
              className="stage-tab"
              aria-selected={panel.id === shown}
              aria-controls={`stage-panel-${panel.id}`}
              onClick={() => onShow(panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>
        <div className={paged ? "stage-scroll is-paged" : "stage-scroll"} ref={scroll}>
          {panels.map((panel) => (
            <div
              key={panel.id}
              role="tabpanel"
              id={`stage-panel-${panel.id}`}
              className="stage-panel"
              aria-labelledby={`stage-tab-${panel.id}`}
              hidden={panel.id !== shown}
            >
              <StageSlot.Provider value={panel.id === shown ? slot : null}>{panel.content}</StageSlot.Provider>
            </div>
          ))}
          <footer className="colophon screen-only">
            <OfflineStatus />
            <p className="quiet">Your projects are kept in this browser, on this device.</p>
          </footer>
        </div>
        <div className="stage-bar screen-only">{bar}</div>
      </div>
    </div>
  );
};

export default StageLayout;
