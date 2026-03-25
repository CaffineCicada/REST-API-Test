import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

const DB_PATH = "./data/app.db";

export let db: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>;

export async function initDb() {
  const SQL = await initSqlJs();

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      tags       TEXT NOT NULL DEFAULT '[]',
      subscribed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      subject    TEXT NOT NULL,
      html_body  TEXT NOT NULL,
      variables  TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      template_id  TEXT NOT NULL,
      target_tags  TEXT NOT NULL DEFAULT '[]',
      scheduled_at TEXT,
      status       TEXT NOT NULL DEFAULT 'draft',
      sent_count   INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );

    CREATE TABLE IF NOT EXISTS send_logs (
      id                TEXT PRIMARY KEY,
      campaign_id       TEXT NOT NULL,
      contact_id        TEXT NOT NULL,
      status            TEXT NOT NULL,
      resend_message_id TEXT,
      error_message     TEXT,
      sent_at           TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (contact_id)  REFERENCES contacts(id)
    );
  `);

  persist();
  console.log("[db] Database ready at", DB_PATH);
}

export function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}
