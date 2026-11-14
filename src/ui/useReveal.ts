import { useEffect, useRef, useState } from "react";

/**
 * Reveals an element the first time it scrolls into view.
 *
 * Returns a ref to attach and whether it has been shown yet. Anyone who has
 * asked for reduced motion, or whose browser has no IntersectionObserver, is
 * shown the content immediately rather than being given a degraded animation.
 */
export const useReveal = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [shown, setShown] = useState(
    prefersReduced || typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    if (shown) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // A little before it reaches the viewport, so it is already settled by
      // the time it is properly on screen.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);

  return { ref, shown };
};
