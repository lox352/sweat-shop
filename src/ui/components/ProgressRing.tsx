import React from "react";
import "./ProgressRing.css";

interface ProgressRingProps {
  /** 0 to 100. */
  percent: number;
  label?: string;
}

const size = 46;
const stroke = 4;
const radius = (size - stroke) / 2;
const circumference = 2 * Math.PI * radius;

/**
 * A small dial for how much of a hat is knitted. Reads at a glance and, unlike
 * a bar, does not need a column of its own in the card.
 */
const ProgressRing: React.FC<ProgressRingProps> = ({ percent, label }) => {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <span
      className="progress-ring"
      role="img"
      aria-label={label ?? `${clamped.toFixed(0)}% knitted`}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          className="progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span className="progress-ring-label" aria-hidden="true">
        {Math.round(clamped)}
      </span>
    </span>
  );
};

export default ProgressRing;
