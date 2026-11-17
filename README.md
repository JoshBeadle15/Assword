# Music Villa Vault

A small internal password vault for Music Villa. One table: **Site/Username**, **Password**, **Last Updated** (date + who made the change). Anyone editing a password has to type their name, which gets stamped into that last column.

Built deliberately light for Railway's free tier: plain Express + SQLite (no separate database service), one small vanilla-JS bundle, no frontend framework, gzip compression on, and the only external request is a Google Fonts stylesheet (served from Google's CDN, not Railway's, so it doesn't count against Railway egress).

## Local setup

```bash
npm install
cp .env.example .env
# edit .env: set SITE_PASSWORD and SESSION_SECRET
npm start
```

Visit `http://localhost:3000`.

## Deploying to Railway

1. Push this folder to a GitHub repo (or use `railway up` from the CLI directly).
2. In Railway, create a new project from that repo. It auto-detects Node via Nixpacks — no Dockerfile needed.
3. **Add a Volume** and mount it at `/data`. Without this, the SQLite file lives in the container's ephemeral filesystem and gets wiped on every redeploy.
4. Set these environment variables on the service:
   - `SITE_PASSWORD` — the shared password your team types to open the vault.
   - `SESSION_SECRET` — a long random string. Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `DB_PATH` = `/data/passwords.db` (matches the volume mount path from step 3).
5. Deploy. Railway sets `PORT` automatically — the app already reads it.

## How password updates are tracked

- Adding a new site requires a name, which is stored as the creator.
- Editing a site's password also requires a name. On save, the server stamps `updated_at` (now) and `updated_by` (that name) — this is the data shown in the "Last Updated" column.
- There's no separate login per person — just the one shared vault password plus a typed name per change, as requested. If you ever want real per-person accounts or an audit log of every past change (not just the most recent), that's a bigger addition — ask and it can be built.

## Notes / things to keep in mind

- Passwords are stored in plaintext in the SQLite file, by design (the UI needs to display them). Treat the Railway volume and your `SITE_PASSWORD`/`SESSION_SECRET` as sensitive; don't commit `.env`.
- The login cookie is a signed, stateless token (HMAC with `SESSION_SECRET`) — no session store, so logins survive restarts, but changing `SESSION_SECRET` invalidates all existing logins.
- The look is a warm, vintage "guitar shop" palette (walnut/amber) meant to evoke Music Villa's branding — all colors live as CSS variables at the top of `public/style.css` if you want to retint it from an exact brand palette later.
