require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');

const db = require('./db');
const { issueCookie, clearCookie, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SITE_PASSWORD) {
  console.error('Missing SITE_PASSWORD environment variable. Set it before starting the server.');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET environment variable. Set it before starting the server.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(compression());
app.use(express.json());
app.use(cookieParser());

// --- Auth routes ---

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password required' });
  }
  if (password !== process.env.SITE_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  issueCookie(res);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  clearCookie(res);
  res.json({ ok: true });
});

// --- Entry API (all require auth) ---

app.get('/api/entries', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM entries ORDER BY site COLLATE NOCASE ASC').all();
  res.json(rows);
});

app.post('/api/entries', requireAuth, (req, res) => {
  const { site, password, name } = req.body || {};
  if (!site || !password || !name) {
    return res.status(400).json({ error: 'site, password, and name are required' });
  }
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO entries (site, password, updated_at, updated_by) VALUES (?, ?, ?, ?)')
    .run(String(site).trim(), String(password), now, String(name).trim());
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

app.patch('/api/entries/:id', requireAuth, (req, res) => {
  const { password, name, site } = req.body || {};
  if (!password || !name) {
    return res.status(400).json({ error: 'password and name are required' });
  }
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  const newSite = site ? String(site).trim() : existing.site;
  db.prepare('UPDATE entries SET site = ?, password = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(
    newSite,
    String(password),
    now,
    String(name).trim(),
    req.params.id
  );
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/entries/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Static assets ---
// No maxAge: browsers revalidate via ETag on every load (cheap 304s,
// no body) instead of caching for a day and missing future fixes.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Music Villa Vault listening on port ${PORT}`);
});
