/**
 * Brake & Throttle pedal bars — horizontal segmented style (React).
 */

import React from "react";

const SEGS = 20;

function PedalSegments({ pct, color }: { pct: number; color: string }) {
  const active = Math.round(pct * SEGS);
  const segs = [];
  for (let i = 0; i < SEGS; i++) {
    const on = i < active;
    segs.push(
      <div key={i} className={`hseg${on ? " on" : ""}`} style={{ background: on ? color : "#1a1a22" }} />
    );
  }
  return <>{segs}</>;
}

export function Pedals({ brk, thr }: { brk: number; thr: number }) {
  return (
    <div className="hpedals">
      <div className="hpedal">
        <div className="hpedal-label">Brake</div>
        <div className="hpedal-bar">
          <div className="hpedal-segs brk">
            <PedalSegments pct={brk} color="#ff3333" />
          </div>
        </div>
      </div>
      <div className="hpedal">
        <div className="hpedal-label">Throttle</div>
        <div className="hpedal-bar">
          <div className="hpedal-segs thr">
            <PedalSegments pct={thr} color="#00ff00" />
          </div>
        </div>
      </div>
    </div>
  );
}
