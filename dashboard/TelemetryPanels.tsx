/**
 * Telemetry trace panels — channel SVG traces with cursor sync (React).
 */

import React, { useCallback, useMemo } from "react";
import type { TelemetryFrame } from "../challenge-hard.ts";
import { COL, findFrame, formatLapTime, TURNS, SECTOR_BOUNDARIES, type LapSummary, type HighlightSrc } from "./state.ts";

// ================================================================
// CHANNEL TRACE SVG
// ================================================================

function ChannelTrace({
  frames,
  channel,
  color,
  maxV,
}: {
  frames: TelemetryFrame[];
  channel: keyof TelemetryFrame | ((f: TelemetryFrame) => number);
  color: string;
  maxV: number;
}) {
  if (!frames.length) return null;
  const w = 600, h = 40, pad = 1;
  const ps = frames.map(f => f.pos);
  const mn = Math.min(...ps), mx = Math.max(...ps), rng = mx - mn || 1;

  const pts = frames.map(f => {
    const x = ((f.pos - mn) / rng) * w;
    const v = typeof channel === "function" ? channel(f) : (f[channel] as number);
    const y = h - pad - ((v / maxV) * (h - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const fx = ((frames[0]!.pos - mn) / rng) * w;
  const lx = ((frames[frames.length - 1]!.pos - mn) / rng) * w;
  const ap = [`${fx.toFixed(1)},${h}`, ...pts, `${lx.toFixed(1)},${h}`];
  const s1 = ((SECTOR_BOUNDARIES[0] - mn) / rng) * w, s2 = ((SECTOR_BOUNDARIES[1] - mn) / rng) * w;

  return (
    <svg className="ch-trace" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={ap.join(" ")} fill={color} opacity="0.1" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <line x1={s1} y1="0" x2={s1} y2={h} stroke="#2a2a34" strokeWidth="1" strokeDasharray="3 2" />
      <line x1={s2} y1="0" x2={s2} y2={h} stroke="#2a2a34" strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  );
}

// ================================================================
// CHANNEL ROW
// ================================================================

function ChannelRow({
  lid,
  frames,
  channel,
  channelKey,
  color,
  maxV,
  label,
  icon,
  highlightPos,
  highlightSrc,
  selectedLap,
  getValue,
}: {
  lid: number;
  frames: TelemetryFrame[];
  channel: keyof TelemetryFrame | ((f: TelemetryFrame) => number);
  channelKey: string;
  color: string;
  maxV: number;
  label: string;
  icon: React.ReactNode;
  highlightPos: number;
  highlightSrc: HighlightSrc;
  selectedLap: number;
  getValue: (f: TelemetryFrame) => string;
}) {
  if (!frames.length) return null;
  const mn = Math.min(...frames.map(f => f.pos)), mx = Math.max(...frames.map(f => f.pos));
  const pct = (highlightPos - mn) / (mx - mn);
  const show = highlightPos >= 0 && pct >= 0 && pct <= 1;
  const isSelLap = lid === selectedLap;
  const visible = show && (highlightSrc !== "anim" || isSelLap);
  const f = visible ? findFrame(frames, highlightPos) : null;

  return (
    <div className="channel-row">
      <div className="channel-icon">{icon}</div>
      <div className="channel-name" style={{ color }}>{label}</div>
      <div className="channel-trace-wrap">
        <ChannelTrace frames={frames} channel={channel} color={color} maxV={maxV} />
        <div className={`channel-cursor${visible ? " visible" : ""}`} style={{ left: `${pct * 100}%` }}>
          <div className="cd" style={{ background: color }} />
        </div>
        <div className={`channel-val${visible ? " visible" : ""}`} style={{ color }}>
          {f ? getValue(f) : ""}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// TELEMETRY PANEL
// ================================================================

function TelemetryPanel({
  lap,
  frames,
  isBest,
  isWorst,
  highlightPos,
  highlightSrc,
  selectedLap,
  onHighlight,
}: {
  lap: LapSummary;
  frames: TelemetryFrame[];
  isBest: boolean;
  isWorst: boolean;
  highlightPos: number;
  highlightSrc: HighlightSrc;
  selectedLap: number;
  onHighlight: (pos: number, src: HighlightSrc) => void;
}) {
  const lid = lap.lapNumber;
  const maxSpd = useMemo(() => Math.max(...frames.map(f => f.spd), 1), [frames]);
  const maxTmp = useMemo(() => Math.max(...frames.flatMap(f => [f.tyres.fl, f.tyres.fr, f.tyres.rl, f.tyres.rr]), 1), [frames]);

  const mnP = frames.length ? Math.min(...frames.map(f => f.pos)) : 0;
  const mxP = frames.length ? Math.max(...frames.map(f => f.pos)) : 1;

  const turnMarkers = TURNS.filter(t => t.pos >= mnP && t.pos <= mxP).map(t => (
    <span key={t.num} className="turn-marker" style={{ left: `${((t.pos - mnP) / (mxP - mnP) * 100)}%` }}>{t.num}</span>
  ));

  const badge = isBest
    ? <span style={{ color: "#00ff00", fontSize: "10px", fontWeight: 600, letterSpacing: "1px" }}>BEST</span>
    : isWorst ? <span style={{ color: "#ff3333", fontSize: "10px", fontWeight: 600, letterSpacing: "1px" }}>WORST</span> : null;

  const handleOverlayMove = useCallback((e: React.MouseEvent) => {
    if (!frames.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    onHighlight(mnP + pct * (mxP - mnP), "trace");
  }, [frames, mnP, mxP, onHighlight]);

  const handleOverlayLeave = useCallback(() => {
    onHighlight(-1, "trace");
  }, [onHighlight]);

  const thrIcon = <svg viewBox="0 0 24 24" fill="none" stroke="#00ff00" strokeWidth="2"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></svg>;
  const brkIcon = <svg viewBox="0 0 24 24" fill="none" stroke={COL.brake} strokeWidth="2"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /></svg>;
  const spdIcon = <svg viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></svg>;
  const tyreIcon = <svg viewBox="0 0 24 24" fill="none" stroke={COL.tyreTemp} strokeWidth="2"><rect x="6" y="4" width="12" height="16" rx="3" /></svg>;

  return (
    <div className="telemetry-panel" style={{ marginBottom: "16px", ...((isBest || isWorst) ? { borderColor: isBest ? "#00ff0033" : "#ff333333" } : {}) }}>
      <div className="playback-bar">
        <div className="play-circle">
          <svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19" /></svg>
        </div>
        <span className="playback-time">{formatLapTime(lap.lapTime)}</span>
        <span className="playback-speed">1&times;</span>
        <div className="lap-nav">
          <button>&lsaquo;</button>
          <div className="lap-info">
            Lap {lid} {badge}
            <span className="lap-time-small">{formatLapTime(lap.lapTime)}</span>
          </div>
          <button>&rsaquo;</button>
        </div>
      </div>
      <div className="turn-markers" style={{ paddingLeft: "138px" }}>{turnMarkers}</div>

      <ChannelRow lid={lid} frames={frames} channel="thr" channelKey="thr" color={COL.throttle} maxV={1} label="Throttle" icon={thrIcon} highlightPos={highlightPos} highlightSrc={highlightSrc} selectedLap={selectedLap} getValue={f => `${(f.thr * 100).toFixed(0)}%`} />
      <ChannelRow lid={lid} frames={frames} channel="brk" channelKey="brk" color={COL.brake} maxV={1} label="Brakes" icon={brkIcon} highlightPos={highlightPos} highlightSrc={highlightSrc} selectedLap={selectedLap} getValue={f => `${(f.brk * 100).toFixed(0)}%`} />
      <ChannelRow lid={lid} frames={frames} channel="spd" channelKey="spd" color={COL.speed} maxV={maxSpd} label="Speed" icon={spdIcon} highlightPos={highlightPos} highlightSrc={highlightSrc} selectedLap={selectedLap} getValue={f => `${f.spd}`} />
      <ChannelRow lid={lid} frames={frames} channel={(f: TelemetryFrame) => f.tyres.fr} channelKey="tyre" color={COL.tyreTemp} maxV={maxTmp} label="Tyre FR" icon={tyreIcon} highlightPos={highlightPos} highlightSrc={highlightSrc} selectedLap={selectedLap} getValue={f => `${f.tyres.fr}\u00B0C`} />

      <div className="add-analytics">+ Add more analytics</div>
      <div
        className="channel-overlay"
        style={{ position: "absolute", top: 0, left: "138px", right: "20px", bottom: 0, cursor: "crosshair", zIndex: 2 }}
        onMouseMove={handleOverlayMove}
        onMouseLeave={handleOverlayLeave}
      />
    </div>
  );
}

// ================================================================
// PANELS CONTAINER
// ================================================================

interface Props {
  laps: LapSummary[];
  lapFrames: Record<number, TelemetryFrame[]>;
  bestLap: number;
  worstLap: number;
  highlightPos: number;
  highlightSrc: HighlightSrc;
  selectedLap: number;
  onHighlight: (pos: number, src: HighlightSrc) => void;
}

export function TelemetryPanels({ laps, lapFrames, bestLap, worstLap, highlightPos, highlightSrc, selectedLap, onHighlight }: Props) {
  return (
    <div className="telemetry-section">
      {laps.map(lap => (
        <TelemetryPanel
          key={lap.lapNumber}
          lap={lap}
          frames={lapFrames[lap.lapNumber] || []}
          isBest={lap.lapNumber === bestLap}
          isWorst={lap.lapNumber === worstLap}
          highlightPos={highlightPos}
          highlightSrc={highlightSrc}
          selectedLap={selectedLap}
          onHighlight={onHighlight}
        />
      ))}
    </div>
  );
}
