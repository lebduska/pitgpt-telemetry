FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY index.ts challenge-hard.ts telemetry.json tsconfig.json ./
COPY dashboard/ ./dashboard/
COPY dashboard.html dashboard.css ./
COPY fonts/ ./fonts/

EXPOSE 3000
CMD ["bun", "run", "index.ts"]
