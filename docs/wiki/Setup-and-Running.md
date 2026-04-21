# Setup and Running

## Requirements

- Node.js
- npm
- PostgreSQL
- An API-SPORTS key

## Environment Variables

Create a `.env` file with values like:

```env
API_SPORTS_KEY=your_key
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/sportsdb
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
FOOTBALL_BASE_URL=https://v3.football.api-sports.io
F1_BASE_URL=https://v1.formula-1.api-sports.io
```

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/api/sync-status`

## Notes

- On startup, the backend initializes tables and runs an immediate sync.
- The frontend can be served by Express on port `3000`.
- If you open the HTML files from another local dev server, the frontend scripts are configured to call the backend on port `3000`.

