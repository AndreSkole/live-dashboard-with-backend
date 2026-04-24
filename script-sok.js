const sokInput = document.querySelector("#sokInput");
const sokHjelp = document.querySelector("#sokHjelp");
const fotballRutenett = document.querySelector("#fotballRutenett");
const f1Rutenett = document.querySelector("#f1Rutenett");
const fotballAntall = document.querySelector("#fotballAntall");
const f1Antall = document.querySelector("#f1Antall");

let timer = null;
const API_BASE =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function debugInfo(message, extra) {
  if (extra !== undefined) {
    console.log(`[DEBUG][Sok] ${message}`, extra);
    return;
  }
  console.log(`[DEBUG][Sok] ${message}`);
}

function debugError(message, error) {
  console.error(`[DEBUG][Sok] ${message}`, error);
}

function statusKlasse(tekst) {
  const lav = String(tekst || "").toLowerCase();
  if (lav.includes("direkte")) return "direkte";
  if (lav.includes("ferdig")) return "ferdig";
  return "kommende";
}

function tidTekst(datoVerdi) {
  const dato = new Date(datoVerdi);
  return `${dato.toLocaleDateString("no-NO", { day: "2-digit", month: "short" })} · ${dato.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}`;
}

function fotballKort(kamp) {
  return `
    <a class="kort-lenke" href="kamp.html?sport=fotball&id=${encodeURIComponent(kamp.nummer)}">
    <div class="kort">
      <div class="status ${statusKlasse(kamp.status)}">${kamp.status}</div>
      <div class="lag-rad">
        <div class="lag">
          <img class="lag-logo" src="${kamp.hjemmeLogo || ""}" alt="${kamp.hjemme}" onerror="this.style.display='none'" />
          <span>${kamp.hjemme}</span>
        </div>
        <span class="vs">vs</span>
        <div class="lag">
          <img class="lag-logo" src="${kamp.borteLogo || ""}" alt="${kamp.borte}" onerror="this.style.display='none'" />
          <span>${kamp.borte}</span>
        </div>
      </div>
      <div class="resultat">${kamp.resultat}</div>
      <div class="detalj">Start: ${tidTekst(kamp.startTid)}</div>
    </div>
    </a>
  `;
}

function f1Kort(lop) {
  return `
    <a class="kort-lenke" href="kamp.html?sport=f1&id=${encodeURIComponent(lop.nummer)}">
    <div class="kort">
      <div class="status ${statusKlasse(lop.status)}">${lop.status}</div>
      <h3>${lop.lop}</h3>
      <div class="resultat">${lop.forer} · ${lop.lag}</div>
      <div class="detalj">Posisjon/status: ${lop.posisjon}</div>
      <div class="detalj">Tid: ${lop.tid}</div>
      <div class="detalj">Start: ${tidTekst(lop.startTid)}</div>
    </div>
    </a>
  `;
}

function tegnResultater(fotball, f1) {
  fotballRutenett.innerHTML = fotball.map(fotballKort).join("");
  f1Rutenett.innerHTML = f1.map(f1Kort).join("");
  fotballAntall.textContent = String(fotball.length);
  f1Antall.textContent = String(f1.length);
  debugInfo("Resultater rendret", { fotball: fotball.length, f1: f1.length });
}

async function sokFraBackend() {
  const sok = sokInput.value.trim();
  if (sok.length === 1) {
    sokHjelp.classList.add("advarsel");
  } else {
    sokHjelp.classList.remove("advarsel");
  }

  if (sok.length < 2) {
    debugInfo("Sok avbrutt fordi teksten er for kort", { sok });
    tegnResultater([], []);
    return;
  }

  try {
    debugInfo("Starter sok mot backend", { sok });
    const response = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(sok)}`));
    if (!response.ok) throw new Error("Kunne ikke hente sokedata.");
    const payload = await response.json();
    debugInfo("Sok fullfort", {
      sok,
      fotball: (payload.fotball || []).length,
      f1: (payload.f1 || []).length,
    });
    tegnResultater(payload.fotball || [], payload.f1 || []);
  } catch (error) {
    debugError("Feil ved sok", error);
    fotballRutenett.innerHTML = `<p class="tips advarsel">${error.message}</p>`;
    f1Rutenett.innerHTML = "";
    fotballAntall.textContent = "0";
    f1Antall.textContent = "0";
  }
}

sokInput.addEventListener("input", () => {
  // Debounce begrenser antall kall mens brukeren skriver.
  if (timer) clearTimeout(timer);
  debugInfo("Bruker skriver i sokefeltet", sokInput.value);
  timer = setTimeout(sokFraBackend, 250);
});

debugInfo("Sokescript lastet");
tegnResultater([], []);
