const sokInput = document.querySelector("#sokInput");
const sokHjelp = document.querySelector("#sokHjelp");
const idagKnapp = document.querySelector("#idagKnapp");
const alleKnapp = document.querySelector("#alleKnapp");
const idagRutenett = document.querySelector("#idagRutenett");
const andreRutenett = document.querySelector("#andreRutenett");
const idagAntall = document.querySelector("#idagAntall");
const andreAntall = document.querySelector("#andreAntall");

let visBareIDag = false;
let f1Lop = [];
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
      <div class="detalj">${lop.land || ""} ${lop.by ? `(${lop.by})` : ""}</div>
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

  const filtrert = f1Lop.filter((lop) => {
    if (sok.length < 2) return true;
    const tekst = `${lop.lop} ${lop.forer} ${lop.lag} ${lop.land || ""} ${lop.by || ""}`;
    return tekst.toLowerCase().includes(sok);
  });

  const idagListe = filtrert.filter((lop) => sammeDag(new Date(lop.startTid), idagDato));
  const andreListe = filtrert.filter((lop) => !sammeDag(new Date(lop.startTid), idagDato));

  idagRutenett.innerHTML = idagListe.map(f1Kort).join("");
  andreRutenett.innerHTML = andreListe.map(f1Kort).join("");

  if (visBareIDag) {
    andreRutenett.innerHTML = "";
    andreAntall.textContent = "0";
  } else {
    andreAntall.textContent = String(andreListe.length);
  }

  idagAntall.textContent = String(idagListe.length);
}

async function lastLop() {
  try {
    const response = await fetch(apiUrl("/api/f1/latest?limit=250"));
    if (!response.ok) throw new Error("Kunne ikke hente F1-data.");
    const payload = await response.json();
    f1Lop = payload.data || [];
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

lastLop();
