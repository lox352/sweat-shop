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
  eyebrow?: React.ReactNode;
  lede?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * The frame every page is laid out in: the masthead, the page's own title,
 * and a footer saying where the designs come from and where your projects
 * are kept.
 */
const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  showTitle = true,
  eyebrow,
  lede,
  aside,
  children,
  className,
}) => (
  <div className={className ? `page ${className}` : "page"}>
    <header className="masthead screen-only">
      <Link to="/" className="masthead-title">
        Sweat Shop
      </Link>
      <div className="masthead-actions">
        {aside}
        <Settings />
      </div>
    </header>
    <StorageNotice />
    {eyebrow && <p className="eyebrow screen-only">{eyebrow}</p>}
    {showTitle && <h1 className="page-title">{title}</h1>}
    {lede && <p className="lede screen-only">{lede}</p>}
    {children}
    <footer className="colophon screen-only">
      <OfflineStatus />
      <p>
        Yokes knitted from the neck down, never more than two colours in a
        round, as Shetland knitters have worked them for a century; each
        design says whose it is. The wool is Shetland's too - every shade here
        is one the Shetland spinners sell.
      </p>
      <p className="quiet">
        Your projects are kept in this browser, on this device. Nothing is sent
        anywhere. To move them or keep a copy, save a backup from Settings.
      </p>
    </footer>
  </div>
);

export default PageLayout;
