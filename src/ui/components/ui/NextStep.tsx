import React from "react";

/**
 * The closing call to action on a hat or project page: what comes next, and
 * the buttons that take you there, with the main one last so it lands where
 * a reader finishes.
 */
const NextStep: React.FC<{
  title: string;
  detail: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, detail, children }) => (
  <section className="section next-step">
    <div>
      <h2>{title}</h2>
      <p className="quiet">{detail}</p>
    </div>
    <div className="next-step-actions">{children}</div>
  </section>
);

export default NextStep;
