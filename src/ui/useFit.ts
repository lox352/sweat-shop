import { useCallback, useEffect, useRef, useState } from "react";
import { type FitQuestion, type Fitted, type Unfitted, askForFit } from "../library/fit";

/** Where the working out of a fit has got to: not asked for, under way with what is found so far, shown, or not to be had. */
export type FitState =
  | { at: "rest" }
  | { at: "working"; fraction: number; found: Fitted[] }
  | { at: "shown"; found: Fitted[]; unfitted: Unfitted[] }
  | { at: "failed"; why: string };

/**
 * The asking for the rest of a sweater to be worked out (see library/fit),
 * for whatever shows it: the one place that starts the worker, follows how
 * far it has got, gathers each of the design's ways as it is done, and stops
 * it when it is no longer wanted.
 */
export const useFit = () => {
  const [state, setState] = useState<FitState>({ at: "rest" });
  const asked = useRef<{ cancel: () => void }>();
  useEffect(() => () => asked.current?.cancel(), []);

  const reset = useCallback(() => {
    asked.current?.cancel();
    setState({ at: "rest" });
  }, []);

  const ask = useCallback((question: FitQuestion) => {
    asked.current?.cancel();
    setState({ at: "working", fraction: 0, found: [] });
    const request = askForFit(question, {
      progress: (fraction) => setState((now) => (now.at === "working" ? { ...now, fraction } : now)),
      fitted: (fitted) => setState((now) => (now.at === "working" ? { ...now, found: [...now.found, fitted] } : now)),
    });
    asked.current = request;
    request.done.then(
      (unfitted) => setState((now) => (now.at === "working" ? { at: "shown", found: now.found, unfitted } : now)),
      (error: Error) => setState({ at: "failed", why: error.message }),
    );
  }, []);

  return { state, ask, reset };
};
