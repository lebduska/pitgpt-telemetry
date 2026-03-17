import { test, expect, describe, beforeAll } from "bun:test";
import { telemetry } from "./challenge-hard";

interface IngestResponse { laps: number; frames: number }
interface LapSummary { lapNumber: number; lapTime: number; sectors: { sector: number; time: number }[]; avgSpeed: number; maxSpeed: number }
interface AnalysisResponse { bestLap: { lapNumber: number; lapTime: number }; worstLap: { lapNumber: number; lapTime: number; delta: number }; problemSector: number; issue: string; coachingMessage: string }

const BASE = "http://localhost:3000";

describe("PitGPT API", () => {
  let ingestResult: IngestResponse;

  beforeAll(async () => {
    const res = await fetch(`${BASE}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telemetry),
    });
    ingestResult = await res.json() as IngestResponse;
  });

  // --- POST /ingest ---

  describe("POST /ingest", () => {
    test("accepts telemetry array and returns { laps, frames }", () => {
      expect(ingestResult).toHaveProperty("laps");
      expect(ingestResult).toHaveProperty("frames");
      expect(typeof ingestResult.laps).toBe("number");
      expect(typeof ingestResult.frames).toBe("number");
      expect(ingestResult.laps).toBeGreaterThan(0);
      expect(ingestResult.frames).toBeGreaterThan(0);
    });

    test("rejects non-array body with 400", async () => {
      const res = await fetch(`${BASE}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notAnArray: true }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body).toHaveProperty("error");
    });
  });

  // --- GET /laps ---

  describe("GET /laps", () => {
    let laps: LapSummary[];

    beforeAll(async () => {
      const res = await fetch(`${BASE}/laps`);
      laps = await res.json() as LapSummary[];
    });

    test("returns lap summaries with correct structure", () => {
      expect(Array.isArray(laps)).toBe(true);
      expect(laps.length).toBeGreaterThan(0);

      for (const lap of laps) {
        expect(lap).toHaveProperty("lapNumber");
        expect(lap).toHaveProperty("lapTime");
        expect(lap).toHaveProperty("sectors");
        expect(lap).toHaveProperty("avgSpeed");
        expect(lap).toHaveProperty("maxSpeed");
        expect(typeof lap.lapNumber).toBe("number");
        expect(typeof lap.lapTime).toBe("number");
        expect(typeof lap.avgSpeed).toBe("number");
        expect(typeof lap.maxSpeed).toBe("number");
      }
    });

    test("excludes out-lap (lap 0 starts at pos 0.541)", () => {
      const lapNumbers = laps.map((l: LapSummary) => l.lapNumber);
      expect(lapNumbers).not.toContain(0);
    });

    test("each lap has 3 sectors", () => {
      for (const lap of laps) {
        expect(lap.sectors).toHaveLength(3);
        for (const sector of lap.sectors) {
          expect(sector).toHaveProperty("sector");
          expect(sector).toHaveProperty("time");
          expect(typeof sector.sector).toBe("number");
          expect(typeof sector.time).toBe("number");
        }
      }
    });
  });

  // --- GET /analysis ---

  describe("GET /analysis", () => {
    let analysis: AnalysisResponse;

    beforeAll(async () => {
      const res = await fetch(`${BASE}/analysis`);
      analysis = await res.json() as AnalysisResponse;
    });

    test("returns bestLap, worstLap, problemSector, issue, coachingMessage", () => {
      expect(analysis).toHaveProperty("bestLap");
      expect(analysis).toHaveProperty("worstLap");
      expect(analysis).toHaveProperty("problemSector");
      expect(analysis).toHaveProperty("issue");
      expect(analysis).toHaveProperty("coachingMessage");

      expect(analysis.bestLap).toHaveProperty("lapNumber");
      expect(analysis.bestLap).toHaveProperty("lapTime");
      expect(analysis.worstLap).toHaveProperty("lapNumber");
      expect(analysis.worstLap).toHaveProperty("lapTime");
      expect(analysis.worstLap).toHaveProperty("delta");
    });

    test("bestLap.lapTime <= worstLap.lapTime", () => {
      expect(analysis.bestLap.lapTime).toBeLessThanOrEqual(analysis.worstLap.lapTime);
    });

    test("issue is one of the valid types", () => {
      const validIssues = ["heavy_braking", "low_throttle", "tyre_overheat", "inconsistency"];
      expect(validIssues).toContain(analysis.issue);
    });

    test("coachingMessage is non-empty string", () => {
      expect(typeof analysis.coachingMessage).toBe("string");
      expect(analysis.coachingMessage.length).toBeGreaterThan(0);
    });
  });
});
