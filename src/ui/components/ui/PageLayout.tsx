import React from "react";
import "./PageLayout.css";
import StorageNotice from "../StorageNotice";
import OfflineStatus from "../OfflineStatus";
import TitleBlock from "./TitleBlock";

interface PageLayoutProps {
  /** Rendered as the page's only h1, unless showTitle is false. */
  title: string;
  showTitle?: boolean;
  /** The small line over the title: see TitleBlock. */
  eyebrow?: React.ReactNode;
  /** Home: the title is the site's own name, and the colophon is given whole. */
  home?: boolean;
  lede?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The frame a page that scrolls is laid out in: the title block, and a line
 * at the foot saying where your projects are kept. A page with the jumper
 * kept on screen is laid out by StageLayout instead.
 */
const PageLayout: React.FC<PageLayoutProps> = ({ title, showTitle = true, eyebrow, home = false, lede, children, className }) => (
  <div className={className ? `page ${className}` : "page"}>
    <TitleBlock title={title} showTitle={showTitle} eyebrow={eyebrow} home={home} />
    <StorageNotice />
    {lede && <p className="lede screen-only">{lede}</p>}
    {children}
    <footer className="colophon screen-only">
      <OfflineStatus />
      {home && (
        <p>
          Yokes knitted from the neck down, never more than two colours in a
          round, as Shetland knitters have worked them for a century; each
          design says whose it is. The wool is Shetland's too - every shade here
          is one the Shetland spinners sell.
        </p>
      )}
      <p className="quiet">
        Your projects are kept in this browser, on this device.
        {home && " Nothing is sent anywhere. To move them or keep a copy, save a backup from Settings."}
      </p>
    </footer>
  </div>
);

export default PageLayout;
