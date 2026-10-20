#!/usr/bin/env bash
# Installs the VPS Dashboard health agent on this machine.
#
# Usage:
#   scp agent/install-agent.sh <user>@<vps-ip>:
#   ssh -t <user>@<vps-ip> 'sudo bash install-agent.sh'
#
# To impose a token instead of generating one, pipe it on stdin (never as an
# argument: sudo logs the command line and `ps` shows it):
#   printf '%s' "$TOKEN" | ssh <user>@<vps-ip> 'sudo bash install-agent.sh -'
#
# The script needs root to install the systemd service, but the agent itself
# runs as an unprivileged, throwaway user (DynamicUser) in a read-only,
# sandboxed view of the system: reading /proc/meminfo and running `df` needs
# no privileges at all.
#
# The token lives in /etc/vps-agent/agent.env (root-only, 0600) and is never
# printed. An existing one is kept on re-install.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (it installs a systemd service)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found on this machine." >&2
  echo "Install Node.js >= 16 first (e.g. 'apt install nodejs'), then re-run this script." >&2
  exit 1
fi

# Resolve symlinks: a /usr/local/bin/node pointing into /root/.nvm would pass
# a check on the link itself but be hidden from the service.
NODE_BIN="$(readlink -f "$(command -v node)")"
case "$NODE_BIN" in
  /home/* | /root/*)
    # ProtectHome=yes hides these from the service (nvm installs live there).
    echo "Node.js must be installed system-wide, not in $NODE_BIN." >&2
    exit 1
    ;;
  /snap/*)
    # snap-confine is setuid, which NoNewPrivileges neutralizes.
    echo "Node.js from snap can't run under NoNewPrivileges; use the distro package." >&2
    exit 1
    ;;
esac

NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 16 ]; then
  # The agent uses `node:`-prefixed built-in modules.
  echo "Node.js >= 16 is required (found $("$NODE_BIN" -v))." >&2
  exit 1
fi

INSTALL_DIR="/opt/vps-agent"
CONFIG_DIR="/etc/vps-agent"
ENV_FILE="$CONFIG_DIR/agent.env"
UNIT_FILE="/etc/systemd/system/vps-agent.service"
PORT="${PORT:-9090}"
TOKEN=""

if [ "$PORT" -le 1024 ]; then
  echo "PORT must be above 1024: the agent has no capability to bind lower." >&2
  exit 1
fi

if [ "${1:-}" = "-" ]; then
  IFS= read -r TOKEN || true
elif [ -n "${1:-}" ]; then
  echo "Pass the token on stdin with '-', not as an argument (see usage)." >&2
  exit 1
elif [ -f "$ENV_FILE" ]; then
  TOKEN="$(sed -n 's/^VPS_AGENT_TOKEN=//p' "$ENV_FILE")"
fi
# Tokens left in the unit file by older versions of this script were
# world-readable: they are deliberately not migrated, a new one is generated.

if [ -z "$TOKEN" ]; then
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 32)"
  else
    TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
fi

# systemd's EnvironmentFile parsing strips quotes and backslashes: restrict the
# token to characters it passes through unchanged.
if ! [[ "$TOKEN" =~ ^[A-Za-z0-9._~+/=-]{16,}$ ]]; then
  echo "Token must be at least 16 characters from [A-Za-z0-9._~+/=-]." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
install -d -m 0700 "$CONFIG_DIR"
(umask 077 && printf 'VPS_AGENT_TOKEN=%s\n' "$TOKEN" > "$ENV_FILE")
unset TOKEN

cat > "$INSTALL_DIR/agent.js" << 'AGENT_JS_EOF'
"use strict";

// Zero-dependency health agent for a single VPS. Node.js built-ins only —
// no npm install needed on the target machine.
//
// GET /health with `Authorization: Bearer <VPS_AGENT_TOKEN>` returns:
//   { status, ram: { used, total }, disk: { used, total }, uptime }
// Any missing/invalid token gets a 401. Nothing else is exposed: no logs,
// no other endpoints, no remote command execution.

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const PORT = Number(process.env.PORT) || 9090;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(req) {
  const token = process.env.VPS_AGENT_TOKEN;
  if (!token) return false;

  const header = req.headers["authorization"] || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;

  return timingSafeEqual(match[1], token);
}

// Parses `/proc/meminfo`. Uses MemAvailable (not MemFree) so buffers/cache
// aren't counted as "used" — matches what `free -h` and Hetzner Console show.
function parseMemInfo(text) {
  const totalMatch = /^MemTotal:\s+(\d+)\s+kB/m.exec(text);
  const availMatch = /^MemAvailable:\s+(\d+)\s+kB/m.exec(text);
  if (!totalMatch || !availMatch) {
    throw new Error("Could not parse /proc/meminfo");
  }

  const totalKb = Number(totalMatch[1]);
  const availKb = Number(availMatch[1]);
  const usedKb = Math.max(0, totalKb - availKb);

  return {
    used: round2(usedKb / 1024 / 1024),
    total: round2(totalKb / 1024 / 1024),
  };
}

// Parses `df -k /` output: header line, then
// "Filesystem 1K-blocks Used Available Use% Mounted-on".
function parseDfOutput(text) {
  const lines = text.trim().split("\n");
  const dataLine = lines[lines.length - 1];
  const parts = dataLine.trim().split(/\s+/);
  const totalKb = Number(parts[1]);
  const usedKb = Number(parts[2]);

  if (!Number.isFinite(totalKb) || !Number.isFinite(usedKb)) {
    throw new Error("Could not parse df output");
  }

  return {
    used: round2(usedKb / 1024 / 1024),
    total: round2(totalKb / 1024 / 1024),
  };
}

function getRam() {
  return parseMemInfo(fs.readFileSync("/proc/meminfo", "utf8"));
}

function getDisk() {
  return parseDfOutput(execFileSync("df", ["-k", "/"], { encoding: "utf8" }));
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function handleHealth(req, res) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  try {
    sendJson(res, 200, {
      status: "online",
      ram: getRam(),
      disk: getDisk(),
      uptime: Math.round(os.uptime()),
    });
  } catch {
    sendJson(res, 500, { error: "Failed to read system metrics" });
  }
}

function requestListener(req, res) {
  if (req.method === "GET" && req.url === "/health") {
    handleHealth(req, res);
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

function startServer() {
  if (!process.env.VPS_AGENT_TOKEN) {
    console.error("VPS_AGENT_TOKEN environment variable is required.");
    process.exit(1);
  }

  http.createServer(requestListener).listen(PORT, () => {
    console.log(`vps-agent listening on port ${PORT}`);
  });
}

module.exports = { parseMemInfo, parseDfOutput, isAuthorized, timingSafeEqual };

if (require.main === module) {
  startServer();
}
AGENT_JS_EOF

chmod 0644 "$INSTALL_DIR/agent.js"
# Leftover from older versions of this script, which embedded the token.
rm -f "$INSTALL_DIR/vps-agent.service"

# On a tailnet, the agent should be reached over Tailscale, not the public IP,
# and the service only accepts tailnet and loopback traffic. This holds even if
# the host firewall is off or misconfigured.
IP_FILTER=""
SERVER_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
if [ -n "$SERVER_IP" ]; then
  IP_FILTER="IPAddressDeny=any
IPAddressAllow=localhost 100.64.0.0/10 fd7a:115c:a1e0::/48"
else
  SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi

# systemd reads EnvironmentFile as root before dropping privileges, so the
# token file stays root-only while the agent still gets the variable.
cat > "$UNIT_FILE" << SERVICE_EOF
[Unit]
Description=VPS Dashboard health agent
After=network.target

[Service]
Type=exec
ExecStart=$NODE_BIN $INSTALL_DIR/agent.js
EnvironmentFile=$ENV_FILE
Environment=PORT=$PORT
Restart=on-failure
RestartSec=2

# Unprivileged, sandboxed: the agent only reads /proc/meminfo, runs df and
# listens on an unprivileged port. Keep PORT above 1024.
DynamicUser=yes
NoNewPrivileges=yes
CapabilityBoundingSet=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectProc=invisible
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
SystemCallArchitectures=native
# V8 calls pkey_alloc (@pkey) at startup. Any other filtered syscall fails
# with EPERM instead of killing Node, which has fallbacks for them.
SystemCallFilter=@system-service @pkey
SystemCallErrorNumber=EPERM
UMask=0077
$IP_FILTER

[Install]
WantedBy=multi-user.target
SERVICE_EOF
chmod 0644 "$UNIT_FILE"

systemctl daemon-reload
systemctl enable vps-agent
systemctl restart vps-agent

# A started unit isn't a working agent: wait for /health to answer 401 (no
# token sent) before reporting success.
HEALTH_CHECK='require("node:http").get({ host: "127.0.0.1", port: process.argv[1], path: "/health", timeout: 1000 },
  (res) => process.exit(res.statusCode === 401 ? 0 : 1)).on("error", () => process.exit(1))'
for _ in $(seq 1 10); do
  if "$NODE_BIN" -e "$HEALTH_CHECK" "$PORT" && systemctl is-active --quiet vps-agent; then
    HEALTHY=1
    break
  fi
  sleep 1
done
if [ -z "${HEALTHY:-}" ]; then
  echo "vps-agent did not answer on port $PORT. See: journalctl -u vps-agent -n 20" >&2
  exit 1
fi

echo ""
echo "vps-agent installed and answering on port $PORT."
echo ""
echo "Agent URL:   http://${SERVER_IP:-<this-vps-ip>}:$PORT"
echo "Agent token: stored in $ENV_FILE (root-only), read it with:"
echo "  sudo sed -n 's/^VPS_AGENT_TOKEN=//p' $ENV_FILE"
echo ""
echo "Add these in the dashboard's Settings page. Check status with:"
echo "  systemctl status vps-agent"
