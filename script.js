const sportVelger = document.querySelector("#sportVelger");
const limitVelger = document.querySelector("#limitVelger");
const sokInput = document.querySelector("#sokInput");
const sokHjelp = document.querySelector("#sokHjelp");
const idagKnapp = document.querySelector("#idagKnapp");
const alleKnapp = document.querySelector("#alleKnapp");
const idagRutenett = document.querySelector("#idagRutenett");
const andreRutenett = document.querySelector("#andreRutenett");
const idagTittel = document.querySelector("#idagTittel");
const andreTittel = document.querySelector("#andreTittel");
const idagAntall = document.querySelector("#idagAntall");
const andreAntall = document.querySelector("#andreAntall");

let visBareIDag = false;
const LIMIT_STORAGE_KEY = "liveSportsDashboard.limit";
let fotballKamper = [];
let f1Lop = [];
const API_BASE =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function debugInfo(message, extra) {
  if (extra !== undefined) {
    console.log(`[DEBUG][Forside] ${message}`, extra);
    return;
  }
  console.log(`[DEBUG][Forside] ${message}`);
}

function debugError(message, error) {
  console.error(`[DEBUG][Forside] ${message}`, error);
}

function lesLimit() {
  const valgt = Number(limitVelger?.value || 20);
  if (!Number.isFinite(valgt)) return 20;
  if (valgt !== 10 && valgt !== 20 && valgt !== 50) return 20;
  return valgt;
}

function antallTekst(vist, totalt) {
  if (vist < totalt) return `${vist}/${totalt}`;
  return String(totalt);
}

if (limitVelger) {
  // Husk brukerens sist valgte antall kort mellom sideoppdateringer.
  const lagret = Number(localStorage.getItem(LIMIT_STORAGE_KEY));
  if (Number.isFinite(lagret) && (lagret === 10 || lagret === 20 || lagret === 50)) {
    limitVelger.value = String(lagret);
  }
}

function sammeDag(a, b) {
  return a.toDateString() === b.toDateString();
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
      <div class="detalj liga-rad">
        <img class="liga-logo" src="${kamp.ligaLogo || ""}" alt="${kamp.liga || "Liga"}" onerror="this.style.display='none'" />
        <span>${kamp.liga || ""} ${kamp.land ? `(${kamp.land})` : ""}</span>
      </div>
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

function tegn() {
  const sport = sportVelger.value;
  const sok = sokInput.value.trim().toLowerCase();
  const idagDato = new Date();
  const limit = lesLimit();

  if (sok.length === 1) {
    sokHjelp.classList.add("advarsel");
  } else {
    sokHjelp.classList.remove("advarsel");
  }

  const data = sport === "fotball" ? fotballKamper : f1Lop;
  const filtrert = data.filter((element) => {
    // Vi lar korte søk passere uten filtrering for å unngå støy på 1 tegn.
    if (sok.length < 2) return true;
    const tekst =
      sport === "fotball"
        ? `${element.hjemme} ${element.borte} ${element.liga || ""}`
        : `${element.lop} ${element.forer} ${element.lag}`;
    return tekst.toLowerCase().includes(sok);
  });

  const idagListe = filtrert.filter((element) => sammeDag(new Date(element.startTid), idagDato));
  const andreListe = filtrert.filter((element) => !sammeDag(new Date(element.startTid), idagDato));
  const idagVis = idagListe.slice(0, limit);
  const andreVis = andreListe.slice(0, limit);

  if (sport === "fotball") {
    idagTittel.textContent = "Dagens kamper";
    andreTittel.textContent = "Tidligere og kommende kamper";
    idagRutenett.innerHTML = idagVis.map(fotballKort).join("");
    andreRutenett.innerHTML = andreVis.map(fotballKort).join("");
  } else {
    idagTittel.textContent = "Dagens lop";
    andreTittel.textContent = "Tidligere og kommende lop";
    idagRutenett.innerHTML = idagVis.map(f1Kort).join("");
    andreRutenett.innerHTML = andreVis.map(f1Kort).join("");
  }

  if (visBareIDag) {
    // Behold samme datasett, men skjul alt som ikke skjer i dag.
    andreRutenett.innerHTML = "";
    andreAntall.textContent = "0";
  } else {
    andreAntall.textContent = antallTekst(andreVis.length, andreListe.length);
  }

  idagAntall.textContent = antallTekst(idagVis.length, idagListe.length);

  debugInfo("Rendring fullfort", {
    sport,
    sok,
    visBareIDag,
    idag: idagListe.length,
    andre: visBareIDag ? 0 : andreListe.length,
    limit,
  });
}

async function lastData() {
  try {
    debugInfo("Starter lasting av data fra backend");
    const [fotballRes, f1Res] = await Promise.all([
      fetch(apiUrl("/api/football/latest?limit=2000")),
      fetch(apiUrl("/api/f1/latest?limit=250")),
    ]);
    if (!fotballRes.ok || !f1Res.ok) {
      throw new Error("Kunne ikke hente data fra backend.");
    }

    const [fotballPayload, f1Payload] = await Promise.all([fotballRes.json(), f1Res.json()]);
    fotballKamper = fotballPayload.data || [];
    f1Lop = f1Payload.data || [];
    debugInfo("Data lastet inn", {
      fotball: fotballKamper.length,
      f1: f1Lop.length,
    });
    tegn();
  } catch (error) {
    debugError("Feil ved lasting av data", error);
    idagRutenett.innerHTML = `<p class="tips advarsel">${error.message}</p>`;
    andreRutenett.innerHTML = "";
    idagAntall.textContent = "0";
    andreAntall.textContent = "0";
  }
}

sportVelger.addEventListener("change", () => {
  visBareIDag = false;
  debugInfo("Bruker byttet sport", sportVelger.value);
  tegn();
});

if (limitVelger) {
  limitVelger.addEventListener("change", () => {
    localStorage.setItem(LIMIT_STORAGE_KEY, String(lesLimit()));
    debugInfo("Bruker endret limit", lesLimit());
    tegn();
  });
}

sokInput.addEventListener("input", () => {
  debugInfo("Bruker skriver i sokefeltet", sokInput.value);
  tegn();
});

idagKnapp.addEventListener("click", () => {
  visBareIDag = true;
  debugInfo("Filter aktivert: bare i dag");
  tegn();
});

alleKnapp.addEventListener("click", () => {
  visBareIDag = false;
  debugInfo("Filter aktivert: vis alle");
  tegn();
});

debugInfo("Forside-script lastet");
lastData();
