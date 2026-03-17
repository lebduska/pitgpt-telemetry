# PitGPT — Telemetry Analysis API + Dashboard

RACEMAKE Product Engineer Challenge (HARD).

Bun/Hono API that ingests racing telemetry data (Porsche 963 LMDh, Spa-Francorchamps) and returns lap analysis with coaching insights. Includes a live React dashboard with real-time telemetry visualization.

## Setup

```bash
bun install
bun run index.ts
# Server starts on http://localhost:3000
```

## API Endpoints

### POST /ingest

Accepts the raw telemetry array. Stores and processes it in memory.

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d @telemetry.json
```

```json
{"laps":3,"frames":163}
```

### GET /laps

Returns a summary of each completed lap with sector times, speeds.

```bash
curl http://localhost:3000/laps
```

```json
[
  {"lapNumber":1,"lapTime":133.2,"sectors":[{"sector":1,"time":41.2},{"sector":2,"time":44.4},{"sector":3,"time":41.2}],"avgSpeed":227.9,"maxSpeed":291},
  {"lapNumber":2,"lapTime":132.8,"sectors":[{"sector":1,"time":41.1},{"sector":2,"time":44.2},{"sector":3,"time":41.1}],"avgSpeed":230.6,"maxSpeed":292},
  {"lapNumber":3,"lapTime":137.4,"sectors":[{"sector":1,"time":41.5},{"sector":2,"time":48},{"sector":3,"time":41.5}],"avgSpeed":217.5,"maxSpeed":286}
]
```

### GET /analysis

Compares laps, identifies the worst sector, detects the primary issue, and returns a coaching message in PitGPT voice.

```bash
curl http://localhost:3000/analysis
```

```json
{
  "bestLap": {"lapNumber":2,"lapTime":132.8},
  "worstLap": {"lapNumber":3,"lapTime":137.4,"delta":4.6},
  "problemSector": 2,
  "issue": "tyre_overheat",
  "coachingMessage": "Sector 2 is killing your lap — tyres are at 119°C, way over the limit. You're overdriving. Smooth inputs on exit, let the rubber breathe."
}
```

## Edge Cases Handled

- **Out-lap exclusion** — first lap starts mid-track (not from 0.0), excluded
- **Incomplete lap exclusion** — last lap without return to ~0.0, excluded
- **Stationary frame filtering** — frames with speed < 5 and no position change, skipped

## Dashboard

Navigate to `http://localhost:3000/dashboard` for a live telemetry dashboard featuring:

- Speed gauge and RPM gauge with gear indicator
- Brake/throttle pedal visualization
- Track map with sector markers and coaching tips
- Tyre temperature widget with Porsche 963 LMDh silhouette and steering visualization
- Correlation charts (speed/steering/brake/throttle vs tyre temp, RPM & gear map)
- Lap comparison panels with best/worst overlay
- Playback controls with scrubber, speed control, and lap selection
- Delta-to-best live timing
- Track info dialog (Spa-Francorchamps)

## Tests

```bash
bun test
```

9 tests, 91 assertions covering all API endpoints and edge cases.

## Tech Stack

- **Runtime:** Bun
- **API:** Hono
- **Frontend:** React 19, SVG gauges, Canvas charts
- **Build:** Bun.build() for TSX bundling
