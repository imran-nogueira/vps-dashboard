import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_PATH = "./data/vps-dashboard.db";

function openDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH ?? DEFAULT_PATH;
  const dir = path.dirname(dbPath);
  if (dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hetzner_server_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      ssh_user TEXT NOT NULL DEFAULT 'root',
      ip TEXT NOT NULL,
      ipv6 TEXT,
      agent_url TEXT NOT NULL,
      agent_token TEXT NOT NULL,
      server_type TEXT,
      vcpu INTEGER,
      ram_total_gb REAL,
      disk_total_gb REAL,
      datacenter TEXT,
      price_monthly REAL,
      hetzner_price_monthly REAL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  return db;
}

// Opened lazily (on first real query) rather than at module import time.
// Next.js imports every route module in parallel build workers just to
// trace it, even for force-dynamic routes; eagerly opening the SQLite file
// there meant several worker processes raced to create the same WAL file
// at once, which crashed the build. Stashed on globalThis so dev-mode
// module reloads and multiple importers share one connection.
const globalForDb = globalThis as unknown as { __vpsDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__vpsDb) {
    globalForDb.__vpsDb = openDb();
  }
  return globalForDb.__vpsDb;
}
