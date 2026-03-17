/**
 * Tyres widget — top-down Porsche 963 LMDh outline with 4 tyre rectangles.
 * Front tyres rotate according to steering input (str: -1..1).
 * Tyre colour reflects temperature (cool → warm → hot).
 */

import React from "react";
import { tyreGlow } from "./state.ts";

interface TyreInfo {
  temp: number;
  color: string;
}

interface Props {
  fl: TyreInfo | null;
  fr: TyreInfo | null;
  rl: TyreInfo | null;
  rr: TyreInfo | null;
  steering: number; // -1 to 1
}

// ========================================
// Porsche 963 LMDh — top-down SVG path constants
// ========================================

const CAR_BODY = `
    M 56,28
    Q 80,20 104,28
    L 108,30
    Q 116,34 120,42
    L 124,50
    Q 128,54 132,56
    Q 136,58 136,62
    Q 136,66 130,68
    L 122,72
    Q 116,76 112,84
    L 108,100
    Q 106,106 106,112
    L 106,116
    Q 106,120 108,126
    L 112,138
    Q 116,146 122,152
    L 130,158
    Q 136,160 136,164
    Q 136,168 132,170
    L 126,174
    Q 120,178 116,184
    L 112,192
    Q 108,198 106,202
    L 104,206
    Q 80,210 56,206
    L 54,202
    Q 52,198 48,192
    L 44,184
    Q 40,178 34,174
    L 28,170
    Q 24,168 24,164
    Q 24,160 28,158
    L 38,152
    Q 44,146 48,138
    L 52,126
    Q 54,120 54,116
    L 54,112
    Q 54,106 52,100
    L 48,84
    Q 44,76 38,72
    L 30,68
    Q 24,66 24,62
    Q 24,58 28,56
    Q 32,54 36,50
    L 40,42
    Q 44,34 52,30
    Z
  `;

const CAR_COCKPIT = `
    M 64,86 Q 64,80 72,76 Q 80,74 88,76 Q 96,80 96,86
    L 94,104 Q 94,110 80,110 Q 66,110 66,104 Z
  `;

const CAR_WING = `M 20,202 L 20,208 L 140,208 L 140,202 Z`;
const CAR_WING_END_L = `M 18,200 L 18,210 L 22,210 L 22,200 Z`;
const CAR_WING_END_R = `M 138,200 L 138,210 L 142,210 L 142,200 Z`;
const CAR_SPLITTER = `M 52,22 L 52,20 L 108,20 L 108,22 Z`;
const CAR_FIN = `M 79,110 L 79,198 L 81,198 L 81,110 Z`;
const CAR_HL_L = `M 38,40 L 32,50 L 36,52 L 42,42 Z`;
const CAR_HL_R = `M 122,40 L 128,50 L 124,52 L 118,42 Z`;
const CAR_SCOOP_L = `M 56,114 L 52,124 L 56,124 Z`;
const CAR_SCOOP_R = `M 104,114 L 108,124 L 104,124 Z`;

export function TyresWidget({ fl, fr, rl, rr, steering }: Props) {
  const steerAngle = -steering * 25;

  // Tyre dimensions
  const tw = 14, th = 32, tr = 3;

  // Axle positions — tyres sit ON the fender bulges
  const frontY = 58;
  const rearY = 172;
  const leftX = 24;
  const rightX = 136;

  function renderTyre(x: number, y: number, info: TyreInfo | null, rotate: number) {
    const c = info ? info.color : "#444";
    const glow = info ? tyreGlow(info.temp) : "none";
    return (
      <g transform={`translate(${x}, ${y}) rotate(${rotate})`}>
        {glow !== "none" && (
          <rect x={-tw / 2 - 2} y={-th / 2 - 2} width={tw + 4} height={th + 4} rx={tr + 1} fill={glow} />
        )}
        <rect x={-tw / 2} y={-th / 2} width={tw} height={th} rx={tr} fill="#1a1a1a" stroke={c} strokeWidth="1.5" />
        {[-10, -5, 0, 5, 10].map(dy => (
          <line key={dy} x1={-tw / 2 + 2} y1={dy} x2={tw / 2 - 2} y2={dy} stroke={c} strokeWidth="0.7" opacity="0.4" />
        ))}
      </g>
    );
  }

  return (
    <div className="widget-card tyres-card">
      <div className="widget-header">Tyres</div>
      <div className="tyres-svg-wrap">
        <svg viewBox="0 0 160 220" className="tyres-svg">
          {/* Car body */}
          <path d={CAR_BODY} fill="#1a1a24" stroke="#2a2a34" strokeWidth="1.2" />
          <path d={CAR_COCKPIT} fill="#111118" stroke="#2a2a34" strokeWidth="0.8" />
          <path d={CAR_WING} fill="#222230" stroke="#333" strokeWidth="0.8" />
          <path d={CAR_WING_END_L} fill="#2a2a34" />
          <path d={CAR_WING_END_R} fill="#2a2a34" />
          <path d={CAR_SPLITTER} fill="#222230" stroke="#333" strokeWidth="0.5" />
          <path d={CAR_FIN} fill="#222230" opacity="0.4" />
          <path d={CAR_HL_L} fill="#333340" opacity="0.4" />
          <path d={CAR_HL_R} fill="#333340" opacity="0.4" />
          <path d={CAR_SCOOP_L} fill="#111118" opacity="0.5" />
          <path d={CAR_SCOOP_R} fill="#111118" opacity="0.5" />

          {/* Axle lines */}
          <line x1={leftX + tw / 2 + 2} y1={frontY} x2={rightX - tw / 2 - 2} y2={frontY} stroke="#2a2a34" strokeWidth="0.8" />
          <line x1={leftX + tw / 2 + 2} y1={rearY} x2={rightX - tw / 2 - 2} y2={rearY} stroke="#2a2a34" strokeWidth="0.8" />

          {/* Rear tyres */}
          {renderTyre(leftX, rearY, rl, 0)}
          {renderTyre(rightX, rearY, rr, 0)}

          {/* Front tyres (steered) */}
          {renderTyre(leftX, frontY, fl, steerAngle)}
          {renderTyre(rightX, frontY, fr, steerAngle)}

          {/* Temp labels */}
          <text x={leftX} y={frontY - th / 2 - 5} textAnchor="middle" fill={fl?.color ?? "#666"} fontSize="10" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">{fl ? `${fl.temp}°` : "--"}</text>
          <text x={rightX} y={frontY - th / 2 - 5} textAnchor="middle" fill={fr?.color ?? "#666"} fontSize="10" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">{fr ? `${fr.temp}°` : "--"}</text>
          <text x={leftX} y={rearY + th / 2 + 13} textAnchor="middle" fill={rl?.color ?? "#666"} fontSize="10" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">{rl ? `${rl.temp}°` : "--"}</text>
          <text x={rightX} y={rearY + th / 2 + 13} textAnchor="middle" fill={rr?.color ?? "#666"} fontSize="10" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600">{rr ? `${rr.temp}°` : "--"}</text>
        </svg>
      </div>
      <div className="tyres-steering-row">
        <span className="tyres-steer-label">STR</span>
        <span className="tyres-steer-val" style={{ color: Math.abs(steering) > 0.3 ? "#fdd952" : Math.abs(steering) > 0.1 ? "#00ff00" : "#888" }}>
          {steering >= 0 ? "+" : ""}{(steering * 100).toFixed(0)}%
        </span>
        <span className="tyres-steer-dir">
          {Math.abs(steering) < 0.02 ? "—" : steering < 0 ? "◀" : "▶"}
        </span>
      </div>
    </div>
  );
}
