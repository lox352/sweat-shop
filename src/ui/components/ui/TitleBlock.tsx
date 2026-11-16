import React from "react";
import { Link } from "react-router-dom";
import Settings from "../Settings";

/**
 * How every page opens: a small line, the title in crimson under it, the gear
 * at the right.
 *
 * On every page but Home the small line begins with the site's name, and
 * that is the way home: there are no back arrows, because the browser has
 * one, and it only works for a knitter who came from inside the site.
 */
const TitleBlock: React.FC<{
  /** Rendered as the page's only h1, unless showTitle is false. */
  title: string;
  showTitle?: boolean;
  /** The small line over the title: what the page is. On Home it stands alone; on every other page it follows the site's name. */
  eyebrow?: React.ReactNode;
  /** Home: the title is the site's own name. */
  home?: boolean;
}> = ({ title, showTitle = true, eyebrow, home = false }) => (
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
);

export default TitleBlock;
