/**
 * RPM gauge with gear indicator dots below (React).
 */

import React from "react";
import { GaugeSVG } from "./SpeedGauge.tsx";

const GEARS = ["R", "N", "1", "2", "3", "4", "5", "6", "7"];

export function RpmGaugeSVG({ rpm }: { rpm: number }) {
  return (
    <GaugeSVG
      value={rpm}
      max={9000}
      size={200}
      colorClass="rpm"
      label={String(rpm)}
      unit="RPM"
      step={1000}
      minorPerMajor={4}
      formatTick={v => v === 0 ? "0" : `${v / 1000}k`}
      redlineFrom={7500}
    />
  );
}

export function GearIndicator({ gear }: { gear: number }) {
  // Map gear number to index: R=-1->0, N=0->1, 1->2, 2->3, etc.
  const activeIdx = gear + 1;

  return (
    <div className="rpm-gear">
      {GEARS.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <div className="gear-line" />}
          <div className={`gear-dot${i === activeIdx ? " active" : ""}`}>
            <div className="gear-circle" />
            <div className="gear-lbl">{label}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
