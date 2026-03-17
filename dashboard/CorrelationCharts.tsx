/**
 * Correlation charts — dual-axis area/line charts along track position.
 * Shows how two channels relate across the lap. Much more readable than scatter.
 */

import React, { useMemo } from "react";
import type { TelemetryFrame } from "../challenge-hard.ts";
import { findFrameIndex, avgTyreTemp, SECTOR_BOUNDARIES } from "./state.ts";

// ================================================================
// DUAL CHANNEL CHART
// ================================================================

interface Series {
  label: string;
  unit: string;
  color: string;
  values: number[];
  min: number;
  max: number;
}

interface DualChartProps {
  title: string;
  positions: number[];     // track positions [0..1]
  primary: Series;
  secondary: Series;
  highlightIdx: number;
  zones?: { from: number; to: number; color: string }[];
}

const W = 400;
const H = 140;
const PAD = { top: 6, right: 44, bottom: 22, left: 44 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

function DualChart({ title, positions, primary, secondary, highlightIdx, zones }: DualChartProps) {
  const toX = (pos: number) => PAD.left + pos * PW;
  const toYp = (v: number) => PAD.top + PH - ((v - primary.min) / (primary.max - primary.min || 1)) * PH;
  const toYs = (v: number) => PAD.top + PH - ((v - secondary.min) / (secondary.max - secondary.min || 1)) * PH;

  // Build SVG paths
  const pLine = positions.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p).toFixed(1)},${toYp(primary.values[i]!).toFixed(1)}`).join(" ");
  const pArea = pLine + ` L${toX(positions[positions.length - 1]!).toFixed(1)},${(PAD.top + PH).toFixed(1)} L${toX(positions[0]!).toFixed(1)},${(PAD.top + PH).toFixed(1)} Z`;

  const sLine = positions.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p).toFixed(1)},${toYs(secondary.values[i]!).toFixed(1)}`).join(" ");

  // Y-axis ticks (3 each side)
  const pTicks = autoTicks(primary.min, primary.max, 3);
  const sTicks = autoTicks(secondary.min, secondary.max, 3);

  // X-axis ticks (sector boundaries + start/end)
  const xTicks = [0, ...SECTOR_BOUNDARIES, 1.0];

  // Highlight cursor
  const hlX = highlightIdx >= 0 ? toX(positions[highlightIdx]!) : -10;
  const hlPy = highlightIdx >= 0 ? toYp(primary.values[highlightIdx]!) : 0;
  const hlSy = highlightIdx >= 0 ? toYs(secondary.values[highlightIdx]!) : 0;

  return (
    <div className="corr-chart">
      <div className="corr-header">
        <span className="corr-title">{title}</span>
        <span className="corr-legend-inline">
          <span className="corr-leg-swatch" style={{ background: primary.color }} />{primary.label}
          <span className="corr-leg-swatch secondary" style={{ background: secondary.color }} />{secondary.label}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="corr-svg" preserveAspectRatio="none">
        {/* Background zones */}
        {zones?.map((z, i) => (
          <rect key={i} x={toX(z.from)} y={PAD.top} width={toX(z.to) - toX(z.from)} height={PH} fill={z.color} />
        ))}

        {/* Grid */}
        {xTicks.map(v => (
          <line key={`xg${v}`} x1={toX(v)} y1={PAD.top} x2={toX(v)} y2={PAD.top + PH} stroke="#1e1e26" strokeWidth="0.5" />
        ))}
        {pTicks.map(v => (
          <line key={`yg${v}`} x1={PAD.left} y1={toYp(v)} x2={PAD.left + PW} y2={toYp(v)} stroke="#1e1e26" strokeWidth="0.5" />
        ))}

        {/* Primary area + line */}
        <path d={pArea} fill={primary.color} opacity="0.08" />
        <path d={pLine} fill="none" stroke={primary.color} strokeWidth="2" opacity="0.8" />

        {/* Secondary line (dashed) */}
        <path d={sLine} fill="none" stroke={secondary.color} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top + PH} x2={PAD.left + PW} y2={PAD.top + PH} stroke="#333" strokeWidth="1" />

        {/* Left Y-axis ticks (primary) */}
        {pTicks.map(v => (
          <text key={`pl${v}`} x={PAD.left - 4} y={toYp(v) + 3} textAnchor="end" fill={primary.color} fontSize="8" fontFamily="'PP Formula', Inter, sans-serif" opacity="0.7">
            {formatTickVal(v)}
          </text>
        ))}

        {/* Right Y-axis ticks (secondary) */}
        {sTicks.map(v => (
          <text key={`sl${v}`} x={W - PAD.right + 4} y={toYs(v) + 3} textAnchor="start" fill={secondary.color} fontSize="8" fontFamily="'PP Formula', Inter, sans-serif" opacity="0.7">
            {formatTickVal(v)}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map(v => (
          <text key={`xl${v}`} x={toX(v)} y={H - 4} textAnchor="middle" fill="#555" fontSize="8" fontFamily="'PP Formula', Inter, sans-serif">
            {v === 0 ? "S/F" : v < 0.5 ? "S2" : v < 0.8 ? "S3" : "END"}
          </text>
        ))}

        {/* Highlight cursor */}
        {highlightIdx >= 0 && (
          <>
            <line x1={hlX} y1={PAD.top} x2={hlX} y2={PAD.top + PH} stroke="#fff" strokeWidth="0.5" opacity="0.3" />
            <circle cx={hlX} cy={hlPy} r="3.5" fill={primary.color} stroke="#fff" strokeWidth="1" />
            <circle cx={hlX} cy={hlSy} r="3" fill={secondary.color} stroke="#fff" strokeWidth="1" />
            {/* Value readouts */}
            <rect x={hlX + 6} y={hlPy - 10} width="40" height="13" rx="3" fill="rgba(0,0,0,0.7)" />
            <text x={hlX + 8} y={hlPy} fill={primary.color} fontSize="9" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">
              {formatTickVal(primary.values[highlightIdx]!)}{primary.unit ? ` ${primary.unit}` : ""}
            </text>
            <rect x={hlX + 6} y={hlSy - 10} width="40" height="13" rx="3" fill="rgba(0,0,0,0.7)" />
            <text x={hlX + 8} y={hlSy} fill={secondary.color} fontSize="9" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">
              {formatTickVal(secondary.values[highlightIdx]!)}{secondary.unit ? ` ${secondary.unit}` : ""}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ================================================================
// GEAR MAP CHART — horizontal bar per frame, colored by gear
// ================================================================

function GearMap({ frames, positions, highlightIdx }: { frames: TelemetryFrame[]; positions: number[]; highlightIdx: number }) {
  const gearColors = ["#666", "#4488ff", "#44bbff", "#44ffbb", "#aaff44", "#ffdd44", "#ff8844", "#ff4444"];
  const toX = (pos: number) => PAD.left + pos * PW;
  const toY = (rpm: number, max: number) => PAD.top + PH - (rpm / max) * PH;
  const maxRpm = Math.max(9000, ...frames.map(f => f.rpm));

  const rpmTicks = autoTicks(0, maxRpm, 3);
  const xTicks = [0, ...SECTOR_BOUNDARIES, 1.0];

  // Gear colored segments
  const gearSegs: { x1: number; x2: number; color: string; gear: number }[] = [];
  for (let i = 0; i < frames.length - 1; i++) {
    gearSegs.push({
      x1: toX(positions[i]!),
      x2: toX(positions[i + 1]!),
      color: gearColors[Math.min(frames[i]!.gear, gearColors.length - 1)]!,
      gear: frames[i]!.gear,
    });
  }

  const hlX = highlightIdx >= 0 ? toX(positions[highlightIdx]!) : -10;

  return (
    <div className="corr-chart">
      <div className="corr-header">
        <span className="corr-title">RPM & Gear Map</span>
        <span className="corr-legend-inline">
          {["1", "2", "3", "4", "5", "6", "7"].map((g, i) => (
            <React.Fragment key={g}>
              <span className="corr-leg-swatch" style={{ background: gearColors[i + 1] }} />{g}
            </React.Fragment>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="corr-svg" preserveAspectRatio="none">
        {/* Gear colored background strips */}
        {gearSegs.map((s, i) => (
          <rect key={i} x={s.x1} y={PAD.top} width={Math.max(1, s.x2 - s.x1)} height={PH} fill={s.color} opacity="0.06" />
        ))}

        {/* Grid */}
        {xTicks.map(v => (
          <line key={`xg${v}`} x1={toX(v)} y1={PAD.top} x2={toX(v)} y2={PAD.top + PH} stroke="#1e1e26" strokeWidth="0.5" />
        ))}
        {rpmTicks.map(v => (
          <line key={`yg${v}`} x1={PAD.left} y1={toY(v, maxRpm)} x2={PAD.left + PW} y2={toY(v, maxRpm)} stroke="#1e1e26" strokeWidth="0.5" />
        ))}

        {/* Gear colored bottom bar */}
        {gearSegs.map((s, i) => (
          <rect key={`gb${i}`} x={s.x1} y={PAD.top + PH - 4} width={Math.max(1, s.x2 - s.x1)} height="4" fill={s.color} opacity="0.8" />
        ))}

        {/* RPM line — colored by gear */}
        {gearSegs.map((s, i) => {
          const y1 = toY(frames[i]!.rpm, maxRpm);
          const y2 = toY(frames[i + 1]!.rpm, maxRpm);
          return (
            <line key={`rl${i}`} x1={s.x1} y1={y1} x2={s.x2} y2={y2} stroke={s.color} strokeWidth="2" opacity="0.85" />
          );
        })}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top + PH} x2={PAD.left + PW} y2={PAD.top + PH} stroke="#333" strokeWidth="1" />

        {/* Y ticks */}
        {rpmTicks.map(v => (
          <text key={`rl${v}`} x={PAD.left - 4} y={toY(v, maxRpm) + 3} textAnchor="end" fill="#9B6DFF" fontSize="8" fontFamily="'PP Formula', Inter, sans-serif" opacity="0.7">
            {formatTickVal(v)}
          </text>
        ))}

        {/* X labels */}
        {xTicks.map(v => (
          <text key={`xl${v}`} x={toX(v)} y={H - 4} textAnchor="middle" fill="#555" fontSize="8" fontFamily="'PP Formula', Inter, sans-serif">
            {v === 0 ? "S/F" : v < 0.5 ? "S2" : v < 0.8 ? "S3" : "END"}
          </text>
        ))}

        {/* Highlight */}
        {highlightIdx >= 0 && (
          <>
            <line x1={hlX} y1={PAD.top} x2={hlX} y2={PAD.top + PH} stroke="#fff" strokeWidth="0.5" opacity="0.3" />
            <circle cx={hlX} cy={toY(frames[highlightIdx]!.rpm, maxRpm)} r="3.5" fill={gearColors[frames[highlightIdx]!.gear] ?? "#666"} stroke="#fff" strokeWidth="1" />
            <rect x={hlX + 6} y={toY(frames[highlightIdx]!.rpm, maxRpm) - 10} width="56" height="13" rx="3" fill="rgba(0,0,0,0.7)" />
            <text x={hlX + 8} y={toY(frames[highlightIdx]!.rpm, maxRpm)} fill="#fff" fontSize="9" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">
              {frames[highlightIdx]!.rpm} G{frames[highlightIdx]!.gear}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ================================================================
// HELPERS
// ================================================================

function autoTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(+(min + step * i).toPrecision(3));
  }
  return ticks;
}

function formatTickVal(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

// ================================================================
// EXPORTED PANEL
// ================================================================

const sectorZones = [
  { from: 0, to: SECTOR_BOUNDARIES[0], color: "rgba(255,255,255,0.015)" },
  { from: SECTOR_BOUNDARIES[0], to: SECTOR_BOUNDARIES[1], color: "rgba(0,0,0,0)" },
  { from: SECTOR_BOUNDARIES[1], to: 1, color: "rgba(255,255,255,0.015)" },
];

interface Props {
  frames: TelemetryFrame[];
  highlightPos: number;
}

export function CorrelationCharts({ frames, highlightPos }: Props) {
  const positions = useMemo(() => frames.map(f => f.pos), [frames]);

  const highlightIdx = useMemo(() => {
    if (highlightPos < 0 || !frames.length) return -1;
    return findFrameIndex(frames, highlightPos);
  }, [frames, highlightPos]);

  if (!frames.length) return null;

  const tempMax = Math.max(120, ...frames.map(f => Math.max(f.tyres.fl, f.tyres.fr, f.tyres.rl, f.tyres.rr)));
  const spdMax = Math.max(300, ...frames.map(f => f.spd));

  const speedValues = useMemo(() => frames.map(f => f.spd), [frames]);
  const avgTyreTempValues = useMemo(() => frames.map(f => avgTyreTemp(f)), [frames]);
  const steeringValues = useMemo(() => frames.map(f => Math.abs(f.str) * 100), [frames]);
  const brakeValues = useMemo(() => frames.map(f => f.brk * 100), [frames]);
  const frontTempValues = useMemo(() => frames.map(f => (f.tyres.fl + f.tyres.fr) / 2), [frames]);
  const throttleValues = useMemo(() => frames.map(f => f.thr * 100), [frames]);
  const rearTempValues = useMemo(() => frames.map(f => (f.tyres.rl + f.tyres.rr) / 2), [frames]);

  return (
    <div className="corr-section">
      <div className="corr-section-title">Correlation Analysis</div>
      <div className="corr-grid">
        <DualChart
          title="Speed & Avg Tyre Temp"
          positions={positions}
          primary={{ label: "Speed", unit: "km/h", color: "#00ff00", values: speedValues, min: 0, max: spdMax }}
          secondary={{ label: "Tyre Temp", unit: "°C", color: "#fdd952", values: avgTyreTempValues, min: 60, max: tempMax }}
          highlightIdx={highlightIdx}
          zones={sectorZones}
        />
        <DualChart
          title="Steering & Avg Tyre Temp"
          positions={positions}
          primary={{ label: "|Steering|", unit: "%", color: "#9B6DFF", values: steeringValues, min: 0, max: 100 }}
          secondary={{ label: "Tyre Temp", unit: "°C", color: "#fdd952", values: avgTyreTempValues, min: 60, max: tempMax }}
          highlightIdx={highlightIdx}
          zones={sectorZones}
        />
        <DualChart
          title="Brake & Front Tyre Temp"
          positions={positions}
          primary={{ label: "Brake", unit: "%", color: "#ff3333", values: brakeValues, min: 0, max: 100 }}
          secondary={{ label: "Front Temp", unit: "°C", color: "#fdd952", values: frontTempValues, min: 60, max: tempMax }}
          highlightIdx={highlightIdx}
          zones={sectorZones}
        />
        <DualChart
          title="Throttle & Rear Tyre Temp"
          positions={positions}
          primary={{ label: "Throttle", unit: "%", color: "#00ff00", values: throttleValues, min: 0, max: 100 }}
          secondary={{ label: "Rear Temp", unit: "°C", color: "#fdd952", values: rearTempValues, min: 60, max: tempMax }}
          highlightIdx={highlightIdx}
          zones={sectorZones}
        />
        <GearMap
          frames={frames}
          positions={positions}
          highlightIdx={highlightIdx}
        />
      </div>
    </div>
  );
}
