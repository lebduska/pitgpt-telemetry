/**
 * Controls row — playback bar with scrubber, lap time, delta, play/pause, lap select, speed.
 */

import React, { useRef, useCallback } from "react";
import * as Select from "@radix-ui/react-select";

interface Props {
  lapTime: string;
  deltaText: string;
  deltaColor: string;
  animPlaying: boolean;
  animSpeed: number;
  speedOptions: number[];
  lapKeys: number[];
  selectedLap: number;
  bestLap: number;
  worstLap: number;
  progressPct: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onLapChange: (lap: number) => void;
  onSeek: (pct: number) => void;
}

function LapSelect({ lapKeys, selectedLap, bestLap, worstLap, onLapChange }: {
  lapKeys: number[]; selectedLap: number; bestLap: number; worstLap: number; onLapChange: (n: number) => void;
}) {
  const label = (n: number) => `Lap ${n}${n === bestLap ? " (Best)" : n === worstLap ? " (Worst)" : ""}`;
  return (
    <Select.Root value={String(selectedLap)} onValueChange={v => onLapChange(Number(v))}>
      <Select.Trigger className="radix-trigger">
        <Select.Value />
        <Select.Icon className="radix-icon">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="radix-content" position="popper" sideOffset={4}>
          <Select.Viewport>
            {lapKeys.map(n => (
              <Select.Item key={n} value={String(n)} className="radix-item">
                <Select.ItemText>{label(n)}</Select.ItemText>
                {n === bestLap && <span className="radix-badge best">BEST</span>}
                {n === worstLap && <span className="radix-badge worst">WORST</span>}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function ControlsRow({
  lapTime, deltaText, deltaColor,
  animPlaying, animSpeed, speedOptions,
  lapKeys, selectedLap, bestLap, worstLap,
  progressPct, onPlayPause, onSpeedChange, onLapChange, onSeek,
}: Props) {
  const scrubRef = useRef<HTMLDivElement>(null);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = scrubRef.current!.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  }, [onSeek]);

  const handleDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    handleScrub(e);
  }, [handleScrub]);

  return (
    <div className="playback-row">
      <div className="playback-controls">
        <button className="play-btn" title="Play/Pause" onClick={onPlayPause}>
          {animPlaying
            ? <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" fill="currentColor" /><rect x="14" y="5" width="4" height="14" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19" /></svg>
          }
        </button>
        <span className="playback-time">{lapTime}</span>
        <span className="playback-delta" style={{ color: deltaColor }}>{deltaText}</span>
        <div className="playback-spacer" />
        <LapSelect lapKeys={lapKeys} selectedLap={selectedLap} bestLap={bestLap} worstLap={worstLap} onLapChange={onLapChange} />
        <div className="divider" />
        {speedOptions.map(s => (
          <button
            key={s}
            className={`speed-btn${s === animSpeed ? " active" : ""}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>
      <div
        className="scrubber"
        ref={scrubRef}
        onClick={handleScrub}
        onMouseMove={handleDrag}
      >
        <div className="scrubber-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
        <div className="scrubber-thumb" style={{ left: `${Math.min(100, progressPct)}%` }} />
      </div>
    </div>
  );
}
