# VPS Dashboard

A single, minimal page to see all your Hetzner VPS at a glance: online/offline,
RAM used/total, disk used/total, monthly price, and a ready-to-copy SSH command.
Not a monitoring tool — no graphs, no history, no CPU breakdown, no logs.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS + SQLite
(`better-sqlite3`) + the Hetzner Cloud API, deployed with Docker. A tiny
zero-dependency Node.js agent runs on each VPS to report live RAM/disk/uptime.

Requires **Node.js >= 22** (required by `better-sqlite3`).

## 1. Local installation

```bash
pnpm install
```

## 2. Configure `.env`

```bash
cp .env.example .env
```

Fill in:

| Variable | What it is |
| --- | --- |
| `HETZNER_API_TOKEN` | Read access is enough. Create one in the [Hetzner Cloud Console](https://console.hetzner.cloud) → your project → **Security** → **API Tokens**. |
| `DASHBOARD_PASSWORD` | The single password used to access the dashboard. |
| `SESSION_SECRET` | Random secret used to sign the session cookie. Generate with `openssl rand -hex 32`. |
| `DATABASE_PATH` | Where the SQLite file lives. Defaults to `./data/vps-dashboard.db`; leave as-is unless you have a reason to change it. |

## 3. SQLite

Nothing to set up: the `servers` table is created automatically on first run,
at the path in `DATABASE_PATH`. There's no metrics history and no separate
database server — the file **is** the database. Back it up by copying it
(with the app stopped, or via `sqlite3 .backup`).

## 4. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), log in with
`DASHBOARD_PASSWORD`, then go to **Settings** to add a VPS manually or click
**Sync with Hetzner** to pull your servers' static info (name, IP, type,
RAM/disk capacity, price) automatically.

A server only shows live RAM/disk/status once its agent is installed and its
Agent URL + token are set in Settings (see next step).

## 5. Install the agent on a VPS

The agent is a single zero-dependency Node.js file
([`agent/agent.js`](agent/agent.js)) that exposes `GET /health` behind a
bearer token. Install it with:

```bash
scp agent/install-agent.sh root@<vps-ip>:/root/
ssh root@<vps-ip> 'bash install-agent.sh'
```

This requires Node.js to already be installed on the VPS. The script:

- copies the agent to `/opt/vps-agent/agent.js`
- generates a random token (or use one you provide: `bash install-agent.sh <token>`)
- creates and starts a `vps-agent` systemd service, enabled on boot, listening
  on port `9090` by default (override with `PORT=xxxx bash install-agent.sh`)
- prints the **Agent URL** and **Agent token** at the end

Copy those two values into the dashboard's **Settings** page for that server
(add a new one, or edit one synced from Hetzner).

Check the agent later with:

```bash
ssh root@<vps-ip> systemctl status vps-agent
ssh root@<vps-ip> curl -H "Authorization: Bearer <token>" http://localhost:9090/health
```

## 6. Configure the agent token in the dashboard

In **Settings**, edit the server and paste the **Agent URL**
(`http://<vps-ip>:9090`) and **Agent token** printed by the install script.
The dashboard sends `Authorization: Bearer <token>` on every request and
never displays the token again once saved — leave that field blank when
editing a server to keep the existing token.

## 7. Run with Docker

```bash
cp .env.example .env   # fill it in, same as step 2
docker compose up -d --build
```

The SQLite file persists on the host at `./data/vps-dashboard.db` (bind
mount, see `docker-compose.yml`). The dashboard is served on
`http://localhost:3000`.

## 8. Deploy on a Hetzner VPS

1. Provision a small VPS (this app is light; the cheapest one is enough) and
   point a DNS record at it if you want a domain.
2. Install Docker + the Docker Compose plugin on it.
3. Copy the project there (`git clone`/`scp`) and `cd` into it.
4. `cp .env.example .env` and fill it in (use a real random `SESSION_SECRET`
   and a strong `DASHBOARD_PASSWORD`).
5. `docker compose up -d --build`.
6. Put it behind a reverse proxy (e.g. Caddy or nginx) for HTTPS if it's
   reachable from the internet — the session cookie is marked `secure` in
   production, so the dashboard must be served over HTTPS or the login
   cookie won't stick.
7. Install the agent (step 5) on this VPS and on every other VPS you want to
   track, then add/sync them from **Settings**.

## Troubleshooting

- **A server shows "Unable to reach VPS" / stays offline**: the dashboard
  couldn't reach `Agent URL` + `/health` within 2.5s. Check the Agent URL and
  token in Settings, that the VPS firewall allows the agent's port, and that
  the service is running (`systemctl status vps-agent` on that VPS).
- **`Sync with Hetzner` fails**: check `HETZNER_API_TOKEN` is set and has at
  least read access to the project.
- **Login doesn't stick after entering the password**: make sure
  `SESSION_SECRET` is set. Behind HTTPS in production, also make sure your
  reverse proxy forwards the request as HTTPS (the cookie is `secure` in
  production, so it's dropped over plain HTTP).
- **`docker compose up` fails to build**: `better-sqlite3` needs Node.js
  **>= 22** to load correctly (the prebuilt native binary segfaults on
  older versions) — this is already pinned in the provided `Dockerfile`;
  if you customize the base image, keep it at `node:22` or newer.
- **Price shows "—"**: neither a manual price nor a Hetzner-synced price is
  set for that server. Set one in Settings, or run **Sync with Hetzner**.

## Commands reference

```bash
pnpm dev              # local dev server
pnpm lint             # ESLint
pnpm test             # Vitest (auth, price/merge logic, agent parsing)
pnpm build            # production build
pnpm start            # run the production build locally
docker compose up -d --build   # build and run with Docker
```
