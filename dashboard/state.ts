/**
 * Shared state, track data, and utility functions for the PitGPT dashboard.
 */

import type { TelemetryFrame } from "../challenge-hard";

// ================================================================
// TRACK GEOMETRY — Spa-Francorchamps approximation
// ================================================================

export const SPA_POINTS: [number, number, number][] = [
  [0.000,0.0,0.0],[0.015,1.2,0.1],[0.030,2.2,0.3],[0.040,2.5,1.0],[0.048,2.2,1.5],
  [0.060,1.8,2.2],[0.070,1.5,3.0],[0.080,1.8,3.8],[0.090,2.3,4.5],
  [0.120,3.5,5.8],[0.160,5.0,7.0],[0.200,6.5,7.8],[0.230,7.8,8.2],
  [0.270,9.0,8.0],[0.290,9.5,7.5],[0.310,9.8,6.8],
  [0.333,9.8,6.0],[0.355,9.5,5.2],[0.375,9.0,4.5],[0.400,8.2,4.0],
  [0.430,7.2,3.5],[0.460,6.0,3.2],
  [0.500,4.8,3.0],[0.530,3.8,3.3],[0.560,3.0,3.8],
  [0.590,2.5,4.5],[0.620,2.0,5.2],[0.650,1.5,5.8],
  [0.667,1.2,6.2],[0.690,0.8,5.8],[0.710,0.5,5.0],
  [0.740,0.2,4.0],[0.770,-0.2,3.0],
  [0.810,-0.8,2.0],[0.840,-1.2,1.2],[0.870,-1.5,0.5],
  [0.900,-1.5,-0.3],[0.920,-1.2,-0.8],
  [0.940,-0.8,-1.2],[0.955,-0.3,-1.0],[0.970,0.0,-0.8],
  [0.985,-0.2,-0.4],[1.000,0.0,0.0],
];

export const TURNS = [
  { pos: 0.035, name: "La Source", num: 1 },
  { pos: 0.065, name: "Eau Rouge", num: 3 },
  { pos: 0.085, name: "Raidillon", num: 4 },
  { pos: 0.280, name: "Les Combes", num: 5 },
  { pos: 0.360, name: "Rivage", num: 6 },
  { pos: 0.510, name: "Pouhon", num: 10 },
  { pos: 0.695, name: "Stavelot", num: 14 },
  { pos: 0.830, name: "Blanchimont", num: 17 },
  { pos: 0.945, name: "Bus Stop", num: 18 },
];

export const COL = {
  speed: "#ffffff",
  throttle: "#00ff00",
  brake: "#ff3333",
  tyreTemp: "#fdd952",
  sector: "#9B6DFF",
} as const;

export const SECTOR_BOUNDARIES = [0.333, 0.667] as const;

// ================================================================
// SHARED TYPES
// ================================================================

export interface LapSummary {
  lapNumber: number;
  lapTime: number;
  sectors?: { sector: number; time: number }[];
  avgSpeed?: number;
  maxSpeed?: number;
}

export interface Analysis {
  bestLap: { lapNumber: number; lapTime: number };
  worstLap: { lapNumber: number; lapTime: number; delta: number };
  problemSector: number;
  issue: IssueType;
  coachingMessage: string;
}

export type HighlightSrc = "anim" | "map" | "trace" | "";

export type IssueType = "heavy_braking" | "low_throttle" | "tyre_overheat" | "inconsistency";

// ================================================================
// TYRE TEMPERATURE CONSTANTS & HELPERS
// ================================================================

export const TYRE_TEMP_HOT = 110;
export const TYRE_TEMP_WARM = 100;

export function tyreColor(temp: number): string {
  if (temp > TYRE_TEMP_HOT) return "#ff3333";
  if (temp > TYRE_TEMP_WARM) return "#fdd952";
  return "#e0e0e0";
}

export function tyreGlow(temp: number): string {
  if (temp > TYRE_TEMP_HOT) return "rgba(255,51,51,0.4)";
  if (temp > TYRE_TEMP_WARM) return "rgba(253,217,82,0.2)";
  return "none";
}

export function mkTyre(t: number) {
  return { temp: Math.round(t), color: tyreColor(t) };
}

export function avgTyreTemp(f: { tyres: { fl: number; fr: number; rl: number; rr: number } }): number {
  return (f.tyres.fl + f.tyres.fr + f.tyres.rl + f.tyres.rr) / 4;
}

// ================================================================
// TRACK INTERPOLATION — Catmull-Rom spline
// ================================================================

export function getTrackXZ(pos: number): [number, number] {
  const pts = SPA_POINTS;
  let i = 0;
  for (; i < pts.length - 1; i++) {
    if (pos >= pts[i][0] && pos <= pts[i + 1][0]) break;
  }
  if (i >= pts.length - 1) return [pts[pts.length - 1][1], pts[pts.length - 1][2]];

  const t = (pos - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;

  const x = 0.5 * ((2 * p1[1]) + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3);
  const z = 0.5 * ((2 * p1[2]) + (p2[2] - p0[2]) * t + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (3 * p1[2] - p0[2] - 3 * p2[2] + p3[2]) * t3);
  return [x, z];
}

// ================================================================
// FRAME HELPERS
// ================================================================

export function findFrameIndex(frames: TelemetryFrame[], pos: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = Math.abs(frames[i]!.pos - pos);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function findFrame(frames: TelemetryFrame[], pos: number): TelemetryFrame {
  return frames[findFrameIndex(frames, pos)]!;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface InterpFrame {
  pos: number; spd: number; thr: number; brk: number; str: number;
  gear: number; rpm: number;
  tyres: { fl: number; fr: number; rl: number; rr: number };
  ts: number; lap: number;
}

export function lerpFrame(f1: TelemetryFrame, f2: TelemetryFrame, t: number): InterpFrame {
  return {
    pos: lerp(f1.pos, f2.pos, t),
    spd: Math.round(lerp(f1.spd, f2.spd, t)),
    thr: lerp(f1.thr, f2.thr, t),
    brk: lerp(f1.brk, f2.brk, t),
    str: lerp(f1.str, f2.str, t),
    gear: t < 0.5 ? f1.gear : f2.gear,
    rpm: Math.round(lerp(f1.rpm, f2.rpm, t)),
    tyres: {
      fl: lerp(f1.tyres.fl, f2.tyres.fl, t),
      fr: lerp(f1.tyres.fr, f2.tyres.fr, t),
      rl: lerp(f1.tyres.rl, f2.tyres.rl, t),
      rr: lerp(f1.tyres.rr, f2.tyres.rr, t),
    },
    ts: lerp(f1.ts, f2.ts, t),
    lap: f1.lap,
  };
}

/** Interpolated elapsed time at a given track position within a lap's frames */
export function getTimeAtPos(frames: TelemetryFrame[], pos: number): number {
  if (!frames.length) return 0;
  const baseTs = frames[0].ts;
  if (pos <= frames[0].pos) return 0;
  if (pos >= frames[frames.length - 1].pos) return frames[frames.length - 1].ts - baseTs;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].pos >= pos) {
      const f0 = frames[i - 1], f1 = frames[i];
      const t = (pos - f0.pos) / (f1.pos - f0.pos);
      return lerp(f0.ts, f1.ts, t) - baseTs;
    }
  }
  return frames[frames.length - 1].ts - baseTs;
}

// ================================================================
// FORMATTERS
// ================================================================

export function formatTime(s: number, alwaysShowMinutes = false): string {
  const m = Math.floor(s / 60);
  const sc = (s % 60).toFixed(3);
  return (m > 0 || alwaysShowMinutes) ? `${m}:${sc.padStart(6, "0")}` : `${sc}s`;
}

export function formatLapTime(s: number): string {
  return formatTime(s, true);
}

export function formatIssueLabel(issue: IssueType): string {
  return issue.replaceAll("_", " ");
}

// ================================================================
// TIP TYPE
// ================================================================

export interface Tip {
  ts: string;
  pos: number;
  color: string;
  text: string;
  num: number;
}
