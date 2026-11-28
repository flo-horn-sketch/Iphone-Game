// Ladebildschirm für "Luftlinie": Vor dem Spiel liegen alle Grafiken und Dateien offline auf dem iPhone.
//
// Bei jedem Start fragt die App dateien.json ab (die Liste aller aktuellen Dateien mit Prüfsumme,
// erzeugt beim Veröffentlichen). Was fehlt oder sich geändert hat, wird geladen und im Cache
// "luftlinie-dateien" gespeichert. Der Service Worker (../sw.js) liefert es von dort, auch ohne Netz.
// Ohne Internet startet das Spiel, wenn alles schon da ist.
//
// Das Spiel wartet auf window.luftlinieBereit, bevor es startet. Sonst greift diese Datei nirgends ein.
// (Töne werden im Browser erzeugt, dafür gibt es keine Dateien.)
(function () {
  "use strict";

  const CACHE = "luftlinie-dateien";
  const STAND = "luftlinie-dateien-stand";
  const NEULADEN = "luftlinie-neu-geladen";
  const GLEICHZEITIG = 4;
  const VERSION = (document.querySelector('meta[name="luftlinie-version"]') || {}).content || "";
  const basis = new URL("../", location.href);

  let fertig;
  window.luftlinieBereit = new Promise((r) => { fertig = r; });

  // Flugzeuge in Airline-Lackierung (grafiken/lack/): Es gibt sie für viele Airlines, gebraucht wird nur die eigene.
  // Deshalb lädt die App nur die Bilder mit dem Kürzel der gespielten Airline (das Spiel merkt es in "luftlinie-lack").
  const LACK = "grafiken/lack/";
  const LACK_KEY = "luftlinie-lack";
  const meinLack = () => { try { return (localStorage.getItem(LACK_KEY) || "").toLowerCase(); } catch (e) { return ""; } };
  const gebraucht = (pfad) => !pfad.startsWith(LACK) || (!!meinLack() && pfad.endsWith("-" + meinLack() + ".png"));
  window.luftlinieLackLaden = () => Promise.resolve();

  // Wie im Spiel: Geladen wird nur in der App vom Home-Bildschirm (im Browser kommt die Installationsanleitung).
  function alsApp() {
    if (window.navigator.standalone === true) return true;
    if (window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches)) return true;
    try { if (localStorage.getItem("luftlinie-entwickler") === "1") return true; } catch (e) { /* egal */ }
    return false;
  }
  if (!alsApp() || !("caches" in window)) { fertig(); return; }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("sw.js", basis).href).catch(() => {});

  const lesen = () => { try { return JSON.parse(localStorage.getItem(STAND)) || null; } catch (e) { return null; } };
  const merken = (s) => { try { localStorage.setItem(STAND, JSON.stringify(s)); } catch (e) { /* egal */ } };
  const adresse = (pfad) => new URL(pfad, basis).href;
  const mb = (b) => (b / 1e6).toLocaleString("de-DE", { maximumFractionDigits: b < 1e7 ? 1 : 0 });

  // ---------- Bildschirm ----------
  let schirm = null, balken = null, zeile = null, titel = null, knoepfe = null;
  function zeigen() {
    if (schirm) return;
    const css = document.createElement("style");
    css.textContent = `
.laden { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  background: radial-gradient(circle at 50% 30%, #173A55, #0A1828); color: #EAF2F8; font-family: Outfit, system-ui, sans-serif; text-align: center; padding: 20px; }
.laden img { width: 72px; height: 72px; border-radius: 16px; box-shadow: 0 6px 24px rgba(0,0,0,.5); }
.laden h1 { margin: 0; font-size: 20px; font-weight: 800; }
.laden .leiste { width: min(360px, 80vw); height: 10px; border-radius: 5px; background: rgba(255,255,255,.12); overflow: hidden; }
.laden .leiste i { display: block; height: 100%; width: 0; background: #F2C14E; border-radius: 5px; transition: width .2s; }
.laden .zeile { font-size: 13px; color: #9FB3C3; min-height: 1.3em; }
.laden .knoepfe { display: flex; gap: 10px; }
.laden button { font: inherit; font-weight: 800; border: 0; border-radius: 10px; padding: 9px 18px; background: #F2C14E; color: #1a1205; }
.laden button.neben { background: rgba(255,255,255,.12); color: #EAF2F8; }`;
    document.head.appendChild(css);
    schirm = document.createElement("div");
    schirm.className = "laden";
    schirm.innerHTML = '<img src="../app-icon-180.png" alt=""><h1>Airlines wird vorbereitet</h1><div class="leiste"><i></i></div><div class="zeile">Prüfe Grafiken …</div><div class="knoepfe"></div>';
    document.body.appendChild(schirm);
    titel = schirm.querySelector("h1"); balken = schirm.querySelector(".leiste i"); zeile = schirm.querySelector(".zeile"); knoepfe = schirm.querySelector(".knoepfe");
  }
  function weg() { if (schirm) schirm.remove(); schirm = null; }
  function knopf(text, neben, wenn) {
    const b = document.createElement("button");
    b.textContent = text;
    if (neben) b.className = "neben";
    b.onclick = wenn;
    knoepfe.appendChild(b);
  }
  function problem(text, mitSpielen) {
    zeigen();
    titel.textContent = "Keine Verbindung";
    zeile.textContent = text;
    knoepfe.innerHTML = "";
    knopf("Nochmal versuchen", false, () => { knoepfe.innerHTML = ""; titel.textContent = "Airlines wird vorbereitet"; pruefen(); });
    if (mitSpielen) knopf("Trotzdem spielen", true, () => { weg(); fertig(); });
  }

  // ---------- Prüfen und Laden ----------
  async function pruefen() {
    // Kurz warten, ehe der Bildschirm erscheint: Ist alles schon da, merkt man nichts davon.
    const uhr = setTimeout(zeigen, 400);
    let liste = null, offline = false;
    try {
      const r = await fetch(adresse("dateien.json") + "?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) liste = await r.json();
      else if (r.status !== 404) offline = true;
    } catch (e) { offline = true; }
    const cache = await caches.open(CACHE);
    const vorhanden = new Set((await cache.keys()).map((q) => q.url.split("?")[0]));
    let stand = lesen() || { version: null, hashes: {} };

    if (!liste) {
      clearTimeout(uhr);
      // Zum Entwickeln (keine Liste auf dem Server): einfach starten.
      if (!offline && !stand.version) { weg(); fertig(); return; }
      // Ohne Netz: starten, wenn der letzte Stand vollständig ist.
      const fehlt = Object.keys(stand.hashes).filter((p) => !vorhanden.has(adresse(p)));
      if (stand.version && !fehlt.length) { weg(); fertig(); return; }
      problem(stand.version ? `Es fehlen noch ${fehlt.length} Dateien. Dafür braucht Airlines einmal Internet.` : "Beim ersten Start braucht Airlines einmal Internet, um alle Grafiken zu laden.", !!stand.version);
      return;
    }

    const alle = liste.dateien;
    liste.dateien = alle.filter((d) => gebraucht(d.pfad));
    const zuLaden = liste.dateien.filter((d) => stand.hashes[d.pfad] !== d.hash || !vorhanden.has(adresse(d.pfad)));
    const gesamt = zuLaden.reduce((s, d) => s + d.groesse, 0);
    let geladen = 0, stueck = 0;
    const fehler = [];
    const anzeigen = () => {
      if (!schirm) return;
      balken.style.width = (gesamt ? Math.round(geladen / gesamt * 100) : 100) + "%";
      zeile.textContent = `${stueck} von ${zuLaden.length} Dateien · ${mb(geladen)} von ${mb(gesamt)} MB`;
    };
    if (zuLaden.length) { zeigen(); titel.textContent = stand.version ? "Neue Grafiken werden geladen" : "Airlines wird geladen"; anzeigen(); }

    async function holen(d) {
      for (let versuch = 0; versuch < 3; versuch++) {
        try {
          // "laden" im Link: am Service Worker vorbei, direkt vom Server (und an keinem alten Zwischenspeicher hängen bleiben).
          const r = await fetch(adresse(d.pfad) + "?laden=" + d.hash, { cache: "no-store" });
          if (!r.ok) throw new Error(r.status);
          await cache.put(adresse(d.pfad), r);
          stand.hashes[d.pfad] = d.hash;
          return true;
        } catch (e) { await new Promise((ok) => setTimeout(ok, 600 * (versuch + 1))); }
      }
      return false;
    }
    let naechste = 0;
    async function arbeiter() {
      while (naechste < zuLaden.length) {
        const d = zuLaden[naechste++];
        if (await holen(d)) { geladen += d.groesse; stueck++; if (stueck % 5 === 0) merken(stand); }
        else fehler.push(d);
        anzeigen();
      }
    }
    await Promise.all(Array.from({ length: GLEICHZEITIG }, arbeiter));
    clearTimeout(uhr);

    if (fehler.length) {
      merken(stand);
      const codeDa = liste.dateien.filter((d) => /\.(html|js)$/.test(d.pfad)).every((d) => stand.hashes[d.pfad]);
      problem(`${fehler.length} Dateien konnten nicht geladen werden.`, codeDa);
      return;
    }
    // Alte Dateien, die es nicht mehr gibt, wegräumen.
    const aktuell = new Set(alle.map((d) => adresse(d.pfad)));
    for (const q of await cache.keys()) if (!aktuell.has(q.url.split("?")[0])) cache.delete(q);
    stand = { version: liste.version, hashes: Object.fromEntries(liste.dateien.map((d) => [d.pfad, d.hash])) };
    merken(stand);

    // Neue Spielversion geladen, aber hier läuft noch die alte: einmal neu starten (nur einmal pro Version).
    if (VERSION && !VERSION.startsWith("__") && liste.version !== VERSION) {
      let schonMal = null;
      try { schonMal = sessionStorage.getItem(NEULADEN); sessionStorage.setItem(NEULADEN, liste.version); } catch (e) { /* egal */ }
      if (schonMal !== liste.version) { location.replace(location.pathname + "?v=" + encodeURIComponent(liste.version)); return; }
    }
    weg();
    fertig();
  }
  // Neue Airline gewählt: ihre Flugzeugbilder im Hintergrund nachladen, ohne das Spiel aufzuhalten.
  window.luftlinieLackLaden = async (kurz) => {
    try {
      localStorage.setItem(LACK_KEY, String(kurz || "").toLowerCase());
      const r = await fetch(adresse("dateien.json") + "?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      const liste = await r.json();
      const cache = await caches.open(CACHE);
      const stand = lesen() || { version: null, hashes: {} };
      for (const d of liste.dateien) {
        if (!d.pfad.startsWith(LACK) || !gebraucht(d.pfad) || stand.hashes[d.pfad] === d.hash) continue;
        const a = await fetch(adresse(d.pfad) + "?laden=" + d.hash, { cache: "no-store" });
        if (!a.ok) continue;
        await cache.put(adresse(d.pfad), a);
        stand.hashes[d.pfad] = d.hash;
        merken(stand);
      }
    } catch (e) { /* ohne Netz bleibt es beim neutralen Flugzeug */ }
  };
  pruefen().catch(() => { weg(); fertig(); });
})();
