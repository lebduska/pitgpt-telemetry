/**
 * Coaching message banner (React).
 */

import React from "react";
import { formatIssueLabel, type Analysis } from "./state.ts";

export function CoachingBanner({ analysis }: { analysis: Analysis }) {
  return (
    <div className="coaching-banner">
      <div className="tag">PitGPT Race Engineer</div>
      <div className="message">{analysis.coachingMessage}</div>
      <div className="meta">
        Sector {analysis.problemSector} &middot; <span>+{analysis.worstLap.delta.toFixed(3)}s</span> vs best &middot; {formatIssueLabel(analysis.issue)}
      </div>
    </div>
  );
}
