/**
 * Speed gauge — circular arc SVG widget (React).
 */

import React from "react";

interface GaugeConfig {
  value: number;
  max: number;
  size: number;
  colorClass: "speed" | "rpm";
  label: string;
  unit: string;
  step: number;
  minorPerMajor: number;
  formatTick: (v: number) => string;
  redlineFrom?: number;
}

function tabulatedDigits(label: string, cx: number, cy: number, fontSize: number): React.ReactNode[] {
  const charW = fontSize * 0.75;
  const totalW = label.length * charW;
  const startX = cx - totalW / 2 + charW / 2;
  return label.split("").map((ch, i) => {
    const x = startX + i * charW;
    return (
      <text key={i} x={x} y={cy} className="g-val" fontSize={fontSize} fontFamily="'PP Formula', Inter, sans-serif" textAnchor="middle">{ch}</text>
    );
  });
}

function GaugeSVG({ value, max, size, colorClass, label, unit, step, minorPerMajor, formatTick, redlineFrom }: GaugeConfig) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
  const startAngle = 140, endAngle = 400, range = endAngle - startAngle;
  const pct = Math.min(value / max, 1);
  const toRad = (a: number) => a * Math.PI / 180;

  function ap(angle: number, radius: number): [number, number] {
    return [cx + radius * Math.cos(toRad(angle)), cy + radius * Math.sin(toRad(angle))];
  }

  const majorCount = Math.round(max / step);
  const totalMinor = majorCount * minorPerMajor;

  const ticks: React.ReactNode[] = [];
  // Minor ticks
  for (let i = 0; i <= totalMinor; i++) {
    const a = startAngle + range * (i / totalMinor);
    const isMajor = i % minorPerMajor === 0;
    const len = isMajor ? 10 : 5;
    const w = isMajor ? 1.5 : 0.8;
    const col = isMajor ? "#555" : "#333";
    const [ox, oy] = ap(a, r);
    const [ix, iy] = ap(a, r - len);
    ticks.push(<line key={`t${i}`} x1={ox} y1={oy} x2={ix} y2={iy} stroke={col} strokeWidth={w} />);
  }

  // Major tick labels
  for (let i = 0; i <= majorCount; i++) {
    const a = startAngle + range * (i / majorCount);
    const v = step * i;
    const [lx, ly] = ap(a, r - 16);
    ticks.push(<text key={`ml${i}`} x={lx} y={ly} fill="#555" fontSize="9" fontFamily="'PP Formula', Inter, sans-serif" fontWeight="500" textAnchor="middle" dominantBaseline="central">{formatTick(v)}</text>);
  }

  const [sx, sy] = ap(startAngle, r);
  const [ex, ey] = ap(endAngle, r);
  const sa = startAngle + range * pct;
  const [spx, spy] = ap(sa, r);

  const maxChars = label.length;
  const valSize = Math.min(28, size * 0.7 / (maxChars * 0.75));
  const unitSize = 10;

  // Redline zone
  let redlineArc = null;
  if (redlineFrom != null) {
    const rlPct = redlineFrom / max;
    const rlAngle = startAngle + range * rlPct;
    const [rlx, rly] = ap(rlAngle, r);
    redlineArc = <path d={`M ${rlx} ${rly} A ${r} ${r} 0 ${(endAngle - rlAngle) > 180 ? 1 : 0} 1 ${ex} ${ey}`} stroke="#ff3333" strokeWidth="5" fill="none" opacity="0.25" strokeLinecap="round" />;
  }

  const arcPath = pct > 0.005
    ? <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${(sa - startAngle) > 180 ? 1 : 0} 1 ${spx} ${spy}`} className={`g-arc-${colorClass}`} />
    : null;

  const glowColor = colorClass === "speed" ? "#00ff00" : "#9B6DFF";
  const glowDot = pct > 0.005
    ? <>
        <circle cx={spx} cy={spy} r="3" fill={glowColor} opacity="0.8" />
        <circle cx={spx} cy={spy} r="6" fill={glowColor} opacity="0.2" />
      </>
    : null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`}>
      {ticks}
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`} className="g-arc-bg" />
      {redlineArc}
      {arcPath}
      {glowDot}
      {tabulatedDigits(label, cx, cy + valSize * 0.15, valSize)}
      <text x={cx} y={cy + valSize * 0.15 + valSize * 0.65} className="g-unit" fontSize={unitSize} fontFamily="'PP Formula', Inter, sans-serif">{unit}</text>
    </svg>
  );
}

export function SpeedGauge({ speed }: { speed: number }) {
  return (
    <GaugeSVG
      value={speed}
      max={300}
      size={200}
      colorClass="speed"
      label={String(speed)}
      unit="km/h"
      step={50}
      minorPerMajor={5}
      formatTick={v => String(v)}
    />
  );
}

export { GaugeSVG };
