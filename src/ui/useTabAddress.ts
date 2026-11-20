import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { PagesHandle } from "./components/ui/Pages";

/**
 * The tab of a page laid out in pages (see Pages), kept in its address.
 *
 * The tab shown is the pages' own to know, and changes at once. It is part
 * of the address too, so a reload keeps it - but written there after, once
 * the pages have come to rest, and replacing what was there, so back leaves
 * the page and does not walk its tabs. The first tab is the address without
 * one. An address that comes to ask for another tab while the page is open -
 * back or forward, a link followed - is gone to.
 *
 * `renamed` is tabs an older address may ask for, and where each is now: a
 * tab, or a page of one.
 */
export const useTabAddress = <Tab extends string>(tabs: readonly Tab[], renamed: Record<string, readonly [tab: Tab, page: string]> = {}) => {
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const [movedTo, wantedPage] = (asked ? renamed[asked] : undefined) ?? [];
  const wanted = tabs.find((tab) => tab === (movedTo ?? asked)) ?? tabs[0];
  const home = tabs[0];
  /** The tab the page opens on, and the page of it, where an older address asked for what is now one. */
  const first = useRef(wanted).current;
  const firstPage = useRef(wantedPage).current;
  const written = useRef<string>(first);
  const settling = useRef<number>();
  const onShown = useCallback(
    (tab: string) => {
      window.clearTimeout(settling.current);
      settling.current = window.setTimeout(() => {
        if (written.current === tab) return;
        written.current = tab;
        setParams(
          (now) => {
            const next = new URLSearchParams(now);
            if (tab === home) next.delete("tab");
            else next.set("tab", tab);
            return next;
          },
          { replace: true },
        );
      }, 600);
    },
    [setParams, home],
  );
  useEffect(() => () => window.clearTimeout(settling.current), []);
  const pager = useRef<PagesHandle>(null);
  const go = useCallback((tab: Tab, page?: string) => pager.current?.go(tab, page), []);
  useEffect(() => {
    if (wanted === written.current) return;
    written.current = wanted;
    pager.current?.go(wanted, wantedPage);
  }, [wanted, wantedPage]);
  return { first, firstPage, onShown, pager, go };
};
