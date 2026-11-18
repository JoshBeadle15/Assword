const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'passwords.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site TEXT NOT NULL,
    username TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  )
`);

// Migration for databases created before the username column existed.
const hasUsername = db.prepare("PRAGMA table_info(entries)").all().some((col) => col.name === 'username');
if (!hasUsername) {
  db.exec("ALTER TABLE entries ADD COLUMN username TEXT NOT NULL DEFAULT ''");
}

module.exports = db;
