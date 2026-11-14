import { Component, type ReactNode } from "react";
import { NoKnitting, retryKnitting } from "../knitting/useSweater";

/**
 * Where a pattern could be had no way - not fetched, and nor could what works
 * one out here (see useSweater's NoKnitting) - says so, and offers to try
 * again, in place of what would have shown it. `compact` for a card among
 * others, which says it in a line. Anything else that goes wrong is not its
 * to catch.
 */
export default class KnittingBoundary extends Component<{ children: ReactNode; compact?: boolean }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    if (error instanceof NoKnitting) return { failed: true };
    throw error;
  }

  retry = () => {
    retryKnitting();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="no-knitting">
        <p>
          {this.props.compact
            ? "This pattern could not be fetched."
            : "The pattern could not be fetched. Anything you have knitted is safe. Check your connection and try again."}
        </p>
        <button type="button" className="btn" onClick={this.retry}>
          Try again
        </button>
      </div>
    );
  }
}
