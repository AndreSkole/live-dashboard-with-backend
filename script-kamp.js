const detaljTittel = document.querySelector("#detaljTittel");
const detaljInnhold = document.querySelector("#detaljInnhold");
const API_BASE =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function tidTekst(datoVerdi) {
  const dato = new Date(datoVerdi);
  return `${dato.toLocaleDateString("no-NO", { day: "2-digit", month: "short", year: "numeric" })} · ${dato.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderFotball(displayData, updatedAt) {
  detaljTittel.textContent = `${displayData.hjemme} vs ${displayData.borte}`;
  detaljInnhold.innerHTML = `
    <div class="kort detalj-kort">
      <div class="status">${displayData.status}</div>
      <div class="lag-rad">
        <div class="lag">
          <img class="lag-logo stor-logo" src="${displayData.hjemmeLogo || ""}" alt="${displayData.hjemme}" onerror="this.style.display='none'" />
          <span>${displayData.hjemme}</span>
        </div>
        <span class="vs">vs</span>
        <div class="lag">
          <img class="lag-logo stor-logo" src="${displayData.borteLogo || ""}" alt="${displayData.borte}" onerror="this.style.display='none'" />
          <span>${displayData.borte}</span>
        </div>
      </div>
      <div class="resultat">${displayData.resultat}</div>
      <div class="detalj">Start: ${tidTekst(displayData.startTid)}</div>
      <div class="detalj liga-rad">
        <img class="liga-logo" src="${displayData.ligaLogo || ""}" alt="${displayData.liga || "Liga"}" onerror="this.style.display='none'" />
        <span>${displayData.liga || ""} ${displayData.land ? `(${displayData.land})` : ""}</span>
      </div>
      <div class="detalj">Sist oppdatert i DB: ${tidTekst(updatedAt)}</div>
    </div>
  `;
}

function renderF1(displayData, updatedAt) {
  detaljTittel.textContent = displayData.lop || "F1 detalj";
  detaljInnhold.innerHTML = `
    <div class="kort detalj-kort">
      <div class="status">${displayData.status}</div>
      <h3>${displayData.lop || "-"}</h3>
      <div class="resultat">${displayData.forer || "-"} · ${displayData.lag || "-"}</div>
      <div class="detalj">Posisjon/status: ${displayData.posisjon || "-"}</div>
      <div class="detalj">Tid: ${displayData.tid || "-"}</div>
      <div class="detalj">Start: ${tidTekst(displayData.startTid)}</div>
      <div class="detalj">${displayData.land || ""} ${displayData.by ? `(${displayData.by})` : ""}</div>
      <div class="detalj">Sist oppdatert i DB: ${tidTekst(updatedAt)}</div>
      <div id="f1Winner" class="detalj"></div>
      <div id="f1Results"></div>
    </div>
  `;
}

function renderF1Results(payload) {
  const winnerEl = document.querySelector("#f1Winner");
  const resultsEl = document.querySelector("#f1Results");
  if (!winnerEl || !resultsEl) return;

  if (!payload || !Array.isArray(payload.results) || payload.results.length === 0) {
    winnerEl.textContent = "Ingen løpsresultater tilgjengelig.";
    return;
  }

  const winner = payload.winner;
  if (winner) {
    winnerEl.innerHTML = `Vinner: <strong>${winner.driver?.name || "-"}</strong> (${winner.team?.name || "-"})`;
  }

  const top = payload.results.slice(0, 10);
  // Vis bare topp 10 for å holde detaljsiden lett å skanne.
  const rows = top
    .map(
      (row) => `
      <tr>
        <td>${row.position ?? "-"}</td>
        <td>${row.driver?.name || "-"}</td>
        <td>${row.team?.name || "-"}</td>
        <td>${row.time || row.gap || "-"}</td>
        <td>${row.laps ?? "-"}</td>
      </tr>
    `
    )
    .join("");

  resultsEl.innerHTML = `
    <h3>Topp 10 resultat</h3>
    <div class="tabell-wrap">
      <table class="resultat-tabell">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Fører</th>
            <th>Team</th>
            <th>Tid/Gap</th>
            <th>Laps</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function lastDetalj() {
  const params = new URLSearchParams(window.location.search);
  const sport = params.get("sport");
  const id = params.get("id");

  if (!sport || !id) {
    detaljTittel.textContent = "Mangler parametere";
    detaljInnhold.innerHTML = `<p class="tips advarsel">URL må inneholde sport og id.</p>`;
    return;
  }

  try {
    const response = await fetch(apiUrl(`/api/events/${encodeURIComponent(sport)}/${encodeURIComponent(id)}`));
    if (!response.ok) throw new Error("Fant ikkje kamp/løp.");
    const payload = await response.json();

    if (payload.sport === "fotball") {
      renderFotball(payload.displayData, payload.updatedAt);
    } else {
      renderF1(payload.displayData, payload.updatedAt);
      // F1-resultatene lastes separat fordi de ofte er større og bare trengs på detaljsiden.
      const resultsResponse = await fetch(apiUrl(`/api/f1/results/${encodeURIComponent(payload.externalId || id)}`));
      if (resultsResponse.ok) {
        const resultsPayload = await resultsResponse.json();
        renderF1Results(resultsPayload);
      }
    }
  } catch (error) {
    detaljTittel.textContent = "Kunne ikkje laste detalj";
    detaljInnhold.innerHTML = `<p class="tips advarsel">${error.message}</p>`;
  }
}

lastDetalj();
