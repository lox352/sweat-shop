import React, { useEffect, useRef, useState } from "react";
import "./PageLayout.css";
import "./StageLayout.css";
import StorageNotice from "../StorageNotice";
import OfflineStatus from "../OfflineStatus";
import TitleBlock from "./TitleBlock";
import Pages, { type PageGroup, type PagesHandle } from "./Pages";
import { StageSlot } from "./stage-slot";

export interface StagePanel {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface Common {
  title: string;
  eyebrow?: React.ReactNode;
  stage: React.ReactNode;
  /** What the tabs are of, for a screen reader: "This design". */
  tabsLabel: string;
  /** What the jumper on the stage is, in a few words, in its corner: its size and its colourway. */
  badge?: React.ReactNode;
  /** A card up from the foot, over what is under the stage, while there is one: see Sheet. */
  sheet?: React.ReactNode;
}

/** Under the stage, panels that scroll, one at a time, and a bar at the foot for the one way forward: a jumper's own page. */
interface Scrolling extends Common {
  panels: StagePanel[];
  /** The panel shown, by its id, and choosing another. */
  shown: string;
  onShow: (id: string) => void;
  bar: React.ReactNode;
}

/** Under the stage, pages side by side, a tab's worth and then the next's: a design's page. See Pages. */
interface Paged extends Common {
  groups: PageGroup[];
  /** The tab it opens on, and being told the tab shown as it changes. */
  first?: string;
  onShown?: (group: string) => void;
  pages?: React.Ref<PagesHandle>;
}

/**
 * A page with the jumper kept on screen: the title block, the jumper on its
 * stage, and under it what there is to see or choose, by tabs.
 *
 * The page itself does not scroll, and the jumper is one size and stays
 * where it is, so a size or a colour chosen is seen on it at once. On a wide
 * screen, or a phone on its side, the stage stands beside the rest.
 *
 * Under the stage is one of two things. A design's page is laid out in pages
 * (see Pages): each the size of the room there, side by side, swiped between,
 * the tabs marking where each kind begins and the last of them the way
 * forward. A jumper's own page is panels that scroll, one shown at a time,
 * every one staying mounted while another is shown, with a bar at the foot
 * for the one way forward.
 */
const StageLayout: React.FC<Scrolling | Paged> = (props) => {
  const { title, eyebrow, stage, tabsLabel, badge, sheet } = props;
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const paged = "groups" in props;
  // Another panel begins at its top.
  const scroll = useRef<HTMLDivElement>(null);
  const shown = paged ? undefined : props.shown;
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [shown]);
  return (
    <div className={paged ? "page stage-layout is-paged" : "page stage-layout"}>
      <TitleBlock title={title} eyebrow={eyebrow} />
      <StorageNotice />
      <div className="stage">
        <div className="stage-over" ref={setSlot} />
        <div className="stage-own">{stage}</div>
        {badge && <p className="stage-badge">{badge}</p>}
      </div>
      <div className="stage-side">
        {paged ? (
          <>
            <Pages ref={props.pages} groups={props.groups} label={tabsLabel} first={props.first} onShown={props.onShown} slot={slot} />
            {/* Its pages end in no colophon; the site is made ready for offline all the same. */}
            <div hidden>
              <OfflineStatus />
            </div>
          </>
        ) : (
          <>
            <div className="stage-tabs screen-only" role="tablist" aria-label={tabsLabel}>
              {props.panels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  role="tab"
                  id={`stage-tab-${panel.id}`}
                  className="stage-tab"
                  aria-selected={panel.id === props.shown}
                  aria-controls={`stage-panel-${panel.id}`}
                  onClick={() => props.onShow(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>
            <div className="stage-scroll" ref={scroll}>
              {props.panels.map((panel) => (
                <div
                  key={panel.id}
                  role="tabpanel"
                  id={`stage-panel-${panel.id}`}
                  className="stage-panel"
                  aria-labelledby={`stage-tab-${panel.id}`}
                  hidden={panel.id !== props.shown}
                >
                  <StageSlot.Provider value={panel.id === props.shown ? slot : null}>{panel.content}</StageSlot.Provider>
                </div>
              ))}
              <footer className="colophon screen-only">
                <OfflineStatus />
                <p className="quiet">Your projects are kept in this browser, on this device.</p>
              </footer>
            </div>
            <div className="stage-bar screen-only">{props.bar}</div>
          </>
        )}
        {sheet}
      </div>
    </div>
  );
};

export default StageLayout;
