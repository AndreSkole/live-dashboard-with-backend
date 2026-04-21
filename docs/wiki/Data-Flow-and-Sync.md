# Data Flow and Sync

## Data Flow

1. The frontend requests data from `/api/...` routes.
2. The backend reads and writes normalized event rows in PostgreSQL.
3. The backend sync job fetches fresh data from API-SPORTS.
4. The frontend renders backend data, not raw third-party API responses.

## Football Sync

Football data is stored in a rolling date window.

- First sync seeds a window from 7 days back to 7 days forward.
- Regular sync refreshes today's data.
- When the date changes, the backend also fetches the new `+7` day.
- Cleanup removes football rows outside the rolling window.

## Important Fix

Football rows for a specific date are now replaced during sync, not just upserted.

Why this matters:

- Some API plans do not return older dates.
- If the API returns zero rows for a date, stale rows can otherwise remain in the database.
- Replacing rows for the synced date prevents old matches from showing as fake upcoming fixtures.

## F1 Sync

- The backend resolves the newest accessible season for the active API plan.
- Only race events are stored in the dashboard list.
- Race result details are cached separately for 12 hours.

## Useful Endpoints

- `GET /api/football/latest`
- `GET /api/f1/latest`
- `GET /api/search?q=...`
- `GET /api/events/:sport/:id`
- `GET /api/f1/results/:raceId`
- `GET /api/sync-status`
- `POST /api/sync-now`

