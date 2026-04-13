# Live Sports Dashboard (Backend + DB)

This project now runs with:
- Backend: Node.js + Express
- Database: PostgreSQL
- Data sources: API-SPORTS Football + Formula-1
- Auto update: every 15 minutes

## 1) Prepare `.env`

Your local `.env` should contain:

```env
API_SPORTS_KEY=your_real_key
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/sportsdb
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
FOOTBALL_BASE_URL=https://v3.football.api-sports.io
F1_BASE_URL=https://v1.formula-1.api-sports.io
```

If you are using your own PostgreSQL server instead of Docker, replace `DATABASE_URL` with your server details.

Examples:

```env
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/sportsdb
DB_SSL=false

# Hosted PostgreSQL with SSL
DATABASE_URL=postgresql://myuser:mypassword@db.example.com:5432/sportsdb
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

Use `DB_SSL=true` when your provider requires TLS. If the provider gives you a CA certificate and wants full certificate validation, keep `DB_SSL_REJECT_UNAUTHORIZED=true`. If the provider explicitly says to allow self-signed certs, set it to `false`.

## 2) Start PostgreSQL

If you need a local PostgreSQL database, use Docker:

```bash
docker compose up -d
```

If you already have a running PostgreSQL server, skip this step.

## 3) Install dependencies

```bash
npm install
```

## 4) Start the app

```bash
npm start
```

Open:
- `http://localhost:3000` (website)
- `http://localhost:3000/api/sync-status` (sync info)

## 5) What the backend does

- Creates DB table automatically on startup (`sports_events`)
- Syncs Football fixtures from 7 days back to 7 days ahead
- Syncs Formula-1 races (auto-fallback to latest season your plan allows)
- Stores normalized display data in PostgreSQL
- Upserts on each sync (no duplicates)
- Runs sync every 15 minutes (`*/15 * * * *`)

Note:
- First startup seeds football data for the 15-day window (7 back, today, 7 ahead).
- Regular 15-minute sync then refreshes today plus one extra forward day once per new date.
- If your daily request quota is low, adjust sync frequency.

## 6) API routes

- `GET /api/football/latest?limit=250`
- `GET /api/f1/latest?limit=250`
- `GET /api/search?q=...`
- `GET /api/sync-status`
- `POST /api/sync-now`
- `GET /api/health`

## 7) Security note

- `.env` is git-ignored and should never be committed.
- If a key is exposed publicly, rotate it in API-SPORTS dashboard.
- If you switch to a hosted PostgreSQL service, store the exact connection string from your provider in `.env`.
