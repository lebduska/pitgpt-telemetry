/**
 * Track info dialog — modal with Spa-Francorchamps details.
 */

import React from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TRACK_INFO = {
  name: "Circuit de Spa-Francorchamps",
  location: "Stavelot, Belgium",
  length: "7.004 km (4.352 mi)",
  turns: 19,
  elevationChange: "102.2 m",
  firstRace: 1921,
  lapRecord: {
    time: "1:44.701",
    driver: "Sergio Pérez",
    car: "Red Bull RB20",
    year: 2024,
  },
  events: [
    "Formula 1 Belgian Grand Prix",
    "FIA World Endurance Championship",
    "24 Hours of Spa (GT)",
    "Spa 6 Hours",
  ],
  corners: [
    { name: "La Source", desc: "Tight hairpin right at the start, key for overtaking into T1." },
    { name: "Eau Rouge / Raidillon", desc: "Iconic uphill left-right-left compression. Flat out in modern prototypes, one of the most famous sequences in motorsport." },
    { name: "Les Combes", desc: "Highest point of the circuit (470m ASL). Heavy braking zone, common overtaking spot." },
    { name: "Rivage", desc: "Downhill double-apex right hander. Easy to overcook on entry." },
    { name: "Pouhon", desc: "Fast double-apex left. High G-loads, tests aero balance and driver confidence." },
    { name: "Stavelot", desc: "Lowest point of the circuit (373m ASL). Chicane leading onto the back straight." },
    { name: "Blanchimont", desc: "Ultra-fast left kink before the final chicane. Flat in qualifying, marginal in race trim." },
    { name: "Bus Stop", desc: "Tight chicane before the start/finish straight. Critical for lap time — exit speed carries all the way to La Source." },
  ],
  description: "Spa-Francorchamps is the longest circuit on the Formula 1 calendar, set in the forests of the Belgian Ardennes. Its combination of high-speed straights, elevation changes (102m difference), and unpredictable weather make it one of the most challenging and beloved tracks in the world. The circuit has hosted racing since 1921, though the modern layout dates to 1979.",
};

export function TrackInfoDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <h2 className="dialog-title">{TRACK_INFO.name}</h2>
            <div className="dialog-subtitle">{TRACK_INFO.location}</div>
          </div>
          <button className="dialog-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <p className="dialog-desc">{TRACK_INFO.description}</p>

        <div className="dialog-stats">
          <div className="dialog-stat">
            <span className="dialog-stat-label">Length</span>
            <span className="dialog-stat-value">{TRACK_INFO.length}</span>
          </div>
          <div className="dialog-stat">
            <span className="dialog-stat-label">Turns</span>
            <span className="dialog-stat-value">{TRACK_INFO.turns}</span>
          </div>
          <div className="dialog-stat">
            <span className="dialog-stat-label">Elevation</span>
            <span className="dialog-stat-value">Δ {TRACK_INFO.elevationChange}</span>
          </div>
          <div className="dialog-stat">
            <span className="dialog-stat-label">First Race</span>
            <span className="dialog-stat-value">{TRACK_INFO.firstRace}</span>
          </div>
          <div className="dialog-stat">
            <span className="dialog-stat-label">Lap Record</span>
            <span className="dialog-stat-value green">{TRACK_INFO.lapRecord.time}</span>
          </div>
          <div className="dialog-stat">
            <span className="dialog-stat-label">Record Holder</span>
            <span className="dialog-stat-value">{TRACK_INFO.lapRecord.driver} ({TRACK_INFO.lapRecord.year})</span>
          </div>
        </div>

        <div className="dialog-section-title">Famous Corners</div>
        <div className="dialog-corners">
          {TRACK_INFO.corners.map(c => (
            <div key={c.name} className="dialog-corner">
              <span className="dialog-corner-name">{c.name}</span>
              <span className="dialog-corner-desc">{c.desc}</span>
            </div>
          ))}
        </div>

        <div className="dialog-section-title">Events</div>
        <div className="dialog-events">
          {TRACK_INFO.events.map(e => (
            <span key={e} className="dialog-event-tag">{e}</span>
          ))}
        </div>

        <div className="dialog-source">
          Source: <a href="https://en.wikipedia.org/wiki/Circuit_de_Spa-Francorchamps" target="_blank" rel="noopener">Wikipedia</a>
        </div>
      </div>
    </div>
  );
}
