import { Component, type ReactNode } from "react";

/** A decorative preview must never take the knitting instructions down. */
export default class PreviewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="status" style={{ padding: "2rem" }}>
          <p>The 3D preview is unavailable. You can still use the chart and knitting counter.</p>
          <button type="button" onClick={() => this.setState({ failed: false })}>
            Retry preview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
