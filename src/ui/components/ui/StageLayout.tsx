import React, { useState } from "react";
import "./PageLayout.css";
import "./StageLayout.css";
import StorageNotice from "../StorageNotice";
import OfflineStatus from "../OfflineStatus";
import TitleBlock from "./TitleBlock";
import Pages, { type PageGroup, type PagesHandle } from "./Pages";

/**
 * A page with the jumper kept on screen: the title block, the jumper on its
 * stage, and under it what there is to see or choose, by tabs.
 *
 * The page itself does not scroll, and the jumper is one size and stays
 * where it is, so a size or a colour chosen is seen on it at once. On a wide
 * screen, or a phone on its side, the stage stands beside the rest.
 *
 * Under the stage, a design's page and a jumper's own are both laid out in
 * pages (see Pages): each the size of the room there, side by side, swiped
 * between, the tabs marking where each kind begins and one of them the way
 * forward.
 */
const StageLayout: React.FC<{
  title: string;
  eyebrow?: React.ReactNode;
  stage: React.ReactNode;
  /** What the tabs are of, for a screen reader: "This design". */
  tabsLabel: string;
  /** What the jumper on the stage is, in a few words, in its corner: its size and its colourway. */
  badge?: React.ReactNode;
  /** A card up from the foot, over what is under the stage, while there is one: see Sheet. */
  sheet?: React.ReactNode;
  groups: PageGroup[];
  /** The tab it opens on, the page of it where that is not its first, and being told the tab shown as it changes. */
  first?: string;
  firstPage?: string;
  onShown?: (group: string) => void;
  pages?: React.Ref<PagesHandle>;
}> = ({ title, eyebrow, stage, tabsLabel, badge, sheet, groups, first, firstPage, onShown, pages }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <div className="page stage-layout">
      <TitleBlock title={title} eyebrow={eyebrow} />
      <StorageNotice />
      <div className="stage">
        <div className="stage-over" ref={setSlot} />
        <div className="stage-own">{stage}</div>
        {badge && <p className="stage-badge">{badge}</p>}
      </div>
      <div className="stage-side">
        <Pages ref={pages} groups={groups} label={tabsLabel} first={first} firstPage={firstPage} onShown={onShown} slot={slot} />
        {/* Its pages end in no colophon; the site is made ready for offline all the same. */}
        <div hidden>
          <OfflineStatus />
        </div>
        {sheet}
      </div>
    </div>
  );
};

export default StageLayout;
