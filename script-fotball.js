const sokInput = document.querySelector("#sokInput");
const sokHjelp = document.querySelector("#sokHjelp");
const idagKnapp = document.querySelector("#idagKnapp");
const alleKnapp = document.querySelector("#alleKnapp");
const idagRutenett = document.querySelector("#idagRutenett");
const andreRutenett = document.querySelector("#andreRutenett");
const idagAntall = document.querySelector("#idagAntall");
const andreAntall = document.querySelector("#andreAntall");

let visBareIDag = false;
let fotballKamper = [];
const API_BASE =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

function apiUrl(path) {
  return `${API_BASE}${path}`;
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

function tegn() {
  const sok = sokInput.value.trim().toLowerCase();
  const idagDato = new Date();

  if (sok.length === 1) {
    sokHjelp.classList.add("advarsel");
  } else {
    sokHjelp.classList.remove("advarsel");
  }

  const filtrert = fotballKamper.filter((kamp) => {
    // Før 2 tegn viser vi bare hele lista i stedet for å gjøre et veldig bredt søk.
    if (sok.length < 2) return true;
    const tekst = `${kamp.hjemme} ${kamp.borte} ${kamp.liga || ""} ${kamp.land || ""}`;
    return tekst.toLowerCase().includes(sok);
  });

  const idagListe = filtrert.filter((kamp) => sammeDag(new Date(kamp.startTid), idagDato));
  const andreListe = filtrert.filter((kamp) => !sammeDag(new Date(kamp.startTid), idagDato));

  idagRutenett.innerHTML = idagListe.map(fotballKort).join("");
  andreRutenett.innerHTML = andreListe.map(fotballKort).join("");

  if (visBareIDag) {
    // Skjul tidligere/kommende kamper uten å hente data på nytt.
    andreRutenett.innerHTML = "";
    andreAntall.textContent = "0";
  } else {
    andreAntall.textContent = String(andreListe.length);
  }

  idagAntall.textContent = String(idagListe.length);
}

async function lastKamper() {
  try {
    const response = await fetch(apiUrl("/api/football/latest?limit=2000"));
    if (!response.ok) throw new Error("Kunne ikke hente fotballdata.");
    const payload = await response.json();
    fotballKamper = payload.data || [];
    tegn();
  } catch (error) {
    idagRutenett.innerHTML = `<p class="tips advarsel">${error.message}</p>`;
    andreRutenett.innerHTML = "";
    idagAntall.textContent = "0";
    andreAntall.textContent = "0";
  }
}

sokInput.addEventListener("input", tegn);

idagKnapp.addEventListener("click", () => {
  visBareIDag = true;
  tegn();
});

alleKnapp.addEventListener("click", () => {
  visBareIDag = false;
  tegn();
});

lastKamper();
