import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Opens every new page at the top.
 *
 * A single-page app keeps the window's scroll position across a route change,
 * so choosing a hat half way down the list would open it half way down its own
 * page. Only forward navigation to a different page is reset: going back is
 * left to the browser, which puts you where you were on the list, and a change
 * to the same page's query (opening or closing the knitting) is not a new page.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  const last = useRef(pathname);
  useLayoutEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    if (type !== "POP") window.scrollTo(0, 0);
  }, [pathname, type]);
  return null;
}
