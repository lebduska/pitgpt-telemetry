/**
 * 2D SVG track map — Catmull-Rom spline path, racing line, sector markers,
 * turn labels, tip markers with hover tooltips, and animated car dot (React).
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import type { TelemetryFrame } from "../challenge-hard.ts";
import { SPA_POINTS, TURNS, COL, getTrackXZ, findFrame, lerp, SECTOR_BOUNDARIES, type Tip, type HighlightSrc } from "./state.ts";

// ================================================================
// CATMULL-ROM -> SVG BEZIER
// ================================================================

function catmullRomToBezier(pts: number[][]): string {
  const n = pts.length;
  if (n < 3) return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]!.toFixed(1)},${p[1]!.toFixed(1)}`).join(" ");

  let d = `M${pts[0]![0]!.toFixed(1)},${pts[0]![1]!.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(n - 1, i + 2)]!;
    const cp1x = p1[0]! + (p2[0]! - p0[0]!) / 6, cp1y = p1[1]! + (p2[1]! - p0[1]!) / 6;
    const cp2x = p2[0]! - (p3[0]! - p1[0]!) / 6, cp2y = p2[1]! - (p3[1]! - p1[1]!) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0]!.toFixed(1)},${p2[1]!.toFixed(1)}`;
  }
  return d;
}

// ================================================================
// MAP DATA
// ================================================================

interface MapData {
  sw: number;
  sh: number;
  path: string;
  toS: (x: number, z: number) => [number, number];
}

function buildMapData(sw: number, sh: number): MapData {
  const ax = SPA_POINTS.map(p => p[1]), az = SPA_POINTS.map(p => p[2]);
  const mnx = Math.min(...ax), mxx = Math.max(...ax);
  const mnz = Math.min(...az), mxz = Math.max(...az);
  const pad = 50;
  const sc = Math.min((sw - pad * 2) / (mxx - mnx), (sh - pad * 2) / (mxz - mnz));
  const ox = (sw - (mxx - mnx) * sc) / 2;
  const oz = (sh - (mxz - mnz) * sc) / 2;
  const toS = (x: number, z: number): [number, number] => [(x - mnx) * sc + ox, (mxz - z) * sc + oz];
  const tp = SPA_POINTS.map(([_, x, z]) => toS(x, z));
  const path = catmullRomToBezier(tp) + " Z";
  return { sw, sh, path, toS };
}

function lerpColor(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, t: number): string {
  return `rgb(${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))})`;
}

function racingColor(f: { thr: number; brk: number }): string {
  if (f.brk > 0.05) {
    const t = Math.min(f.brk / 0.4, 1);
    return lerpColor(80, 80, 80, 255, 51, 51, t);
  }
  const t = Math.min(f.thr / 0.5, 1);
  return lerpColor(80, 80, 80, 0, 255, 0, t);
}

interface RacingLineSegment {
  x1: number; y1: number; x2: number; y2: number; color: string;
}

function buildRacingLineSegments(frames: TelemetryFrame[], toS: MapData["toS"]): { lines: RacingLineSegment[]; glow: RacingLineSegment[] } {
  if (frames.length < 2) return { lines: [], glow: [] };
  const steps = 400;
  const mnPos = frames[0]!.pos, mxPos = frames[frames.length - 1]!.pos;
  const lines: RacingLineSegment[] = [];
  const glow: RacingLineSegment[] = [];

  for (let i = 0; i < steps; i++) {
    const pos1 = mnPos + (mxPos - mnPos) * (i / steps);
    const pos2 = mnPos + (mxPos - mnPos) * ((i + 1) / steps);
    const f = findFrame(frames, pos1);
    const [x1, y1] = toS(...getTrackXZ(pos1));
    const [x2, y2] = toS(...getTrackXZ(pos2));
    const c = racingColor(f);
    lines.push({ x1, y1, x2, y2, color: c });

    if (i % 2 === 0) {
      const pos2g = mnPos + (mxPos - mnPos) * ((i + 2) / steps);
      const [x2g, y2g] = toS(...getTrackXZ(pos2g));
      glow.push({ x1, y1, x2: x2g, y2: y2g, color: c });
    }
  }

  return { lines, glow };
}

interface Props {
  frames: TelemetryFrame[];
  tips: Tip[];
  highlightPos: number;
  highlightSrc: HighlightSrc;
  onHighlight: (pos: number, src: HighlightSrc) => void;
  progressPct: number;
  onTrackInfo: () => void;
}

export function TrackMap({ frames, tips, highlightPos, highlightSrc, onHighlight, progressPct, onTrackInfo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [tooltipState, setTooltipState] = useState<{ visible: boolean; x: number; y: number; html: string }>({ visible: false, x: 0, y: 0, html: "" });
  const [tipTooltipState, setTipTooltipState] = useState<{ visible: boolean; x: number; y: number; html: string }>({ visible: false, x: 0, y: 0, html: "" });
  const carPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Build map data when container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    function update() {
      const rect = containerRef.current!.getBoundingClientRect();
      setMapData(buildMapData(rect.width, rect.height || 520));
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const racingLine = useMemo(() => {
    if (!mapData || !frames.length) return { lines: [], glow: [] };
    return buildRacingLineSegments(frames, mapData.toS);
  }, [mapData, frames]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!mapData || !frames.length) return;
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const sx = (e.clientX - r.left) / r.width * mapData.sw;
    const sy = (e.clientY - r.top) / r.height * mapData.sh;
    let bp = 0, bd = 999;
    for (let t = 0; t <= 1; t += 0.003) {
      const [tx, tz] = getTrackXZ(t);
      const [px, py] = mapData.toS(tx, tz);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) { bd = d; bp = t; }
    }
    if (bd < 30) {
      onHighlight(bp, "map");
      const f = findFrame(frames, bp);
      if (f) {
        const wr = containerRef.current!.getBoundingClientRect();
        setTooltipState({
          visible: true,
          x: e.clientX - wr.left + 14,
          y: e.clientY - wr.top - 16,
          html: `<div class="tt-row"><span class="tt-label">Speed</span><span class="tt-val">${f.spd} km/h</span></div><div class="tt-row"><span class="tt-label">Thr</span><span class="tt-val" style="color:${COL.throttle}">${(f.thr * 100).toFixed(0)}%</span></div><div class="tt-row"><span class="tt-label">Brk</span><span class="tt-val" style="color:${COL.brake}">${(f.brk * 100).toFixed(0)}%</span></div>`,
        });
      }
    } else {
      onHighlight(-1, "map");
      setTooltipState(prev => ({ ...prev, visible: false }));
    }
  }, [mapData, frames, onHighlight]);

  const handleMouseLeave = useCallback(() => {
    onHighlight(-1, "map");
    setTooltipState(prev => ({ ...prev, visible: false }));
  }, [onHighlight]);

  const handleTipEnter = useCallback((e: React.MouseEvent, tip: Tip) => {
    const wr = containerRef.current!.getBoundingClientRect();
    setTipTooltipState({
      visible: true,
      x: e.clientX - wr.left + 16,
      y: e.clientY - wr.top - 10,
      html: `<div class="tt-title" style="color:${tip.color}">Tip ${tip.num}</div><div class="tt-body">${tip.text}</div><div class="tt-time">at ${tip.ts}</div>`,
    });
  }, []);

  const handleTipLeave = useCallback(() => {
    setTipTooltipState(prev => ({ ...prev, visible: false }));
  }, []);

  if (!mapData) {
    return (
      <div className="track-widget" ref={containerRef}>
        <svg id="track-map-svg" />
        <div className="map-tooltip" style={{ display: "none" }} />
        <div className="tip-tooltip" style={{ display: "none" }} />
      </div>
    );
  }

  // Compute car & highlight positions
  let carCx = 0, carCy = 0;
  let hlCx = 0, hlCy = 0, hlOpacity = 0;
  if (highlightPos >= 0) {
    const [sx, sy] = mapData.toS(...getTrackXZ(highlightPos));
    if (highlightSrc === "anim") {
      carPosRef.current.x += (sx - carPosRef.current.x) * 0.3;
      carPosRef.current.y += (sy - carPosRef.current.y) * 0.3;
      hlOpacity = 0;
    } else {
      carPosRef.current.x = sx;
      carPosRef.current.y = sy;
      hlCx = sx;
      hlCy = sy;
      hlOpacity = 0.6;
    }
    carCx = carPosRef.current.x;
    carCy = carPosRef.current.y;
  }

  // Sector markers
  const sectorMarkers: React.ReactNode[] = [];
  for (const sp of SECTOR_BOUNDARIES) {
    const [sx, sy] = mapData.toS(...getTrackXZ(sp));
    sectorMarkers.push(
      <circle key={`sc${sp}`} cx={sx.toFixed(1)} cy={sy.toFixed(1)} r="5" fill={COL.sector} opacity="0.5" />,
      <text key={`st${sp}`} x={(sx + 9).toFixed(1)} y={(sy + 4).toFixed(1)} fill={COL.sector} fontSize="11" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600" opacity="0.5">{sp < 0.5 ? "S2" : "S3"}</text>
    );
  }
  const [s1x, s1y] = mapData.toS(...getTrackXZ(0.0));
  sectorMarkers.push(
    <text key="s1t" x={(s1x + 9).toFixed(1)} y={(s1y + 4).toFixed(1)} fill={COL.sector} fontSize="11" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="600" opacity="0.5">S1</text>
  );

  // Turn labels
  const turnLabels = TURNS.map(t => {
    const [sx, sy] = mapData.toS(...getTrackXZ(t.pos));
    return (
      <React.Fragment key={t.num}>
        <text x={(sx + 8).toFixed(1)} y={(sy - 7).toFixed(1)} fill="#555" fontSize="10" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="500">{t.name}</text>
        <circle cx={sx.toFixed(1)} cy={sy.toFixed(1)} r="3" fill="#444" opacity="0.6" />
      </React.Fragment>
    );
  });

  // Tip markers
  const tipMarkers = tips.map(tip => {
    const [tx, ty] = mapData.toS(...getTrackXZ(tip.pos));
    return (
      <React.Fragment key={tip.num}>
        <circle className="tip-marker-pulse" cx={tx.toFixed(1)} cy={ty.toFixed(1)} r="8" fill={tip.color} opacity="0.4" />
        <circle
          className="tip-marker"
          cx={tx.toFixed(1)} cy={ty.toFixed(1)} r="6" fill={tip.color} opacity="0.8"
          style={{ cursor: "pointer", pointerEvents: "all" }}
          onMouseEnter={(e) => handleTipEnter(e, tip)}
          onMouseLeave={handleTipLeave}
        />
        <text x={(tx + 10).toFixed(1)} y={(ty + 4).toFixed(1)} fill={tip.color} fontSize="10" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="700" opacity="0.9">{tip.num}</text>
      </React.Fragment>
    );
  });

  return (
    <div className="track-widget" ref={containerRef}>
      <button className="track-name-btn" onClick={onTrackInfo}>
        Spa-Francorchamps
        <svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" /><text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="700">i</text></svg>
      </button>
      <svg
        id="track-map-svg"
        viewBox={`0 0 ${mapData.sw} ${mapData.sh}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track outline */}
        <path d={mapData.path} fill="none" stroke="#333" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
        <path d={mapData.path} fill="none" stroke="#1e1e26" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
        {/* Racing line glow */}
        {racingLine.glow.map((seg, i) => (
          <line key={`g${i}`} x1={seg.x1.toFixed(1)} y1={seg.y1.toFixed(1)} x2={seg.x2.toFixed(1)} y2={seg.y2.toFixed(1)} stroke={seg.color} strokeWidth="10" strokeLinecap="round" opacity="0.15" />
        ))}
        {/* Racing line */}
        {racingLine.lines.map((seg, i) => (
          <line key={`l${i}`} x1={seg.x1.toFixed(1)} y1={seg.y1.toFixed(1)} x2={seg.x2.toFixed(1)} y2={seg.y2.toFixed(1)} stroke={seg.color} strokeWidth="4" strokeLinecap="round" />
        ))}
        {sectorMarkers}
        {turnLabels}
        {tipMarkers}
        {/* Highlight circle */}
        <circle cx={hlCx.toFixed(1)} cy={hlCy.toFixed(1)} r="8" fill={COL.throttle} opacity={hlOpacity} stroke={COL.throttle} strokeWidth="2" />
        {/* Car dot */}
        <circle cx={carCx.toFixed(1)} cy={carCy.toFixed(1)} r="5" fill="#fff" filter="url(#glow)" />
      </svg>
      <div
        className="map-tooltip"
        style={{ display: tooltipState.visible ? "block" : "none", left: tooltipState.x, top: tooltipState.y }}
        dangerouslySetInnerHTML={{ __html: tooltipState.html }}
      />
      <div
        className="tip-tooltip"
        style={{ display: tipTooltipState.visible ? "block" : "none", left: tipTooltipState.x, top: tipTooltipState.y }}
        dangerouslySetInnerHTML={{ __html: tipTooltipState.html }}
      />
    </div>
  );
}
