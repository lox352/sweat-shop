import React from "react";
import type { TimeSummary } from "../knitting/timing/model";
import { duration, range, timeLine } from "../knitting/timing/format";

export const TimeLine: React.FC<{ time: TimeSummary; finished: boolean; className?: string }> = ({
  time,
  finished,
  className,
}) => <p className={`quiet ${className ?? ""}`.trim()}>{timeLine(time, finished)}</p>;

/**
 * The project's figures for time: how long, over how many sittings, how
 * fast, and how long to go - with, once there are a few days to go on, how
 * many more days that is at the knitter's usual amount a day.
 */
export const TimeFigures: React.FC<{ time: TimeSummary; finished: boolean }> = ({ time, finished }) => {
  const sittings = time.sittings.length;
  const perDay = time.knitted / Math.max(time.days, 1);
  const moreDays = time.left && time.days >= 3 ? Math.max(1, Math.round(time.left.mid / perDay)) : undefined;
  return (
    <>
      <div>
        <dt>Time knitted</dt>
        <dd>{duration(time.knitted)}</dd>
      </div>
      <div>
        <dt>Sittings</dt>
        <dd>
          {sittings} over {time.days} {time.days === 1 ? "day" : "days"}
        </dd>
      </div>
      {time.perMinute !== undefined && (
        <div>
          <dt>Pace</dt>
          <dd>about {Math.round(time.perMinute)} stitches a minute</dd>
        </div>
      )}
      {!finished && time.left && (
        <div>
          <dt>Time to go</dt>
          <dd>
            about {range(time.left)}
            {moreDays !== undefined && (
              <span className="quiet">
                {" "}· {moreDays === 1 ? "a day" : `${moreDays} days`} at your usual {duration(perDay)} a day
              </span>
            )}
          </dd>
        </div>
      )}
    </>
  );
};
