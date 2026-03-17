/**
 * PitGPT Dashboard — main App component.
 * Fetches data, manages animation state, passes down to child components.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { TelemetryFrame } from "../challenge-hard.ts";
import { COL, formatTime, lerpFrame, getTimeAtPos, mkTyre, type Tip, type InterpFrame, type LapSummary, type Analysis, type HighlightSrc } from "./state.ts";
import { SpeedGauge } from "./SpeedGauge.tsx";
import { RpmGaugeSVG, GearIndicator } from "./RpmGauge.tsx";
import { Pedals } from "./Pedals.tsx";
import { TrackMap } from "./TrackMap.tsx";
import { TelemetryPanels } from "./TelemetryPanels.tsx";
import { StatsRow } from "./StatsRow.tsx";
import { CoachingBanner } from "./CoachingBanner.tsx";
import { ControlsRow } from "./ControlsRow.tsx";
import { TyresWidget } from "./TyresWidget.tsx";
import { CorrelationCharts } from "./CorrelationCharts.tsx";
import { TrackInfoDialog } from "./TrackInfoDialog.tsx";

const SPEED_OPTIONS = [1, 2, 5, 10, 20];

export function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [laps, setLaps] = useState<LapSummary[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [lapFrames, setLapFrames] = useState<Record<number, TelemetryFrame[]>>({});
  const [selectedLap, setSelectedLap] = useState<number>(0);
  const [tips, setTips] = useState<Tip[]>([]);

  // Animation state — refs for perf, state for rendering
  const animPlayingRef = useRef(true);
  const animSpeedRef = useRef(10);
  const simTimeRef = useRef(0);
  const [animPlaying, setAnimPlaying] = useState(true);
  const [animSpeed, setAnimSpeed] = useState(10);

  // Current interpolated frame for rendering
  const [currentFrame, setCurrentFrame] = useState<InterpFrame | TelemetryFrame | null>(null);
  const [simTime, setSimTime] = useState(0);

  // Highlight position for brushing & linking
  const [highlightPos, setHighlightPos] = useState(-1);
  const [highlightSrc, setHighlightSrc] = useState<HighlightSrc>("");
  const [trackInfoOpen, setTrackInfoOpen] = useState(false);
  const handleTrackInfo = useCallback(() => setTrackInfoOpen(true), []);

  const currentLapFramesRef = useRef<TelemetryFrame[]>([]);

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        const td = await (await fetch("/api/telemetry-raw")).json();
        await fetch("/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(td) });
        const [lapsData, analysisData, lapFramesData] = await Promise.all([
          fetch("/laps").then(r => r.json()),
          fetch("/analysis").then(r => r.json()),
          fetch("/api/lap-frames").then(r => r.json()),
        ]);
        setLaps(lapsData);
        setAnalysis(analysisData);
        setLapFrames(lapFramesData);

        const bn = analysisData.bestLap.lapNumber;
        const wn = analysisData.worstLap.lapNumber;
        setSelectedLap(bn);

        // Generate tips from worst lap
        const wFrames: TelemetryFrame[] = lapFramesData[wn] || [];
        const newTips: Tip[] = [];
        let tipIdx = 0;
        for (let i = 1; i < wFrames.length; i++) {
          const f = wFrames[i]!, pf = wFrames[i - 1]!;
          if (pf.brk < 0.3 && f.brk > 0.7 && f.spd > 180) {
            newTips.push({ ts: `0:${(f.ts - wFrames[0]!.ts).toFixed(1)}`, pos: f.pos, color: COL.brake, text: `Braked ${(f.brk * 100).toFixed(0)}% at ${f.spd} km/h. Trail brake earlier.`, num: ++tipIdx });
            if (newTips.length >= 4) break;
          }
          if (f.tyres.fr > 112 && pf.tyres.fr <= 112) {
            newTips.push({ ts: `0:${(f.ts - wFrames[0]!.ts).toFixed(1)}`, pos: f.pos, color: COL.tyreTemp, text: `Tyre temp spiked to ${f.tyres.fr}\u00B0C. Smooth the inputs on exit.`, num: ++tipIdx });
            if (newTips.length >= 4) break;
          }
        }
        setTips(newTips);

        currentLapFramesRef.current = lapFramesData[bn] || [];
        setLoading(false);
        // These elements are outside React's tree (in dashboard.html)
        document.getElementById("loading")?.classList.add("hidden");
        document.getElementById("content")?.classList.remove("hidden");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        const el = document.getElementById("loading");
        if (el) el.textContent = "Error: " + msg;
      }
    })();
  }, []);

  // Update currentLapFramesRef when selectedLap changes
  useEffect(() => {
    if (lapFrames[selectedLap]) {
      currentLapFramesRef.current = lapFrames[selectedLap]!;
      simTimeRef.current = 0;
    }
  }, [selectedLap, lapFrames]);

  // Animation loop
  useEffect(() => {
    if (loading || error) return;
    let lt = 0;
    let raf: number;

    function anim(time: number) {
      raf = requestAnimationFrame(anim);
      const dt = Math.min(time - lt, 50);
      lt = time;

      const frames = currentLapFramesRef.current;
      if (!frames.length) return;

      let interpFrame: InterpFrame | null = null;

      if (animPlayingRef.current && frames.length > 1) {
        simTimeRef.current += dt * 0.001 * animSpeedRef.current;
        const baseTs = frames[0]!.ts;
        const lapDuration = frames[frames.length - 1]!.ts - baseTs;
        if (simTimeRef.current > lapDuration) simTimeRef.current = 0;
        const targetTs = baseTs + simTimeRef.current;
        let i0 = 0;
        for (let i = 1; i < frames.length; i++) { if (frames[i]!.ts <= targetTs) i0 = i; else break; }
        const i1 = Math.min(i0 + 1, frames.length - 1);
        if (i0 !== i1) {
          const segDur = frames[i1]!.ts - frames[i0]!.ts;
          const t = segDur > 0 ? (targetTs - frames[i0]!.ts) / segDur : 0;
          interpFrame = lerpFrame(frames[i0]!, frames[i1]!, Math.max(0, Math.min(1, t)));
        }
      }

      const f = interpFrame || frames[0];
      if (f) {
        setCurrentFrame(f);
        setSimTime(simTimeRef.current);
        setHighlightPos(f.pos);
        setHighlightSrc("anim");
      }
    }

    raf = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(raf);
  }, [loading, error]);

  const handlePlayPause = useCallback(() => {
    animPlayingRef.current = !animPlayingRef.current;
    setAnimPlaying(animPlayingRef.current);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    animSpeedRef.current = speed;
    setAnimSpeed(speed);
  }, []);

  const handleLapChange = useCallback((lap: number) => {
    setSelectedLap(lap);
    simTimeRef.current = 0;
  }, []);

  const handleHighlight = useCallback((pos: number, src: HighlightSrc) => {
    setHighlightPos(pos);
    setHighlightSrc(src);
  }, []);

  const handleSeek = useCallback((pct: number) => {
    const frames = currentLapFramesRef.current;
    if (frames.length < 2) return;
    const lapDuration = frames[frames.length - 1]!.ts - frames[0]!.ts;
    simTimeRef.current = pct * lapDuration;
  }, []);

  const lk = useMemo(() => Object.keys(lapFrames).map(Number).sort((a, b) => a - b), [lapFrames]);

  if (loading || error || !analysis) return null;

  const bn = analysis.bestLap.lapNumber;
  const wn = analysis.worstLap.lapNumber;
  const bestLapFrames = lapFrames[bn] || [];
  const currentLapFramesList = lapFrames[selectedLap] || [];

  // Compute delta vs best
  let deltaText = "-";
  let deltaColor = "var(--text-dim)";
  if (currentFrame && selectedLap === bn) {
    deltaText = "BEST";
    deltaColor = "var(--green)";
  } else if (currentFrame && selectedLap !== bn && bestLapFrames.length > 1 && currentFrame.pos > 0) {
    const bestTimeAtPos = getTimeAtPos(bestLapFrames, currentFrame.pos);
    const delta = simTime - bestTimeAtPos;
    const sign = delta >= 0 ? "+" : "";
    deltaText = `${sign}${delta.toFixed(3)}s`;
    deltaColor = delta <= 0 ? "var(--green)" : "var(--red)";
  }

  // Progress bar
  const lapDur = currentLapFramesList.length > 1
    ? currentLapFramesList[currentLapFramesList.length - 1]!.ts - currentLapFramesList[0]!.ts
    : 1;
  const progressPct = (simTime / lapDur) * 100;

  // Tyre temps
  const tyreFL = currentFrame ? mkTyre(currentFrame.tyres.fl) : null;
  const tyreFR = currentFrame ? mkTyre(currentFrame.tyres.fr) : null;
  const tyreRL = currentFrame ? mkTyre(currentFrame.tyres.rl) : null;
  const tyreRR = currentFrame ? mkTyre(currentFrame.tyres.rr) : null;
  const steering = currentFrame?.str ?? 0;

  return (
    <>
      <ControlsRow
        lapTime={formatTime(simTime)}
        deltaText={deltaText}
        deltaColor={deltaColor}
        animPlaying={animPlaying}
        animSpeed={animSpeed}
        speedOptions={SPEED_OPTIONS}
        lapKeys={lk}
        selectedLap={selectedLap}
        bestLap={bn}
        worstLap={wn}
        progressPct={progressPct}
        onPlayPause={handlePlayPause}
        onSpeedChange={handleSpeedChange}
        onLapChange={handleLapChange}
        onSeek={handleSeek}
      />
      <div className="top-row">
        <div className="widget-card rpm-card">
          <div className="widget-header">RPM</div>
          <div className="gauge-center">
            <div className="gauge-big">
              <RpmGaugeSVG rpm={currentFrame?.rpm ?? 0} />
            </div>
          </div>
          <GearIndicator gear={currentFrame?.gear ?? 0} />
        </div>
        <div className="widget-card speed-card">
          <div className="widget-header">Speed</div>
          <div className="gauge-center">
            <div className="gauge-big">
              <SpeedGauge speed={currentFrame?.spd ?? 0} />
            </div>
          </div>
          <Pedals brk={currentFrame?.brk ?? 0} thr={currentFrame?.thr ?? 0} />
        </div>
        <TrackMap
          frames={currentLapFramesList}
          tips={tips}
          highlightPos={highlightPos}
          highlightSrc={highlightSrc}
          onHighlight={handleHighlight}
          progressPct={progressPct}
          onTrackInfo={handleTrackInfo}
        />
        <TyresWidget fl={tyreFL} fr={tyreFR} rl={tyreRL} rr={tyreRR} steering={steering} />
      </div>
      <StatsRow analysis={analysis} lapsCount={laps.length} />
      <CoachingBanner analysis={analysis} />
      <CorrelationCharts frames={currentLapFramesList} highlightPos={highlightPos} />
      <TelemetryPanels
        laps={laps}
        lapFrames={lapFrames}
        bestLap={bn}
        worstLap={wn}
        highlightPos={highlightPos}
        highlightSrc={highlightSrc}
        selectedLap={selectedLap}
        onHighlight={handleHighlight}
      />
      <TrackInfoDialog open={trackInfoOpen} onClose={() => setTrackInfoOpen(false)} />
    </>
  );
}
