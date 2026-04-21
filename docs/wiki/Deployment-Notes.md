# Deployment Notes

## Runtime Behavior

- The backend must stay running for the site to work.
- The sync runs on startup and then every 15 minutes.
- If the process stops, the frontend will fail to load API data.

## Recommended Process Management

For a server deployment, use a process manager such as:

- `systemd`
- `pm2`

This avoids the app going down after logout, reboot or crashes.

## Health Checks

Use:

```bash
curl http://localhost:3000/api/health
```

If the backend is healthy, it returns:

```json
{"ok":true}
```

## Sync Checks

Use:

```bash
curl http://localhost:3000/api/sync-status
```

This shows:

- when the last sync started
- when it finished
- whether football sync succeeded
- whether F1 sync succeeded

## Common Issues

### Frontend shows `404` on `/api/...`

The page is probably being served from another port, such as `5500`, while the backend runs on `3000`.

### Frontend shows `ERR_CONNECTION_REFUSED`

The backend process is not running.

### Old football matches still appear as upcoming

This can happen when the API plan no longer returns older dates. The backend fix in `server.js` now replaces rows for each synced football date to prevent stale data from lingering.
