/**
 * Stats row — best/worst/problem/laps stat cards (React).
 */

import React from "react";
import { formatTime, formatIssueLabel, type Analysis } from "./state.ts";

export function StatsRow({ analysis, lapsCount }: { analysis: Analysis; lapsCount: number }) {
  return (
    <div className="stats-row">
      <div className="stat-card best">
        <div className="label">Best Lap</div>
        <div className="value">{formatTime(analysis.bestLap.lapTime)}<span className="unit">Lap {analysis.bestLap.lapNumber}</span></div>
      </div>
      <div className="stat-card worst">
        <div className="label">Worst Lap</div>
        <div className="value">{formatTime(analysis.worstLap.lapTime)}<span className="unit">+{analysis.worstLap.delta.toFixed(3)}s</span></div>
      </div>
      <div className="stat-card">
        <div className="label">Problem</div>
        <div className="value">S{analysis.problemSector}<span className="unit">{formatIssueLabel(analysis.issue)}</span></div>
      </div>
      <div className="stat-card">
        <div className="label">Laps</div>
        <div className="value">{lapsCount}</div>
      </div>
    </div>
  );
}
