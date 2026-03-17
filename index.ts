/**
 * PitGPT Telemetry API — Bun/Hono
 * Processes raw telemetry from racing simulators into lap analysis and coaching.
 */

import { Hono } from "hono";
import type { TelemetryFrame } from "./challenge-hard";
import { telemetry as rawTelemetry } from "./challenge-hard";

// ============================================================
// CONSTANTS
// ============================================================

const STATIONARY_SPEED = 5;
const STATIONARY_POS_DELTA = 0.001;
const OUT_LAP_START_THRESHOLD = 0.1;
const INCOMPLETE_LAP_END_THRESHOLD = 0.95;
const HEAVY_BRAKING_THRESHOLD = 0.8;
const HEAVY_BRAKING_SPEED = 200;
const TYRE_OVERHEAT_TEMP = 110;
const LOW_THROTTLE_AVG = 0.6;
const INCONSISTENCY_STDDEV = 40;

// ============================================================
// TYPES
// ============================================================

interface SectorSummary {
  sector: number;
  time: number;
}

interface LapSummary {
  lapNumber: number;
  lapTime: number;
  sectors: SectorSummary[];
  avgSpeed: number;
  maxSpeed: number;
}

type IssueType = "heavy_braking" | "low_throttle" | "tyre_overheat" | "inconsistency";

interface SectorIssueDetails {
  issue: IssueType;
  maxTemp?: number;
  avgThrottle?: number;
  speedStddev?: number;
}

interface AnalysisResult {
  bestLap: { lapNumber: number; lapTime: number };
  worstLap: { lapNumber: number; lapTime: number; delta: number };
  problemSector: number;
  issue: IssueType;
  coachingMessage: string;
}

// ============================================================
// STORAGE
// ============================================================

let frames: TelemetryFrame[] = [];
let cachedFiltered: TelemetryFrame[] = [];
let cachedLaps: Map<number, TelemetryFrame[]> = new Map();

let cachedJs: string | null = null;
let cachedCss: string | null = null;
let cachedHtml: string | null = null;

// ============================================================
// TELEMETRY PROCESSING
// ============================================================

const SECTOR_BOUNDARIES = [0.333, 0.667] as const;

function isStationary(frame: TelemetryFrame, prev?: TelemetryFrame): boolean {
  if (frame.spd < STATIONARY_SPEED && prev && Math.abs(frame.pos - prev.pos) < STATIONARY_POS_DELTA) return true;
  if (frame.spd < STATIONARY_SPEED && !prev) return true;
  return false;
}

function getSector(pos: number): number {
  if (pos < SECTOR_BOUNDARIES[0]) return 1;
  if (pos < SECTOR_BOUNDARIES[1]) return 2;
  return 3;
}

function filterFrames(raw: TelemetryFrame[]): TelemetryFrame[] {
  const result: TelemetryFrame[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (!isStationary(raw[i], raw[i - 1])) {
      result.push(raw[i]);
    }
  }
  return result;
}

function getCompletedLaps(filtered: TelemetryFrame[]): Map<number, TelemetryFrame[]> {
  // Group frames by lap number
  const byLap = new Map<number, TelemetryFrame[]>();
  for (const f of filtered) {
    if (!byLap.has(f.lap)) byLap.set(f.lap, []);
    byLap.get(f.lap)!.push(f);
  }

  const completed = new Map<number, TelemetryFrame[]>();

  for (const [lapNum, lapFrames] of byLap) {
    // Exclude out-lap: starts mid-track (first frame pos significantly > 0)
    const firstPos = lapFrames[0].pos;
    if (firstPos > OUT_LAP_START_THRESHOLD) continue;

    // Exclude incomplete laps: last frame should be near end of track (pos > 0.95)
    const lastPos = lapFrames[lapFrames.length - 1].pos;
    if (lastPos < INCOMPLETE_LAP_END_THRESHOLD) continue;

    completed.set(lapNum, lapFrames);
  }

  return completed;
}

function buildLapSummary(lapNum: number, lapFrames: TelemetryFrame[]): LapSummary {
  const firstTs = lapFrames[0].ts;
  const lastTs = lapFrames[lapFrames.length - 1].ts;
  const lapTime = +(lastTs - firstTs).toFixed(3);

  // Split frames into sectors
  const sectorFrames: TelemetryFrame[][] = [[], [], []];
  for (const f of lapFrames) {
    const s = getSector(f.pos);
    sectorFrames[s - 1].push(f);
  }

  // Sector times based on first/last timestamp in each sector
  const sectors: SectorSummary[] = sectorFrames.map((sf, i) => {
    if (sf.length < 2) return { sector: i + 1, time: 0 };
    return {
      sector: i + 1,
      time: +(sf[sf.length - 1].ts - sf[0].ts).toFixed(3),
    };
  });

  const speeds = lapFrames.map((f) => f.spd);
  const avgSpeed = +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1);
  const maxSpeed = Math.max(...speeds);

  return { lapNumber: lapNum, lapTime, sectors, avgSpeed, maxSpeed };
}

// ============================================================
// ANALYSIS
// ============================================================

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / values.length);
}

function detectSectorIssue(sectorFrames: TelemetryFrame[]): SectorIssueDetails {
  // Check heavy_braking: brake > HEAVY_BRAKING_THRESHOLD while speed > HEAVY_BRAKING_SPEED
  const heavyBraking = sectorFrames.some((f) => f.brk > HEAVY_BRAKING_THRESHOLD && f.spd > HEAVY_BRAKING_SPEED);
  if (heavyBraking) return { issue: "heavy_braking" };

  // Check tyre_overheat: any tyre > TYRE_OVERHEAT_TEMP
  const maxTemp = Math.max(
    ...sectorFrames.flatMap((f) => [f.tyres.fl, f.tyres.fr, f.tyres.rl, f.tyres.rr])
  );
  const overheated = sectorFrames.some(
    (f) => f.tyres.fl > TYRE_OVERHEAT_TEMP || f.tyres.fr > TYRE_OVERHEAT_TEMP || f.tyres.rl > TYRE_OVERHEAT_TEMP || f.tyres.rr > TYRE_OVERHEAT_TEMP
  );
  if (overheated) return { issue: "tyre_overheat", maxTemp };

  // Check low_throttle: avg throttle < LOW_THROTTLE_AVG
  const avgThrottle = sectorFrames.reduce((s, f) => s + f.thr, 0) / sectorFrames.length;
  if (avgThrottle < LOW_THROTTLE_AVG) return { issue: "low_throttle", avgThrottle };

  // Check inconsistency: speed stddev > INCONSISTENCY_STDDEV
  const speedStddev = stddev(sectorFrames.map((f) => f.spd));
  if (speedStddev > INCONSISTENCY_STDDEV) return { issue: "inconsistency", speedStddev };

  return { issue: "low_throttle", avgThrottle };
}

function generateCoachingMessage(
  sector: number,
  details: SectorIssueDetails
): string {
  switch (details.issue) {
    case "heavy_braking":
      return `Sector ${sector} — you're standing on the brakes too hard at high speed. Trail brake, don't stamp. You're unsettling the car and killing your entry speed.`;
    case "tyre_overheat":
      return `Sector ${sector} is killing your lap — tyres are at ${details.maxTemp}°C, way over the limit. You're overdriving. Smooth inputs on exit, let the rubber breathe.`;
    case "low_throttle": {
      const avgThr = details.avgThrottle!.toFixed(0);
      return `Sector ${sector}, throttle trace is weak — ${avgThr}% average. You're hesitating on the exits. Pick up the throttle earlier, commit to it.`;
    }
    case "inconsistency": {
      const sd = details.speedStddev!.toFixed(1);
      return `Sector ${sector} is all over the place — speed variance is ${sd} km/h. You're not in a rhythm. Same braking point, same turn-in, every lap. Consistency first, speed comes after.`;
    }
  }
}

function analyzeStint(laps: Map<number, TelemetryFrame[]>): AnalysisResult {
  const summaries = [...laps.entries()].map(([num, f]) => buildLapSummary(num, f));

  const best = summaries.reduce((a, b) => (a.lapTime < b.lapTime ? a : b));
  const worst = summaries.reduce((a, b) => (a.lapTime > b.lapTime ? a : b));
  const delta = +(worst.lapTime - best.lapTime).toFixed(3);

  // Find worst sector of worst lap by comparing to best lap
  const worstLapFrames = laps.get(worst.lapNumber)!;

  // Sector times for worst and best
  const worstSectors = worst.sectors;
  const bestSectors = best.sectors;

  let maxSectorDelta = -Infinity;
  let problemSector = 1;

  for (let i = 0; i < 3; i++) {
    const sectorDelta = worstSectors[i].time - bestSectors[i].time;
    if (sectorDelta > maxSectorDelta) {
      maxSectorDelta = sectorDelta;
      problemSector = i + 1;
    }
  }

  // Get frames for the problem sector of the worst lap
  const problemFrames = worstLapFrames.filter((f) => getSector(f.pos) === problemSector);
  const issueDetails = detectSectorIssue(problemFrames);
  const issue = issueDetails.issue;
  const coachingMessage = generateCoachingMessage(problemSector, issueDetails);

  return {
    bestLap: { lapNumber: best.lapNumber, lapTime: best.lapTime },
    worstLap: { lapNumber: worst.lapNumber, lapTime: worst.lapTime, delta },
    problemSector,
    issue,
    coachingMessage,
  };
}

// ============================================================
// API
// ============================================================

const app = new Hono();

app.post("/ingest", async (c) => {
  const body = await c.req.json<TelemetryFrame[]>();

  if (!Array.isArray(body)) {
    return c.json({ error: "Expected array of telemetry frames" }, 400);
  }

  frames = body;
  cachedFiltered = filterFrames(frames);
  cachedLaps = getCompletedLaps(cachedFiltered);

  return c.json({ laps: cachedLaps.size, frames: cachedFiltered.length });
});

app.get("/laps", (c) => {
  if (frames.length === 0) {
    return c.json({ error: "No telemetry data. POST to /ingest first." }, 404);
  }

  const summaries = [...cachedLaps.entries()]
    .map(([num, f]) => buildLapSummary(num, f))
    .sort((a, b) => a.lapNumber - b.lapNumber);

  return c.json(summaries);
});

app.get("/analysis", (c) => {
  if (frames.length === 0) {
    return c.json({ error: "No telemetry data. POST to /ingest first." }, 404);
  }

  if (cachedLaps.size < 2) {
    return c.json({ error: "Need at least 2 completed laps to compare." }, 400);
  }

  const result = analyzeStint(cachedLaps);
  return c.json(result);
});

// ============================================================
// DASHBOARD HELPERS
// ============================================================

app.get("/api/telemetry-raw", (c) => {
  return c.json(rawTelemetry);
});

app.get("/api/lap-frames", (c) => {
  const filtered = filterFrames(frames.length > 0 ? frames : rawTelemetry);
  const laps = getCompletedLaps(filtered);
  const result: Record<number, TelemetryFrame[]> = {};
  for (const [num, f] of laps) {
    result[num] = f;
  }
  return c.json(result);
});

// ============================================================
// DASHBOARD — bundle & serve
// ============================================================

async function buildDashboardJs(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [import.meta.dir + "/dashboard/main.tsx"],
    bundle: true,
    minify: false,
    target: "browser",
  });
  return result.outputs[0] ? await result.outputs[0].text() : "console.error('Dashboard build failed')";
}

app.get("/dashboard.css", async (c) => {
  if (!cachedCss) cachedCss = await Bun.file(import.meta.dir + "/dashboard.css").text();
  return new Response(cachedCss, { headers: { "Content-Type": "text/css" } });
});

app.get("/dashboard.js", async (c) => {
  if (!cachedJs) cachedJs = await buildDashboardJs();
  return new Response(cachedJs, { headers: { "Content-Type": "application/javascript" } });
});

app.get("/dashboard", async (c) => {
  if (!cachedHtml) cachedHtml = await Bun.file(import.meta.dir + "/dashboard.html").text();
  return c.html(cachedHtml);
});

app.get("/fonts/:file", async (c) => {
  const file = Bun.file(import.meta.dir + "/fonts/" + c.req.param("file"));
  if (!(await file.exists())) return c.notFound();
  return new Response(file, { headers: { "Content-Type": "font/otf" } });
});

// ============================================================
// SERVER
// ============================================================

const port = 3000;
console.log(`🏁 PitGPT API running on http://localhost:${port}`);
console.log(`📊 Dashboard: http://localhost:${port}/dashboard`);

export default {
  port,
  fetch: app.fetch,
};
