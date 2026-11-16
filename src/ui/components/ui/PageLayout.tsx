import React from "react";
import { Link } from "react-router-dom";
import "./PageLayout.css";
import StorageNotice from "../StorageNotice";
import Settings from "../Settings";
import OfflineStatus from "../OfflineStatus";

interface PageLayoutProps {
  /** Rendered as the page's only h1, unless showTitle is false. */
  title: string;
  showTitle?: boolean;
  /** The small line over the title: what the page is. On Home it stands alone; on every other page it follows the site's name. */
  eyebrow?: React.ReactNode;
  /** Home: the title is the site's own name, and the colophon is given whole. */
  home?: boolean;
  lede?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The frame every page is laid out in: the title block, and a line at the
 * foot saying where your projects are kept.
 *
 * The title block is the same on every page: a small line, the title in
 * crimson under it, the gear at the right. On every page but Home the small
 * line begins with the site's name, and that is the way home: there are no
 * back arrows, because the browser has one, and it only works for a knitter
 * who came from inside the site.
 */
const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  showTitle = true,
  eyebrow,
  home = false,
  lede,
  children,
  className,
}) => (
  <div className={className ? `page ${className}` : "page"}>
    <header className="title-block">
      <div className="title-block-text">
        <p className="eyebrow screen-only">
          {home ? (
            eyebrow
          ) : (
            <>
              <Link to="/" className="title-block-home">
                Sweat Shop
              </Link>
              {eyebrow && <> · {eyebrow}</>}
            </>
          )}
        </p>
        {showTitle && <h1 className="page-title">{title}</h1>}
      </div>
      <div className="title-block-actions screen-only">
        <Settings />
      </div>
    </header>
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
