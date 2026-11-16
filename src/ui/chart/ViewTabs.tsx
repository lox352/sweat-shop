import React from "react";
import type { ChartView } from "../../reading/views";

/**
 * The chart's views as tabs over it: from the neck, the body and each sleeve,
 * each its own chart, with the one the knitting is in marked. See
 * reading/views.
 */
const ViewTabs: React.FC<{
  views: ChartView[];
  shown: string;
  current?: string;
  onShow: (view: string) => void;
}> = ({ views, shown, current, onShow }) => (
  <div className="view-tabs" role="tablist" aria-label="Views of the chart">
    {views.map((view) => (
      <button
        key={view.id}
        type="button"
        role="tab"
        aria-selected={view.id === shown}
        className={`view-tab${view.id === shown ? " is-shown" : ""}`}
        onClick={() => onShow(view.id)}
      >
        {view.label}
        {view.id === current && <span className="quiet">knitting</span>}
      </button>
    ))}
  </div>
);

export default ViewTabs;
