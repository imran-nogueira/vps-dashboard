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
