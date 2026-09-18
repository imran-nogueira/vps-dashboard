# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@12

# ---- deps: install once, compile better-sqlite3's native addon here -------
FROM base AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the Next.js app --------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm build

# ---- runner: same base image as `deps`, so the compiled native addon works -
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
