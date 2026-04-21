require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);

function parseBoolean(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in environment. Point it to your PostgreSQL server.");
}

const dbSslEnabled = parseBoolean(process.env.DB_SSL, false);
const dbSslRejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: dbSslEnabled
    ? {
        rejectUnauthorized: dbSslRejectUnauthorized,
      }
    : undefined,
});

const footballBaseUrl = process.env.FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const f1BaseUrl = process.env.F1_BASE_URL || "https://v1.formula-1.api-sports.io";

let lastSyncStatus = {
  startedAt: null,
  finishedAt: null,
  football: { ok: false, count: 0, error: null },
  f1: { ok: false, count: 0, error: null, season: null },
};

let cachedF1Season = null;
let footballWindowSeeded = false;
let footballWindowDayAdvancedAt = null;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function toNorwegianStatusFromFootball(shortCode) {
  const liveCodes = new Set(["1H", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
  const doneCodes = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"]);
  if (liveCodes.has(shortCode)) return "Direkte";
  if (doneCodes.has(shortCode)) return "Ferdig";
  return "Kommende";
}

function toNorwegianStatusFromF1(status) {
  const lower = String(status || "").toLowerCase();
  if (lower.includes("completed") || lower.includes("finished")) return "Ferdig";
  if (lower.includes("in progress") || lower.includes("live")) return "Direkte";
  return "Kommende";
}

async function initDb() {
  // Én tabell for visningsdata på tvers av sportene gjør søk og listing enklere.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sports_events (
      id BIGSERIAL PRIMARY KEY,
      sport TEXT NOT NULL,
      external_id TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      search_text TEXT NOT NULL,
      display_data JSONB NOT NULL,
      source_payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (sport, external_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sports_events_sport_start_time ON sports_events (sport, start_time DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sports_events_updated_at ON sports_events (updated_at DESC)");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS f1_race_results_cache (
      race_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function fetchApi(baseUrl, endpoint, params = {}) {
  const url = new URL(endpoint, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": process.env.API_SPORTS_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}) ${url.pathname}: ${text}`);
  }

  return response.json();
}

async function upsertEvent(event) {
  // Vi oppdaterer eksisterende rad hvis samme sport/external_id allerede finnes.
  await pool.query(
    `
      INSERT INTO sports_events (
        sport,
        external_id,
        start_time,
        status,
        search_text,
        display_data,
        source_payload,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (sport, external_id)
      DO UPDATE SET
        start_time = EXCLUDED.start_time,
        status = EXCLUDED.status,
        search_text = EXCLUDED.search_text,
        display_data = EXCLUDED.display_data,
        source_payload = EXCLUDED.source_payload,
        updated_at = NOW()
    `,
    [
      event.sport,
      event.externalId,
      event.startTime,
      event.status,
      event.searchText,
      JSON.stringify(event.displayData),
      JSON.stringify(event.sourcePayload),
    ]
  );
}

function toIsoDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

async function saveFootballRows(rows) {
  for (const row of rows) {
    const fixtureId = row?.fixture?.id;
    if (!fixtureId) continue;

    const home = row?.teams?.home?.name || "Ukjent hjemmelag";
    const away = row?.teams?.away?.name || "Ukjent bortelag";
    const homeGoals = row?.goals?.home;
    const awayGoals = row?.goals?.away;
    const result = homeGoals == null || awayGoals == null ? "-" : `${homeGoals} - ${awayGoals}`;
    const shortStatus = row?.fixture?.status?.short || "NS";
    const status = toNorwegianStatusFromFootball(shortStatus);
    const startTid = row?.fixture?.date || new Date().toISOString();
    const hjemmeLogo = row?.teams?.home?.logo || "";
    const borteLogo = row?.teams?.away?.logo || "";
    const ligaLogo = row?.league?.logo || "";

    const displayData = {
      nummer: fixtureId,
      hjemme: home,
      borte: away,
      hjemmeLogo,
      borteLogo,
      resultat: result,
      status,
      startTid,
      liga: row?.league?.name || "",
      ligaLogo,
      land: row?.league?.country || "",
    };

    await upsertEvent({
      sport: "fotball",
      externalId: String(fixtureId),
      startTime: startTid,
      status,
      searchText: `${home} ${away} ${displayData.liga} ${displayData.land}`.toLowerCase(),
      displayData,
      sourcePayload: row,
    });
  }
}

async function syncFootballForDate(date) {
  const payload = await fetchApi(footballBaseUrl, "/fixtures", { date });
  const rows = payload.response || [];
  await replaceFootballRowsForDate(date, rows);
  return rows.length;
}

async function replaceFootballRowsForDate(date, rows) {
  const from = `${date}T00:00:00Z`;
  const toDate = new Date(`${date}T00:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const to = `${toIsoDateUtc(toDate)}T00:00:00Z`;

  await pool.query(
    `
      DELETE FROM sports_events
      WHERE sport = 'fotball'
      AND start_time >= $1::timestamptz
      AND start_time < $2::timestamptz
    `,
    [from, to]
  );

  await saveFootballRows(rows);
}

async function cleanupFootballWindow(now) {
  // Behold bare en rullerende 7-dagers buffer bakover og framover.
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 7);
  const toDate = new Date(now);
  toDate.setUTCDate(toDate.getUTCDate() + 7);
  const from = toIsoDateUtc(fromDate);
  const to = toIsoDateUtc(toDate);

  await pool.query(
    `
      DELETE FROM sports_events
      WHERE sport = 'fotball'
      AND (start_time < $1::timestamptz OR start_time > $2::timestamptz)
    `,
    [`${from}T00:00:00Z`, `${to}T23:59:59Z`]
  );
}

async function seedFootballWindow(now) {
  let count = 0;
  // Første sync fyller hele vinduet, slik at UI-et har både historikk og kommende kamper.
  for (let offset = -7; offset <= 7; offset += 1) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + offset);
    count += await syncFootballForDate(toIsoDateUtc(day));
  }
  footballWindowSeeded = true;
  footballWindowDayAdvancedAt = toIsoDateUtc(now);
  return count;
}

async function syncFootball() {
  const now = new Date();
  const today = toIsoDateUtc(now);
  let count = 0;

  if (!footballWindowSeeded) {
    count += await seedFootballWindow(now);
  } else {
    // Deretter holder vi bare dagens data varme på hver sync.
    count += await syncFootballForDate(today);

    if (footballWindowDayAdvancedAt !== today) {
      // Når datoen skifter, henter vi inn den nye +7-dagen i vinduet.
      const plus7 = new Date(now);
      plus7.setUTCDate(plus7.getUTCDate() + 7);
      count += await syncFootballForDate(toIsoDateUtc(plus7));
      footballWindowDayAdvancedAt = today;
    }
  }

  if (!footballWindowSeeded) {
    count += await syncFootballForDate(today);
  }

  await cleanupFootballWindow(now);

  return count;
}

async function resolveF1Season() {
  if (cachedF1Season) {
    return cachedF1Season;
  }

  // API-planen kan gi tilgang til ulike sesonger, så vi prøver kandidater til vi finner en som virker.
  const nowYear = new Date().getUTCFullYear();
  const candidates = [nowYear, nowYear - 1, nowYear - 2, nowYear - 3, 2024, 2023, 2022]
    .map((s) => Number(s))
    .filter((value, index, arr) => value >= 2022 && arr.indexOf(value) === index);

  for (const season of candidates) {
    const probe = await fetchApi(f1BaseUrl, "/races", { season });
    const hasPlanError = probe?.errors && Object.keys(probe.errors).length > 0;
    if (!hasPlanError && Array.isArray(probe.response) && probe.response.length > 0) {
      cachedF1Season = season;
      return season;
    }
  }

  throw new Error("Could not find an accessible F1 season for this API plan.");
}

async function syncF1() {
  const season = await resolveF1Season();
  const payload = await fetchApi(f1BaseUrl, "/races", { season });
  // Vi viser bare hovedløpene i dashboardet, ikke trening/kvalifisering.
  const rows = (payload.response || []).filter((race) => race?.type === "Race");

  for (const row of rows) {
    const raceId = row?.id;
    if (!raceId) continue;

    const raceName = row?.competition?.name || "Ukjent lop";
    const country = row?.competition?.location?.country || "";
    const city = row?.competition?.location?.city || "";
    const circuit = row?.circuit?.name || "";
    const status = toNorwegianStatusFromF1(row?.status);
    const startTid = row?.date || new Date().toISOString();

    const displayData = {
      nummer: raceId,
      lop: raceName,
      forer: "-",
      lag: circuit || "-",
      posisjon: row?.status || "-",
      tid: row?.fastest_lap?.time || "-",
      status,
      startTid,
      land: country,
      by: city,
      sesong: season,
    };

    await upsertEvent({
      sport: "f1",
      externalId: String(raceId),
      startTime: startTid,
      status,
      searchText: `${raceName} ${country} ${city} ${circuit}`.toLowerCase(),
      displayData,
      sourcePayload: row,
    });
  }

  return { count: rows.length, season };
}

async function getF1RaceResultsWithCache(raceId) {
  // Resultater endrer seg sjelden etter målgang, så vi cacher dem for å spare API-kall.
  const cacheResult = await pool.query(
    `
    SELECT payload, updated_at
    FROM f1_race_results_cache
    WHERE race_id = $1
    LIMIT 1
    `,
    [String(raceId)]
  );

  if (cacheResult.rows.length > 0) {
    const cached = cacheResult.rows[0];
    const cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    if (cacheAgeMs < twelveHoursMs) {
      return cached.payload || [];
    }
  }

  const apiResponse = await fetchApi(f1BaseUrl, "/rankings/races", { race: raceId });
  const rows = apiResponse.response || [];

  await pool.query(
    `
    INSERT INTO f1_race_results_cache (race_id, payload, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (race_id)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [String(raceId), JSON.stringify(rows)]
  );

  return rows;
}

async function syncAllSports() {
  lastSyncStatus.startedAt = new Date().toISOString();
  lastSyncStatus.finishedAt = null;

  try {
    const footballCount = await syncFootball();
    lastSyncStatus.football = { ok: true, count: footballCount, error: null };
  } catch (error) {
    lastSyncStatus.football = { ok: false, count: 0, error: error.message };
  }

  try {
    const f1 = await syncF1();
    lastSyncStatus.f1 = { ok: true, count: f1.count, error: null, season: f1.season };
  } catch (error) {
    lastSyncStatus.f1 = { ok: false, count: 0, error: error.message, season: null };
  }

  lastSyncStatus.finishedAt = new Date().toISOString();
}

async function listEventsBySport(sport, limit = 2000) {
  // Klamp limit for å unngå at klienten ber om urimelig store payloads.
  const safeLimit = Math.max(1, Math.min(Number(limit) || 2000, 5000));
  const result = await pool.query(
    `
      SELECT display_data, updated_at
      FROM sports_events
      WHERE sport = $1
      ORDER BY start_time ASC
      LIMIT $2
    `,
    [sport, safeLimit]
  );
  return result.rows.map((row) => ({
    ...row.display_data,
    hentet: row.updated_at,
  }));
}

app.get("/api/football/latest", async (req, res) => {
  try {
    const data = await listEventsBySport("fotball", req.query.limit);
    res.json({
      sport: "fotball",
      count: data.length,
      updatedAt: lastSyncStatus.finishedAt,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/f1/latest", async (req, res) => {
  try {
    const data = await listEventsBySport("f1", req.query.limit);
    res.json({
      sport: "f1",
      count: data.length,
      updatedAt: lastSyncStatus.finishedAt,
      season: lastSyncStatus.f1.season,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/search", async (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  if (query.length < 2) {
    // Unngå brede søk på enkeltbokstaver.
    return res.json({ fotball: [], f1: [] });
  }

  try {
    const result = await pool.query(
      `
      SELECT sport, display_data
      FROM sports_events
      WHERE search_text LIKE $1
      ORDER BY start_time DESC
      LIMIT 400
      `,
      [`%${query}%`]
    );

    const fotball = [];
    const f1 = [];

    for (const row of result.rows) {
      if (row.sport === "fotball") fotball.push(row.display_data);
      if (row.sport === "f1") f1.push(row.display_data);
    }

    res.json({ fotball, f1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sync-status", async (_req, res) => {
  res.json(lastSyncStatus);
});

app.get("/api/f1/results/:raceId", async (req, res) => {
  const raceId = String(req.params.raceId || "");
  if (!raceId) {
    return res.status(400).json({ error: "Missing race id." });
  }

  try {
    const rows = await getF1RaceResultsWithCache(raceId);
    const winner = rows.find((row) => Number(row?.position) === 1) || null;
    res.json({
      raceId,
      winner,
      count: rows.length,
      results: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/events/:sport/:id", async (req, res) => {
  const sportParam = String(req.params.sport || "").toLowerCase();
  const sport = sportParam === "football" ? "fotball" : sportParam;
  const externalId = String(req.params.id || "");

  if (!["fotball", "f1"].includes(sport) || !externalId) {
    return res.status(400).json({ error: "Invalid sport or id." });
  }

  try {
    const result = await pool.query(
      `
      SELECT sport, external_id, display_data, source_payload, updated_at
      FROM sports_events
      WHERE sport = $1 AND external_id = $2
      LIMIT 1
      `,
      [sport, externalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found." });
    }

    const row = result.rows[0];
    res.json({
      sport: row.sport,
      externalId: row.external_id,
      updatedAt: row.updated_at,
      displayData: row.display_data,
      sourcePayload: row.source_payload,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sync-now", async (_req, res) => {
  await syncAllSports();
  res.json({ ok: true, status: lastSyncStatus });
});

app.get("/api/health", (_req, res) => {
  pool
    .query("SELECT 1 AS ok")
    .then(() => {
      res.json({ ok: true, database: "connected" });
    })
    .catch((error) => {
      res.status(500).json({
        ok: false,
        database: "disconnected",
        error: error.message,
      });
    });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function startServer() {
  await pool.query("SELECT NOW()");
  await initDb();
  await syncAllSports();

  const runOnce = process.argv.includes("--sync-once");
  if (runOnce) {
    // Praktisk for manuell sync i terminal eller cron-jobb uten å starte webserveren.
    console.log("Sync completed (run once mode).");
    await pool.end();
    return;
  }

  cron.schedule("*/15 * * * *", syncAllSports);
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer().catch(async (error) => {
  console.error("Startup failed:", error);
  await pool.end();
  process.exit(1);
});
