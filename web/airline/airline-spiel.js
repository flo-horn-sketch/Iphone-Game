// Oberfläche von "Luftlinie". Alle Regeln stehen in airline-logik.js, die Karte in airline-karte.js.
//
// Aufbau: Die Karte ist zum Schauen da. Neue Linien entstehen nur im Linien-Editor (✏️).
// Flugzeuge kauft man zusammen mit einem Flug. Unten steht immer genau ein Ziel.
(function () {
  "use strict";

  const L = window.AirLogik;
  const K = window.AirKarte;
  const SPEICHER = "luftlinie-v3";
  const SPEICHER_ALT = "luftlinie-v2";
  const EINFUEHRUNG = "luftlinie-einfuehrung-v3";
  const RIVALEN_AN = "luftlinie-rivalen";
  let FELD_B = 844, FELD_H = 390;    // wächst mit dem Bildschirm; die Bedienung bleibt im sicheren Bereich 844 × 390
  const SEK_PRO_STUNDE = 2.5;          // ein Tag dauert eine Minute
  const SVG = "http://www.w3.org/2000/svg";
  const TEMPI = [0, 1, 2, 4];

  const feld = document.getElementById("feld");
  const rahmen = document.getElementById("rahmen");

  // ---------- Kleinkram ----------
  function skalieren() {
    const cs = getComputedStyle(rahmen);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const W = rahmen.clientWidth, H = rahmen.clientHeight;
    // Die Bedienung passt in den sicheren Bereich (ohne Kamera-Insel und Home-Balken), die Karte füllt den ganzen Bildschirm.
    ui.skala = Math.max(0.2, Math.min((W - pl - pr) / 844, (H - pt - pb) / 390));
    FELD_B = W / ui.skala; FELD_H = H / ui.skala;
    feld.style.width = FELD_B + "px"; feld.style.height = FELD_H + "px";
    feld.style.transform = `scale(${ui.skala})`;
    // Ränder in Spielfeld-Pixeln; dazu kommt Luft, damit die Bedienung mittig im sicheren Bereich sitzt.
    const extraB = (FELD_B - (pl + pr) / ui.skala - 844) / 2;
    feld.style.setProperty("--sl", pl / ui.skala + extraB + "px");
    feld.style.setProperty("--sr", pr / ui.skala + extraB + "px");
    feld.style.setProperty("--st", pt / ui.skala + "px");
    feld.style.setProperty("--sb", pb / ui.skala + "px");
    const svg = document.getElementById("karte");
    if (svg) { svg.setAttribute("viewBox", `0 0 ${FELD_B} ${FELD_H}`); const hg = svg.querySelector("rect"); if (hg) { hg.setAttribute("width", FELD_B); hg.setAttribute("height", FELD_H); } }
  }
  function el(tag, props, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") for (const [sk, sv2] of Object.entries(v)) { if (sk.startsWith("--")) e.style.setProperty(sk, sv2); else e.style[sk] = sv2; }
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "text") e.replaceChildren(...mitIcons(v));
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kind of kinder.flat(Infinity)) {
      if (kind == null || kind === false) continue;
      if (kind.nodeType) e.append(kind); else e.append(...mitIcons(kind));
    }
    return e;
  }
  function sv(tag, props) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    return e;
  }
  function rivalenLesen() {
    const w = lesen(RIVALEN_AN, {});
    if (w === true) return { k: true, s: true, a: true };   // alter Schalter: alle an
    return w && typeof w === "object" ? w : {};
  }
  function lesen(schluessel, ersatz) {
    try { const roh = localStorage.getItem(schluessel); return roh ? JSON.parse(roh) : ersatz; } catch (e) { return ersatz; }
  }
  function schreiben(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch (e) { /* ohne Speicher spielbar */ }
  }
  // Geld kurz und lesbar: 1,2 Mio · 85 Tsd · 900
  function geld(x, vorzeichen) {
    const v = Math.round(x);
    const s = vorzeichen && v > 0 ? "+" : v < 0 ? "−" : "";
    const a = Math.abs(v);
    let t;
    if (a >= 1e6) t = (a / 1e6).toLocaleString("de-DE", { maximumFractionDigits: a >= 1e8 ? 0 : 1 }) + " Mio";
    else if (a >= 1e4) t = Math.round(a / 1e3).toLocaleString("de-DE") + " Tsd";
    else t = a.toLocaleString("de-DE");
    return s + t;
  }
  function kurz(x) {
    const a = Math.abs(x);
    if (a >= 1000 && a < 10000) return (x > 0 ? "+" : "−") + (a / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k";
    return geld(x, true).replace(" Tsd", "k").replace(" Mio", "M");
  }
  const farbeGewinn = (g) => (g > 2000 ? "#4ADE80" : g < -2000 ? "#F87171" : "#FACC15");

  // ---------- Bilder ----------
  // Jedes Bild hat einen festen Namen (siehe BILDER-AUFTRAG.md, Abschnitt Luftlinie).
  const dateien = new Set();
  function bild(name) { return dateien.has(name + ".png") ? "../grafiken/" + name + ".png" : null; }
  // Flugzeuge in der Lackierung der eigenen Airline: grafiken/lack/air-flugzeug-<typ>-<kürzel>.png.
  // Gibt es das Bild (noch) nicht, erscheint das neutrale Flugzeug.
  const lack = new Set();
  const lackKurz = () => (st && st.airlines[L.SPIELER].kurz ? st.airlines[L.SPIELER].kurz.toLowerCase() : "");
  function flugzeugBild(typ, ersatz) {
    const n = "air-flugzeug-" + typ + "-" + lackKurz() + ".png";
    if (!lackKurz() || !lack.has(n)) return bildEl("air-flugzeug-" + typ, ersatz);
    const img = el("img", { src: "../grafiken/lack/" + n, alt: "" });
    const neutral = bild("air-flugzeug-" + typ);
    img.onerror = () => { img.onerror = null; if (neutral) img.src = neutral; };
    return img;
  }
  function lackMerken() {
    try { localStorage.setItem("luftlinie-lack", lackKurz()); } catch (e) { /* egal */ }
    if (lackKurz() && window.luftlinieLackLaden) window.luftlinieLackLaden(lackKurz());
  }
  function bildEl(name, ersatz) {
    const pfad = bild(name);
    return pfad ? el("img", { src: pfad, alt: "" }) : ersatz != null ? el("span", { class: "ersatz", text: ersatz }) : null;
  }
  // ---------- Eigene Symbole ----------
  // Jedes Symbol im Spiel ist ein eigenes Bild (ico-*.png, malt ChatGPT, siehe BILDER-AUFTRAG.md).
  // Bis das Bild da ist, steht das Zeichen als Platzhalter in einem festen Kästchen gleicher Größe.
  const ICONS = {
    "✏": "stift", "🛒": "store", "✈": "flugzeug", "🛩": "propeller", "🛫": "start", "🛬": "landung", "⚔": "duell", "🔥": "mode",
    "▲": "hoch", "▼": "runter", "📈": "trend-hoch", "📉": "trend-runter", "🎪": "messe", "☀": "sonne", "⛷": "ski", "🌴": "palme", "🌧": "regen",
    "🌱": "fruehling", "🍂": "herbst", "❄": "winter", "🎟": "landerecht", "🔨": "hammer", "📣": "ankuendigung", "🏛": "versteigerung",
    "🤝": "aufkauf", "💬": "angebot", "✋": "nein", "✊": "streik", "⛈": "sturm", "⛽": "kerosin", "⬇": "pfeil-runter", "⬆": "pfeil-hoch", "🔻": "billiger", "🔺": "teurer",
    "👥": "rivalen", "🏁": "rennen", "🏆": "pokal", "🥇": "gold", "🥈": "silber", "🥉": "bronze", "⏳": "sanduhr", "⏱": "stoppuhr",
    "📋": "bericht", "🎯": "ziel", "🎁": "geschenk", "👔": "geschaeft", "🏖": "urlaub", "🎫": "ticket", "💸": "kosten", "💰": "kasse",
    "💶": "preis", "🪙": "muenze", "🏦": "bank", "🍽": "essen", "🥂": "premium", "🧳": "koffer", "💺": "sitz", "📏": "reichweite",
    "👩": "crew", "🔁": "umsteiger", "🔄": "neu", "⭐": "stern", "★": "stern", "☆": "stern-leer", "🏳": "aufgeben", "🏗": "ausbau",
    "🔎": "lupe", "🔬": "gruendlich", "⚡": "schnell", "➕": "extra", "🛡": "sicher", "🎲": "risiko", "✅": "ok", "✨": "beste",
    "🔒": "schloss", "⚠": "warnung", "🌍": "welt", "🗓": "kalender", "📰": "zeitung", "💥": "pleite", "📖": "regeln", "🏠": "heimat", "❗": "hinweis", "📊": "statistik", "🏢": "verwaltung", "📺": "werbung", "📤": "teilen", "📲": "homescreen",
    "🔊": "ton-an", "🔇": "ton-aus", "🎵": "musik",
  };
  const ICON_RE = new RegExp("(" + Object.keys(ICONS).join("|") + ")[\\uFE0F\\u200D\\u2708]*", "gu");
  function icon(zeichen) {
    const name = ICONS[zeichen];
    const pfad = name && bild("ico-" + name);
    if (pfad) return el("img", { class: "ico", src: pfad, alt: "" });
    const e = document.createElement("span");
    e.className = "ico ico-ersatz";
    e.textContent = zeichen;
    return e;
  }
  function textSetzen(e, t) { if (e._t !== t) { e._t = t; e.replaceChildren(...mitIcons(t)); } }
  // Text in Stücke zerlegen: normale Wörter bleiben Text, bekannte Zeichen werden Symbole.
  function mitIcons(text) {
    const s = String(text);
    ICON_RE.lastIndex = 0;
    if (!ICON_RE.test(s)) return [s];
    const teile = [];
    let rest = 0;
    ICON_RE.lastIndex = 0;
    for (const m of s.matchAll(ICON_RE)) {
      if (m.index > rest) teile.push(s.slice(rest, m.index));
      teile.push(icon(m[1]));
      rest = m.index + m[0].length;
    }
    if (rest < s.length) teile.push(s.slice(rest));
    return teile;
  }
  // Symbol auf der Karte (SVG): Bild, wenn vorhanden, sonst das Zeichen.
  function svIcon(zeichen, x, y, groesse, props) {
    const name = ICONS[zeichen.replace(/[️]/g, "")];
    const pfad = name && bild("ico-" + name);
    if (pfad) return sv("image", { href: pfad, x: x - groesse / 2, y: y - groesse / 2, width: groesse, height: groesse, class: props && props.class });
    return sv("text", Object.assign({ x, y: y + groesse * 0.35, "font-size": groesse, "text-anchor": "middle", text: zeichen }, props));
  }
  const TYP_TEXT = {
    libelle: "Sparsamer Propeller für kurze Strecken und Zubringer.", dash8: "Schnellerer Propeller, etwas mehr Plätze.",
    crj900: "Kleiner Jet für mittlere Städte.", falke: "Der Allrounder für Europa.", a220: "Leise und sparsam, kommt bis über den Atlantik.",
    b737: "Das Arbeitstier der Billigflieger.", a320: "Der Klassiker für volle Strecken in Europa.", kranich: "Viele Plätze, schafft den Atlantik.",
    albatros: "Sparsamer Großraumjet für lange Strecken.", a350: "Noch etwas größer, fliegt am weitesten.", b777: "Riesig, für die vollsten Langstrecken.", a380: "Der Doppelstock-Riese für die größten Drehkreuze.",
  };
  const TYP_ICON = new Proxy({ libelle: "🛩️", dash8: "🛩️", a380: "🛫", albatros: "🛫", a350: "🛫", b777: "🛫" }, { get: (o, k) => o[k] || "✈️" });
  const CHEF = { k: "air-chef-kontinentia", s: "air-chef-spatzflug", a: "air-chef-aurelia" };
  const KLASSE = { 3: "Weltdrehkreuz", 2: "Großflughafen", 1: "Regionalflughafen" };
  const GRUND = { reichweite: "zu weit", geld: "Zu wenig Geld", slots: "Kein Slot frei", gesperrt: "Noch gesperrt", zeit: "Die Zeiten passen nicht", gleich: "Start und Ziel sind gleich" };

  // ---------- Zustand ----------
  let st = null;
  const ui = {
    rivalen: rivalenLesen(),             // welche Rivalen-Linien auf der Karte zu sehen sind, z. B. { k: true }
    skala: 1, tempo: 0, kamera: { x: 0, y: 0, z: 1 }, zMin: 0.5,
    tafel: null, stadt: null, route: null, slot: null, flug: null, tafelWahl: null,
    editor: null,          // { start, ziel, linie, typ, stufe }
    heimat: false, modal: false, letzterAbschluss: null,
  };
  let einf = lesen(EINFUEHRUNG, { gesehen: {} });
  einf.gesehen = einf.gesehen || {};
  function gesehen(id) { if (einf.gesehen[id]) return true; einf.gesehen[id] = true; schreiben(EINFUEHRUNG, einf); return false; }

  function speichern() { if (st && !st.ende) schreiben(SPEICHER, st); }
  const ich = () => st.airlines[L.SPIELER];

  // ---------- Karte ----------
  const stadtXY = {};
  for (const s of L.ALLE) stadtXY[s.id] = K.projektion(s.lon, s.lat);
  // Ausschnitt: die ganze Welt, oder die Gegend um eine Stadt.
  function gegend(id) {
    const nah = L.ALLE.filter((c) => L.entfernung(id, c.id) < 2200);
    const xs = nah.map((c) => stadtXY[c.id][0]), ys = nah.map((c) => stadtXY[c.id][1]);
    return { x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, y0: Math.min(...ys) - 22, y1: Math.max(...ys) + 18 };
  }
  function kameraPassend(r) {
    r = r || { x0: 0, x1: K.B, y0: 60, y1: K.H - 120 };
    const z = Math.min((FELD_B - 20) / (r.x1 - r.x0), (FELD_H - 70) / (r.y1 - r.y0));
    ui.kamera = { z, x: FELD_B / 2 - ((r.x0 + r.x1) / 2) * z, y: 44 + (FELD_H - 70) / 2 - ((r.y0 + r.y1) / 2) * z };
    ui.zMin = Math.min(z * 0.9, (FELD_B - 20) / K.B);
  }
  kameraPassend();

  let karte = null;
  // Das Land einmal auf den Kartenrand zuschneiden (statt clip-path, siehe unten).
  let landCache = null;
  function landZugeschnitten() {
    if (landCache) return landCache;
    const teile = [];
    for (const stueck of K.land.split(/(?=M)/)) {
      let pts = (stueck.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).reduce((a, v, i, arr) => (i % 2 ? a : a.concat([[v, arr[i + 1]]])), []);
      for (const [innen, schnitt] of [
        [(p) => p[0] >= 0, (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]],
        [(p) => p[0] <= K.B, (a, b) => [K.B, a[1] + (b[1] - a[1]) * (K.B - a[0]) / (b[0] - a[0])]],
        [(p) => p[1] >= 0, (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0]],
        [(p) => p[1] <= K.H, (a, b) => [a[0] + (b[0] - a[0]) * (K.H - a[1]) / (b[1] - a[1]), K.H]],
      ]) {
        const neu = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
          if (innen(b)) { if (!innen(a)) neu.push(schnitt(a, b)); neu.push(b); }
          else if (innen(a)) neu.push(schnitt(a, b));
        }
        pts = neu;
        if (!pts.length) break;
      }
      if (pts.length > 2) teile.push("M" + pts.map((q) => Math.round(q[0] * 10) / 10 + " " + Math.round(q[1] * 10) / 10).join("L") + "Z");
    }
    landCache = teile.join("");
    return landCache;
  }

  function karteBauen() {
    const svg = sv("svg", { id: "karte", viewBox: `0 0 ${FELD_B} ${FELD_H}` });
    const defs = sv("defs");
    const verlauf = sv("radialGradient", { id: "meerlicht", cx: "50%", cy: "35%", r: "75%" });
    verlauf.append(sv("stop", { offset: "0%", "stop-color": "#173A55" }), sv("stop", { offset: "100%", "stop-color": "#0A1828" }));
    defs.append(verlauf);
    svg.append(defs, sv("rect", { x: 0, y: 0, width: FELD_B, height: FELD_H, fill: "url(#meerlicht)" }));
    const g = sv("g");
    // Ohne clip-path: Safari verliert den Verweis nach dem Wiederöffnen der Homescreen-App, dann fehlt das Land.
    const landG = sv("g", { class: "landschaft" });
    const netz = sv("g", { class: "netz" });
    for (let x = 0; x <= K.B; x += 50) netz.append(sv("line", { x1: x, y1: 0, x2: x, y2: K.H }));
    for (let y = 0; y <= K.H; y += 50) netz.append(sv("line", { x1: 0, y1: y, x2: K.B, y2: y }));
    landG.append(netz, sv("path", { class: "land", d: landZugeschnitten() }), sv("path", { class: "grenze", d: K.grenzen }));
    g.append(landG);
    const fremd = sv("g"), routen = sv("g"), staedte = sv("g"), namen = sv("g"), schilder = sv("g"), flieger = sv("g"), symbole = sv("g"), effekte = sv("g");
    g.append(fremd, routen, flieger, staedte, namen, schilder, symbole, effekte);
    svg.append(g);
    feld.append(svg);
    karte = { svg, g, fremd, routen, staedte, namen, schilder, flieger, symbole, effekte, fliegerEls: new Map() };
    gestenAn(svg);
    kameraSetzen();
  }

  function kameraBegrenzen(c) {
    const r = { x0: -40, x1: K.B + 40, y0: -40, y1: K.H + 40 };
    c.z = Math.max(ui.zMin, Math.min(6, c.z));
    c.x = Math.min(FELD_B - 60 - r.x0 * c.z, Math.max(60 - r.x1 * c.z, c.x));
    c.y = Math.min(FELD_H - 60 - r.y0 * c.z, Math.max(60 - r.y1 * c.z, c.y));
    return c;
  }
  function kameraSetzen() {
    const c = kameraBegrenzen(ui.kamera);
    if (karte.svg.style.transform) karte.svg.style.transform = "";
    karte.g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) scale(${c.z.toFixed(4)})`);
    karteZeichnen();
  }
  // Die Karte zeigt genau einmal die ganze Welt. Über den Pazifik geht es am Rand hinaus und auf der anderen Seite weiter.
  function strecke(a, b) {
    const [x1, y1] = stadtXY[a];
    let [x2, y2] = stadtXY[b];
    if (x2 - x1 > K.B / 2) x2 -= K.B; else if (x1 - x2 > K.B / 2) x2 += K.B;
    return [x1, y1, x2, y2];
  }
  const umlauf = (x) => ((x % K.B) + K.B) % K.B;
  // Eine Linie, bei Bedarf zweimal (einmal an jedem Kartenrand).
  function linieSv(gruppe, a, b, props) {
    const [x1, y1, x2, y2] = strecke(a, b);
    const versatz = x2 < 0 ? [0, K.B] : x2 > K.B ? [0, -K.B] : [0];
    for (const v of versatz) gruppe.append(sv("line", { ...props, x1: x1 + v, y1, x2: x2 + v, y2 }));
  }
  function mitteVon(a, b) { const [x1, y1, x2, y2] = strecke(a, b); return [umlauf((x1 + x2) / 2), (y1 + y2) / 2]; }
  const bildschirm = (id) => { const [x, y] = stadtXY[id]; return [x * ui.kamera.z + ui.kamera.x, y * ui.kamera.z + ui.kamera.y]; };

  // Wischen verschiebt, zwei Finger zoomen, kurzes Tippen wählt aus.
  function gestenAn(svg) {
    const zeiger = new Map();
    let start = null, bewegt = false;
    const punkt = (e) => {
      const r = feld.getBoundingClientRect();
      return { x: (e.clientX - r.left) / ui.skala, y: (e.clientY - r.top) / ui.skala };
    };
    // Während der Geste wird nur das fertige Bild verschoben und gezoomt (flüssig, die Grafikkarte macht das).
    // Erst wenn die Finger weg sind, wird die Karte neu gezeichnet.
    let vorschau = null;
    const vorschauSetzen = (c) => {
      kameraBegrenzen(c);
      const b = ui.kamera, k = c.z / b.z;
      vorschau = c;
      feld.classList.add("geste");
      svg.style.transform = `translate3d(${(c.x - k * b.x).toFixed(1)}px, ${(c.y - k * b.y).toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
    };
    const vorschauFertig = () => {
      if (!vorschau) return;
      Object.assign(ui.kamera, vorschau);
      vorschau = null;
      feld.classList.remove("geste");
      kameraSetzen();
    };
    svg.addEventListener("pointerdown", (e) => {
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      zeiger.set(e.pointerId, punkt(e));
      bewegt = false;
      start = { kamera: { ...(vorschau || ui.kamera) }, punkte: [...zeiger.values()].map((p) => ({ ...p })), ziel: e.target };
    });
    svg.addEventListener("pointermove", (e) => {
      if (!zeiger.has(e.pointerId) || !start) return;
      zeiger.set(e.pointerId, punkt(e));
      const pts = [...zeiger.values()];
      if (pts.length !== start.punkte.length) start = { kamera: { ...(vorschau || ui.kamera) }, punkte: pts.map((p) => ({ ...p })), ziel: null };
      const c = { ...start.kamera };
      if (pts.length === 1) {
        const dx = pts[0].x - start.punkte[0].x, dy = pts[0].y - start.punkte[0].y;
        if (Math.abs(dx) + Math.abs(dy) > 6) bewegt = true;
        if (!bewegt) return;
        c.x = start.kamera.x + dx; c.y = start.kamera.y + dy;
      } else {
        bewegt = true;
        const [a, b] = pts, [a0, b0] = start.punkte;
        const d = Math.hypot(a.x - b.x, a.y - b.y), d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mx0 = (a0.x + b0.x) / 2, my0 = (a0.y + b0.y) / 2;
        const z = Math.max(ui.zMin, Math.min(6, start.kamera.z * d / d0));
        const wx = (mx0 - start.kamera.x) / start.kamera.z, wy = (my0 - start.kamera.y) / start.kamera.z;
        c.z = z; c.x = mx - wx * z; c.y = my - wy * z;
      }
      vorschauSetzen(c);
    });
    svg.addEventListener("pointerup", (e) => {
      if (!zeiger.has(e.pointerId)) return;
      zeiger.delete(e.pointerId);
      if (zeiger.size === 0) vorschauFertig();
      if (!bewegt && zeiger.size === 0 && start && start.ziel) tippen(start.ziel);
    });
    svg.addEventListener("pointercancel", (e) => { zeiger.delete(e.pointerId); bewegt = true; if (zeiger.size === 0) vorschauFertig(); });
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = punkt(e);
      const z = Math.max(ui.zMin, Math.min(6, ui.kamera.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const wx = (p.x - ui.kamera.x) / ui.kamera.z, wy = (p.y - ui.kamera.y) / ui.kamera.z;
      ui.kamera.z = z; ui.kamera.x = p.x - wx * z; ui.kamera.y = p.y - wy * z;
      kameraSetzen();
    }, { passive: false });
  }

  function tippen(ziel) {
    const t = ziel.closest ? ziel.closest("[data-stadt],[data-route],[data-gel],[data-duell],[data-slot]") : null;
    if (ui.heimat) { if (t && t.dataset.stadt && L.HEIMAT.includes(t.dataset.stadt)) heimatGewaehlt(t.dataset.stadt); return; }
    if (t && t.dataset.gel) { zeigeGelegenheit(t.dataset.gel); return; }
    if (t && t.dataset.slot && !ui.editor) { zeigeSlot(t.dataset.slot); return; }
    if (t && t.dataset.duell && !ui.editor) { zeigeDuell(t.dataset.duell); return; }
    if (ui.editor) { editorTippen(t); return; }
    if (!t) { tafelZu(); return; }
    if (t.dataset.route) zeigeRoute(t.dataset.route);
    else zeigeStadt(t.dataset.stadt);
  }

  // Im Editor: Wie gut wäre eine Linie vom Start zu jeder Stadt? (grün, gelb, grau)
  let heatCache = null;
  function heatmap() {
    const e = ui.editor;
    if (!e || !e.start || e.linie) return null;
    const key = e.start + "|" + st.stand + "|" + L.tagVon(st);
    if (heatCache && heatCache.key === key) return heatCache.werte;
    const p = ich();
    const alle = Object.keys(L.TYPEN).filter((t) => L.typFrei(st, p, t));
    const eigene = [...new Set(p.flotte.map((f) => f.typ))];
    const hatStart = L.enden(st, p, e.start).length > 0;
    const werte = {};
    for (const c of L.staedte(st)) {
      if (c.id === e.start) continue;
      let best = null;
      const km = L.entfernung(e.start, c.id);
      if (hatStart && L.enden(st, p, c.id).length) {
        // Nicht jeden Typ durchrechnen: die eigenen und die zwei kleinsten, die es schaffen.
        const passend = alle.filter((t) => L.TYPEN[t].reichweite >= km);
        const typen = [...new Set([...eigene.filter((t) => passend.includes(t)), ...passend.slice(0, 2)])];
        for (const typ of typen) {
          const t = L.flugFinden(st, L.SPIELER, e.start, c.id, typ);
          if (!t.plan) continue;
          const g = L.schaetzen(st, L.SPIELER, e.start, c.id, typ, t.plan.e1.h, t.plan.e2.h, !t.kosten.frei).gewinn;
          if (best == null || g > best) best = g;
        }
      }
      werte[c.id] = best == null ? "grau" : best > 12000 ? "gruen" : best > 0 ? "gelb" : "rot";
    }
    heatCache = { key, werte };
    return werte;
  }
  const HEAT = { gruen: "#4ADE80", gelb: "#FACC15", rot: "#F87171", grau: "#5B6B78" };

  // Alles Statische der Karte. Flieger kommen jedes Bild neu.
  function karteZeichnen() {
    if (!karte) return;
    const z = ui.kamera.z, s = 1 / z;
    for (const g of [karte.fremd, karte.routen, karte.staedte, karte.namen, karte.schilder, karte.symbole]) g.replaceChildren();
    const sichtbar = (ui.heimat ? L.ALLE.filter((c) => L.HEIMAT.includes(c.id)) : st ? L.staedte(st) : L.ALLE).slice().sort((x, y) => y.k - x.k);
    const p = st && ich();
    const rg = st ? L.rechnung(st) : null;
    const tag = st ? L.tagVon(st) : 1;
    const sai = L.saison(tag);
    const fokus = ui.editor ? ui.editor.start : ui.stadt;
    // Rivalen: alle Linien dünn in ihrer Farbe, wenn der Schalter an ist. Sonst nur rund um die gewählte Stadt.
    if (st && (fokus || Object.values(ui.rivalen).some(Boolean))) {
      for (const aid of ["k", "s", "a"]) {
        const a = st.airlines[aid];
        for (const r of a.routen) {
          if (r.a !== fokus && r.b !== fokus) {
            if (ui.rivalen[aid]) linieSv(karte.fremd, r.a, r.b, { stroke: a.farbe, "stroke-width": 1.2 * s, "stroke-opacity": 0.55, "stroke-linecap": "round" });
            continue;
          }
          linieSv(karte.fremd, r.a, r.b, { stroke: a.farbe, "stroke-width": 1.4 * s, "stroke-opacity": 0.7, "stroke-dasharray": `${4 * s} ${3 * s}` });
        }
      }
    }
    // Eigene Linien: Farbe = Gewinn, Dicke = Flugzeuge. Zahl nur an den drei besten und drei schlechtesten.
    const belegt = [];
    const frei = (x, y, w, h) => {
      const sx = x * z + ui.kamera.x, sy = y * z + ui.kamera.y, sw = w * z, sh = h * z;
      if (belegt.some((b) => Math.abs(b.x - sx) < (b.w + sw) / 2 + 2 && Math.abs(b.y - sy) < (b.h + sh) / 2 + 1)) return false;
      belegt.push({ x: sx, y: sy, w: sw, h: sh });
      return true;
    };
    const belegen = (x, y, w, h) => belegt.push({ x: x * z + ui.kamera.x, y: y * z + ui.kamera.y, w: w * z, h: h * z });
    const schildPos = {};
    if (p) {
      const mit = p.routen.map((r) => ({ r, e: rg.routen[r.id] })).filter((x) => x.e);
      const sortiert = mit.slice().sort((x, y) => y.e.gewinn - x.e.gewinn);
      const zahlen = new Set(sortiert.length <= 6 ? sortiert.map((x) => x.r.id) : sortiert.slice(0, 3).concat(sortiert.slice(-3)).map((x) => x.r.id));
      const aktiv = ui.route || (ui.editor && ui.editor.linie);
      if (aktiv) zahlen.add(aktiv);
      // Kurzer Zustand für Linien, um die man sich kümmern sollte: immer beschriftet.
      const zustand = {};
      for (const { r, e } of mit) {
        if (!e.flugzeuge || tag - (r.seit || 0) < 2) continue;
        if (e.gewinn + e.zubringer < 0) zustand[r.id] = "Verlust";
        else if (e.auslastung < 0.45) zustand[r.id] = "fast leer";
        if (zustand[r.id]) zahlen.add(r.id);
      }
      const verlust = new Set(st.letzterTag ? st.letzterTag.routen.filter((x) => x.gewinn + x.zubringer < 0).map((x) => x.id) : []);
      for (const { r, e } of mit) {
        const farbe = farbeGewinn(e.gewinn + e.zubringer);
        const gewaehlt = aktiv === r.id;
        const breite = (1.6 + Math.min(6, e.flugzeuge) * 0.9) * s * (mit.length > 20 ? 0.6 : 1);   // viele Linien: dünner, damit es ruhig bleibt
        linieSv(karte.routen, r.a, r.b, { stroke: "#06101a", "stroke-width": breite + 2 * s, "stroke-linecap": "round", "stroke-opacity": 0.6 });
        linieSv(karte.routen, r.a, r.b, { stroke: gewaehlt ? "#FFFFFF" : farbe, "stroke-width": breite, "stroke-linecap": "round", class: verlust.has(r.id) ? "blinken" : null, opacity: ui.editor && !gewaehlt ? 0.45 : 1 });
        linieSv(karte.routen, r.a, r.b, { stroke: "transparent", "stroke-width": 16 * s, "data-route": r.id });
      }
      for (const { r, e } of sortiert) {
        if (!zahlen.has(r.id)) continue;
        const [mx, my] = mitteVon(r.a, r.b);
        const farbe = farbeGewinn(e.gewinn + e.zubringer);
        const text = kurz(e.gewinn) + (zustand[r.id] ? " · " + zustand[r.id] : "");
        const w = (text.length * 5.6 + 8) * s, h = 13 * s;
        if (!frei(mx, my, w, h)) continue;
        schildPos[r.id] = { mx, my, w };
        const schild = sv("g", { class: "preis-schild", "data-route": r.id });
        const farbeZ = zustand[r.id] === "Verlust" ? "#F87171" : zustand[r.id] ? "#FB923C" : farbe;
        schild.append(sv("rect", { x: mx - w / 2, y: my - h / 2, width: w, height: h, rx: h / 2, stroke: farbeZ, "stroke-width": (zustand[r.id] ? 1.4 : 0.8) * s }));
        schild.append(sv("text", { x: mx, y: my + 0.5 * s, fill: farbeZ, "font-size": 9.5 * s, text }));
        karte.schilder.append(schild);
      }
    }
    // Preiskampf ⚔️ und Trend-Pfeile auf deinen Linien.
    if (p && !ui.editor) {
      const punktAuf = (a, b, t) => { const [x1, y1, x2, y2] = strecke(a, b); return [umlauf(x1 + (x2 - x1) * t), y1 + (y2 - y1) * t]; };
      // Freien Platz auf der Linie suchen, damit Zeichen nichts verdecken.
      const freierPunkt = (a, b, ts) => { for (const t of ts) { const q = punktAuf(a, b, t); if (frei(q[0], q[1], 18 * s, 18 * s)) return q; } const q = punktAuf(a, b, ts[0]); belegen(q[0], q[1], 18 * s, 18 * s); return q; };
      for (const r of p.routen) {
        if (r.duell) {
          // Neben das Zahlenschild, nie darauf.
          const sp = schildPos[r.id];
          const [dx, dy] = sp ? [sp.mx - sp.w / 2 - 10 * s, sp.my] : freierPunkt(r.a, r.b, [0.68, 0.55, 0.8, 0.42]);
          if (sp) belegen(dx, dy, 18 * s, 18 * s);
          const grp = sv("g", { "data-duell": r.id, class: "huepfen" });
          grp.append(sv("circle", { cx: dx, cy: dy, r: 8.5 * s, fill: "rgba(9,18,28,.92)", stroke: st.airlines[r.duell.gegen].farbe, "stroke-width": 1.4 * s }));
          grp.append(svIcon("⚔️", dx, dy, 10 * s));
          karte.schilder.append(grp);
        }
        const hw = !r.duell && (p.hinweise || []).find((h) => h.id === r.id);
        if (hw) {
          const sp = schildPos[r.id];
          const [hx, hy] = sp ? [sp.mx + sp.w / 2 + 10 * s, sp.my] : freierPunkt(r.a, r.b, [0.5, 0.38, 0.62, 0.28, 0.72]);
          if (sp) belegen(hx, hy, 18 * s, 18 * s);
          const grp = sv("g", { "data-route": r.id, class: "huepfen" });
          grp.append(sv("circle", { cx: hx, cy: hy, r: 8 * s, fill: "rgba(9,18,28,.92)", stroke: "#FB923C", "stroke-width": 1.4 * s }));
          grp.append(svIcon("❗", hx, hy, 9 * s));
          karte.schilder.append(grp);
        }
        const t = L.trendVon(st, r.a, r.b);
        if (t) {
          const [tx, ty] = punktAuf(r.a, r.b, 0.32);
          if (frei(tx, ty, 12 * s, 12 * s)) karte.schilder.append(svIcon(t === 2 ? "🔥" : t > 0 ? "▲" : "▼", tx, ty, 10 * s, { class: "trendpfeil", fill: t > 0 ? "#4ADE80" : "#F87171", "stroke-width": 2.4 * s }));
        }
      }
    }
    // Der Tipp eines Assistenten: betroffene Linie leuchtet, neue Strecke gestrichelt.
    const tp = p && !ui.editor ? L.tipp(st) : null;
    if (tp && tp.art !== "bieten") {
      const r = tp.route && p.routen.find((x) => x.id === tp.route);
      if (r) linieSv(karte.routen, r.a, r.b, { stroke: "#F2C14E", "stroke-width": 6 * s, opacity: 0.45, "stroke-linecap": "round", class: "puls" });
      else if (tp.start && tp.ziel) linieSv(karte.routen, tp.start, tp.ziel, { stroke: "#F2C14E", "stroke-width": 2.4 * s, "stroke-dasharray": `${5 * s} ${4 * s}`, "stroke-linecap": "round", opacity: 0.9 });
    }
    // Vorschläge für die erste Linie (solange die Tafel offen ist).
    if (p && ui.tafel === "angebote" && ui.angebote) {
      for (const o of ui.angebote) linieSv(karte.routen, p.basis, o.ziel, { stroke: "#F2C14E", "stroke-width": 2.4 * s, "stroke-dasharray": `${5 * s} ${4 * s}`, "stroke-linecap": "round", opacity: 0.85 });
    }
    // Geplante Linie im Editor.
    if (ui.editor && ui.editor.start && ui.editor.ziel) {
      linieSv(karte.routen, ui.editor.start, ui.editor.ziel, { stroke: "#F2C14E", "stroke-width": 3 * s, "stroke-dasharray": `${6 * s} ${4 * s}`, "stroke-linecap": "round" });
    }
    const heat = st ? heatmap() : null;
    const hubs = p ? new Set(L.drehkreuze(p)) : new Set();
    const meineOrte = p ? new Set(p.routen.flatMap((r) => [r.a, r.b])) : new Set();
    const messen = st ? new Set(st.messen.filter((m) => tag >= m.von - 1 && tag <= m.bis).map((m) => m.stadt)) : new Set();
    for (const c of sichtbar) {
      const [x, y] = stadtXY[c.id];
      const g = sv("g", { "data-stadt": c.id });
      const r = (c.k === 3 ? 6 : c.k === 2 ? 4.6 : 3.4) * s;
      g.append(sv("circle", { cx: x, cy: y, r: Math.max(r, 11 * s), fill: "transparent" }));
      if (ui.heimat && L.HEIMAT.includes(c.id)) g.append(sv("circle", { cx: x, cy: y, r: r * 2.2, fill: SCHWER_FARBE[L.SCHWIERIGKEIT[c.id]] || "#F2C14E", class: "puls", opacity: 0.6 }));
      if (heat && heat[c.id]) {
        const f = HEAT[heat[c.id]];
        g.append(sv("circle", { cx: x, cy: y, r: r + 5 * s, fill: f, opacity: heat[c.id] === "grau" ? 0.15 : 0.35 }));
        g.append(sv("circle", { cx: x, cy: y, r: r + 5 * s, fill: "none", stroke: f, "stroke-width": 1.6 * s, opacity: heat[c.id] === "grau" ? 0.4 : 1 }));
      }
      const eigen = p && meineOrte.has(c.id);
      if (p && (hubs.has(c.id) || p.basis === c.id)) g.append(sv("circle", { cx: x, cy: y, r: r + 3.2 * s, fill: "none", stroke: "#F2C14E", "stroke-width": 1.6 * s }));
      if (p && L.ausgebaut(p, c.id)) g.append(sv("circle", { cx: x, cy: y, r: r + 6 * s, fill: "none", stroke: "#F2C14E", "stroke-width": 1.2 * s }));
      const ct = st && !ui.heimat ? L.stadtTrend(st, c.id) : 0;
      if (ct && z > 0.6) g.append(svIcon(ct > 0 ? "▲" : "▼", x + r * 0.6, y - r - 4 * s, 8 * s, { class: "trendpfeil", fill: ct > 0 ? "#4ADE80" : "#F87171", "stroke-width": 2 * s }));
      if (fokus === c.id || (ui.editor && ui.editor.ziel === c.id)) g.append(sv("circle", { cx: x, cy: y, r: r + 7 * s, fill: "none", stroke: "#fff", "stroke-width": 1.6 * s, class: "puls" }));
      const fuell = eigen ? p.farbe : c.k === 3 ? "#EAF2F8" : c.k === 2 ? "#C5D6E2" : "#93A9B8";
      g.append(sv("circle", { cx: x, cy: y, r, fill: fuell, class: "stadt-punkt", "stroke-width": 1.2 * s }));
      const zeigeName = ui.heimat ? L.HEIMAT.includes(c.id) : (ui.tafel === "angebote" && ui.angebote && ui.angebote.some((o) => o.ziel === c.id)) || (c.k === 3 && z > 0.6) || (c.k === 2 && z > 1.4) || z > 2.4 || fokus === c.id || (ui.editor && ui.editor.ziel === c.id) || eigen || (heat && heat[c.id] === "gruen");
      const nameB = c.name.length * (c.k === 3 ? 5.6 : 4.9) * s;
      const muss = fokus === c.id || (ui.editor && ui.editor.ziel === c.id) || (ui.tafel === "angebote" && ui.angebote && ui.angebote.some((o) => o.ziel === c.id));
      if (zeigeName && (muss || frei(x + r + 2.5 * s + nameB / 2, y, nameB, 9 * s))) {
        karte.namen.append(sv("text", { x: x + r + 2.5 * s, y: y + 3.2 * s, class: "stadt-name", "font-size": (c.k === 3 ? 10.5 : 9) * s, "stroke-width": 2.6 * s, text: c.name }));
        // Startwahl: unter der Stadt steht die Airline, die du dort führst, in der Farbe des Starts (leicht, mittel).
        const sw = ui.heimat && L.SCHWIERIGKEIT[c.id];
        const heim = ui.heimat && L.heimAirline(c.id);
        if (heim) karte.namen.append(sv("text", { x: x + r + 2.5 * s, y: y + 12 * s, class: "stadt-name", "font-size": 7.5 * s, "stroke-width": 2.2 * s, fill: SCHWER_FARBE[sw] || "#EAF2F8", text: heim.name }));
      }
      let zeichen = null;
      if (messen.has(c.id)) zeichen = "🎪";
      else if ((c.t === "sonne" && sai.sonne > 1.2) || (c.t === "sued" && sai.sued > 1.2) || (c.t === "tropen" && sai.tropen > 1.2)) zeichen = "☀️";
      else if (c.t === "schnee" && sai.schnee > 1.2) zeichen = "⛷️";
      if (zeichen && !ui.heimat && z > 0.7) g.append(svIcon(zeichen, x - r - 4.5 * s, y - r - 4 * s, 9 * s));
      karte.staedte.append(g);
    }
    // Goldene Ringe: Hier wird gerade ein Slot vergeben, den du nutzen könntest. Höchstens fünf, die lohnendsten.
    if (p && !ui.heimat && !ui.editor) {
      for (const { s: sl } of slotRinge().slice(0, 5)) {
        const [x, y] = stadtXY[sl.stadt];
        const grp = sv("g", { "data-slot": sl.id });
        grp.append(sv("circle", { cx: x, cy: y, r: 13 * s, fill: "rgba(242,193,78,.14)", stroke: "#F2C14E", "stroke-width": 2 * s, class: "puls" }));
        grp.append(sv("circle", { cx: x, cy: y, r: 16 * s, fill: "transparent" }));
        const text = uhr(sl.h) + (sl.gebote[L.SPIELER] ? " ✓" : "");
        const w = (text.length * 5.4 + 18) * s, by = y + 21 * s;
        grp.append(sv("rect", { x: x - w / 2, y: by - 6.5 * s, width: w, height: 13 * s, rx: 6.5 * s, fill: "rgba(8,16,24,.9)", stroke: "#F2C14E", "stroke-width": 0.9 * s }));
        grp.append(svIcon("🎟️", x - w / 2 + 8 * s, by, 8 * s));
        grp.append(sv("text", { x: x + 5 * s, y: by + 3.2 * s, "font-size": 9 * s, "font-weight": 800, "text-anchor": "middle", fill: "#F2C14E", text }));
        karte.schilder.append(grp);
      }
    }
    symboleZeichnen();
    beraterZeigen();
  }

  // Gelegenheiten als Symbol an der Stadt, mit ablaufendem Ring.
  const GEL_ICON = { messe: "🎪", plan: "📣", slotangebot: "💬", streik: "✊", sturm: "⛈️", kerosin: "⛽" };
  const gelIcon = (g) => GEL_ICON[g.art === "wahl" ? g.typ : g.art];
  function gelegenheitOrt(g) { return g.stadt || (g.art === "wahl" ? ich().basis : null); }
  function symboleZeichnen() {
    if (!karte || !st) return;
    karte.symbole.replaceChildren();
    const s = 1 / ui.kamera.z;
    for (const g of st.gelegenheiten) {
      const ort = gelegenheitOrt(g);
      if (!ort || !gelIcon(g)) continue;
      const [x, y] = stadtXY[ort];
      const cx = x + 12 * s, cy = y - 14 * s, r = 9 * s;
      const grp = sv("g", { "data-gel": g.id, class: g.info ? "" : "huepfen" });
      grp.append(sv("circle", { cx, cy, r: r + 2 * s, fill: "rgba(9,18,28,.92)", stroke: g.info ? "#9FB4C4" : "#F2C14E", "stroke-width": 1 * s }));
      const umfang = 2 * Math.PI * (r + 2 * s);
      const rest = Math.max(0, (g.bis - st.zeit) / g.dauer);
      grp.append(sv("circle", { cx, cy, r: r + 2 * s, fill: "none", stroke: "#F2C14E", "stroke-width": 2 * s, "stroke-dasharray": `${umfang * rest} ${umfang}`, transform: `rotate(-90 ${cx} ${cy})`, class: "uhrring" }));
      grp.append(svIcon(gelIcon(g), cx, cy, 10 * s));
      karte.symbole.append(grp);
    }
  }
  function ringeAktualisieren() {
    if (!karte) return;
    for (const grp of karte.symbole.children) {
      const g = st.gelegenheiten.find((x) => x.id === grp.dataset.gel);
      const ring = grp.querySelector(".uhrring");
      if (!g || !ring) continue;
      const r = parseFloat(ring.getAttribute("r"));
      const umfang = 2 * Math.PI * r;
      ring.setAttribute("stroke-dasharray", `${umfang * Math.max(0, (g.bis - st.zeit) / g.dauer)} ${umfang}`);
    }
  }

  const FLIEGER_FORM = "M6 0 L1 -1.2 L-1 -5 L-2.4 -5 L-1.2 -1.2 L-4 -1 L-5 -2.4 L-6 -2.4 L-5.2 0 L-6 2.4 L-5 2.4 L-4 1 L-1.2 1.2 L-2.4 5 L-1 5 L1 1.2 Z";
  // Symbolgröße nach Sitzen: ATR 72 klein, A380 gut doppelt so groß.
  function groesseFlieger(typ) {
    const t = L.TYPEN[typ];
    if (!t) return 1;
    return 0.7 + 0.9 * Math.sqrt(Math.max(0, Math.min(1, (t.sitze - 70) / 505)));
  }
  function fliegerZeichnen() {
    if (!karte || !st) return;
    const s = 1 / ui.kamera.z;
    const da = new Set();
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const eigen = aid === L.SPIELER;
      for (const f of a.flotte) {
        const pos = L.position(st, aid, f);
        if (!pos) continue;
        const [x1, y1, x2, y2] = strecke(pos.r.a, pos.r.b);
        const x = umlauf(x1 + (x2 - x1) * pos.anteil), y = y1 + (y2 - y1) * pos.anteil;
        let winkel = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        if (!pos.hin) winkel += 180;
        let e = karte.fliegerEls.get(f.id);
        if (!e) {
          e = sv("path", { d: FLIEGER_FORM, class: "flieger", fill: a.farbe, stroke: "#06101a", "stroke-width": 0.8 });
          karte.flieger.append(e);
          karte.fliegerEls.set(f.id, e);
        }
        e.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${winkel.toFixed(1)}) scale(${((eigen ? 1.25 : 0.75) * groesseFlieger(f.typ) * s).toFixed(3)})`);
        e.setAttribute("opacity", pos.amBoden ? 0 : eigen ? 1 : 0.55);
        da.add(f.id);
      }
    }
    for (const [id, e] of karte.fliegerEls) if (!da.has(id)) { e.remove(); karte.fliegerEls.delete(id); }
  }

  function landungZeigen(l) {
    if (!karte || document.hidden) return;
    const s = 1 / ui.kamera.z;
    const [x, y] = stadtXY[l.stadt];
    const t = sv("text", { x, y: y - 8 * s, "font-size": 9 * s, "stroke-width": 2.4 * s, class: "landung" + (l.betrag < 0 ? " minus" : ""), text: kurz(l.betrag) });
    karte.effekte.append(t);
    setTimeout(() => t.remove(), 1700);
  }

  // ---------- Kopfleiste ----------
  const hud = {};
  function hudBauen() {
    const oben = el("div", { class: "oben" });
    hud.name = el("div", { class: "airline-name" });
    hud.geldB = el("b", { class: "zahl" });
    hud.geldS = el("small", { class: "zahl" });
    hud.chef = el("span", { class: "hud-chef" });
    hud.geldK = el("button", { class: "kachel geld", onclick: zeigeKasse }, hud.chef, el("span", { class: "geld-spalte" }, hud.name, hud.geldB, hud.geldS));
    hud.tag = el("span"); hud.saison = el("span"); hud.balken = el("i"); hud.kerosin = el("span", { class: "kerosin" });
    hud.uhr = el("div", { class: "kachel uhr" }, el("div", { class: "zeile" }, hud.tag, hud.saison, hud.kerosin), el("div", { class: "balken" }, hud.balken));
    hud.tempo = el("button", { class: "kachel tempoknopf", onclick: tempoWeiter, "aria-label": "Tempo" });
    hud.platz = el("button", { class: "kachel treppchen", onclick: zeigeRang, "aria-label": "Rangliste" });
    hud.slotZahl = el("span", { class: "abzeichen" });
    hud.store = el("button", { class: "kachel rundknopf knopf-mit", onclick: slotListe, "aria-label": "Freie Slots" }, "🎟️", hud.slotZahl);
    hud.frei = el("span", { class: "abzeichen" });
    hud.linien = el("button", { class: "kachel linienknopf knopf-mit", onclick: () => editorOeffnen() }, "✏️ Linien", hud.frei);
    hud.menue = el("button", { class: "kachel rundknopf", onclick: menueZeigen, "aria-label": "Menü" }, "☰");
    // Ton an/aus, immer sichtbar (Töne stehen in airline-ton.js).
    hud.ton = el("button", { class: "kachel rundknopf tonknopf", onclick: tonFenster, "aria-label": "Ton" });
    tonKnopf();
    hud.bericht = el("button", { class: "kachel rundknopf berichtknopf", onclick: zeigeBericht, "aria-label": "Berichte" });
    oben.append(hud.geldK, hud.uhr, hud.tempo, el("div", { class: "luecke" }), hud.bericht, hud.platz, hud.store, hud.linien, hud.ton, hud.menue);
    hud.ziel = el("button", { class: "zielleiste", onclick: zielAntippen });
    hud.warn = el("div");
    // Schalter unten links: Rivalen-Linien auf der Karte zeigen oder ausblenden.
    hud.rivalen = el("div", { class: "rivalenknopf" });
    feld.append(oben, hud.ziel, hud.warn, hud.rivalen);
    rivalenKnopf();
    hudAktualisieren();
  }

  function tonKnopf() {
    const an = !window.Ton || window.Ton.an;
    hud.ton.classList.toggle("aus", !an);
    hud.ton.replaceChildren(icon(an ? "🔊" : "🔇"));
  }
  // Kleines Fenster unter dem Lautsprecher: zwei Schalter, Töne und Hintergrundklang.
  function tonFenster() {
    const alt = feld.querySelector(".tonfenster");
    if (alt) { alt.remove(); return; }
    if (!window.Ton) return;
    const T = window.Ton;
    const zeile = (zeichen, text, an, f) => el("button", { class: "ton-zeile" + (an ? " an" : ""), onclick: () => { f(); tonKnopf(); fenster.remove(); tonFenster(); } },
      el("span", { class: "gross-icon" }, icon(zeichen)), el("span", { text }), el("span", { class: "schieber" }, el("i")));
    const fenster = el("div", { class: "tonfenster" },
      zeile(T.an ? "🔊" : "🔇", "Töne", T.an, () => T.anSetzen(!T.an)),
      zeile("🎵", "Hintergrundklang", T.an && T.musik, () => { if (T.an && T.musik) T.musikSetzen(false); else { T.anSetzen(true); T.musikSetzen(true); } }));
    feld.append(fenster);
    // Tippen daneben schließt das Fenster.
    const weg = (e) => {
      if (fenster.isConnected && !fenster.contains(e.target) && !hud.ton.contains(e.target)) fenster.remove();
      if (!fenster.isConnected) document.removeEventListener("pointerdown", weg, true);
    };
    document.addEventListener("pointerdown", weg, true);
  }
  const ton = (name) => { if (window.Ton) window.Ton.spielen(name); };

  function rivalenKnopf() {
    if (!hud.rivalen || !st) return;
    const irgendwer = ["k", "s", "a"].some((aid) => ui.rivalen[aid]);
    hud.rivalen.classList.toggle("an", irgendwer);
    // Jeder Rivale hat seinen eigenen Punkt: antippen schaltet seine Linien an oder aus.
    hud.rivalen.replaceChildren(el("span", { text: "👥", title: "Rivalen auf der Karte" }),
      ...["k", "s", "a"].map((aid) => {
        const a = st.airlines[aid];
        return el("button", { class: "rivale-punkt" + (ui.rivalen[aid] ? " an" : ""), style: { "--farbe": a.farbe }, "aria-label": a.name + " zeigen", title: a.name,
          onclick: () => { ui.rivalen = { ...ui.rivalen, [aid]: !ui.rivalen[aid] }; schreiben(RIVALEN_AN, ui.rivalen); rivalenKnopf(); karteZeichnen(); } },
          el("i"), a.kurz || a.name.slice(0, 3));
      }));
  }

  function hudAktualisieren() {
    if (!st || !hud.geldB) return;
    const p = ich();
    const tag = L.tagVon(st);
    const rufSig = p.name + p.farbe + Math.round(p.ruf);
    if (hud.rufSig !== rufSig) { hud.rufSig = rufSig; hud.name.replaceChildren(el("span", { class: "punkt", style: { background: p.farbe } }), p.name, el("span", { class: "ruf-chip", text: "⭐ " + Math.round(p.ruf) })); }
    const chefSig = st.manager ? st.manager.aussehen + st.manager.name : "";
    if (hud.chefSig !== chefSig) { hud.chefSig = chefSig; hud.chef.replaceChildren(st.manager ? managerGesicht(st.manager) : ""); hud.chef.hidden = !st.manager; }
    hud.geldB.textContent = geld(p.geld);
    hud.geldB.className = "zahl" + (p.geld < 0 ? " minus" : "");
    const gestern = p.verlauf.length ? p.verlauf[p.verlauf.length - 1] : null;
    hud.geldS.textContent = (p.kredit > 0 ? "Kredit " + geld(p.kredit) + " · " : "") + (gestern == null ? "noch kein Tag" : "gestern " + geld(gestern, true));
    hud.tag.textContent = "Tag " + tag + " · " + L.WOCHENTAGE[L.wochentag(tag)];
    const sai = L.saison(tag);
    textSetzen(hud.saison, sai.icon + " " + sai.name);
    textSetzen(hud.kerosin, st.kerosin !== 1 ? (st.kerosin < 1 ? "⛽⬇" : "⛽⬆") : "");
    hud.kerosin.title = st.kerosin < 1 ? "Kerosin billiger" : "Kerosin teurer";
    hud.balken.style.width = ((st.zeit % 24) / 24 * 100).toFixed(1) + "%";
    hud.tempo.textContent = ["❚❚", "▶", "▶▶", "▶▶▶"][TEMPI.indexOf(ui.tempo)];
    hud.tempo.classList.toggle("pause", ui.tempo === 0);
    const pl = L.platz(st);
    hud.platz.replaceChildren(el("span", { class: "stufen-bild" }, [3, 1, 2].map((i) => el("i", { class: i === pl ? "an" : "", style: { height: (i === 1 ? 14 : i === 2 ? 10 : 7) + "px" } }))), el("b", { text: L.tagVon(st) < L.REGELN.rangAb ? "–" : pl + "." }),
      ...(st.rennen ? [el("span", { class: "abzeichen rennen-abzeichen", text: "🏁" })] : []));
    const frei = L.freieFlugzeuge(p).length;
    hud.frei.textContent = frei; hud.frei.style.display = frei ? "" : "none";
    const ringe = slotRinge().length;
    hud.slotZahl.textContent = ringe; hud.slotZahl.style.display = ringe ? "" : "none";
    const au = Object.values(p.auftraege || {}).filter(Boolean);
    const ctrl = L.assistent(p);
    const fertig = au.some((x) => x.bericht && !x.gelesen) || !!(p.wochenbericht && !p.wochenbericht.gelesen) || !!(p.hinweise && p.hinweise.some((h) => !h.gelesen)), laeuft = au.some((x) => !x.bericht);
    hud.bericht.style.display = au.length || ctrl ? "" : "none";
    textSetzen(hud.bericht, laeuft && !fertig ? "⏳" : "📋");
    hud.bericht.classList.toggle("neu", fertig);
    zielZeichnen();
    warnungZeichnen();
  }

  function zielZeichnen() {
    const z = L.zielStand(st);
    const sig = z.id + "|" + z.ist;
    if (hud.zielSig === sig) return;
    hud.zielSig = sig;
    const anteil = Math.min(1, z.ist / z.soll);
    const zahl = z.soll > 1 ? (z.mio ? `${z.ist.toLocaleString("de-DE")} / ${z.soll} Mio` : `${z.ist} / ${z.soll}${z.einheit ? " " + z.einheit : ""}`) : "";
    hud.ziel.replaceChildren(...[
      el("span", { class: "zielnr", text: "🎯" }),
      el("div", { class: "zieltext" }, el("b", { text: z.text }), el("div", { class: "spur" }, el("i", { style: { width: (anteil * 100).toFixed(0) + "%" } }))),
      zahl ? el("span", { class: "zielzahl", text: zahl }) : null,
      z.belohnung ? el("span", { class: "praemie", text: "🎁 " + geld(z.belohnung) }) : null].filter(Boolean));
  }
  function zielAntippen() {
    const z = L.zielStand(st);
    if ((z.id === "kaufen" || z.id === "route") && !ich().routen.length) angeboteZeigen();
    else if (["kaufen", "route", "zweiterFlug", "drehkreuz", "kontinent", "kontinente4"].includes(z.id)) editorOeffnen();
    else if (z.id === "bieten") slotListe();
    else if (z.id === "flotte5") zeigeFlotte();
    else if (z.id.startsWith("platz")) zeigeRang();
    else zeigeKasse();
  }

  function warnungZeichnen() {
    const pl = st.pleite;
    const sig = pl.stufe + "|" + (st.uebernahme && st.uebernahme.abgelehnt);
    if (hud.warnSig === sig) return;
    hud.warnSig = sig;
    hud.warn.replaceChildren();
    if (!pl.stufe) return;
    const texte = { 1: "Die Bank mahnt: Konto im Minus!", 2: "Kredit läuft. Noch einmal ins Minus, dann will dich ein Rivale kaufen.", 3: "Letzte Chance: Konto ins Plus, sonst ist die Airline pleite!" };
    const w = el("div", { class: "warnung" }, el("span", { class: "stufen" }, [1, 2, 3].map((i) => el("i", { class: i <= pl.stufe ? "an" : "" }))), texte[pl.stufe]);
    if (pl.stufe === 3 && st.uebernahme && !st.uebernahme.abgelehnt) w.append(el("button", { text: "Angebot ansehen", onclick: uebernahmeZeigen }));
    hud.warn.append(w);
    if (pl.stufe === 3 && st.uebernahme && !st.uebernahme.abgelehnt) uebernahmeZeigen();
  }

  function tempoWeiter() {
    const i = TEMPI.indexOf(ui.tempo);
    tempo(TEMPI[(i + 1) % TEMPI.length]);
  }
  function tempo(t) { ui.tempo = t; hudAktualisieren(); }

  // ---------- Seitentafel (rechts) ----------
  let tafelEl = null;
  function tafel(art, titel, untertitel, ...inhalt) {
    if (ui.entscheidung && art !== "gelegenheit") entscheidungFertig();
    // Wird dieselbe Tafel neu gezeichnet (z. B. nach einem Tipp im Editor), bleibt sie an derselben Stelle gescrollt.
    // Sonst springt sie nach oben, und der nächste Tipp trifft einen ganz anderen Knopf.
    const schluessel = art + "|" + (typeof titel === "string" ? titel : "");
    const alt = tafelEl && tafelEl.dataset.schluessel === schluessel ? [...tafelEl.querySelectorAll("*")].filter((x) => x.scrollTop > 0).map((x) => x.scrollTop)[0] || tafelEl.scrollTop : 0;
    if (tafelEl) tafelEl.remove();
    ui.tafel = art;
    tafelEl = el("div", { class: "tafel" + (ui.editor ? " im-editor" : "") },
      el("div", { class: "kopf" }, el("h2", {}, titel, untertitel ? el("small", { text: untertitel }) : null),
        ui.editor ? null : el("button", { class: "zu", text: "✕", onclick: tafelZu, "aria-label": "Schließen" })),
      el("div", { class: "rumpf" }, inhalt));
    tafelEl.dataset.schluessel = schluessel;
    feld.append(tafelEl);
    if (alt) { const r = tafelEl.querySelector(".rumpf"); if (r && r.scrollHeight > r.clientHeight) r.scrollTop = alt; else tafelEl.scrollTop = alt; }
    feld.classList.add("tafel-an");
    karteZeichnen();
    return tafelEl;
  }
  // Ruhige Zeit: Eine Entscheidung (Wahl, Angebot eines Rivalen) hält die Uhr an, bis die Tafel zu ist. Immer nur eine.
  const ENTSCHEIDUNG = new Set(["wahl", "slotangebot"]);
  function entscheidungPruefen() {
    if (!st || ui.modal || ui.editor || ui.entscheidung) return;
    const g = st.gelegenheiten.find((x) => ENTSCHEIDUNG.has(x.art) && !x.gezeigt);
    if (!g) return;
    g.gezeigt = true;
    ui.entscheidung = { id: g.id, tempo: ui.tempo };
    ton("entscheidung");
    tempo(0);
    zeigeGelegenheit(g.id);
  }
  function entscheidungFertig() {
    if (!ui.entscheidung) return;
    const t = ui.entscheidung.tempo;
    ui.entscheidung = null;
    tempo(t || 1);
    setTimeout(entscheidungPruefen, 400);
  }
  function tafelZu() {
    entscheidungFertig();
    if (tafelEl) tafelEl.remove();
    tafelEl = null; ui.tafel = null; ui.stadt = null; ui.route = null;
    feld.classList.remove("tafel-an");
    karteZeichnen();
  }
  function tafelNeu() {
    if (ui.editor) { editorZeichnen(); return; }
    if (ui.tafel === "stadt") zeigeStadt(ui.stadt);
    else if (ui.tafel === "route") { if (ich().routen.some((r) => r.id === ui.route)) (tafelEl && tafelEl.querySelector(".vergleich") ? zeigeDuell : zeigeRoute)(ui.route); else tafelZu(); }
    else if (ui.tafel === "flotte") zeigeFlotte();
    else if (ui.tafel === "rang") zeigeRang();
    else if (ui.tafel === "bericht") zeigeBericht();
    else if (ui.tafel === "kasse") zeigeKasse();
    else if (ui.tafel === "slots") slotListe();
    else if (ui.tafel === "slot" && !st.pool.some((x) => x.id === ui.slot)) tafelZu();   // vergeben: Tafel schließen. Sonst nicht neu zeichnen, das Rad bliebe sonst nicht stehen.
  }

  const chipAirline = (aid) => el("span", { class: "chip" }, el("span", { class: "punkt", style: { background: st.airlines[aid].farbe } }), st.airlines[aid].name);

  // ---------- Slots: Stadt, Tafel, Bieten, Handel ----------
  const uhr = (h) => L.uhrText(h);
  const ZEIT_KURZ = { begehrt: "begehrt", ruhig: "ruhig", schwach: "schwach" };
  const ZEIT_LANG = { begehrt: "Begehrte Zeit: viele Reisende", ruhig: "Ruhige Zeit: weniger Reisende", schwach: "Schwache Zeit: kaum Reisende" };
  const prozent = (x) => Math.round(Math.min(1.5, x) * 100) + " %";
  // Rat des Analysten nur einmal je Spielstand rechnen (er bleibt beim zweiten Blick derselbe).
  const ratMerker = new Map();
  function ratCache(key, f) {
    const k = key + "|" + st.stand + "|" + L.tagVon(st);
    if (!ratMerker.has(k)) { if (ratMerker.size > 60) ratMerker.clear(); ratMerker.set(k, f()); }
    return ratMerker.get(k);
  }
  function ratBox(wer, text) {
    if (!wer) return el("div", { class: "rat leer" }, el("span", { text: "Ohne Assistent kein Rat." }),
      el("button", { class: "nebenknopf", text: "Einstellen", onclick: () => { const fs = feld.querySelector(".flugseite"); if (fs) { fs.remove(); ui.modal = false; } tafelZu(); if (ui.editor) editorZu(); meineAirline(); } }));
    return el("div", { class: "rat" }, el("div", { class: "gesicht klein-gesicht" }, bildEl(wer.bild, wer.name[0])),
      el("div", { class: "rat-text" }, el("b", { text: wer.name + " " + sterne(wer.sterne) }), el("span", { text })));
  }
  // Wo wird gerade geboten und könnte ich den Slot nutzen? Die lohnendsten zuerst, eigene Gebote ganz vorn.
  let ringCache = null;
  function slotRinge() {
    const key = st.stand + "|" + L.tagVon(st) + "|" + st.pool.length;
    if (ringCache && ringCache.key === key) return ringCache.liste;
    const p = ich();
    const liste = st.pool.filter((s) => s.bis != null && !L.hatTafel(p, s.stadt)).map((s) => {
      const n = L.slotNutzen(st, L.SPIELER, s.stadt, s.h, s.id);
      return { s, nutzen: n ? n.gewinn : null };
    }).filter((x) => x.nutzen > 0 || x.s.gebote[L.SPIELER])
      .sort((x, y) => (y.s.gebote[L.SPIELER] ? 1 : 0) - (x.s.gebote[L.SPIELER] ? 1 : 0) || (y.nutzen || 0) - (x.nutzen || 0));
    ringCache = { key, liste };
    return liste;
  }
  const stundenBis = (t) => Math.max(1, Math.ceil(t - st.zeit));

  function slotStatus(p, s) {
    const F = L.slotFlug(p, s.id);
    if (F) return { text: "nach " + L.STADT[F.von === s.stadt ? F.nach : F.von].name, art: "betrieb" };
    if (L.slotInGefahr(st, p, s)) { const t = L.tageBisSaisonende(L.tagVon(st)); return { text: "⚠️ ungenutzt, geht " + (t <= 1 ? "morgen" : "in " + t + " Tagen") + " zurück", art: "gefahr" }; }
    return { text: "noch frei", art: "frei" };
  }

  function zeigeStadt(id) {
    const c = L.STADT[id];
    const p = ich();
    ui.stadt = id; ui.route = null;
    const tag = L.tagVon(st);
    const hub = L.drehkreuze(p).includes(id);
    const routen = p.routen.filter((r) => r.a === id || r.b === id);
    const sai = L.saison(tag);
    let saisonText = null;
    if (c.t === "sued") saisonText = sai.sued > 1.2 ? "☀️ Südsommer: viele Urlauber! (wenn bei uns Winter ist)" : "☀️ Beliebt, wenn bei uns Winter ist";
    if (c.t === "tropen") saisonText = sai.tropen > 1.2 ? "🌴 Hauptsaison: viele Urlauber!" : "🌴 Am beliebtesten im Winter";
    if (c.t === "sonne") saisonText = sai.sonne > 1.2 ? "☀️ Sommer: viele Urlauber!" : sai.sonne < 0.8 ? "🌧️ Nebensaison: wenig Urlauber" : "☀️ Urlaubsziel, im Sommer gefragt";
    if (c.t === "schnee") saisonText = sai.schnee > 1.2 ? "⛷️ Winter: Skiurlauber!" : "⛷️ Im Winter gefragt";
    const messe = st.messen.find((m) => m.stadt === id);
    const trend = L.stadtTrend(st, id);
    const istAusgebaut = L.ausgebaut(p, id);
    const ausbauPreis = L.kannAusbauen(st, L.SPIELER, id) ? L.drehkreuzPreis(st, L.SPIELER, id) : 0;
    const stand = L.rechnung(st).staedte[id];
    const reis = L.reisende(st, id), bedient = stand ? Math.round(stand.bedient) : 0;
    const eigeneTafel = L.hatTafel(p, id);
    const meine = L.slotsIn(p, id).slice().sort((x, y) => x.h - y.h);
    const pool = L.poolIn(st, id).slice().sort((x, y) => x.h - y.h);
    const fremd = ["k", "s", "a"].flatMap((aid) => st.airlines[aid].slots.filter((s) => s.stadt === id && !s.heim).map((s) => ({ aid, s }))).sort((x, y) => x.s.h - y.s.h);
    const heimVon = ["k", "s", "a"].find((aid) => L.hatTafel(st.airlines[aid], id));
    const zeileSlot = (s) => { const z = slotStatus(p, s); return el("div", { class: "slotzeile " + z.art }, el("b", { text: uhr(s.h) }), el("span", { text: z.text })); };
    tafel("stadt", c.name, KLASSE[c.k] + " · " + L.KONTINENTE[c.r] + (istAusgebaut ? " · ausgebautes Drehkreuz" : hub ? " · dein Drehkreuz" : p.basis === id ? " · deine Heimat" : ""),
      el("div", { class: "symbolzeile" },
        symbol("👥", "Größe", "●".repeat(Math.round(c.g / 2.5)) || "●"),
        symbol("👔", "Geschäft", Math.round(c.w * 100) + " %"),
        symbol("🛬", "Gebühr", geld(L.REGELN.gebuehr[c.k]))),
      el("div", { class: "reisende" },
        el("div", { class: "zeile mini" }, el("span", { text: "👥 Reisende am Tag" }), el("b", { class: "rechts", text: bedient.toLocaleString("de-DE") + " von " + reis.toLocaleString("de-DE") + " fliegen schon" })),
        el("div", { class: "auslastung" }, el("i", { style: { width: Math.min(100, bedient / Math.max(1, reis) * 100).toFixed(0) + "%", background: bedient >= reis * 0.95 ? "#F87171" : "#7FC4E8" } }))),
      saisonText ? el("div", { class: "hinweis", text: saisonText }) : null,
      messe ? el("div", { class: "hinweis", text: `🎪 Messe Tag ${messe.von} bis ${messe.bis}: doppelt so viele Geschäftsreisende.` }) : null,
      trend ? el("div", { class: "hinweis " + (trend > 0 ? "gruen" : "rot"), text: trend > 0 ? "📈 Wird gerade beliebter: jeden Tag mehr Gäste." : "📉 Verliert gerade Gäste." }) : null,
      el("b", { class: "abschnitt", text: "🎟️ Slots" }),
      eigeneTafel ? el("button", { class: "hauptknopf", text: "Deine Slot-Tafel öffnen (" + meine.filter((s) => s.heim).length + " von " + (id === p.basis ? 19 : 10) + ")", onclick: () => tafelSeite(id) }) : null,
      heimVon ? el("div", { class: "blass mini", text: "Heimat von " + st.airlines[heimVon].name + ". Alle anderen brauchen hier einen der wenigen freien Slots." }) : null,
      meine.filter((s) => !s.heim).map(zeileSlot),
      eigeneTafel ? null : pool.map((s) => el("button", { class: "wahl" + (s.bis != null ? " an" : ""), onclick: () => zeigeSlot(s.id) },
        el("div", { class: "mitte" }, el("b", { text: uhr(s.h) + " Uhr · " + ZEIT_KURZ[L.zeitArt(s.h)] }),
          el("span", { text: s.bis != null ? "wird vergeben · noch " + stundenBis(s.bis) + " Std" : "liegt frei: Wer zuerst kommt" })),
        el("div", { class: "wert" }, s.gebote[L.SPIELER] ? geld(s.gebote[L.SPIELER]) : geld(L.slotGrundpreis(id, s.h)), el("small", { text: s.gebote[L.SPIELER] ? "dein Gebot" : s.bis != null ? "ab" : "Preis" })))),
      !eigeneTafel && !pool.length && !meine.length ? el("div", { class: "blass mini", text: "Gerade kein Slot zu haben. Der Flughafen gibt alle paar Tage einen neuen frei." }) : null,
      fremd.length ? el("div", { class: "blass mini", text: "Slots der Rivalen (antippen: kaufen oder tauschen):" }) : null,
      fremd.length ? el("div", { class: "chips" }, fremd.map(({ aid, s }) => el("button", { class: "chip slotchip", onclick: () => zeigeHandel(s.id) }, el("span", { class: "punkt", style: { background: st.airlines[aid].farbe } }), uhr(s.h)))) : null,
      ausbauPreis ? el("div", { class: "ausbau" },
        el("div", {}, el("b", { text: "🏗️ Zum Drehkreuz ausbauen" }), el("small", { text: "Eigene Tafel mit 10 Slots, +60 % Umsteiger, mehr Gäste." })),
        el("button", { class: "nebenknopf", disabled: p.geld < ausbauPreis, text: geld(ausbauPreis), onclick: () => { L.drehkreuzAusbauen(st, L.SPIELER, id); nachAktion(); meldung("🏗️", c.name + " ist jetzt dein ausgebautes Drehkreuz."); zeigeStadt(id); } })) : null,
      routen.map(routeZeile),
      el("button", { class: "hauptknopf", text: eigeneTafel ? "✏️ Neuer Flug ab " + c.name : "✏️ Flug nach " + c.name + " planen", onclick: () => editorOeffnen(eigeneTafel ? { start: id } : { start: p.basis, ziel: id }) }));
  }

  // Die Tafel der Heimat (oder eines ausgebauten Drehkreuzes): jede Stunde ein Slot, nur für dich.
  function tafelSeite(id) {
    const p = ich();
    const alt = feld.querySelector(".slottafel");
    if (alt) alt.remove();
    ui.modal = true;
    const zu = () => { seite.remove(); ui.modal = false; ui.tafelWahl = null; if (ui.tafel === "stadt") zeigeStadt(ui.stadt); };
    const zeilen = L.tafel(st, L.SPIELER, id);
    const gew = zeilen.find((z) => z.h === ui.tafelWahl && !z.slot) || null;
    const seite = el("div", { class: "seite store slottafel" },
      el("div", { class: "store-kopf" },
        el("h1", {}, L.STADT[id].name, el("small", { text: id === p.basis ? "Deine Heimat" : "Dein Drehkreuz" })),
        el("span", { class: "store-geld", text: p.geschenk > 0 ? p.geschenk === 1 ? "🎁 Noch 1 Slot geschenkt: Such ihn dir aus." : "🎁 Noch " + p.geschenk + " Slots geschenkt: Such sie dir aus." : "Hier kaufst nur du Slots. Du verlierst sie nie." }),
        el("button", { class: "zu", text: "✕", "aria-label": "Schließen", onclick: zu })),
      el("div", { class: "slotgitter" }, zeilen.map((z) => {
        const ziel = z.flug ? L.STADT[z.flug.von === id ? z.flug.nach : z.flug.von].name : null;
        return el("button", { class: "slotkachel " + z.art + (z.slot ? " mein" : "") + (gew && gew.h === z.h ? " an" : ""), disabled: !!z.slot,
          onclick: () => { ui.tafelWahl = z.h; tafelSeite(id); } },
          el("b", { text: uhr(z.h) }),
          el("span", { text: z.slot ? (ziel ? "nach " + ziel : "dein Slot") : z.preis ? geld(z.preis) : "geschenkt" }),
          el("small", { text: z.slot ? (ziel ? "in Betrieb" : "noch frei") : ZEIT_KURZ[z.art] }));
      })),
      el("div", { class: "legende gross" },
        el("span", {}, el("i", { style: { background: "#4ADE80" } }), "gehört dir"),
        el("span", {}, el("i", { class: "rahmen-gold" }), "begehrte Zeit: mehr Reisende, teurer"),
        el("span", {}, el("i", { class: "rahmen-ruhig" }), "ruhige Zeit: günstig")),
      el("div", { class: "tafel-fuss" + (gew ? " an" : "") },
        el("div", { class: "mitte" },
          el("b", { text: gew ? uhr(gew.h) + " Uhr ausgewählt" : "Tippe eine Uhrzeit an" }),
          el("span", { text: gew ? ZEIT_LANG[gew.art] + ". Ein Abflug pro Tag um diese Zeit." : "Jeder Abflug braucht einen Slot. Für den Rückflug brauchst du einen am Ziel." })),
        gew ? el("button", { class: "hauptknopf", disabled: p.geld < gew.preis, text: gew.preis ? "Kaufen · " + geld(gew.preis) : "🎁 Nehmen (geschenkt)",
          onclick: () => { L.heimSlotKaufen(st, L.SPIELER, id, gew.h); ton("kauf"); ui.tafelWahl = null; nachAktion(); tafelSeite(id); } }) : null));
    feld.append(seite);
    erklaeren("tafel");
  }

  // Das Rad: ein Wert aus einer Liste, durch Drehen (Wischen) eingestellt.
  function rad(werte, wert, format, wenn) {
    const H = 30;
    const liste = el("div", { class: "rad-liste" }, werte.map((v) => el("div", { class: "rad-wert", text: format(v) })));
    const box = el("div", { class: "rad" }, liste, el("div", { class: "rad-marke" }));
    const markieren = (i) => { [...liste.children].forEach((c, j) => c.classList.toggle("an", j === i)); };
    let warten = null, letzter = -1;
    liste.addEventListener("scroll", () => {
      const i = Math.max(0, Math.min(werte.length - 1, Math.round(liste.scrollTop / H)));
      if (i !== letzter) { letzter = i; markieren(i); }
      clearTimeout(warten);
      warten = setTimeout(() => wenn(werte[i]), 80);
    });
    const start = Math.max(0, werte.indexOf(wert));
    markieren(start);
    requestAnimationFrame(() => { liste.scrollTop = start * H; });
    return box;
  }
  function radWerte(von, bis) {
    const w = [];
    for (let v = von; v <= bis + 1; v += 10000) w.push(v);
    return w;
  }

  // Ein Slot wird vergeben: verdeckt bieten, einen Tag lang.
  function zeigeSlot(sid) {
    const s = st.pool.find((x) => x.id === sid);
    if (!s) { if (ui.tafel === "slot") tafelZu(); return; }
    const p = ich();
    const c = L.STADT[s.stadt];
    ui.stadt = s.stadt; ui.route = null; ui.slot = sid;
    const gp = L.slotGrundpreis(s.stadt, s.h);
    const titel = "🎟️ " + c.name + " " + uhr(s.h) + " Uhr";
    if (s.bis == null) {
      tafel("slot", titel, ZEIT_LANG[L.zeitArt(s.h)],
        el("div", { class: "hinweis gruen", text: "Dieser Slot liegt frei. Wer zuerst einen Flug darauf legt, bekommt ihn für " + geld(gp) + "." }),
        el("button", { class: "hauptknopf", text: "✏️ Flug nach " + c.name + " planen", onclick: () => editorOeffnen({ start: p.basis, ziel: s.stadt }) }),
        el("button", { class: "nebenknopf", text: "Flughafen ansehen", onclick: () => zeigeStadt(s.stadt) }));
      return;
    }
    const mein = s.gebote[L.SPIELER] || 0;
    const max = Math.max(gp, mein, Math.min(Math.floor(p.geld / 10000) * 10000, gp * 8));
    let betrag = mein || gp;
    const rat = ratCache("slot" + sid, () => L.ratSlot(st, sid));
    const knopf = el("button", { class: "hauptknopf", disabled: p.geld < gp, onclick: () => { L.bieten(st, sid, betrag); nachAktion(); meldung("🎟️", "Dein Gebot für " + c.name + " steht: " + geld(betrag) + "."); zeigeSlot(sid); } });
    const setzen = (v) => { betrag = v; textSetzen(knopf, (mein ? "Gebot ändern · " : "Verdeckt bieten · ") + geld(v)); };
    setzen(betrag);
    let ratText = null;
    if (rat) {
      const namen = rat.mit.map((aid) => st.airlines[aid].name);
      ratText = (rat.wert ? "Der Slot ist für dich etwa " + geld(rat.wert[0]) + " bis " + geld(rat.wert[1]) + " wert" + (rat.von ? " (Flug ab " + L.STADT[rat.von].name + ")." : ".") : "Von deinen Flughäfen aus bringt dir der Slot kaum etwas.")
        + " " + (namen.length ? "Ich rechne damit, dass " + namen.join(" und ") + " mitbietet." : "Ich glaube, du bietest allein.");
    }
    tafel("slot", titel, ZEIT_LANG[L.zeitArt(s.h)] + " · noch " + stundenBis(s.bis) + " Std",
      el("div", { class: "blass mini", text: "Alle Airlines bieten verdeckt. Das höchste Gebot gewinnt. Bietest nur du, zahlst du nur den Grundpreis von " + geld(gp) + "." }),
      ratBox(rat && rat.wer, ratText),
      el("div", { class: "blass mini", text: "Dein Gebot: am Rad drehen" }),
      rad(radWerte(gp, max), betrag, (v) => geld(v), setzen),
      knopf,
      mein ? el("button", { class: "nebenknopf", text: "Gebot zurückziehen", onclick: () => { L.bieten(st, sid, 0); nachAktion(); zeigeSlot(sid); } }) : null,
      el("button", { class: "nebenknopf", text: "Flughafen ansehen", onclick: () => zeigeStadt(s.stadt) }));
    erklaeren("bieten");
  }

  // Einem Rivalen einen Slot abkaufen oder tauschen. Die Antwort kommt sofort.
  function zeigeHandel(sid) {
    const aid = L.slotBesitzer(st, sid);
    if (!aid || aid === L.SPIELER) { tafelZu(); return; }
    const p = ich(), a = st.airlines[aid];
    const s = L.slotVon(a, sid);
    const c = L.STADT[s.stadt];
    ui.stadt = s.stadt; ui.route = null;
    const h = L.handelPruefen(st, sid);
    const titel = "🤝 " + c.name + " " + uhr(s.h) + " Uhr";
    const zurueck = el("button", { class: "nebenknopf", text: "◀ Zum Flughafen", onclick: () => zeigeStadt(s.stadt) });
    if (!h.ok) {
      tafel("handel", titel, "Slot von " + a.name,
        el("div", { class: "hinweis", text: h.grund === "heim" ? "Slots an der eigenen Heimat gibt niemand her." : a.name + " will bis Tag " + h.bis + " nicht mehr über diesen Slot reden." }), zurueck);
      return;
    }
    const F = L.slotFlug(a, sid);
    const rat = ratCache("handel" + sid, () => L.ratHandel(st, sid));
    const eigene = p.slots.filter((x) => !x.heim && !L.slotFlug(p, x.id));
    let betrag = Math.min(h.grundpreis, Math.floor(p.geld / 10000) * 10000), tausch = null;
    const max = Math.max(betrag, Math.min(Math.floor(p.geld / 10000) * 10000, h.grundpreis * 12));
    const knopf = el("button", { class: "hauptknopf", onclick: () => {
      const r = L.handelAnbieten(st, sid, betrag, tausch);
      nachAktion();
      if (r.ok) { ton("sieg"); meldung("🤝", a.name + ": „Abgemacht.“ Der Slot gehört dir."); zeigeStadt(s.stadt); }
      else if (r.grund === "nein") { meldung("✋", a.name + ": „Das reicht nicht. In zwei Tagen können wir wieder reden.“"); zeigeHandel(sid); }
    } });
    const setzen = (v) => { betrag = v; textSetzen(knopf, "Angebot machen · " + geld(v) + (tausch ? " + Slot" : "")); };
    setzen(betrag);
    tafel("handel", titel, "Slot von " + a.name,
      el("div", { class: "blass mini", text: (F ? a.name + " fliegt darauf nach " + L.STADT[F.von === s.stadt ? F.nach : F.von].name + ". " : a.name + " nutzt den Slot gerade nicht. ") + "Die Antwort kommt sofort. Nach einem Nein ist zwei Tage Pause." }),
      h.groll >= 0.5 ? el("div", { class: "laune groll", text: a.name + " ärgert sich gerade über dich und verlangt deshalb mehr." }) : null,
      ratBox(rat && rat.wer, rat ? a.name + " gibt ihn wohl für " + geld(rat.noetig[0]) + " bis " + geld(rat.noetig[1]) + " her." + (rat.wert ? " Dir ist er etwa " + geld(rat.wert[0]) + " bis " + geld(rat.wert[1]) + " wert." : " Du kannst ihn von hier kaum nutzen.") : null),
      el("div", { class: "blass mini", text: "Dein Angebot: am Rad drehen" }),
      rad(radWerte(0, max), betrag, (v) => geld(v), setzen),
      eigene.length ? el("div", { class: "blass mini", text: "Dazu einen eigenen freien Slot zum Tausch geben:" }) : null,
      eigene.length ? el("div", { class: "chips" }, eigene.map((x) => el("button", { class: "chip slotchip", onclick: (ev) => {
        tausch = tausch === x.id ? null : x.id;
        for (const b of ev.currentTarget.parentNode.children) b.classList.remove("an");
        if (tausch) ev.currentTarget.classList.add("an");
        setzen(betrag);
      } }, L.STADT[x.stadt].name + " " + uhr(x.h)))) : null,
      knopf, zurueck);
    erklaeren("handel");
  }

  // Übersicht: Wo wird geboten, und was ist mit meinen Slots?
  function slotListe() {
    const p = ich();
    ui.stadt = null; ui.route = null;
    const ringe = slotRinge();
    const fremde = p.slots.filter((s) => !s.heim).sort((x, y) => L.STADT[x.stadt].name.localeCompare(L.STADT[y.stadt].name) || x.h - y.h);
    tafel("slots", "🎟️ Freie Slots", "Wo du gerade bieten kannst",
      ringe.length ? ringe.map(({ s }) => el("button", { class: "wahl" + (s.gebote[L.SPIELER] ? " an" : ""), onclick: () => zeigeSlot(s.id) },
        el("div", { class: "mitte" }, el("b", { text: L.STADT[s.stadt].name + " " + uhr(s.h) }), el("span", { text: ZEIT_KURZ[L.zeitArt(s.h)] + " · noch " + stundenBis(s.bis) + " Std" })),
        el("div", { class: "wert" }, geld(s.gebote[L.SPIELER] || L.slotGrundpreis(s.stadt, s.h)), el("small", { text: s.gebote[L.SPIELER] ? "dein Gebot" : "ab" }))))
        : el("div", { class: "hinweis", text: "Gerade wird in deiner Reichweite kein Slot vergeben. Flughäfen geben alle paar Tage einen frei: Dann leuchtet ein goldener Ring." }),
      el("button", { class: "nebenknopf", text: "🏠 Deine Tafel in " + L.STADT[p.basis].name, onclick: () => tafelSeite(p.basis) }),
      fremde.length ? el("b", { class: "abschnitt", text: "Deine Slots an fremden Flughäfen" }) : null,
      fremde.map((s) => { const z = slotStatus(p, s); return el("button", { class: "slotzeile knopf " + z.art, onclick: () => zeigeStadt(s.stadt) }, el("b", { text: L.STADT[s.stadt].name + " " + uhr(s.h) }), el("span", { text: z.text })); }),
      el("div", { class: "blass mini", text: "Liegt gebliebene Slots findest du im ✏️ Linien-Editor: Ziele mit Slot leuchten farbig." }));
  }

  // Der Tag eines Flugzeugs als Balken von 5 bis 24 Uhr. "neu" ist ein geplanter Flug.
  function tagesbalken(fid, neu) {
    const p = ich();
    const von = 4, bis = 26;
    const stuecke = fid ? L.tagesplan(st, L.SPIELER, fid).map((x) => ({ ab: x.z.ab, dauer: x.z.dauer, ziel: x.flug.nach })) : [];
    if (neu) stuecke.push(Object.assign({ neu: true }, neu));
    return el("div", { class: "tagbalken" },
      [6, 12, 18, 24].map((h) => el("i", { class: "strich", style: { left: ((h - von) / (bis - von) * 100) + "%" } }, el("small", { text: String(h % 24) }))),
      stuecke.map((x) => el("div", { class: "block" + (x.neu ? " neu" : ""), style: { left: Math.max(0, (x.ab - von) / (bis - von) * 100) + "%", width: Math.max(4, Math.min(100, Math.min(x.dauer, bis - x.ab) / (bis - von) * 100)) + "%" } },
        el("span", { text: L.STADT[x.ziel].name }))));
  }


  const symbol = (icon, name, wert) => el("div", { class: "symbol" }, el("span", { class: "gross-icon", text: icon }), el("b", { text: wert }), el("small", { text: name }));

  function routeZeile(r) {
    const e = L.rechnung(st).routen[r.id];
    const g = e ? e.gewinn : 0;
    return el("button", { class: "wahl", onclick: () => (ui.editor ? editorLinie(r.id) : zeigeRoute(r.id)) },
      el("span", { class: "farbstrich", style: { background: farbeGewinn(g + (e ? e.zubringer : 0)) } }),
      el("div", { class: "mitte" }, el("b", { text: L.STADT[r.a].name + " – " + L.STADT[r.b].name }), el("span", { text: "✈".repeat(Math.min(6, e ? e.flugzeuge : 0)) + "  " + Math.round((e ? e.auslastung : 0) * 100) + " % verkauft" })),
      el("div", { class: "wert", style: { color: farbeGewinn(g) }, text: kurz(g) }));
  }

  // Sitzplan: so viele Plätze sind verkauft.
  function sitzplan(anteil) {
    const n = 30, voll = Math.round(Math.min(1, anteil) * n);
    return el("div", { class: "sitzplan" },
      el("span", { class: "nase" }),
      el("div", { class: "sitze" }, Array.from({ length: n }, (_, i) => el("i", { class: i < voll ? "voll" : "" }))),
      el("span", { class: "sitztext", text: Math.round(anteil * 100) + " % der Plätze verkauft" }));
  }
  // Geldstapel: grün die Tickets, darunter rot, was abgeht.
  function geldstapel(e) {
    const max = Math.max(e.erloes, e.kosten, 1);
    const teil = (wert, farbe, icon) => el("i", { style: { width: (wert / max * 100).toFixed(1) + "%", background: farbe }, title: icon });
    return el("div", { class: "stapel" },
      el("div", { class: "stapelzeile" }, el("span", { text: "🎫" }), el("div", { class: "stapelspur" }, teil(e.erloes, "#4ADE80", "Tickets")), el("b", { class: "plus", text: geld(e.erloes) })),
      el("div", { class: "stapelzeile" }, el("span", { text: "💸" }), el("div", { class: "stapelspur" },
        teil(e.kerosin, "#F87171", "Kerosin"), teil(e.gebuehr, "#FB923C", "Gebühren"), teil(e.service, "#C084FC", "Service"), teil(e.crew, "#94A3B8", "Crew")), el("b", { class: "minus", text: geld(-e.kosten) })),
      el("div", { class: "legende" }, [["#F87171", "⛽ Kerosin"], ["#FB923C", "🛬 Gebühren"], ["#C084FC", "🍽️ Service"], ["#94A3B8", "👩‍✈️ Crew"]].map(([f, t]) => el("span", {}, el("i", { style: { background: f } }), t))));
  }

  function zeigeRoute(rid) {
    const p = ich();
    const r = p.routen.find((x) => x.id === rid);
    if (!r) { tafelZu(); return; }
    ui.route = rid; ui.stadt = null;
    const e = L.rechnung(st).routen[rid];
    const fs = L.flugzeugeAuf(p, rid);
    tafel("route", L.STADT[r.a].name + " – " + L.STADT[r.b].name, e.km.toLocaleString("de-DE") + " km · " + fs.map((f) => L.TYPEN[f.typ].name).join(", "),
      el("div", { class: "zeile" }, el("span", { class: "gross zahl", style: { color: farbeGewinn(e.gewinn) }, text: kurz(e.gewinn) }), el("span", { class: "blass", text: "pro Tag" })),
      (p.hinweise || []).filter((h) => h.id === rid).map((h) => hinweisBox(h, false)),
      e.zubringer > 1000 ? el("div", { class: "hinweis gruen", text: `🔁 Bringt zusätzlich ${kurz(e.zubringer)} auf deinen Anschlussflügen.` }) : null,
      (() => { const t = L.trendVon(st, r.a, r.b); return t ? el("div", { class: "hinweis " + (t > 0 ? "gruen" : "rot"), text: t === 2 ? "🔥 Diese Strecke ist gerade in Mode." : t > 0 ? "📈 Die Nachfrage steigt gerade." : "📉 Die Nachfrage sinkt gerade." }) : null; })(),
      sitzplan(e.auslastung),
      geldstapel(e),
      (L.vergleich(st, rid) || []).length > 1 ? el("button", { class: "nebenknopf", text: "⚔️ Mit den Rivalen vergleichen", onclick: () => zeigeDuell(rid) }) : null,
      el("button", { class: "hauptknopf", text: "＋ Weiterer Flug auf dieser Linie", onclick: () => { const fl = L.fluegeAuf(p, rid)[0]; const a = fl ? fl.von : r.a; flugSeite(a, a === r.a ? r.b : r.a); } }),
      el("button", { class: "nebenknopf", text: "✏️ Im Editor bearbeiten", onclick: () => editorOeffnen({ linie: rid }) }));
  }

  // Zwei (oder mehr) gleiche Linien nebeneinander: Preis, Qualität, Gäste. Bei gleichem Preis gewinnt die bessere Airline.
  function zeigeDuell(rid) {
    const p = ich();
    const r = p.routen.find((x) => x.id === rid);
    const liste = L.vergleich(st, rid);
    if (!r || !liste) { tafelZu(); return; }
    ui.route = rid; ui.stadt = null;
    const maxG = Math.max(1, ...liste.map((x) => x.gaeste));
    const spalte = (x) => el("div", { class: "vergleich-spalte" + (x.id === L.SPIELER ? " ich" : ""), style: { "--farbe": x.farbe } },
      el("b", { class: "v-name", text: x.id === L.SPIELER ? "Du" : x.name }),
      el("div", { class: "v-wert" }, el("small", { text: "🎫 Preis" }), el("b", { text: Math.round(x.preis) + " €" }), el("span", { class: "v-stufe", text: L.STUFEN[x.stufe].icon })),
      el("div", { class: "v-wert" }, el("small", { text: "⭐ Qualität" }), el("b", { class: "sterne", text: "★".repeat(x.sterne) + "☆".repeat(5 - x.sterne) })),
      el("div", { class: "v-wert" }, el("small", { text: "👥 Gäste am Tag" }), el("b", { text: x.gaeste.toLocaleString("de-DE") }),
        el("div", { class: "v-balken" }, el("i", { style: { width: (x.gaeste / maxG * 100).toFixed(0) + "%" } }))),
      el("div", { class: "v-wert" }, el("small", { text: "✈ Flugzeuge" }), el("b", { text: String(x.flugzeuge) })));
    tafel("route", "⚔️ " + L.STADT[r.a].name + " – " + L.STADT[r.b].name, r.duell ? "Preiskampf mit " + st.airlines[r.duell.gegen].name : "Wer fliegt hier besser?",
      el("div", { class: "vergleich" }, liste.slice(0, 3).map(spalte)),
      el("div", { class: "blass mini mitte-text", text: "Bei gleichem Preis gewinnt die bessere Qualität. Gutes Essen und Platz kosten dich aber pro Gast." }),
      el("div", { class: "segment" },
        el("button", { class: r.stufe === "angreifen" ? "an" : "", onclick: () => { L.duellAntwort(st, rid, "unterbieten"); nachAktion(); zeigeDuell(rid); } }, "⬇ Unterbieten"),
        el("button", { class: r.stufe === "normal" ? "an" : "", onclick: () => { L.duellAntwort(st, rid, "halten"); nachAktion(); zeigeDuell(rid); } }, "● Preis halten")),
      el("button", { class: "nebenknopf", text: "🏳️ Linie aufgeben", onclick: () => { L.duellAntwort(st, rid, "aufgeben"); nachAktion(); tafelZu(); } }),
      el("button", { class: "nebenknopf", text: "◀ Zur Linie", onclick: () => zeigeRoute(rid) }));
  }

  function zeigeFlotte() {
    const p = ich();
    const frei = L.freieFlugzeuge(p);
    tafel("flotte", "Deine Flotte", (p.flotte.length === 1 ? "1 Flugzeug" : p.flotte.length + " Flugzeuge") + (frei.length ? " · " + frei.length + " ohne Flug" : ""),
      p.flotte.length ? null : el("div", { class: "hinweis", text: "Noch keine Flugzeuge. Du kaufst eins, wenn du im ✏️ Linien-Editor einen Flug anlegst." }),
      p.flotte.map((f) => {
        const t = L.TYPEN[f.typ];
        const ohne = !p.fluege.some((x) => x.f === f.id);
        const gr = L.kabineGrenzen(f.typ);
        return el("div", { class: "flieger-karte" },
          el("div", { class: "zeile" },
            el("div", { class: "fz-bild klein" }, flugzeugBild(f.typ, TYP_ICON[f.typ])),
            el("div", { class: "mitte" }, el("b", { text: t.name }), el("span", { class: "blass mini", text: kabineText(f.typ, f.kabine) })),
            el("b", { class: "rechts", text: ohne ? "ohne Flug" : Math.round(L.auslastungFlugzeug(st, L.SPIELER, f.id) * 100) + " % voll" })),
          tagesbalken(f.id),
          L.inWerkstatt(st, f) ? el("div", { class: "hinweis", text: "In der Werkstatt: Die Kabine wird umgebaut." }) : null,
          el("div", { class: "knopfreihe" },
            gr.business > 0 ? el("button", { class: "nebenknopf", text: "💺 Kabine umbauen", onclick: () => kabineSeite(f.id) }) : null,
            ohne ? sicherKnopf("Verkaufen · " + geld(t.preis * L.REGELN.verkaufAnteil), () => { L.verkaufen(st, L.SPIELER, f.id); nachAktion(); zeigeFlotte(); }) : null));
      }),
      el("div", { class: "blass mini", text: "Der Balken zeigt den Tag jedes Flugzeugs. Je voller, desto besser verdient es sein Geld." }),
      el("button", { class: "nebenknopf", text: "✏️ Flug anlegen", onclick: () => editorOeffnen() }));
    erklaeren("tagesplan");
  }


  // Kabine eines Flugzeugs umbauen: kostet Geld und einen Tag Werkstatt.
  function kabineSeite(fid, wahl) {
    const p = ich();
    const f = p.flotte.find((x) => x.id === fid);
    if (!f) return;
    const alt = feld.querySelector(".kabine-seite");
    const vorher = alt ? alt._vorher : ui.modal;
    if (alt) alt.remove();
    ui.modal = true;
    const gr = L.kabineGrenzen(f.typ);
    const k = wahl || { ...f.kabine };
    const analyst = L.assistent(p, "analyst");
    const rat = analyst ? ratCache("kab" + fid, () => L.ratKabine(st, fid)) : null;
    const preis = L.umbauPreis(f.typ);
    const geaendert = k.business !== f.kabine.business || k.first !== f.kabine.first;
    const reihen = 18, fR = Math.round(reihen * k.first), bR = Math.round(reihen * k.business);
    const bild = el("div", { class: "kabine" }, el("span", { class: "nase" }),
      el("div", { class: "reihen" }, Array.from({ length: reihen }, (_, i) => {
        const art = i < fR ? "first" : i < fR + bR ? "business" : "eco";
        return el("div", { class: "reihe " + art }, Array.from({ length: art === "first" ? 2 : art === "business" ? 3 : 5 }, () => el("i")));
      })), el("span", { class: "heck" }));
    const regler = (art, max) => el("div", { class: "klassenzeile" },
      el("span", { class: "klassenpunkt", style: { background: L.KLASSEN[art].farbe } }), el("b", { text: L.KLASSEN[art].name }),
      el("input", { type: "range", min: 0, max, step: 0.05, value: k[art], onchange: (ev) => { const v = parseFloat(ev.target.value); kabineSeite(fid, Object.assign({}, k, { [art]: v })); } }),
      el("small", { text: Math.round(k[art] * 100) + " %" }));
    const zu = () => { seite.remove(); ui.modal = vorher; if (ui.tafel === "flotte") zeigeFlotte(); };
    const seite = el("div", { class: "seite ergebnis-seite kabine-seite" },
      el("div", { class: "ergebnis-karte" },
        el("div", { class: "ergebnis-kopf" }, el("span", { class: "ergebnis-icon", text: "💺" }), el("div", {}, el("small", { text: L.TYPEN[f.typ].name }), el("b", { text: "Kabine umbauen" }))),
        bild,
        gr.first > 0 ? regler("first", gr.first) : null,
        regler("business", gr.business),
        el("div", { class: "blass mini", text: kabineText(f.typ, k) + ". Business braucht doppelt so viel Platz wie Economy, First dreimal so viel. Dafür zahlen diese Gäste viel mehr." }),
        analyst ? ratBox(analyst, rat ? (rat.lohnt ? "Ich würde auf " + Math.round(rat.business * 100) + " % Business" + (rat.first ? " und " + Math.round(rat.first * 100) + " % First" : "") + " umbauen: etwa " + vonBis(rat.plus, kurz) + " am Tag." : "Die Kabine passt zu den Flügen. Ein Umbau lohnt sich gerade nicht.") : "Ohne Flüge kann ich nichts empfehlen.") : ratBox(null),
        rat && rat.lohnt && (k.business !== rat.business || k.first !== rat.first) ? el("button", { class: "nebenknopf", text: "✨ Empfehlung einstellen", onclick: () => kabineSeite(fid, { business: rat.business, first: rat.first }) }) : null,
        el("div", { class: "knopfreihe" },
          el("button", { class: "nebenknopf", text: "Abbrechen", onclick: zu }),
          el("button", { class: "hauptknopf", disabled: !geaendert || p.geld < preis, text: "Umbauen · " + geld(preis), onclick: () => { const r = L.kabineSetzen(st, L.SPIELER, fid, k.business, k.first); nachAktion(); zu(); if (r.ok) meldung("💺", "Umbau bestellt: Morgen steht das Flugzeug einen Tag in der Werkstatt. Übermorgen siehst du, was es gebracht hat."); } })),
        el("div", { class: "blass mini mitte-text", text: "Das Flugzeug steht morgen einen Tag in der Werkstatt und fliegt nicht." })));
    seite._vorher = vorher;
    feld.append(seite);
    erklaeren("kabine");
  }


  // Was dein Analyst über die beste Linie eines Rivalen denkt. Antippen öffnet die Strecke im Editor.
  function rivalenLinieEl(aid) {
    const b = L.besteRivalenLinie(st, aid);
    if (!b) return null;
    const N = (id) => L.STADT[id].name;
    const spanneText = b.gewinn[0] === b.gewinn[1] ? "etwa " + kurz(b.gewinn[0]) : kurz(b.gewinn[0]) + " bis " + kurz(b.gewinn[1]).replace("+", "");
    return el("button", { class: "rival-linie", onclick: () => { if (b.duFliegst) return; editorOeffnen({ start: b.a, ziel: b.b }); } },
      "🔎 Beste Linie " + N(b.a) + "–" + N(b.b) + ": " + spanneText + " am Tag" + (b.duFliegst ? " · fliegst du auch" : " · ✏️"));
  }
  function zeigeRang() {
    const liste = L.rangliste(st);
    const max = Math.max(...liste.map((r) => r.wert), 1);
    const meinPlatz = liste.findIndex((x) => x.id === L.SPIELER);
    const R = st.rennen;
    tafel("rang", "Rangliste der Welt", (L.tagVon(st) < L.REGELN.rangAb ? "zählt ab Tag " + L.REGELN.rangAb + " · " : "gezählt wird der Firmenwert · ") + "Rivalen: " + (L.GEGNER[st.gegner] || L.GEGNER.mittel).name,
      R ? el("div", { class: "rennen" }, el("b", { text: "🏁 " + R.text }),
        el("small", { text: `Preis ${R.preis / 1e6} Mio + Pokal · noch ${Math.max(0, R.bis - L.tagVon(st) + 1)} Tage · du: ${Math.min(L.rennenStand(st, L.SPIELER), R.soll)} / ${R.soll}` })) : null,
      liste.map((r, i) => {
        const riv = L.RIVALEN[r.id];
        const spruch = riv ? (i === 0 ? riv.sprueche.gross : meinPlatz < i ? riv.sprueche.verliert : riv.sprueche.gegen) : null;
        const laune = riv ? L.laune(st, r.id) : null;
        return el("div", { class: "rang" + (riv ? "" : " ich") },
          el("span", { class: "nr", text: ["🥇", "🥈", "🥉", "4"][i] }),
          riv || !st.manager ? el("div", { class: "gesicht", style: { background: r.farbe } }, riv ? bildEl(CHEF[r.id], riv.chef[0]) : "★") : managerGesicht(st.manager),
          el("div", { class: "mitte" },
            el("b", { text: r.name + (riv ? " · " + riv.chef : st.manager ? " · " + st.manager.name + " (du)" : " (du)") + (st.airlines[r.id].pokale ? " " + "🏆".repeat(Math.min(5, st.airlines[r.id].pokale)) : "") }),
            el("span", { class: "blass mini", text: `${geld(r.wert)} · ${r.routen} Linien · ${r.flugzeuge} ✈` }),
            el("div", { class: "spur" }, el("i", { style: { width: (r.wert / max * 100).toFixed(1) + "%", background: r.farbe } })),
            laune && laune.art !== "normal" ? el("div", { class: "laune " + laune.art, text: laune.text }) : spruch ? el("div", { class: "spruch", text: "„" + spruch + "“" }) : null,
            riv ? rivalenLinieEl(r.id) : null));
      }),
      L.assistent(ich(), "analyst") ? null : el("div", { class: "hinweis", text: "🔎 Mit einem Assistenten siehst du hier, welche Linie der Rivalen sich am meisten rechnet." }));
    erklaeren("rangliste");
  }

  // ---------- Meine Airline ----------
  // Name, Grundsätze und Assistenten. Jederzeit über das Menü erreichbar, alles änderbar.
  const FARBEN = ["#4FD1A5", "#6EC6FF", "#FF7FA8", "#F2C14E", "#B794F6", "#F6AD55"];
  // Was der Assistent alles macht, als Bildzeile (gleich für alle drei, nur unterschiedlich gut).
  const ASSIST_KANN = [["✨", "Rat"], ["💬", "Tipps"], ["❗", "Probleme"], ["📋", "Wochenbericht"]];
  const sterne = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const punkte = (v) => { const n = Math.max(1, Math.min(5, Math.round(1 + v / 2.4 * 4))); return "●".repeat(n) + "○".repeat(5 - n); };
  function meineAirline() {
    const p = ich();
    ui.modal = true;
    const alt = feld.querySelector(".meine");
    const scroll = alt ? alt.querySelector(".meine-spalte.breit").scrollTop : 0;
    if (alt) alt.remove();
    const neu = () => meineAirline();
    const pr = L.profil(p);
    const analyst = L.assistent(p, "analyst");
    const bloecke = Object.entries(L.GRUNDSAETZE).map(([k, g]) => grundsatzBlock(k, g, neu));
    const seite = el("div", { class: "seite store meine" },
      el("div", { class: "store-kopf" }, el("h1", { text: "✈️ Meine Airline" }),
        el("button", { class: "zu", text: "✕", "aria-label": "Schließen", onclick: () => { seite.remove(); ui.modal = false; } })),
      el("div", { class: "meine-reihe" },
        el("div", { class: "meine-spalte" },
          el("b", { class: "spaltentitel", text: "Manager" }),
          el("button", { class: "manager-karte", onclick: () => { seite.remove(); profilSeite((m) => { L.managerSetzen(st, m); nachAktion(); hudAktualisieren(); meineAirline(); }, meineAirline, "Fertig ✓"); } },
            st.manager ? managerGesicht(st.manager) : el("div", { class: "gesicht mgr-gesicht" }, "?"),
            el("span", { class: "mitte" }, el("b", { text: st.manager ? st.manager.name : "Noch kein Profil" }), el("small", { text: st.manager ? "ändern ✏️" : "Profil anlegen ✏️" }))),
          el("b", { class: "spaltentitel", text: "Name der Airline" }),
          el("input", { class: "namensfeld", value: p.name, maxlength: 18, onchange: (e) => { L.umbenennen(st, L.SPIELER, e.target.value); nachAktion(); neu(); } }),
          el("div", { class: "farben" }, FARBEN.map((f) => el("button", { class: "farbpunkt" + (p.farbe === f ? " an" : ""), style: { background: f }, "aria-label": "Farbe", onclick: () => { L.umbenennen(st, L.SPIELER, null, f); karte.fliegerEls.forEach((x) => x.remove()); karte.fliegerEls.clear(); nachAktion(); neu(); } }))),
          el("div", { class: "zeile" }, el("span", { text: "⭐ Ruf" }), el("b", { class: "rechts", text: Math.round(p.ruf) + " / 100" })),
          el("div", { class: "auslastung" }, el("i", { style: { width: p.ruf + "%", background: "#F2C14E" } })),
          el("div", { class: "blass mini", text: rufWirkung(p) }),
          werbeKnopf(neu)),
        el("div", { class: "meine-spalte breit" },
          el("b", { class: "spaltentitel", text: "Deine Grundsätze" }),
          el("div", { class: "wirkung" },
            el("div", {}, el("small", { text: "⭐ Qualität" }), el("b", { class: "sterne", text: "★".repeat(pr.sterne) + "☆".repeat(5 - pr.sterne) })),
            el("div", {}, el("small", { text: "🍽️ Kostet dich" }), el("b", { class: pr.essenKosten > 0 ? "minus" : "", text: pr.essenKosten > 0 ? Math.round(pr.essenKosten) + " € / Gast" : "nichts" })),
            el("div", {}, el("small", { text: "➕ Gebühren" }), el("b", { text: pr.extra ? "+" + pr.extra + " € / Gast" : "keine" }))),
          (st.wirkungenGestern || []).length ? el("div", { class: "hinweis", text: "🔎 Deine letzte Änderung: " + st.wirkungenGestern.map((w) => w.text + " brachte " + geld(w.gewinn, true) + " am Tag").join(" · ") }) : null,
          el("div", { class: "blass mini", text: analyst ? "Unter jeder Einstellung steht, was sie sofort bewirkt. ✨ ist der Rat von " + analyst.name + ". Am nächsten Morgen siehst du, was eine Änderung wirklich gebracht hat." : "Unter jeder Einstellung steht, was sie sofort bewirkt. Was sie an Gästen bringt, schätzt nur dein Assistent. Am nächsten Morgen siehst du die echte Wirkung." }),
          bloecke),
        el("div", { class: "meine-spalte" },
          el("b", { class: "spaltentitel", text: "Dein Assistent" }),
          assistKarte(neu))));
    feld.append(seite);
    seite.querySelector(".meine-spalte.breit").scrollTop = scroll;
    // Der Rat kommt Stück für Stück nach, damit das Fenster sofort da ist.
    if (analyst) bloecke.forEach((b, i) => setTimeout(() => { if (seite.isConnected) b._rat(); }, 60 + i * 40));
    erklaeren("meine");
  }
  // Ein Grundsatz: Wahl, feste Tatsache der gewählten Stufe, Rat des Analysten (kommt einen Moment später, damit nichts ruckelt).
  function grundsatzBlock(k, g, neu) {
    const p = ich();
    const jetzt = p.grundsaetze[k];
    const aus = k === "essenZahlen" && p.grundsaetze.essen === "keins";
    const knoepfe = {};
    const ratZeile = el("div", { class: "gs-rat" });
    const block = el("div", { class: "grundsatz2" + (aus ? " aus" : "") },
      el("div", { class: "gs-kopf" }, el("span", { class: "gs-icon", text: g.icon }), el("b", { text: g.name }),
        el("div", { class: "segment klein" }, Object.entries(g.optionen).map(([id, o]) => (knoepfe[id] = el("button", { class: jetzt === id ? "an" : "", onclick: () => { L.grundsatzSetzen(st, L.SPIELER, k, id); nachAktion(); neu(); } }, o.name))))),
      el("div", { class: "gs-fakt", text: aus ? "Ohne Essen gibt es nichts zu bezahlen." : g.optionen[jetzt].fakt }),
      ratZeile);
    block._rat = () => {
      if (aus || !ich().fluege.length) return;
      const rat = ratCache("gs" + k, () => L.ratGrundsatz(st, k));
      if (!rat) return;
      const e = rat.empfehlung;
      if (e && e !== jetzt && rat.optionen[e] && rat.optionen[e].spanne) {
        knoepfe[e].append(" ", icon("✨"));
        textSetzen(ratZeile, "✨ „" + g.optionen[e].name + "“ brächte etwa " + vonBis(rat.optionen[e].spanne, kurz) + " am Tag.");
      } else knoepfe[jetzt].append(" ", icon("✨"));
    };
    return block;
  }

  // Ein Assistent für alles: drei zur Wahl, mehr Sterne = genauer und teurer. Das Gehalt steht auch als Anteil am Tagesgewinn da.
  function assistKarte(neu) {
    const p = ich();
    const x = L.assistent(p);
    const gewinn = p.verlauf.length ? p.verlauf[p.verlauf.length - 1] + (x ? x.gehalt : 0) : 0;   // Gewinn vor Gehalt
    const anteil = (g) => (gewinn > 0 ? Math.max(1, Math.round(g / gewinn * 100)) + " % vom Gewinn" : null);
    const kann = el("div", { class: "chips" }, ASSIST_KANN.map(([i, t]) => el("span", { class: "chip", text: i + " " + t })));
    // Gesicht nur beim Eingestellten, damit die anderen in die schmale Spalte passen.
    const zeile = (id, k, an) => el("div", { class: "kandidat" + (an ? " an" : "") },
      an ? el("div", { class: "gesicht klein-gesicht" }, bildEl(k.bild, k.name[0])) : null,
      el("div", { class: "mitte" }, el("b", { text: k.name + " " }, el("span", { class: "sterne", text: sterne(k.sterne) })),
        el("small", { text: geld(k.gehalt) + "/Tag · " + k.mackeText }), anteil(k.gehalt) ? el("small", { class: "blass", text: "≈ " + anteil(k.gehalt) }) : null),
      an ? el("button", { class: "zu", text: "✕", title: "Entlassen", "aria-label": "Entlassen", onclick: () => { L.einstellen(st, L.SPIELER, null); nachAktion(); neu(); } })
        : el("button", { class: "nebenknopf", text: x ? "Wechseln" : "Einstellen", onclick: () => { L.einstellen(st, L.SPIELER, id); nachAktion(); neu(); } }));
    if (!x) return el("div", { class: "assist" },
      el("div", { class: "blass mini", text: "Noch niemand. Dein Assistent macht alles:" }), kann,
      Object.entries(L.ASSISTENTEN).map(([id, k]) => zeile(id, k, false)),
      el("div", { class: "blass mini", text: "Mehr ★ = genauer und übersieht weniger." }));
    const andere = Object.entries(L.ASSISTENTEN).filter(([id]) => id !== x.id);
    return el("div", { class: "assist" },
      zeile(x.id, x, true), kann,
      p.wochenbericht || (p.hinweise && p.hinweise.length) ? el("button", { class: "nebenknopf", text: "📋 Bericht ansehen", onclick: () => { meineZu(); zeigeBericht(); } }) : null,
      el("div", { class: "blass mini", text: "Oder jemand anderes:" }),
      andere.map(([id, k]) => zeile(id, k, false)));
  }
  // Ruf: was er bringt und wie man ihn hebt.
  function rufWirkung(p) {
    const w = Math.round(((0.55 + p.ruf / 100) / (0.55 + L.REGELN.rufStart / 100) - 1) * 100);
    return (w >= 0 ? "+" : "−") + Math.abs(w) + " % Gäste durch deinen Ruf. Wächst von selbst bis " + L.REGELN.rufNatur + ", darüber nur mit Werbung.";
  }
  function werbeKnopf(neu) {
    const p = ich(), preis = L.werbungPreis(st, L.SPIELER);
    return el("button", { class: "nebenknopf", disabled: p.geld < preis || p.ruf >= L.REGELN.rufMax, text: "📺 Werbung · " + geld(preis) + " (+" + L.REGELN.werbungRuf + " ⭐)", onclick: () => { L.werbung(st, L.SPIELER); nachAktion(); meldung("📺", "Werbekampagne läuft: Ruf +" + L.REGELN.werbungRuf + "."); neu(); } });
  }
  const VORSCHLAG = { vergleich: "⚔️ Vergleichen", abziehen: "− Einen Flug streichen", schliessen: "Linie schließen", billiger: "🔻 Preis senken", groesser: "⬆ Größeres Flugzeug" };
  function hinweisAusfuehren(h) {
    const p = ich();
    const r = p.routen.find((x) => x.id === h.id);
    p.hinweise = (p.hinweise || []).filter((x) => x !== h);
    if (!r) { tafelZu(); return; }
    if (h.vorschlag === "vergleich") { zeigeDuell(r.id); return; }
    if (h.vorschlag === "groesser") { editorOeffnen({ linie: r.id }); return; }
    if (h.vorschlag === "abziehen") { if (L.flugzeugeAuf(p, r.id).length > 1) L.abziehen(st, L.SPIELER, r.id); }
    else if (h.vorschlag === "schliessen") L.routeSchliessen(st, L.SPIELER, r.id);
    else if (h.vorschlag === "billiger") L.preisStufe(st, L.SPIELER, r.id, "angreifen");
    nachAktion();
    if (p.routen.some((x) => x.id === r.id)) zeigeRoute(r.id); else tafelZu();
  }
  function hinweisBox(h, mitName) {
    h.gelesen = true;
    return el("div", { class: "hinweis orange" }, el("div", { text: "❗ " + (mitName ? L.STADT[h.a].name + " – " + L.STADT[h.b].name + ": " : "") + h.text }),
      h.vorschlag === "schliessen" ? sicherKnopf(VORSCHLAG.schliessen, () => hinweisAusfuehren(h))
        : h.vorschlag ? el("button", { class: "nebenknopf", text: VORSCHLAG[h.vorschlag], onclick: () => hinweisAusfuehren(h) }) : null,
      mitName ? el("button", { class: "nebenknopf", text: "Ansehen", onclick: () => zeigeRoute(h.id) }) : null);
  }
  function meineZu() { const m = feld.querySelector(".meine"); if (m) m.remove(); ui.modal = false; }
  // ---------- Berater: Tipps der Assistenten als Sprechblase an der Linie ----------
  const STUFE_ORDNUNG = { angreifen: 0, normal: 1, abschoepfen: 2 };
  function tippInhalt(t) {
    const p = ich(), N = (id) => L.STADT[id].name;
    const r = t.route && p.routen.find((x) => x.id === t.route);
    const linie = r ? N(r.a) + "–" + N(r.b) : "";
    const plus = t.plus ? (t.plus[0] === t.plus[1] ? "etwa " + kurz(t.plus[0]) : kurz(t.plus[0]) + " bis " + kurz(t.plus[1]).replace("+", "")) + " am Tag" : "";
    const typ = t.typ ? L.TYPEN[t.typ].kurz : "";
    switch (t.art) {
      case "preis": {
        const rauf = STUFE_ORDNUNG[t.stufe] > STUFE_ORDNUNG[r.stufe];
        return rauf ? { text: `${linie} ist gefragter, als Plätze da sind. Teurere Tickets bringen ${plus}.`, knopf: "🔺 Preis erhöhen" }
          : { text: `Auf ${linie} bleiben Plätze leer. Günstigere Tickets bringen ${plus}.`, knopf: "🔻 Preis senken" };
      }
      case "dazu": return { text: `${linie} ist ausgebucht. Ein weiterer Flug mit der ${typ} bringt ${plus}` + (t.preis > 0 ? `, die Slots kosten einmalig ${geld(t.preis)}.` : "."), knopf: "＋ Flug hinzufügen" };
      case "umruesten": return { text: `${linie} ist ständig ausgebucht. Auf ${typ} umrüsten kostet ${geld(t.preis)} und bringt ${plus}.`, knopf: "⬆ Umrüsten · " + geld(t.preis) };
      case "abziehen": return { text: `Auf ${linie} bleibt viel leer. Ein Flug weniger bringt ${plus}.`, knopf: "− Einen Flug streichen" };
      case "kabine": return { text: `${linie}: Die Kabine der ${typ} passt nicht zu den Gästen. ${Math.round(t.business * 100)} % Business${t.first ? " und " + Math.round(t.first * 100) + " % First" : ""} bringen ${plus}. Der Umbau kostet ${geld(t.preis)} und einen Tag Werkstatt.`, knopf: "💺 Umbauen · " + geld(t.preis) };
      case "bieten": return { text: `In ${N(t.stadt)} wird ein Slot um ${uhr(t.h)} Uhr vergeben. Den können wir gut brauchen: Ich würde etwa ${geld(t.betrag)} bieten.`, knopf: "🎟️ Slot ansehen" };
      case "schliessen": return { text: `${linie} verliert seit ${t.tage} Tagen Geld, und nichts hilft. Schließen bringt ${plus}.`, knopf: "Linie schließen", sicher: true };
      case "neu": return { text: `Gute Strecke gefunden: ${N(t.start)}–${N(t.ziel)} mit ${typ}. Bringt ${plus}` + (t.kosten > 0 ? `, kostet einmalig ${geld(t.kosten)}.` : "."), knopf: "✏️ Ansehen" };
      case "mitfliegen": return { text: `${st.airlines[t.wer2].name} verdient auf ${N(t.start)}–${N(t.ziel)} gut: ${t.rivale[0] === t.rivale[1] ? "etwa " + kurz(t.rivale[0]) : kurz(t.rivale[0]) + " bis " + kurz(t.rivale[1]).replace("+", "")} am Tag. Fliegen wir mit, bringt uns das ${plus}. Rechne mit einem Preiskampf.`, knopf: "✏️ Ansehen" };
      case "plan": return { text: `${st.airlines[t.wer2 || "k"] ? "" : ""}${L.RIVALEN[tippRivale(t)] ? st.airlines[tippRivale(t)].name : "Ein Rivale"} will ${N(t.start)}–${N(t.ziel)} fliegen. Sind wir zuerst da, verzichten sie, und es lohnt sich: ${plus}.`, knopf: "✏️ Zuvorkommen" };
      default: return null;
    }
  }
  // Ohne Analyst: eine grobe Spanne (halb so genau wie der schwächste Analyst), damit man nie ganz ohne Zahl entscheidet.
  function grob(delta) { const d = Math.max(3000, Math.abs(delta) * 0.5); return [Math.round((delta - d) / 1000) * 1000, Math.round((delta + d) / 1000) * 1000]; }
  function tippRivale(t) { const g = st.gelegenheiten.find((x) => x.id === t.gel); return g ? g.aid : null; }
  function tippWer(t) { return L.assistent(ich(), t.rolle); }
  function tippAnnehmen(t) {
    const p = ich();
    if (t.art === "neu" || t.art === "plan" || t.art === "mitfliegen") { L.tippAusfuehren(st); editorOeffnen({ start: t.start, ziel: t.ziel, vor: { typ: t.typ } }); return; }
    if (t.art === "bieten") { zeigeSlot(t.slot); return; }
    const res = L.tippAusfuehren(st);
    L.zielPruefen(st);
    nachAktion();
    if (res && res.ok === false) meldung("⚠️", "Das hat leider nicht geklappt.");
    else meldung("✅", (tippWer(t) || { name: "" }).name + ": Erledigt!");
    if (ui.tafel === "route" && ui.route && !p.routen.some((r) => r.id === ui.route)) tafelZu();
  }
  let beraterEl = null;
  function beraterZeigen() {
    const t = st && !ui.heimat && !ui.editor && !ui.modal ? L.tipp(st) : null;
    const inhalt = t ? tippInhalt(t) : null;
    const wer = t && tippWer(t);
    if (!inhalt || !wer) { if (beraterEl) { beraterEl.remove(); beraterEl = null; } return; }
    const sig = t.key + "|" + t.tag;
    if (!beraterEl || beraterEl.dataset.sig !== sig) {
      if (beraterEl) beraterEl.remove();
      beraterEl = el("div", { class: "berater" },
        el("div", { class: "berater-kopf" },
          el("span", { class: "berater-gesicht" }, bildEl(wer.bild, "🧑‍💼")),
          el("div", { class: "berater-name" }, el("b", { text: wer.name }), el("small", { text: { analyst: "Neue Strecke", preis: "Preise", controller: "Deine Linien" }[t.rolle] })),
          el("button", { class: "berater-zu", text: "✕", "aria-label": "Später", onclick: () => { L.tippWeg(st); speichern(); karteZeichnen(); } })),
        el("div", { class: "berater-text", text: inhalt.text }),
        inhalt.sicher ? sicherKnopf(inhalt.knopf, () => tippAnnehmen(t)) : el("button", { class: "hauptknopf klein", text: inhalt.knopf, onclick: () => tippAnnehmen(t) }));
      beraterEl.dataset.sig = sig;
      feld.append(beraterEl);
      if (!einf.gesehen["regel-berater"]) setTimeout(() => { if (!ui.modal) erklaeren("berater"); }, 600);
    }
    // An die Linie heften: über ihre Mitte, sonst darunter. Am Rand bleibt die Blase im Bild.
    const p = ich();
    const r = t.route && p.routen.find((x) => x.id === t.route);
    const [mx, my] = r ? mitteVon(r.a, r.b) : t.stadt ? stadtXY[t.stadt] : mitteVon(t.start, t.ziel);
    const k = ui.kamera;
    let ax = mx * k.z + k.x;
    if (ax < 0) ax += L.WELT ? 0 : 0;
    const ay = my * k.z + k.y;
    const B = beraterEl.offsetWidth || 250, H = beraterEl.offsetHeight || 110;
    const cs = getComputedStyle(feld);
    const sl = parseFloat(cs.getPropertyValue("--sl")) || 0, sr = parseFloat(cs.getPropertyValue("--sr")) || 0;
    const rechtsFrei = feld.classList.contains("tafel-an") ? 300 : 0;
    const minX = 8 + sl, maxX = FELD_B - B - 8 - sr - rechtsFrei, minY = 52, maxY = FELD_H - H - 52;
    const oben = ay - H - 14 >= minY;
    const x = Math.max(minX, Math.min(maxX, ax - B / 2));
    const y = Math.max(minY, Math.min(maxY, oben ? ay - H - 14 : ay + 14));
    beraterEl.style.left = x + "px";
    beraterEl.style.top = y + "px";
    beraterEl.classList.toggle("unten", !oben);
    const imBild = ax >= minX && ax <= FELD_B - sr && Math.abs((oben ? ay - H - 14 : ay + 14) - y) < 2;
    beraterEl.classList.toggle("ohne-zipfel", !imBild);
    beraterEl.style.setProperty("--zipfel", Math.max(14, Math.min(B - 14, ax - x)) + "px");
  }

  function meldung(icon, text) {
    const e = el("div", { class: "meldung" }, icon, el("span", { text }));
    feld.append(e);
    setTimeout(() => e.remove(), 4300);
  }

  // Berichte der Assistenten: Schätzungen mit Spannen, nie ganz genau.
  const STUFE_TEXT = { angreifen: "🔻 Billiger", normal: "● Normal", abschoepfen: "🔺 Teurer" };
  const vonBis = (sp, f) => f(sp[0]) + " bis " + f(sp[1]);
  function zeigeBericht() {
    const p = ich();
    for (const au of Object.values(p.auftraege || {})) if (au && au.bericht) au.gelesen = true;
    const teile = [];
    const ctrl = L.assistent(p);
    if (ctrl) {
      teile.push(el("div", { class: "bericht-kopf" }, el("div", { class: "gesicht klein-gesicht" }, bildEl(ctrl.bild, ctrl.name[0])),
        el("div", {}, el("b", { text: ctrl.name + " " + sterne(ctrl.sterne) }), el("small", { class: "blass", text: "Dein Assistent" + (st.manager ? " · für " + L.anrede(st.manager) : "") }))));
      const hs = (p.hinweise || []).filter((h) => p.routen.some((r) => r.id === h.id));
      teile.push(hs.length ? hs.map((h) => hinweisBox(h, true)) : el("div", { class: "hinweis gruen", text: "✅ Gerade läuft alles rund." }));
      const w = p.wochenbericht;
      if (w) {
        w.gelesen = true;
        const plus = w.vorwoche == null ? null : w.woche - w.vorwoche;
        teile.push(el("div", { class: "vorschlag" },
          el("div", { class: "zeile" }, el("b", { text: "📋 Wochenbericht · Tag " + w.tag })),
          el("div", { class: "zeile mini" }, el("span", { text: "Gewinn der Woche" }), el("b", { class: "rechts", style: { color: farbeGewinn(w.woche) }, text: kurz(w.woche) })),
          plus != null ? el("div", { class: "zeile mini" }, el("span", { class: "blass", text: "gegen Vorwoche" }), el("b", { class: "rechts", style: { color: farbeGewinn(plus) }, text: (plus >= 0 ? "📈 " : "📉 ") + kurz(plus) })) : null,
          w.beste ? el("div", { class: "zeile mini" }, el("span", { text: "🏆 " + L.STADT[w.beste.a].name + " – " + L.STADT[w.beste.b].name }), el("b", { class: "rechts plus", text: kurz(w.beste.gewinn) })) : null,
          w.schwach.length ? el("div", { class: "blass mini", text: "Die schwächsten Linien:" }) : null,
          w.schwach.map((x, i) => {
            const k = x.aktion;
            const txt = !k ? null : k.art === "preis" ? STUFE_TEXT[k.stufe] : k.art === "abziehen" ? "− Einen Flug streichen" : "Linie schließen";
            return el("div", { class: "zeile mini" }, el("span", { class: "farbstrich", style: { background: farbeGewinn(x.gewinn) } }), el("span", { text: L.STADT[x.a].name + " – " + L.STADT[x.b].name + " " + kurz(x.gewinn) }),
              k && !x.erledigt ? el("button", { class: "nebenknopf rechts", text: txt + " · " + vonBis(x.plus, kurz), onclick: () => { L.wochenVorschlagUebernehmen(st, i); nachAktion(); zeigeBericht(); } })
                : el("span", { class: "rechts", text: x.erledigt ? "✓ erledigt" : "passt so" }));
          }),
          (w.neu || []).length ? el("div", { class: "blass mini", text: "Neue Strecken, die ich mir anschauen würde:" }) : null,
          (w.neu || []).filter((v) => !L.routeVon(p, v.start, v.ziel)).map((v) => el("div", { class: "zeile mini" },
            el("span", { text: "→ " + L.STADT[v.start].name + " – " + L.STADT[v.ziel].name + " " + TYP_ICON[v.typ] }),
            el("button", { class: "nebenknopf rechts", text: "✏️ " + vonBis(v.gewinn, kurz), onclick: () => editorOeffnen({ start: v.start, ziel: v.ziel, vor: { stufe: v.preis, typ: v.typ } }) })))));
      }
      teile.push(el("div", { class: "blass mini", text: "Nur Schätzungen (" + ctrl.mackeText + "). Jahreszeit und Konkurrenz ändern die Nachfrage." }));
    }
    tafel("bericht", "📋 Bericht", null, teile.length ? teile : el("div", { class: "hinweis", text: "Noch kein Bericht. Stelle in ✈️ Meine Airline einen Assistenten ein." }),
      el("button", { class: "nebenknopf", text: "✈️ Meine Airline", onclick: () => { tafelZu(); meineAirline(); } }));
  }

  function zeigeKasse() {
    const p = ich();
    const lt = st.letzterTag;
    const max = Math.max(1, ...p.verlauf.map(Math.abs));
    tafel("kasse", "💰 Kasse", "Geld " + geld(p.geld) + (p.kredit ? " · Kredit " + geld(p.kredit) : ""),
      el("div", { class: "blass mini", text: "Gewinn der letzten Tage:" }),
      L.verwaltungKosten(p) ? el("div", { class: "zeile mini" }, el("span", { text: "🏢 Verwaltung (" + p.routen.length + " Linien)" }), el("b", { class: "rechts minus", text: "−" + geld(L.verwaltungKosten(p)) + "/Tag" })) : null,
      L.gehaelter(p) ? el("div", { class: "zeile mini" }, el("span", { text: "👔 Assistenten" }), el("b", { class: "rechts minus", text: "−" + geld(L.gehaelter(p)) + "/Tag" })) : null,
      el("div", { class: "saeulen" }, p.verlauf.map((v) => el("div", { style: { height: Math.max(3, Math.abs(v) / max * 58) + "px", background: v >= 0 ? "#4ADE80" : "#F87171" } }))),
      p.kredit > 0 ? el("button", { class: "hauptknopf", disabled: p.geld <= 0, text: "Kredit tilgen (" + geld(Math.min(p.kredit, Math.max(0, p.geld))) + ")", onclick: () => { L.tilgen(st); nachAktion(); zeigeKasse(); } }) : null,
      lt ? lt.routen.map((r) => el("div", { class: "zeile mini" }, el("span", { class: "farbstrich", style: { background: farbeGewinn(r.gewinn) } }), el("span", { text: L.STADT[r.a].name + " – " + L.STADT[r.b].name }), el("b", { class: "rechts", style: { color: farbeGewinn(r.gewinn) }, text: kurz(r.gewinn) }))) : null);
  }

  function zeigeGelegenheit(gid) {
    const g = st.gelegenheiten.find((x) => x.id === gid);
    if (!g) return;
    const p = ich();
    const stadt = g.stadt && L.STADT[g.stadt].name;
    let titel = "", text = "", bildName = "air-ereignis-messe";
    const extra = [];
    if (g.art === "messe") {
      titel = "Messe in " + stadt; text = "Ab Tag " + g.von + " drei Tage lang doppelt so viele Geschäftsreisende.";
      extra.push(el("button", { class: "hauptknopf", text: "✏️ Flug nach " + stadt + " planen", onclick: () => editorOeffnen({ start: p.basis, ziel: g.stadt }) }));
    } else if (g.art === "plan") {
      const a = st.airlines[g.aid];
      bildName = "air-ereignis-plan";
      titel = a.name + " plant " + L.STADT[g.von].name + " – " + stadt;
      text = `In ${Math.max(1, g.tag - L.tagVon(st))} Tagen geht es los. Fliegst du die Strecke vorher, verzichtet ${a.name}.`;
      extra.push(el("button", { class: "hauptknopf", text: "✏️ Zuvorkommen", onclick: () => editorOeffnen({ start: g.von, ziel: g.stadt }) }));
    } else if (g.art === "slotangebot") {
      const a = st.airlines[g.aid];
      const F = L.slotFlug(p, g.slot);
      bildName = "air-ereignis-slotangebot";
      titel = a.name + " will deinen Slot";
      text = stadt + " " + uhr(g.h) + " Uhr. " + (F ? "Du fliegst darauf nach " + L.STADT[F.von === g.stadt ? F.nach : F.von].name + ": Dieser Flug fällt dann weg." : "Du nutzt ihn gerade nicht.");
      extra.push(el("button", { class: "hauptknopf", text: "Verkaufen · " + geld(g.preis, true), onclick: () => { const r = L.gelegenheitAnnehmen(st, g.id); nachAktion(); tafelZu(); if (r.ok) meldung("🤝", "Verkauft: " + geld(g.preis) + " von " + a.name + "."); } }));
      extra.push(el("button", { class: "nebenknopf", text: "Nein danke", onclick: () => { L.gelegenheitAblehnen(st, g.id); nachAktion(); tafelZu(); } }));
    } else if (g.art === "wahl") {
      const W = {
        streik: { bild: "air-ereignis-streik", titel: "Streik droht in " + stadt, text: "Das Bodenpersonal will mehr Lohn. Zahlst du nicht, wird vielleicht zwei Tage gestreikt: dann fliegt dort nur die Hälfte.", sicher: "Lohn zahlen · " + geld(g.preis), riskant: "Hart bleiben (50 % Streik)" },
        sturm: { bild: "air-ereignis-sturm", titel: "Sturm über " + stadt, text: "Streichst du die Flüge, verlierst du einen Tag dort. Fliegst du, geht es meist gut, sonst gibt es Schaden und Ärger.", sicher: "Heute nicht fliegen", riskant: "Trotzdem fliegen (30 % Schaden)" },
        kerosin: { bild: "air-ereignis-kerosin", titel: "Kerosinpreis wackelt", text: "Für eine Woche den Preis festmachen, oder pokern: vielleicht 20 % billiger, vielleicht 40 % teurer.", sicher: "Preis festmachen · " + geld(g.preis), riskant: "Pokern (50 : 50)" },
      }[g.typ];
      bildName = W.bild; titel = W.titel; text = W.text;
      extra.push(el("button", { class: "hauptknopf", disabled: p.geld < g.preis, text: "🛡️ " + W.sicher, onclick: () => { const t = L.wahlTreffen(st, g.id, true); nachAktion(); tafelZu(); if (t) meldung("✅", t); } }));
      extra.push(el("button", { class: "nebenknopf", text: "🎲 " + W.riskant, onclick: () => { const t = L.wahlTreffen(st, g.id, false); nachAktion(); tafelZu(); if (t) meldung("🎲", t); } }));
      extra.push(el("div", { class: "blass mini mitte-text", text: "Wählst du nichts, kommt es wie beim Risiko." }));
    } else {
      bildName = "air-ereignis-kerosin";
      titel = g.billig ? "Kerosin ist gerade billig" : "Kerosin ist gerade teuer";
      text = g.billig ? "Ein paar Tage lang kostet jeder Flug weniger." : "Ein paar Tage lang kostet jeder Flug mehr.";
    }
    const stunden = Math.max(0, Math.ceil(g.bis - st.zeit));
    tafel("gelegenheit", titel, g.info && g.art !== "plan" ? null : "Noch " + stunden + " Stunden",
      el("div", { class: "ereignisbild" }, bildEl(bildName, gelIcon(g))),
      el("div", { text }),
      extra);
  }

  // ---------- Drei Vorschläge für die erste Linie ----------
  const ANGEBOT = {
    guenstig: { icon: "💰", titel: "Günstiger Einstieg" },
    drehkreuz: { icon: "🔁", titel: "Gut für ein Drehkreuz" },
    chance: { icon: "🎲", titel: "Große Chance, mehr Risiko" },
  };
  function angeboteZeigen() {
    const p = ich();
    ui.angebote = L.angebote(st, L.SPIELER);
    if (!ui.angebote.length) { editorOeffnen(); return; }
    tafel("angebote", "Deine erste Linie", "Drei Vorschläge ab " + L.STADT[p.basis].name,
      ui.angebote.map((o) => el("button", { class: "wahl angebot " + o.art, onclick: () => { ui.angebote = null; editorOeffnen({ start: p.basis, ziel: o.ziel, vor: { typ: o.typ, e1: o.plan.e1, e2: o.plan.e2 } }); } },
        el("div", { class: "mitte" },
          el("small", { class: "angebot-art", text: ANGEBOT[o.art].icon + " " + ANGEBOT[o.art].titel }),
          el("div", { class: "angebot-zeile" }, el("b", { text: "→ " + L.STADT[o.ziel].name }), el("span", { class: "plus", text: kurz(o.von) + " bis " + kurz(o.bis) + " am Tag" })),
          el("div", { class: "angebot-zeile" }, el("span", { text: L.TYPEN[o.typ].name }), el("span", { class: "kostet", text: "kostet " + geld(o.gesamt) })),
          el("span", { class: "grund", text: o.grund })))),
      el("button", { class: "nebenknopf", text: "✏️ Lieber selbst planen", onclick: () => { ui.angebote = null; editorOeffnen(); } }));
  }

  // ---------- Linien-Editor ----------
  // Der einzige Weg zu neuen Linien. Links deine Linien, rechts der aktuelle Schritt.
  let editorEl = null;
  function editorOeffnen(opt) {
    opt = opt || {};
    entscheidungFertig();
    if (tafelEl) { tafelEl.remove(); tafelEl = null; } feld.classList.remove("tafel-an");
    ui.tafel = null; ui.stadt = null; ui.route = null;
    ui.editor = { start: opt.start || (opt.linie ? null : ich().basis), ziel: opt.ziel || null, linie: opt.linie || null, vor: opt.vor || null };
    feld.classList.add("editor-an");
    editorZeichnen();
    if (!gesehen("editor")) tippZeigen("Das ist der Linien-Editor. Die Startstadt ist schon gewählt. Grün leuchtende Ziele lohnen sich und haben einen Slot frei: Tippe eins an.", editorEl.querySelector(".editor-mitte"), "unten", "Okay");
  }
  function editorZu() {
    ui.editor = null;
    feld.classList.remove("editor-an", "tafel-an");
    if (editorEl) editorEl.remove();
    editorEl = null;
    if (tafelEl) { tafelEl.remove(); tafelEl = null; } feld.classList.remove("tafel-an");
    tippWeg();
    karteZeichnen();
  }
  function editorTippen(t) {
    const e = ui.editor;
    if (t && t.dataset.route) { editorLinie(t.dataset.route); return; }
    if (!t || !t.dataset.stadt) return;
    const id = t.dataset.stadt;
    if (e.linie) { e.linie = null; e.start = id; e.ziel = null; }
    else if (!e.start || e.wahlStart) { e.start = id; e.ziel = null; e.wahlStart = false; }
    else if (id === e.start) { e.ziel = null; }
    else e.ziel = id;
    e.typ = null;
    editorZeichnen();
  }
  function editorLinie(rid) {
    ui.editor = { start: null, ziel: null, linie: rid, typ: null, stufe: "normal" };
    editorZeichnen();
  }

  function editorZeichnen() {
    if (!ui.editor) return;
    const p = ich();
    const e = ui.editor;
    if (editorEl) editorEl.remove();
    const liste = el("div", { class: "editor-liste" },
      el("button", { class: "wahl neu" + (!e.linie ? " an" : ""), onclick: () => { ui.editor = { start: p.basis, ziel: null, linie: null, typ: null, stufe: "normal" }; editorZeichnen(); } },
        el("span", { class: "plus-gross", text: "＋" }), el("b", { text: "Neue Linie" })),
      p.routen.map((r) => { const z = routeZeile(r); if (e.linie === r.id) z.classList.add("an"); return z; }));
    let mitte;
    if (e.linie) mitte = "Linie bearbeiten";
    else if (!e.start || e.wahlStart) mitte = "① Tippe die Startstadt an";
    else if (!e.ziel) mitte = "② Tippe ein Ziel an: grün lohnt sich";
    else mitte = "③ Zeiten und Flugzeug wählen";
    editorEl = el("div", { class: "editor" },
      el("div", { class: "editor-kopf" },
        el("span", { class: "editor-titel", text: "✏️ Linien-Editor" }),
        el("span", { class: "editor-mitte", text: mitte }),
        el("button", { class: "hauptknopf klein", text: "Fertig", onclick: editorZu })),
      liste);
    feld.append(editorEl);
    if (e.linie) linieBearbeiten(e.linie);
    else if (e.start && e.ziel) { if (tafelEl) { tafelEl.remove(); tafelEl = null; } feld.classList.remove("tafel-an"); const vor = e.vor; e.vor = null; flugSeite(e.start, e.ziel, vor); }
    else if (e.start) startTafel(e.start);
    else if (tafelEl) { tafelEl.remove(); tafelEl = null; } feld.classList.remove("tafel-an");
    karteZeichnen();
  }

  function startTafel(id) {
    const p = ich();
    const heat = heatmap() || {};
    const gruen = Object.values(heat).filter((v) => v === "gruen").length;
    const hat = L.enden(st, p, id).length > 0;
    tafel("editor", "Start: " + L.STADT[id].name, KLASSE[L.STADT[id].k],
      el("div", { class: "legende gross" }, [["gruen", "lohnt sich"], ["gelb", "knapp"], ["rot", "Verlust"], ["grau", "kein Slot oder zu weit"]].map(([k, t]) => el("span", {}, el("i", { style: { background: HEAT[k] } }), t))),
      !hat ? el("div", { class: "hinweis orange", text: "In " + L.STADT[id].name + " hast du keinen freien Slot. Ohne Slot kein Abflug." })
        : el("div", { class: "hinweis gruen", text: gruen ? `${gruen} Ziele leuchten grün. Tippe eins auf der Karte an.` : "Von hier lohnt sich gerade kein Ziel mit freiem Slot." }),
      el("div", { class: "blass mini", text: "Farbig sind nur Ziele, an denen gerade ein Slot zu haben ist." }),
      L.hatTafel(p, id) ? el("button", { class: "nebenknopf", text: "🎟️ Deine Slot-Tafel in " + L.STADT[id].name, onclick: () => tafelSeite(id) }) : null,
      el("button", { class: "nebenknopf", text: "Andere Startstadt wählen", onclick: () => { ui.editor.wahlStart = true; ui.editor.ziel = null; editorZeichnen(); } }));
  }

  // ---------- Einen Flug bauen: Abflug wählen, Rückflug wählen, Flugzeug nimmt das Spiel ----------
  const endeKey = (e) => (e ? e.art + ":" + (e.id || e.h) : "");
  const fuellung = (x) => (x >= 0.9 ? ["voll", "#4ADE80"] : x >= 0.65 ? ["gut gefüllt", "#4ADE80"] : x >= 0.4 ? ["mittel", "#FACC15"] : ["schwach", "#F87171"]);
  function kabineText(typ, k) {
    const s = Math.round(L.TYPEN[typ].sitze * L.profil(ich()).sitze);
    const f = Math.round(s * k.first / L.KLASSEN.first.platz), b = Math.round(s * k.business / L.KLASSEN.business.platz), e = Math.round(s * (1 - k.first - k.business));
    return e + " Economy" + (b ? " · " + b + " Business" : "") + (f ? " · " + f + " First" : "");
  }
  function flugSeite(a, b, vor) {
    const p = ich();
    const alt = feld.querySelector(".flugseite");
    if (alt) alt.remove();
    ui.modal = true;
    if (!ui.flug || ui.flug.a !== a || ui.flug.b !== b) ui.flug = { a, b, e1: null, e2: null, fid: null, typ: null, stufe: "normal", kabine: null };
    const F = ui.flug;
    if (vor) Object.assign(F, vor);
    const vorhanden = L.routeVon(p, a, b);
    const km = L.entfernung(a, b);
    const zu = (fertig) => { seite.remove(); ui.modal = false; ui.flug = null; if (ui.editor && !fertig) { ui.editor.ziel = null; ui.editor.vor = null; editorZeichnen(); } };
    const nachH = (x, y) => x.h - y.h;
    const enden1 = L.enden(st, p, a).sort(nachH), enden2 = L.enden(st, p, b).sort(nachH);
    const typen = Object.keys(L.TYPEN).filter((t) => L.typFrei(st, p, t) && L.TYPEN[t].reichweite >= km);
    const kopf = el("div", { class: "store-kopf" },
      el("h1", {}, L.STADT[a].name + " – " + L.STADT[b].name, el("small", { text: (vorhanden ? "Weiterer Flug auf deiner Linie" : "Neue Linie") + " · " + Math.round(km).toLocaleString("de-DE") + " km" })),
      el("span", { class: "store-geld", text: "Dein Geld: " + geld(p.geld) }),
      el("button", { class: "zu", text: "✕", "aria-label": "Schließen", onclick: () => zu(false) }));
    const seite = el("div", { class: "seite store flugseite" }, kopf);
    feld.append(seite);
    const leer = (text, stadt) => { seite.append(el("div", { class: "flug-leer" }, el("div", { class: "hinweis", text }), stadt ? el("button", { class: "nebenknopf", text: "Flughafen " + L.STADT[stadt].name + " ansehen", onclick: () => { zu(false); if (ui.editor) editorZu(); zeigeStadt(stadt); } }) : null)); };
    if (!typen.length) { leer("Diese Strecke ist für deine Flugzeuge noch zu weit. Größere Typen gibt es, wenn deine Airline mehr wert ist."); return; }
    for (const [liste, ort] of [[enden1, a], [enden2, b]]) {
      if (liste.length) continue;
      const laeuft = L.poolIn(st, ort).filter((x) => x.bis != null).sort(nachH)[0];
      if (laeuft) {
        seite.append(el("div", { class: "flug-leer" },
          el("div", { class: "hinweis", text: "In " + L.STADT[ort].name + " wird gerade ein Slot vergeben: " + uhr(laeuft.h) + " Uhr. Biete darauf. Gewinnst du, kannst du den Flug anlegen." }),
          el("button", { class: "hauptknopf", text: "🎟️ Auf diesen Slot bieten", onclick: () => { zu(false); if (ui.editor) editorZu(); zeigeSlot(laeuft.id); } })));
      } else leer("In " + L.STADT[ort].name + (ort === a ? " hast du keinen freien Slot." : " ist gerade kein Slot zu haben.") + " Sobald dort einer frei wird, leuchtet ein goldener Ring. Du kannst auch einem Rivalen einen abkaufen.", ort);
      return;
    }
    // Vorbelegung: die beste Kombination, am liebsten mit einem Flugzeug, das schon da ist.
    if (!enden1.some((x) => endeKey(x) === endeKey(F.e1)) || !enden2.some((x) => endeKey(x) === endeKey(F.e2))) {
      F.e1 = null; F.e2 = null;
      const eigene = [...new Set(p.flotte.map((f) => f.typ))].filter((t) => typen.includes(t));
      for (const typ of [...(F.typ ? [F.typ] : []), ...eigene, ...typen]) {
        const t = L.flugFinden(st, L.SPIELER, a, b, typ);
        if (t.plan) { F.e1 = t.plan.e1; F.e2 = t.plan.e2; break; }
      }
      if (!F.e1) { F.e1 = enden1[0]; F.e2 = enden2[0]; }
    } else { F.e1 = enden1.find((x) => endeKey(x) === endeKey(F.e1)); F.e2 = enden2.find((x) => endeKey(x) === endeKey(F.e2)); }
    // Welche eigenen Flugzeuge haben zu dieser Zeit Zeit?
    const eigene = [];
    for (const f of p.flotte) {
      if (L.TYPEN[f.typ].reichweite < km || L.inWerkstatt(st, f)) continue;
      const z = L.zeiten(p, a, b, f.typ, F.e1.h, F.e2.h);
      if (z.passt && L.flugzeugFrei(p, f, a, z.ab, z.dauer)) eigene.push({ f, z });
    }
    const analyst = L.assistent(p, "analyst");
    const rat = analyst ? ratCache("kauf" + a + b + endeKey(F.e1) + endeKey(F.e2), () => L.ratKauf(st, { x: a, y: b, e1: F.e1, e2: F.e2 })) : null;
    const neue = typen.filter((t) => L.zeiten(p, a, b, t, F.e1.h, F.e2.h).passt)
      .map((t) => ({ typ: t, g: L.schaetzen(st, L.SPIELER, a, b, t, F.e1.h, F.e2.h, true).gewinn - L.TYPEN[t].preis / 45 }))
      .sort((x, y) => (rat && y.typ === rat.typ ? 1 : 0) - (rat && x.typ === rat.typ ? 1 : 0) || y.g - x.g);
    if (F.fid && !eigene.some((x) => x.f.id === F.fid)) F.fid = null;
    if (!F.fid && F.typ && !neue.some((x) => x.typ === F.typ)) F.typ = null;
    if (!F.fid && !F.typ) { if (eigene.length) F.fid = eigene[0].f.id; else if (neue.length) F.typ = neue[0].typ; }
    const flieger = F.fid ? p.flotte.find((f) => f.id === F.fid) : null;
    const typ = flieger ? flieger.typ : F.typ;
    const zRef = L.zeiten(p, a, b, typ || typen[0], F.e1.h, F.e2.h);
    // Kabine für ein neues Flugzeug: Der Analyst stellt sie ein, ohne ihn gibt es nur Economy.
    const gr = typ ? L.kabineGrenzen(typ) : { business: 0, first: 0 };
    const kabinen = [];
    if (typ && !flieger && gr.business > 0) {
      kabinen.push({ id: "eco", name: "Nur Economy", k: { business: 0, first: 0 } });
      kabinen.push({ id: "mix", name: "Etwas Business", k: { business: Math.min(gr.business, 0.1), first: 0 } });
      kabinen.push({ id: "viel", name: gr.first ? "Business + First" : "Viel Business", k: { business: gr.business >= 0.4 ? 0.3 : gr.business, first: gr.first ? 0.1 : 0 } });
      if (rat && rat.typ === typ) {
        const gleich = kabinen.find((x) => x.k.business === rat.kabine.business && x.k.first === rat.kabine.first);
        if (gleich) gleich.rat = true; else kabinen.unshift({ id: "rat", name: Math.round(rat.kabine.business * 100) + " % Business" + (rat.kabine.first ? ", " + Math.round(rat.kabine.first * 100) + " % First" : ""), k: rat.kabine, rat: true });
      }
      if (!F.kabine || !kabinen.some((x) => x.id === F.kabine)) F.kabine = (kabinen.find((x) => x.rat) || kabinen[0]).id;
    }
    const kab = kabinen.find((x) => x.id === F.kabine);
    const plan = typ ? { x: a, y: b, typ, fid: F.fid, e1: F.e1, e2: F.e2, stufe: vorhanden ? null : F.stufe, kabine: flieger ? null : kab ? kab.k : { business: 0, first: 0 } } : null;
    const test = plan ? L.flugFinden(st, L.SPIELER, a, b, typ, { e1: F.e1, e2: F.e2, fid: F.fid, neu: !F.fid }) : { ok: false, grund: "zeit" };
    const schau = plan && test.ok ? L.flugVorschau(st, plan) : null;
    const ratF = schau && analyst ? ratCache("flug" + endeKey(F.e1) + endeKey(F.e2) + typ + F.fid + F.stufe + F.kabine, () => L.ratFlug(st, plan, schau.delta)) : null;
    // Empfohlene Uhrzeiten (nur mit Analyst): die Zeit, zu der die meisten Leute fliegen wollen.
    const w = (L.STADT[a].w + L.STADT[b].w) / 2;
    const besteZeit = (liste) => (analyst && liste.length > 1 ? liste.slice().sort((x, y) => L.zeitGuete(y.h, w) - L.zeitGuete(x.h, w))[0] : null);
    const kachel = (e, stadt, gewaehlt, aus, grund, tipp, wenn) => el("button", { class: "slotkachel klein " + L.zeitArt(e.h) + (e.art === "slot" ? " mein" : "") + (gewaehlt ? " an" : "") + (aus ? " aus" : ""), disabled: aus, onclick: wenn },
      el("b", { text: uhr(e.h) + (tipp ? " ✨" : "") }),
      el("span", { text: aus ? grund : e.art === "slot" ? "dein Slot" : e.preis ? geld(e.preis) : "geschenkt" }));
    const tipp1 = besteZeit(enden1);
    const passend2 = enden2.filter((e) => L.zeiten(p, a, b, typ || typen[0], F.e1.h, e.h).passt);
    const tipp2 = besteZeit(passend2);
    const spalte1 = el("div", { class: "flug-spalte" },
      el("b", { text: "1. Hinflug: Wann ab " + L.STADT[a].name + "?" }),
      p.geschenk > 0 && L.hatTafel(p, a) ? el("span", { class: "blass mini", text: (p.geschenk === 1 ? "🎁 Zu Hause ist noch 1 Slot geschenkt." : "🎁 Zu Hause sind " + p.geschenk + " Slots geschenkt.") + " Gold umrandet: begehrte Zeit." }) : null,
      el("div", { class: "kachelgitter" }, enden1.map((e) => kachel(e, a, endeKey(e) === endeKey(F.e1), false, "", tipp1 === e, () => { F.e1 = e; flugSeite(a, b); }))),
      el("span", { class: "flug-zeit", text: "Ab " + L.STADT[a].name + " " + uhr(zRef.ab) + ", an " + L.STADT[b].name + " " + uhr(zRef.an) + " Ortszeit." }));
    const spalte2 = el("div", { class: "flug-spalte" },
      el("b", { text: "2. Rückflug: Wann ab " + L.STADT[b].name + "?" }),
      el("div", { class: "kachelgitter" }, enden2.map((e) => {
        const z = L.zeiten(p, a, b, typ || typen[0], F.e1.h, e.h);
        return kachel(e, b, endeKey(e) === endeKey(F.e2), !z.passt, e.h < z.an + z.wende ? "zu früh" : "zu spät", tipp2 === e, () => { F.e2 = e; flugSeite(a, b); });
      })),
      el("span", { class: "blass mini", text: "Das Flugzeug braucht nach der Landung " + Math.round(zRef.wende * 60) + " Minuten am Boden." }),
      zRef.passt ? el("span", { class: "flug-zeit", text: "Ab " + L.STADT[b].name + " " + uhr(zRef.rueck) + (zRef.rueck >= 24 ? " am nächsten Tag" : "") + ", an " + L.STADT[a].name + " " + uhr(zRef.heim) + "." + (zRef.tage > 1 ? " Fliegt jeden zweiten Tag." : "") })
        : el("span", { class: "flug-zeit rot", text: "Diese Zeiten passen nicht zusammen: Wähle einen späteren Rückflug oder einen früheren Hinflug." }));
    const chip = (an, typ, ersatz, name, unter, tipp, wenn) => el("button", { class: "fz-chip" + (an ? " an" : ""), onclick: wenn },
      el("div", { class: "fz-bild" }, flugzeugBild(typ, ersatz)), el("b", { text: name + (tipp ? " ✨" : "") }), el("small", { text: unter }));
    const hin = schau && schau.flug ? fuellung(schau.flug.hin.last) : null, zur = schau && schau.flug ? fuellung(schau.flug.zur.last) : null;
    const neuLinie = !vorhanden;
    const spalte3 = el("div", { class: "flug-spalte ergebnis" },
      el("b", { text: "3. Flugzeug" }),
      el("div", { class: "fz-reihe" },
        eigene.map(({ f }) => chip(F.fid === f.id, f.typ, TYP_ICON[f.typ], "Dein " + L.TYPEN[f.typ].kurz, "hat Zeit", false, () => { F.fid = f.id; F.typ = null; flugSeite(a, b); })),
        neue.map((x) => chip(!F.fid && F.typ === x.typ, x.typ, TYP_ICON[x.typ], L.TYPEN[x.typ].kurz, "kaufen " + geld(L.TYPEN[x.typ].preis), !!rat && rat.typ === x.typ, () => { F.fid = null; F.typ = x.typ; F.kabine = null; flugSeite(a, b); }))),
      typ ? el("span", { class: "blass mini", text: flieger ? kabineText(typ, flieger.kabine) : L.TYPEN[typ].sitze + " Sitze · " + L.TYPEN[typ].reichweite.toLocaleString("de-DE") + " km weit · " + (TYP_TEXT[typ] || "") }) : el("span", { class: "flug-zeit rot", text: "Kein Flugzeug schafft diese Zeiten." }),
      typ && zRef.passt ? tagesbalken(F.fid, { ab: zRef.ab, dauer: zRef.dauer, ziel: b }) : null,
      kabinen.length ? el("div", { class: "segment klein" }, kabinen.map((x) => el("button", { class: F.kabine === x.id ? "an" : "", onclick: () => { F.kabine = x.id; flugSeite(a, b); } }, x.name + (x.rat ? " ✨" : "")))) : null,
      kab ? el("span", { class: "blass mini", text: "Kabine: " + kabineText(typ, kab.k) + ". Umbauen geht später, kostet aber." }) : null,
      neuLinie ? preisSegment(F.stufe, km, (s) => { F.stufe = s; flugSeite(a, b); }) : null,
      hin ? el("div", { class: "fuell" },
        el("div", {}, el("span", { text: "Hinflug " + uhr(zRef.ab) }), el("b", { style: { color: hin[1] }, text: hin[0] })),
        el("div", {}, el("span", { text: "Rückflug " + uhr(zRef.rueck) }), el("b", { style: { color: zur[1] }, text: zur[0] }))) : null,
      analyst ? (ratF ? ratBox(analyst, "Bringt etwa " + kurz(ratF.gewinn[0]) + " bis " + kurz(ratF.gewinn[1]) + " am Tag." + (rat && rat.typ !== typ && !flieger ? " Ich würde den " + L.TYPEN[rat.typ].kurz + " nehmen." : "") + " ✨ zeigt, was ich empfehle.") : null)
        : null,
      // Unten, direkt über dem Knopf: was es bringt, was es kostet, was übrig bleibt. Ohne Analyst grob geschätzt.
      el("div", { class: "kauf-fuss" },
      test.ok && schau ? el("span", { class: "kauf-zahl", text: (ratF ? "✨ Bringt etwa " + kurz(ratF.gewinn[0]) + " bis " + kurz(ratF.gewinn[1]).replace("+", "") : "Grob geschätzt " + kurz(grob(schau.delta)[0]) + " bis " + kurz(grob(schau.delta)[1]).replace("+", "")) + " am Tag" }) : null,
      test.ok && test.kosten.gesamt ? el("span", { class: "blass mini mitte-text", text: [test.kosten.flugzeug ? "Flugzeug " + geld(test.kosten.flugzeug) : null, test.kosten.slots ? "Slots " + geld(test.kosten.slots) : null, "danach bleiben dir " + geld(p.geld - test.kosten.gesamt)].filter(Boolean).join(" · ") }) : null,
      el("button", { class: "hauptknopf gross-knopf", disabled: !test.ok,
        text: !test.ok ? (GRUND[test.grund] || "geht nicht") + (test.grund === "geld" && test.kosten ? " (" + geld(test.kosten.gesamt) + ")" : "") : (neuLinie ? "Linie eröffnen" : "Flug hinzufügen") + (test.kosten.gesamt ? " · " + geld(test.kosten.gesamt) : ""),
        onclick: () => {
          const r = L.flugAnlegen(st, L.SPIELER, plan);
          if (!r.ok) return;
          ton(test.kosten.flugzeug ? "kauf" : "linie"); if (test.kosten.flugzeug) setTimeout(() => ton("linie"), 350);
          if (ui.tempo === 0 && p.fluege.length === 1) tempo(1);
          L.zielPruefen(st);
          zu(true);
          nachAktion();
          meldungenZeigen();
          if (!ui.editor) feld.classList.add("editor-an");
          ui.editor = { start: null, ziel: null, linie: r.route.id, typ: null, stufe: "normal" };
          editorZeichnen();
          if (!gesehen("erste-linie")) tippZeigen("Deine erste Linie fliegt! Jeden Tag ein Hin- und ein Rückflug. Tippe auf „Fertig“, um zuzuschauen.", editorEl.querySelector(".hauptknopf.klein"), "unten", "Okay");
        } })));
    seite.append(el("div", { class: "flug-reihe" }, spalte1, spalte2, spalte3));
    erklaeren("slots");
  }

  function preisSegment(stufe, km, wenn, empf) {
    const p = ich();
    return el("div", { class: "segment" }, Object.entries(L.STUFEN).map(([id, s]) => el("button", { class: stufe === id ? "an" : "", onclick: () => wenn(id) },
      { angreifen: "🔻 Billiger", normal: "● Normal", abschoepfen: "🔺 Teurer" }[id] + (empf === id ? " ✨" : ""),
      el("small", { text: Math.round(L.ticket(km) * L.profil(p).preis * s.preis) + " €" }))));
  }

  function linieBearbeiten(rid) {
    const p = ich();
    const r = p.routen.find((x) => x.id === rid);
    if (!r) { ui.editor = { start: p.basis, ziel: null, linie: null, typ: null, stufe: "normal" }; editorZeichnen(); return; }
    const e = L.rechnung(st).routen[rid];
    const analyst = L.assistent(p, "analyst");
    const rat = analyst ? ratCache("preis" + rid, () => L.ratPreis(st, rid)) : null;
    const empf = rat && rat.empfehlung !== r.stufe ? rat.empfehlung : null;
    const start = e.fluege.length ? e.fluege[0].von : r.a;
    tafel("editor", L.STADT[r.a].name + " – " + L.STADT[r.b].name, e.km.toLocaleString("de-DE") + " km",
      el("div", { class: "zeile" }, el("span", { class: "gross zahl", style: { color: farbeGewinn(e.gewinn) }, text: kurz(e.gewinn) }), el("span", { class: "blass", text: "pro Tag" })),
      e.zubringer > 1000 ? el("div", { class: "hinweis gruen", text: `🔁 Bringt zusätzlich ${kurz(e.zubringer)} auf Anschlussflügen.` }) : null,
      sitzplan(e.auslastung),
      el("div", { class: "blass mini", text: "Flüge auf dieser Linie (jeden Tag):" }),
      e.fluege.map((fl) => el("div", { class: "flugzeile" },
        el("div", { class: "mitte" },
          el("b", { text: uhr(fl.z.ab) + " hin · " + uhr(fl.z.rueck) + " zurück" }),
          el("span", { text: L.TYPEN[fl.typ].kurz + (fl.ruht ? " · heute in der Werkstatt" : " · hin " + prozent(fl.hin.last) + " · zurück " + prozent(fl.zur.last)) + (fl.z.tage > 1 ? " · jeden 2. Tag" : "") })),
        sicherKnopf("✕", () => { L.flugStreichen(st, L.SPIELER, fl.id); nachAktion(); if (ich().routen.some((x) => x.id === rid)) editorZeichnen(); else { ui.editor = { start: p.basis, ziel: null, linie: null, typ: null, stufe: "normal" }; editorZeichnen(); } }))),
      el("button", { class: "hauptknopf", text: "＋ Weiterer Flug auf dieser Linie", onclick: () => flugSeite(start, start === r.a ? r.b : r.a) }),
      el("div", { class: "blass mini", text: "Ticketpreis: billiger bringt mehr Gäste, teurer mehr Geld pro Gast." }),
      preisSegment(r.stufe, e.km, (s) => { L.preisStufe(st, L.SPIELER, rid, s); nachAktion(); editorZeichnen(); }, empf),
      rat ? el("div", { class: "blass mini", text: "✨ " + analyst.name + ": " + (empf ? L.STUFEN[empf].kurz + " brächte etwa " + vonBis(rat.optionen[empf].spanne, kurz) + " am Tag." : "Der Preis passt so.") }) : null,
      detailsBox("linie", "Details: größeres Flugzeug", umruestenZeile(r, e) || el("div", { class: "blass mini", text: "Gerade gibt es kein größeres Flugzeug für diese Linie." })),
      sicherKnopf("Linie schließen", () => { L.routeSchliessen(st, L.SPIELER, rid); nachAktion(); ui.editor = { start: p.basis, ziel: null, linie: null, typ: null, stufe: "normal" }; editorZeichnen(); }),
      el("div", { class: "blass mini", text: "Gestrichene Flüge: Das Flugzeug bleibt in deiner Flotte, die Slots bleiben bis zum Saisonende." }));
    if (einf.gesehen["erste-linie"] && !tippEl) erklaeren("linie");
  }


  // Knopf für Schritte, die etwas wegnehmen: erst beim zweiten Tippen passiert es.
  function sicherKnopf(text, aktion) {
    let scharf = false, uhr = null;
    const b = el("button", { class: "nebenknopf", text, onclick: () => {
      if (!scharf) {
        scharf = true; b.textContent = "Wirklich? Nochmal tippen"; b.classList.add("warnknopf");
        uhr = setTimeout(() => { scharf = false; b.textContent = text; b.classList.remove("warnknopf"); }, 3000);
        return;
      }
      clearTimeout(uhr); aktion();
    } });
    return b;
  }

  // Eingeklappter Bereich für alles, was man selten braucht. Bleibt offen, wenn man ihn geöffnet hat.
  function detailsBox(id, titel, ...inhalt) {
    ui.details = ui.details || {};
    const offen = !!ui.details[id];
    return el("div", { class: "details" + (offen ? " offen" : "") },
      el("button", { class: "details-kopf", onclick: (ev) => { ui.details[id] = !offen; const box = ev.currentTarget.parentNode; box.classList.toggle("offen"); ui.details[id] = box.classList.contains("offen"); } },
        el("span", { class: "pfeilchen", text: "▸" }), titel),
      el("div", { class: "details-rumpf" }, inhalt));
  }

  // Umrüsten: das kleinste Flugzeug der Linie gegen ein größeres tauschen (das alte wird verkauft).
  function umruestenZeile(r, e) {
    const p = ich();
    const k0 = L.umruestenKosten(st, L.SPIELER, r.id, "a380");
    if (!k0) return null;
    const altSitze = L.TYPEN[k0.alt.typ].sitze;
    const typen = Object.keys(L.TYPEN).filter((t) => L.TYPEN[t].sitze > altSitze && L.TYPEN[t].reichweite >= e.km && L.typFrei(st, p, t)).slice(0, 3);
    if (!typen.length) return null;
    return el("div", {}, el("div", { class: "blass mini", text: "⬆ Umrüsten (" + L.TYPEN[k0.alt.typ].kurz + " wird verkauft):" }),
      el("div", { class: "knopfreihe" }, typen.map((t) => {
        const k = L.umruestenKosten(st, L.SPIELER, r.id, t);
        return el("button", { class: "nebenknopf", disabled: p.geld < k.preis, text: L.TYPEN[t].kurz + " · " + geld(k.preis), onclick: () => { L.umruesten(st, L.SPIELER, r.id, t); nachAktion(); editorZeichnen(); } });
      })));
  }
  // ---------- Statistik ----------
  // Alles auf einen Blick: oben die wichtigsten Zahlen, darunter Linien, Städte oder Verlauf. Antippen springt zur Linie.
  function statistikZeigen(reiter, sortierung) {
    const p = ich();
    ui.statReiter = reiter || ui.statReiter || "linien";
    ui.statSort = sortierung || ui.statSort || "gewinn";
    ui.modal = true;
    const alt = feld.querySelector(".statistik");
    if (alt) alt.remove();
    const rg = L.rechnung(st);
    const zu = () => { seite.remove(); ui.modal = false; };
    const linien = p.routen.map((r) => ({ r, e: rg.routen[r.id] })).filter((x) => x.e).map(({ r, e }) => ({
      r, e, wert: e.wert, aus: Math.min(1, e.auslastung), gaeste: Math.round(e.pax || 0), n: L.fluegeAuf(p, r.id).length,
      name: L.STADT[r.a].name + " – " + L.STADT[r.b].name, hinweis: (p.hinweise || []).some((h) => h.id === r.id) }));
    const v = p.verlauf;
    const woche = v.slice(-7).reduce((a, x) => a + x, 0);
    const schnittAus = linien.length ? linien.reduce((a, x) => a + x.aus, 0) / linien.length : 0;
    const verw = L.verwaltungKosten(p);
    const kachel = (icon, titel, wert, farbe) => el("div", { class: "stat-kachel" }, el("small", { text: icon + " " + titel }), el("b", { text: wert, style: farbe ? { color: farbe } : null }));
    const kopf = el("div", { class: "stat-kacheln" },
      kachel("💰", "Gestern", v.length ? kurz(v[v.length - 1]) : "–", v.length ? farbeGewinn(v[v.length - 1]) : null),
      kachel("🗓️", "Diese Woche", kurz(woche), farbeGewinn(woche)),
      kachel("✈️", "Linien", String(p.routen.length)),
      kachel("🛩️", "Flugzeuge", p.flotte.length + (L.freieFlugzeuge(p).length ? " (" + L.freieFlugzeuge(p).length + " frei)" : "")),
      kachel("💺", "Auslastung", Math.round(schnittAus * 100) + " %", schnittAus > 0.75 ? "#4ADE80" : schnittAus > 0.55 ? "#FACC15" : "#F87171"),
      kachel("⭐", "Ruf", String(Math.round(p.ruf))),
      kachel("🏢", "Verwaltung", verw ? "−" + kurz(verw).replace(/^[+−]/, "") : "keine", verw ? "#F87171" : null));
    const reiterLeiste = el("div", { class: "segment stat-reiter" }, [["linien", "✈️ Linien"], ["staedte", "🏠 Städte"], ["verlauf", "📈 Verlauf"]].map(([id, t]) =>
      el("button", { class: ui.statReiter === id ? "an" : "", onclick: () => statistikZeigen(id) }, t)));
    let inhalt;
    if (ui.statReiter === "linien") {
      const SORT = { gewinn: (x, y) => y.wert - x.wert, auslastung: (x, y) => y.aus - x.aus, gaeste: (x, y) => y.gaeste - x.gaeste, name: (x, y) => x.name.localeCompare(y.name) };
      linien.sort(SORT[ui.statSort] || SORT.gewinn);
      const maxW = Math.max(1, ...linien.map((x) => Math.abs(x.wert)));
      const sp = (id, t) => el("button", { class: "stat-sp" + (ui.statSort === id ? " an" : ""), onclick: () => statistikZeigen("linien", id) }, t + (ui.statSort === id ? " ▼" : ""));
      inhalt = el("div", { class: "stat-tabelle" },
        el("div", { class: "stat-zeile stat-kopf" }, sp("name", "Linie"), el("span", { text: "✈️" }), sp("auslastung", "Auslastung"), sp("gaeste", "Gäste/Tag"), sp("gewinn", "Gewinn/Tag")),
        linien.length ? linien.map((x) => el("button", { class: "stat-zeile", onclick: () => { zu(); zeigeRoute(x.r.id); } },
          el("span", { class: "stat-name" }, el("i", { class: "farbstrich", style: { background: farbeGewinn(x.wert) } }), x.hinweis ? "❗ " : "", x.name),
          el("span", { text: String(x.n) }),
          el("span", { class: "stat-balken" }, el("i", { style: { width: Math.round(x.aus * 100) + "%", background: x.aus > 0.75 ? "#4ADE80" : x.aus > 0.5 ? "#FACC15" : "#F87171" } }), el("small", { text: Math.round(x.aus * 100) + " %" })),
          el("span", { text: x.gaeste.toLocaleString("de-DE") }),
          el("span", { class: "stat-gewinn" }, el("i", { style: { width: Math.round(Math.abs(x.wert) / maxW * 100) + "%", background: farbeGewinn(x.wert) } }), el("b", { style: { color: farbeGewinn(x.wert) }, text: kurz(x.wert) }))))
          : el("div", { class: "hinweis", text: "Noch keine Linien." }));
    } else if (ui.statReiter === "staedte") {
      const st2 = {};
      for (const x of linien) for (const c of [x.r.a, x.r.b]) {
        const o = st2[c] = st2[c] || { c, linien: 0, wert: 0, umst: 0 };
        o.linien++; o.wert += x.wert / 2; o.umst += (x.e.umsteigerPax || 0) / 2;
      }
      const liste = Object.values(st2).sort((x, y) => y.linien - x.linien || y.wert - x.wert);
      inhalt = el("div", { class: "stat-tabelle" },
        el("div", { class: "stat-zeile stat-kopf staedte" }, el("span", { text: "Stadt" }), el("span", { text: "Linien" }), el("span", { text: "🔁 Umsteiger" }), el("span", { text: "🎟️ Slots genutzt" }), el("span", { text: "Gewinn/Tag" })),
        liste.map((o) => el("button", { class: "stat-zeile staedte", onclick: () => { zu(); zeigeStadt(o.c); } },
          el("span", { class: "stat-name" }, (o.c === p.basis ? "🏠 " : "") + ((p.ausgebaut || []).includes(o.c) ? "🏗️ " : "") + L.STADT[o.c].name),
          el("span", { text: String(o.linien) + (o.linien >= L.REGELN.drehkreuzAb ? " 🔁" : "") }),
          el("span", { text: Math.round(o.umst).toLocaleString("de-DE") }),
          el("span", { text: L.slotsIn(p, o.c).filter((x) => L.slotFlug(p, x.id)).length + " von " + L.slotsIn(p, o.c).length }),
          el("b", { style: { color: farbeGewinn(o.wert) }, text: kurz(o.wert) }))));
    } else {
      const saeulen = (werte, farbe, max) => { const m = max || Math.max(1, ...werte.map(Math.abs)); return el("div", { class: "saeulen gross" }, werte.map((w) => el("div", { title: String(w), style: { height: Math.max(3, Math.abs(w) / m * 70) + "px", background: farbe ? farbe(w) : "#F2C14E" } }))); };
      const naechste = L.verwaltungKosten(p, p.routen.length + 1) - verw;
      inhalt = el("div", { class: "stat-verlauf" },
        el("div", { class: "stat-block" }, el("b", { text: "💰 Gewinn pro Tag (14 Tage)" }), saeulen(v, (w) => (w >= 0 ? "#4ADE80" : "#F87171"))),
        el("div", { class: "stat-block" }, el("b", { text: "⭐ Ruf (14 Tage)" }), saeulen(p.rufVerlauf || [Math.round(p.ruf)], null, 100), el("small", { class: "blass", text: rufWirkung(p) })),
        el("div", { class: "stat-block" }, el("b", { text: "🏢 Verwaltung" }),
          el("small", { text: `Die ersten ${L.REGELN.verwaltungFrei} Linien kosten nichts. Jetzt: ${verw ? geld(verw) : "nichts"} am Tag. Die nächste Linie kostet zusätzlich ${geld(naechste)} am Tag.` }),
          el("small", { class: "blass", text: "Wenige starke Linien schlagen viele schwache." })));
    }
    const seite = el("div", { class: "seite store statistik" },
      el("div", { class: "store-kopf" }, el("h1", { text: "📊 Statistik" }), el("button", { class: "zu", text: "✕", "aria-label": "Schließen", onclick: zu })),
      kopf, reiterLeiste, el("div", { class: "stat-inhalt" }, inhalt));
    feld.append(seite);
    erklaeren("statistik");
  }

  // ---------- Menü ----------
  function menueZeigen() {
    if (feld.querySelector(".menue")) { feld.querySelector(".menue").remove(); return; }
    const zu = () => m.remove();
    const punkt = (icon, text, f) => el("button", { class: "menue-punkt", onclick: () => { zu(); f(); } }, el("span", { class: "gross-icon", text: icon }), text);
    const m = el("div", { class: "menue" },
      punkt("✈️", "Meine Airline", meineAirline),
      punkt("📋", "Berichte", zeigeBericht),
      punkt("🎟️", "Slots", slotListe),
      punkt("🛩️", "Deine Flotte", zeigeFlotte),
      punkt("✏️", "Linien-Editor", () => editorOeffnen()),
      punkt("🏆", "Rangliste", zeigeRang),
      punkt("📊", "Statistik", () => statistikZeigen()),
      punkt("💰", "Kasse", zeigeKasse),
      punkt("📖", "Spielregeln", regelbuch),
      punkt("↺", "Neue Airline gründen", neuStartFragen));
    feld.append(m);
  }
  function neuStartFragen() {
    ui.modal = true;
    const seite = el("div", { class: "seite" },
      el("h1", {}, "Neu anfangen?", el("small", { text: "Deine jetzige Airline ist dann weg." })),
      el("div", { class: "knopfreihe", style: { width: "360px" } },
        el("button", { class: "nebenknopf", text: "Lieber nicht", onclick: () => { seite.remove(); ui.modal = false; } }),
        el("button", { class: "hauptknopf", text: "Ja, neu gründen", onclick: () => { ui.modal = false; neuStart(); } })));
    feld.append(seite);
  }

  // ---------- Regeln nach und nach (Bildkarten) ----------
  const REGELKARTEN = {
    start: { bild: "air-regel-start", icon: "✈️", titel: "So fängst du an", text: "Tippe einen Vorschlag an. Wähle, wann dein Flugzeug abfliegt und wann es zurückkommt, und eröffne die Linie. Das Flugzeug kaufst du gleich mit. Unten steht immer dein nächstes 🎯 Ziel." },
    slots: { bild: "air-regel-slots", icon: "🎟️", titel: "Jeder Flug braucht einen Slot", text: "Ein Slot ist ein Abflug pro Tag zu einer festen Uhrzeit. Für den Hinflug brauchst du einen Slot am Start, für den Rückflug einen am Ziel. Morgens und abends fliegen die meisten Leute: Diese Zeiten sind begehrt und teurer." },
    farben: { bild: "air-regel-farben", icon: "📈", titel: "Grün, Gelb, Rot", text: "Deine Linien leuchten nach Gewinn pro Tag: grün lohnt sich, gelb gerade so, rot kostet Geld. Tippe eine Linie an, dann siehst du warum." },
    tempo: { bild: "air-regel-tempo", icon: "⏳", titel: "Die Zeit läuft", text: "Ein Tag dauert eine Minute. Oben neben der Uhr machst du schneller oder hältst an. Abends wird abgerechnet." },
    flugzeuge: { bild: "air-regel-flugzeuge", icon: "🛩️", titel: "Flugzeuge kaufst du mit dem Flug", text: "Ein Flugzeug kaufst du immer zusammen mit einem Flug. Hat eins deiner Flugzeuge zu der Zeit frei, fliegt es den neuen Flug einfach mit, und du sparst den Kauf. 🔒 Größere Typen gibt es, wenn deine Airline mehr wert ist." },
    tafel: { bild: "air-regel-tafel", icon: "🏠", titel: "Deine Slot-Tafel", text: "Zu Hause gehört die Tafel dir allein: von 5 bis 23 Uhr jede Stunde ein Slot. Zwei bekommst du geschenkt, weitere kaufst du zum festen Preis. Diese Slots verlierst du nie." },
    tagesplan: { bild: "air-regel-tagesplan", icon: "🗓️", titel: "Ein Flugzeug, viele Flüge", text: "Ein Flugzeug kann mehrmals am Tag fliegen, auch zu verschiedenen Zielen. Der Balken zeigt seinen Tag. Je voller der Balken, desto besser verdient das Flugzeug sein Geld." },
    linie: { bild: "air-regel-linie", icon: "✏️", titel: "Deine Linie einstellen", text: "Hier siehst du alle Flüge der Linie mit Uhrzeit und wie voll sie sind. ＋ legt einen weiteren Flug an, ✕ streicht einen. Der Preis 🔻 billiger oder 🔺 teurer gilt für die ganze Linie." },
    bieten: { bild: "air-regel-bieten", icon: "🎟️", titel: "Slots an fremden Flughäfen", text: "Dort gibt es nur wenige Slots für alle Airlines. Wird einer frei, leuchtet ein goldener Ring. Einen Tag lang bieten alle verdeckt: Dreh am Rad und gib dein Gebot ab. Das höchste gewinnt. Bietest nur du, zahlst du nur den Grundpreis." },
    meine: { bild: "air-regel-meine", icon: "✈️", titel: "Meine Airline", text: "Im Menü ☰ unter „Meine Airline“: Name, Farbe und deine Grundsätze wie Essen, Koffer und Sitzabstand. Unter jeder Einstellung steht, was sie sofort bewirkt. Am nächsten Morgen meldet das Spiel, was eine Änderung wirklich gebracht hat." },
    reisende: { bild: "air-regel-reisende", icon: "👥", titel: "Reisende sind begrenzt", text: "Jede Stadt hat nur eine feste Zahl Reisender am Tag. Alle Flüge und alle Airlines teilen sie sich. Der Balken am Flughafen zeigt, wie viele schon fliegen. Zwei Flüge kurz nacheinander nehmen sich die Gäste weg." },
    assistenten: { bild: "air-regel-assistenten", icon: "🔎", titel: "Dein Assistent", text: "In „Meine Airline“ stellst du einen Assistenten ein. Er macht alles: ✨ Rat bei jeder Entscheidung, 💬 Tipps auf der Karte, ❗ an Linien mit Problemen und sonntags 📋 den Wochenbericht. Mehr ★ heißt genauer, aber teurer." },
    berater: { bild: "air-regel-berater", icon: "💬", titel: "Tipps deiner Leute", text: "Deine Assistenten arbeiten von selbst. Finden sie etwas, das sich wirklich lohnt, erscheint eine Sprechblase auf der Karte: ein Tipp genügt. Nie mehr als ein Tipp auf einmal. ✕ heißt: später." },
    rat: { bild: "air-regel-rat", icon: "✨", titel: "Dein Assistent rät dir", text: "✨ zeigt bei Uhrzeit, Flugzeug, Kabine, Preis und Geboten, was dein Assistent empfiehlt, dazu eine Spanne in Euro. Mit ★★★ liegt er näher an der Wahrheit. Ohne Assistent gibt es keinen Rat." },
    verlieren: { bild: "air-regel-verlieren", icon: "⚠️", titel: "Nutzen oder verlieren", text: "Am Ende jeder Jahreszeit gehen Slots an fremden Flughäfen zurück, wenn kein Flug darauf liegt. Zwei Tage vorher wirst du gewarnt. Slots zu Hause bleiben immer deine." },
    saison: { bild: "air-regel-saison", icon: "🗓️", titel: "Jahreszeiten", text: "Jede Woche ist eine Jahreszeit: Im Sommer wollen alle ans Meer, im Winter in die Berge. ☀️ und ⛷️ an einer Stadt zeigen, wo gerade Hochsaison ist." },
    drehkreuz: { bild: "air-regel-drehkreuz", icon: "🔁", titel: "Dein Drehkreuz!", text: "Ab drei Linien steigen Gäste in deiner Stadt um. Kleine Zubringer füllen so deine großen Flugzeuge." },
    rivalen: { bild: "air-regel-rivalen", icon: "⚔️", titel: "Die Konkurrenz", text: "Drei Airlines wollen denselben Himmel. Sie spielen nach denselben Regeln wie du, mit demselben Startgeld und denselben Prämien. Sie machen Fehler, und sie merken sich, wenn du ihnen einen Slot wegschnappst oder ihre Strecke fliegst: Dann bieten sie höher und fliegen dir nach. Ihre Laune steht in der Rangliste. Ihre Linien zeigst du unten links: die drei Kürzel antippen." },
    rangliste: { bild: "air-regel-rangliste", icon: "🏆", titel: "Die Rangliste", text: "Gezählt wird, was deine Airline wert ist: Geld, Flugzeuge, Slots und Gewinn. Wer wird die Nummer eins?" },
    handel: { bild: "air-regel-handel", icon: "🤝", titel: "Slots kaufen und tauschen", text: "Tippe am Flughafen den Slot eines Rivalen an und mach ein Angebot mit dem Rad. Die Antwort kommt sofort. Du kannst auch einen eigenen freien Slot dazugeben. Nach einem Nein ist zwei Tage Pause. Manchmal fragen Rivalen auch dich: 💬." },
    kabine: { bild: "air-regel-kabine", icon: "💺", titel: "Die Kabine", text: "Economy, Business und First gehören zum Flugzeug. Du legst sie beim Kauf fest. Später umbauen kostet Geld und einen Tag Werkstatt: An dem Tag fliegt das Flugzeug nicht." },
    gelegenheiten: { bild: "air-ereignis-messe", icon: "🎪", titel: "Gelegenheiten", text: "Ab jetzt tauchen Symbole auf der Karte auf: Messen 🎪 und Ankündigungen 📣. Der gelbe Ring zeigt, wie lange sie noch gelten." },
    plaene: { bild: "air-regel-plaene", icon: "📣", titel: "Rivalen kündigen an", text: "Manchmal verraten die Rivalen ihren nächsten Zug: 📣 auf der Karte. Fliegst du die Strecke vorher, verzichten sie." },
    duell: { bild: "air-regel-duell", icon: "⚔️", titel: "Preiskampf", text: "Fliegt ein Rivale auf deine Strecke, erscheint ⚔️. Tipp drauf: Ihr steht nebeneinander. Unterbieten, Preis halten oder aufgeben. Bei gleichem Preis gewinnt die bessere Qualität." },
    trends: { bild: "air-regel-trends", icon: "📈", titel: "Die Nachfrage ändert sich", text: "Städte werden beliebter ▲ oder verlieren Gäste ▼, manche Strecken kommen in Mode 🔥. Die Pfeile siehst du an Städten und Linien." },
    wahl: { bild: "air-regel-wahl", icon: "🎲", titel: "Sicher oder Risiko?", text: "Streik, Sturm oder Kerosin: Du wählst. Sicher kostet sofort, Risiko kann gut ausgehen oder teuer werden." },
    rennen: { bild: "air-regel-rennen", icon: "🏁", titel: "Das Rennen der Jahreszeit", text: "Jede Jahreszeit ein Rennen gegen die Rivalen. Wer zuerst ans Ziel kommt, bekommt Geld und einen Pokal: +3 % Gäste für immer. Steht in der Rangliste." },
    ausbau: { bild: "air-regel-ausbau", icon: "🏗️", titel: "Ein zweites Drehkreuz", text: "Eine Stadt mit drei Linien kannst du ausbauen: Du bekommst dort eine eigene Tafel mit 10 Slots, die du nie verlierst, dazu viel mehr Umsteiger. Tipp die Stadt an." },
    rivalpleite: { bild: "air-regel-rivalpleite", icon: "💥", titel: "Ein Rivale ist pleite", text: "Geht ein Rivale pleite, werden alle seine Slots an fremden Flughäfen frei. Sie leuchten golden: Biete schnell mit. Der Rivale fängt mit neuem Geld von vorn an." },
    ruf: { bild: "air-regel-ruf", icon: "⭐", titel: "Dein Ruf", text: "Oben neben deinem Namen steht dein ⭐ Ruf. Je höher, desto mehr Gäste. Bis 70 wächst er von selbst, darüber nur mit 📺 Werbung in „Meine Airline“, und dann sinkt er langsam wieder." },
    statistik: { bild: "air-regel-statistik", icon: "📊", titel: "Statistik", text: "Im Menü ☰ unter „Statistik“: alle Linien mit Auslastung und Gewinn, sortierbar, dazu Städte und Verlauf. Antippen springt zur Linie." },
    controlling: { bild: "air-regel-controlling", icon: "📋", titel: "Wochenbericht", text: "❗ an einer Linie heißt: Dein Assistent sieht dort ein Problem, mit einem Vorschlag zum Antippen. Jeden Sonntag kommt unter 📋 der Wochenbericht, mit zwei Ideen für neue Strecken." },
    verwaltung: { bild: "air-regel-verwaltung", icon: "🏢", titel: "Größer heißt teurer", text: "Ab der 9. Linie kostet jede weitere Verwaltung, und zwar immer mehr. Wenige starke Linien schlagen viele schwache. Lass lieber ein Flugzeug öfter fliegen, statt immer neue Linien zu eröffnen." },
    spaet: { bild: "air-regel-spaet", icon: "🎯", titel: "Besser statt mehr", text: "Ab jetzt fragen die Ziele auch nach Qualität: alle Linien im Plus, volle Flieger, bester Ruf, starke Linien. Und Entscheidungen halten die Uhr an, bis du sie getroffen hast." },
    pleite: { bild: "air-regel-pleite", icon: "⚠️", titel: "Achtung, Minus!", text: "Ist dein Konto im Minus, mahnt die 🏦 Bank. Drei Stufen: Mahnung, Kredit, dann will dich ein Rivale kaufen. Streiche rote Flüge oder verkaufe ein Flugzeug." },
  };
  const REGEL_FOLGE = ["start", "slots", "farben", "tempo", "flugzeuge", "tafel", "tagesplan", "linie", "bieten", "meine", "reisende", "assistenten", "berater", "rat", "verlieren", "saison", "drehkreuz", "rivalen", "rangliste", "handel", "kabine", "gelegenheiten", "plaene", "duell", "trends", "wahl", "rennen", "ausbau", "rivalpleite", "ruf", "statistik", "controlling", "verwaltung", "spaet", "pleite"];
  // Erklärung beim ersten Auftauchen einer Funktion (z. B. beim ersten Öffnen der Slot-Tafel).
  function erklaeren(id) { if (!einf.gesehen["regel-" + id]) regelkarte(id); }
  function regelnPruefen() {
    if (!st || ui.modal) return;
    const tag = L.tagVon(st), p = ich();
    let id = null;
    const g = (x) => !einf.gesehen["regel-" + x];
    const fliegt = p.routen.length > 0;
    if (st.pleite && st.pleite.stufe && g("pleite")) id = "pleite";
    else if (fliegt && st.letzterTag && g("farben")) id = "farben";
    else if (fliegt && tag >= 2 && g("tempo")) id = "tempo";
    else if (fliegt && tag >= 3 && g("flugzeuge")) id = "flugzeuge";
    else if (fliegt && tag >= 4 && g("tagesplan")) id = "tagesplan";
    else if (L.drehkreuze(p).length && g("drehkreuz")) id = "drehkreuz";
    else if (tag >= 3 && slotRinge().length && g("bieten")) id = "bieten";
    else if (L.assistent(p, "analyst") && g("rat")) id = "rat";
    else if (p.slots.some((s) => !s.heim) && L.tageBisSaisonende(tag) <= 3 && g("verlieren")) id = "verlieren";
    else if (st.rivalPleite && g("rivalpleite")) id = "rivalpleite";
    else if (tag >= 5 && fliegt && g("meine")) id = "meine";
    else if (tag >= 6 && fliegt && g("reisende")) id = "reisende";
    else if (tag >= 7 && fliegt && g("assistenten")) id = "assistenten";
    else if (tag >= 8 && g("saison")) id = "saison";
    else if (tag >= 9 && g("rivalen")) id = "rivalen";
    else if (tag >= 10 && g("rangliste")) id = "rangliste";
    else if (p.routen.length > L.REGELN.verwaltungFrei && g("verwaltung")) id = "verwaltung";
    else if (tag >= L.REGELN.handelAb && g("handel")) id = "handel";
    else if (tag >= 13 && g("ruf")) id = "ruf";
    else if (tag >= 14 && p.flotte.some((f) => L.kabineGrenzen(f.typ).business > 0) && g("kabine")) id = "kabine";
    else if (p.routen.length >= 6 && g("controlling")) id = "controlling";
    else if (p.routen.length >= 8 && g("statistik")) id = "statistik";
    else if (st.ziel >= L.ZIELE.length && g("spaet")) id = "spaet";
    else if (tag >= L.REGELN.gelegenheitAb && g("gelegenheiten")) id = "gelegenheiten";
    else if (st.gelegenheiten.some((x) => x.art === "plan") && g("plaene")) id = "plaene";
    else if (p.routen.some((r) => r.duell) && g("duell")) id = "duell";
    else if (tag >= L.REGELN.trendAb && g("trends")) id = "trends";
    else if (st.gelegenheiten.some((x) => x.art === "wahl") && g("wahl")) id = "wahl";
    else if (st.rennen && g("rennen")) id = "rennen";
    else if (fliegt && L.drehkreuze(p).some((c) => L.kannAusbauen(st, L.SPIELER, c)) && g("ausbau")) id = "ausbau";
    if (id) regelkarte(id);
  }
  function regelkarte(id, zurueck) {
    if (!zurueck) gesehen("regel-" + id);
    const k = REGELKARTEN[id];
    const vorher = ui.modal;
    ui.modal = true;
    const seite = el("div", { class: "seite regelkarte-seite" },
      el("div", { class: "regelkarte" },
        el("div", { class: "regelbild" }, bildEl(k.bild, k.icon), id === "rivalen" ? el("div", { class: "chefs" }, ["k", "s", "a"].map((aid) => el("div", { class: "gesicht", style: { background: st.airlines[aid].farbe } }, bildEl(CHEF[aid], L.RIVALEN[aid].chef[0])))) : null),
        el("div", { class: "regeltext" }, el("b", { text: k.titel }), el("p", { text: k.text }),
          el("button", { class: "hauptknopf", text: zurueck ? "◀ Zurück" : "Verstanden", onclick: () => { seite.remove(); ui.modal = vorher; if (zurueck) zurueck(); } }))));
    feld.append(seite);
  }
  // Alle Erklärungen zum Nachschlagen. Was noch nicht vorkam, bleibt zu (die Regeln kommen nach und nach).
  function regelbuch() {
    const alt = feld.querySelector(".regelbuch");
    if (alt) alt.remove();
    ui.modal = true;
    const offen = (id) => id === "start" || einf.gesehen["regel-" + id];
    const seite = el("div", { class: "seite store regelbuch" },
      el("div", { class: "store-kopf" }, el("h1", { text: "📖 Spielregeln" }),
        el("span", { class: "store-geld", text: REGEL_FOLGE.filter(offen).length + " von " + REGEL_FOLGE.length + " entdeckt" }),
        el("button", { class: "zu", text: "✕", "aria-label": "Schließen", onclick: () => { seite.remove(); ui.modal = false; } })),
      el("div", { class: "regel-gitter" }, REGEL_FOLGE.map((id) => {
        const k = REGELKARTEN[id];
        return offen(id)
          ? el("button", { class: "regel-kachel", onclick: () => regelkarte(id, regelbuch) }, el("div", { class: "regel-kachelbild" }, bildEl(k.bild, k.icon)), el("b", { text: k.titel }))
          : el("div", { class: "regel-kachel zu-karte" }, el("div", { class: "regel-kachelbild" }, el("span", { class: "ersatz", text: "🔒" })), el("b", { text: "Kommt noch" }));
      })));
    feld.append(seite);
  }

  // ---------- Zeit ----------
  let letzterRahmen = null, letztesSpeichern = 0, letzteHud = 0;
  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    if (!st || st.ende || ui.heimat) { letzterRahmen = jetzt; return; }
    const dt = letzterRahmen == null ? 0 : Math.min(0.25, (jetzt - letzterRahmen) / 1000);
    letzterRahmen = jetzt;
    if (ui.tempo > 0 && dt > 0 && !ui.modal) {
      const tagVorher = L.tagVon(st);
      const gelVorher = st.gelegenheiten.length;
      const landungen = L.vorruecken(st, dt * ui.tempo / SEK_PRO_STUNDE);
      for (const l of landungen.slice(0, 6)) landungZeigen(l);
      if (st.gelegenheiten.length !== gelVorher) symboleZeichnen();
      if (L.tagVon(st) !== tagVorher) tagEnde();
      if (st.ende) { endeSeite(); return; }
      if (st.gelegenheiten.length !== gelVorher || L.tagVon(st) !== tagVorher) entscheidungPruefen();
    }
    fliegerZeichnen();
    if (jetzt - letzteHud > 250) {
      hudAktualisieren(); ringeAktualisieren(); letzteHud = jetzt;
      if (st.bietErgebnisse && st.bietErgebnisse.length && !ui.modal) { karteZeichnen(); tafelNeu(); bietErgebnisZeigen(); }
      const pz = st.pool.length + "|" + st.pool.filter((x) => x.bis != null).length;
      if (pz !== ui.poolSig) { ui.poolSig = pz; ringCache = null; karteZeichnen(); }
    }
    if (jetzt - letztesSpeichern > 5000) { speichern(); letztesSpeichern = jetzt; }
  }

  function tagEnde() {
    heatCache = null;
    karteZeichnen();
    tafelNeu();
    meldungenZeigen();
    bietErgebnisZeigen();
    const lt = st.letzterTag;
    if (lt && lt.tag !== ui.letzterAbschluss) {
      ui.letzterAbschluss = lt.tag;
      muenzenFliegen(lt);
      const alt = feld.querySelector(".abschluss");
      if (alt) alt.remove();
      const box = el("div", { class: "abschluss" },
        el("div", {}, el("div", { class: "blass mini", text: "Tag " + lt.tag + " abgerechnet" }), el("div", { class: "gross zahl", style: { color: farbeGewinn(lt.gewinn) }, text: geld(lt.gewinn, true) })));
      feld.append(box);
      setTimeout(() => box.remove(), 4200);
    }
    regelnPruefen();
    speichern();
  }

  // Münzen fliegen von den Linien ins Geld.
  function muenzenFliegen(lt) {
    if (document.hidden || !karte) return;
    const ziel = hud.geldK.getBoundingClientRect(), f = feld.getBoundingClientRect();
    const zx = (ziel.left - f.left) / ui.skala + 40, zy = (ziel.top - f.top) / ui.skala + 18;
    const gute = lt.routen.filter((r) => r.gewinn > 0).slice(0, 8);
    gute.forEach((r, i) => {
      const [mx, my] = mitteVon(r.a, r.b);
      const x = mx * ui.kamera.z + ui.kamera.x, y = my * ui.kamera.z + ui.kamera.y;
      const m = el("div", { class: "muenze", text: "🪙", style: { left: x + "px", top: y + "px", animationDelay: i * 70 + "ms" } });
      m.style.setProperty("--dx", zx - x + "px");
      m.style.setProperty("--dy", zy - y + "px");
      feld.append(m);
      setTimeout(() => m.remove(), 1400 + i * 70);
    });
    if (lt.gewinn > 0) setTimeout(() => { hud.geldK.classList.remove("pling"); void hud.geldK.offsetWidth; hud.geldK.classList.add("pling"); }, 900);
  }

  const MELDUNG_ICON = { bericht: "📋", mahnung: "⚠️", kredit: "🏦", uebernahme: "🤝", gerettet: "✅", aufstieg: "🏆", abstieg: "📉", stufe: "✈️", welt: "🌍", saison: "🗓️", slotweg: "🎟️", kerosin: "⛽", rivale: "📰", angriff: "⚔️", ziel: "🎯", wirkung: "🔎" };
  function meldungenZeigen() {
    // Das Ergebnis eines Gebots kommt als eigenes Fenster, nicht noch einmal als Meldung.
    const neu = st.meldungen.splice(0).filter((m) => !(m.art === "slotsieg" || (m.art === "slotweg" && m.stadt)));
    let verzoegerung = 0;
    // Wichtiges zuerst, höchstens vier auf einmal.
    const wichtig = ["duell", "plan", "pleite", "krise", "slotwarnung", "slotangebot", "wirkung", "rennensieg", "rennen", "ziel", "mahnung", "kredit", "uebernahme"];
    const auswahl = neu.filter((m) => wichtig.includes(m.art)).concat(neu.filter((m) => !wichtig.includes(m.art))).slice(0, 4);
    for (const m of auswahl) {
      setTimeout(() => {
        const mitBild = /^\p{Extended_Pictographic}/u.test(m.text);   // neue Meldungen bringen ihr Zeichen selbst mit
        const e = el("div", { class: "meldung" + (m.art === "ziel" ? " ziel" : ""), "data-art": m.art }, mitBild ? null : MELDUNG_ICON[m.art] || "📰", el("span", { text: m.text }));
        feld.append(e);
        setTimeout(() => e.remove(), m.art === "wirkung" || m.art === "slotwarnung" ? 6500 : 4300);
      }, verzoegerung);
      verzoegerung += 1500;
    }
  }

  // Ergebnis eines Gebots als Fenster: wer wie viel geboten hat, wer den Slot bekommt.
  function bietErgebnisZeigen() {
    if (!st.bietErgebnisse || !st.bietErgebnisse.length || ui.modal || feld.querySelector(".ergebnis-seite")) return;
    const v = st.bietErgebnisse.shift();
    const ichDabei = v.gebote.some((x) => x.aid === L.SPIELER);
    const gewonnen = v.sieger === L.SPIELER;
    const hoch = Math.max(...v.gebote.map((x) => x.betrag));
    const ort = L.STADT[v.stadt].name + " " + uhr(v.h) + " Uhr";
    const titel = gewonnen ? "Gewonnen!" : ichDabei ? "Leider verloren" : st.airlines[v.sieger].name + " gewinnt";
    const unter = gewonnen ? (v.gebote.length === 1 ? "Nur du hast geboten: Du zahlst den Grundpreis von " + geld(v.preis) + "." : "Der Slot gehört dir für " + geld(v.preis) + ".")
      : "Der Slot geht an " + st.airlines[v.sieger].name + ". Du zahlst nichts.";
    ui.modal = true;
    ton(gewonnen ? "sieg" : "verloren");
    const zu = () => { seite.remove(); ui.modal = false; nachAktion(); meldungenZeigen(); bietErgebnisZeigen(); };
    const seite = el("div", { class: "seite ergebnis-seite" },
      el("div", { class: "ergebnis-karte" + (gewonnen ? " sieg" : "") },
        el("div", { class: "ergebnis-kopf" }, el("span", { class: "ergebnis-icon", text: gewonnen ? "🏆" : "🎟️" }),
          el("div", {}, el("small", { text: "Slot " + ort }), el("b", { text: titel }))),
        el("div", { class: "blass", text: unter }),
        el("div", { class: "gebote" }, v.gebote.map((x) => {
          const a = st.airlines[x.aid], ich2 = x.aid === L.SPIELER;
          return el("div", { class: "gebot" + (x.aid === v.sieger ? " vorn" : "") + (ich2 ? " ich" : "") },
            el("span", { class: "gebot-punkt", style: { background: a.farbe } }),
            el("span", { class: "gebot-name", text: ich2 ? "Du" : a.name }),
            el("span", { class: "gebot-balken" }, el("i", { style: { width: Math.max(6, 100 * x.betrag / hoch) + "%", background: a.farbe } })),
            el("span", { class: "gebot-betrag zahl", text: geld(x.betrag) }),
            el("span", { class: "gebot-krone", text: x.aid === v.sieger ? "🏆" : "" }));
        })),
        v.zuWenig ? el("div", { class: "hinweis orange", text: `Dein Gebot (${geld(v.meinGebot)}) zählte nicht: Es war nicht genug Geld auf dem Konto.` }) : null,
        el("div", { class: "knopfreihe" },
          el("button", { class: gewonnen ? "nebenknopf" : "hauptknopf", text: "Weiter", onclick: zu }),
          gewonnen ? el("button", { class: "hauptknopf", text: "✏️ Flug nach " + L.STADT[v.stadt].name + " planen", onclick: () => { zu(); editorOeffnen({ start: ich().basis, ziel: v.stadt }); } }) : null)));
    feld.append(seite);
  }

  function nachAktion() {
    heatCache = null; ringCache = null; ratMerker.clear();
    hud.zielSig = null;
    karteZeichnen();
    hudAktualisieren();
    speichern();
  }

  // ---------- Übernahme, Ende ----------
  function uebernahmeZeigen() {
    if (feld.querySelector(".uebernahme")) return;
    const u = st.uebernahme;
    const riv = L.RIVALEN[u.von];
    ui.modal = true;
    const seite = el("div", { class: "seite uebernahme" },
      bild("air-ereignis-uebernahme") ? el("img", { class: "bg", src: bild("air-ereignis-uebernahme"), alt: "" }) : null,
      el("div", { class: "rang", style: { width: "420px" } },
        el("div", { class: "gesicht", style: { background: st.airlines[u.von].farbe, width: "60px", height: "60px" } }, bildEl(CHEF[u.von], riv.chef[0])),
        el("div", { class: "mitte" }, el("b", { style: { fontSize: "16px" }, text: riv.chef + " von " + st.airlines[u.von].name }),
          el("div", { class: "spruch", style: { fontSize: "13px" }, text: `„${st.manager ? L.anrede(st.manager) + ", Ihre" : "Ihre"} Airline ist am Ende. Ich zahle Ihnen ${geld(u.preis)}, und Ihre Flugzeuge fliegen ab morgen für mich.“` }))),
      el("div", { class: "blass", text: "Ablehnen heißt: Du hast drei Tage, um das Konto ins Plus zu bringen. Sonst ist die Airline pleite." }),
      el("div", { class: "knopfreihe", style: { width: "420px" } },
        el("button", { class: "nebenknopf", text: "Verkaufen", onclick: () => { L.uebernahmeAnnehmen(st); ui.modal = false; seite.remove(); endeSeite(); } }),
        el("button", { class: "hauptknopf", text: "Ablehnen und kämpfen!", onclick: () => { L.uebernahmeAblehnen(st); ui.modal = false; seite.remove(); hud.warnSig = null; hudAktualisieren(); } })));
    feld.append(seite);
  }

  function endeSeite() {
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
    ui.modal = false;
    const p = ich(), e = st.ende;
    const titel = e.grund === "verkauft" ? "Verkauft an " + st.airlines[e.von].name : "Pleite";
    feld.append(el("div", { class: "seite" },
      bild("air-ende") ? el("img", { class: "bg", src: bild("air-ende"), alt: "" }) : null,
      el("h1", {}, titel, el("small", { text: (st.manager ? st.manager.name + " und " : "") + p.name + (st.manager ? " haben " : " hat ") + (e.tag - 1) + " Tage durchgehalten. Bester Platz: " + (st.bestPlatz || L.platz(st)) + "." })),
      el("button", { class: "hauptknopf", text: "Neue Airline gründen", onclick: neuStart })));
  }

  // ---------- Start ----------
  function neuStart() {
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
    st = null;
    startSeite();
  }

  let altHinweis = false;
  const GEGNER_KEY = "luftlinie-gegner";
  let gegnerWahl = "mittel";
  try { const g = localStorage.getItem(GEGNER_KEY); if (L.GEGNER[g]) gegnerWahl = g; } catch (e) { /* egal */ }
  function startSeite() {
    feld.replaceChildren();
    feld.classList.remove("editor-an", "tafel-an");
    karte = null; tafelEl = null; editorEl = null; ui.tafel = null; ui.editor = null; ui.stadt = null; ui.route = null; ui.modal = false;
    const seite = el("div", { class: "seite" });
    function zeichnen() {
      seite.replaceChildren();
      seite.append(...[
        bild("air-start") ? el("img", { class: "bg", src: bild("air-start"), alt: "" }) : null,
        el("h1", {}, "Airlines", el("small", { text: "Alle starten bei Null. Wer wird die größte Airline der Welt?" })),
        el("div", { class: "gegnerwahl" },
          el("b", { text: "Wie gut sollen deine drei Rivalen spielen?" }),
          el("div", { class: "gegner-reihe" }, Object.entries(L.GEGNER).map(([id, g], i) =>
            el("button", { class: "gegner" + (gegnerWahl === id ? " an" : ""), "data-gegner": id, onclick: () => { gegnerWahl = id; try { localStorage.setItem(GEGNER_KEY, id); } catch (e) { /* egal */ } zeichnen(); } },
              el("span", { class: "gegner-stufe" }, [0, 1, 2].map((n) => el("i", { class: n <= i ? "voll" : "" }))),
              el("b", { text: g.name }), el("small", { text: g.text })))),
          el("small", { class: "blass", text: "Alle spielen nach denselben Regeln wie du und starten mit demselben Geld." })),
        altHinweis ? el("div", { class: "hinweis", style: { maxWidth: "520px" }, text: "Neue Fassung: Slots haben jetzt Uhrzeiten, und ein Flugzeug kann mehrmals am Tag fliegen. Dein alter Spielstand passt nicht mehr dazu, deshalb beginnt ein neues Spiel." }) : null,
        el("button", { class: "hauptknopf", text: "Airline gründen ▶", onclick: () => { altHinweis = false; try { localStorage.removeItem(SPEICHER_ALT); } catch (e) { /* egal */ } profilSeite(heimatWaehlen, startSeite, "Weiter ▶"); } })].filter(Boolean));
    }
    zeichnen();
    feld.append(seite);
  }

  // ---------- Manager-Profil ----------
  // Vor der Wahl der Heimat: Wer leitet die Airline? Name, Geschlecht, Aussehen. Das letzte Profil wird vorgeschlagen.
  const MANAGER_KEY = "luftlinie-manager";
  let profilEntwurf = null;
  function managerGesicht(m, gross) {
    const look = L.AUSSEHEN.find((a) => a.id === (m && m.aussehen)) || L.AUSSEHEN[0];
    return el("div", { class: "gesicht mgr-gesicht" + (gross ? " gross" : ""), style: { background: look.farbe } },
      bildEl("mgr-" + look.id, m && m.name ? m.name[0].toUpperCase() : "?"));
  }
  // weiter(m) bekommt das fertige Profil; zurueck() geht einen Schritt zurück.
  function profilSeite(weiter, zurueck, knopfText) {
    const m = profilEntwurf || (st && st.manager ? { ...st.manager } : lesen(MANAGER_KEY, null)) || { name: "", geschlecht: "frau", aussehen: "frau-1" };
    profilEntwurf = m;
    const seite = el("div", { class: "seite profil" });
    const fertig = () => !!L.managerPruefen(m);
    let knopf, vorschau, anredeEl;
    const oben = () => { vorschau.replaceWith(vorschau = managerGesicht(m, true)); textSetzen(anredeEl, fertig() ? L.anrede(L.managerPruefen(m)) : "Wie heißt du?"); knopf.disabled = !fertig(); };
    function zeichnen() {
      const looks = L.aussehenFuer(m.geschlecht);
      if (!looks.some((a) => a.id === m.aussehen)) m.aussehen = looks[0].id;
      vorschau = managerGesicht(m, true);
      anredeEl = el("b", { class: "profil-anrede" });
      knopf = el("button", { class: "hauptknopf", text: knopfText, onclick: () => {
        const neu = L.managerPruefen(m);
        if (!neu) return;
        schreiben(MANAGER_KEY, neu);
        profilEntwurf = null;
        seite.remove();
        weiter(neu);
      } });
      seite.replaceChildren(
        el("button", { class: "kachel rundknopf", onclick: () => { profilEntwurf = null; seite.remove(); zurueck(); }, style: { position: "absolute", left: "calc(6px + var(--sl))", top: "calc(6px + var(--st))", height: "38px", zIndex: 9 }, "aria-label": "Zurück", text: "◀" }),
        el("h1", {}, "Dein Profil", el("small", { text: "Du leitest die Airline. Wer bist du?" })),
        el("div", { class: "profil-reihe" },
          el("div", { class: "profil-links" }, vorschau, anredeEl),
          el("div", { class: "profil-rechts" },
            el("input", { class: "namensfeld", value: m.name, maxlength: 24, placeholder: "Vor- und Nachname", autocomplete: "name",
              oninput: (e) => { m.name = e.target.value; oben(); },
              onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); } }),
            el("div", { class: "segment" }, Object.entries(L.GESCHLECHTER).map(([id, g]) =>
              el("button", { class: m.geschlecht === id ? "an" : "", "data-geschlecht": id, text: g.name, onclick: () => { m.geschlecht = id; zeichnen(); } }))),
            el("div", { class: "looks" + (looks.length > 6 ? " viele" : "") }, looks.map((a, i) =>
              el("button", { class: "look" + (m.aussehen === a.id ? " an" : ""), "data-look": a.id, "aria-label": "Aussehen " + (i + 1), style: { background: a.farbe },
                onclick: () => { m.aussehen = a.id; zeichnen(); } }, bildEl("mgr-" + a.id, String(i + 1))))))),
        knopf);
      oben();
    }
    zeichnen();
    feld.append(seite);
  }

  const SCHWER_FARBE = { leicht: "#4ADE80", mittel: "#F2C14E", schwer: "#F87171" };
  function heimatWaehlen() {
    feld.replaceChildren();
    ui.heimat = true;
    { // Gestartet wird in Europa: Die Karte zeigt gleich den passenden Ausschnitt.
      const xs = L.HEIMAT.map((id) => stadtXY[id][0]), ys = L.HEIMAT.map((id) => stadtXY[id][1]);
      kameraPassend({ x0: Math.min(...xs) - 40, x1: Math.max(...xs) + 40, y0: Math.min(...ys) - 95, y1: Math.max(...ys) + 24 });
    }
    karteBauen();
    feld.append(el("div", { class: "heimatwahl" }, "Wo soll deine Airline zu Hause sein?", el("small", { text: "Tippe auf eine leuchtende Stadt in Europa. Du führst die Airline, die dort zu Hause ist." }),
      el("div", { class: "legende" }, Object.entries(SCHWER_FARBE).filter(([k]) => L.HEIMAT.some((id) => L.SCHWIERIGKEIT[id] === k)).map(([k, f]) => el("span", {}, el("i", { style: { background: f } }), { leicht: "leichter Start", mittel: "mittel", schwer: "schwerer Start" }[k])))),
      el("button", { class: "kachel rundknopf", onclick: () => { ui.heimat = false; feld.replaceChildren(); karte = null; profilSeite(heimatWaehlen, startSeite, "Weiter ▶"); }, style: { position: "absolute", left: "6px", top: "6px", height: "38px", zIndex: 9 }, "aria-label": "Zurück", text: "◀" }));
  }

  function heimatGewaehlt(id) {
    ui.heimat = false;
    st = L.neuesSpiel({ basis: id, service: "standard", gegner: gegnerWahl, manager: lesen(MANAGER_KEY, null) });
    einf = { gesehen: {} };
    schreiben(EINFUEHRUNG, einf);
    lackMerken();
    spielStarten();
    angeboteZeigen();
    tippZeigen("Willkommen" + (st.manager ? ", " + L.anrede(st.manager) : "") + " bei " + st.airlines[L.SPIELER].name + "! Alle Airlines starten bei Null. Hier sind drei Vorschläge für deine erste Linie: Tippe einen an. Dann wählst du nur noch die Uhrzeiten, das Flugzeug kaufst du gleich mit.", tafelEl, "links", "Los geht's");
  }

  function spielStarten() {
    kameraPassend(gegend(st.airlines[L.SPIELER].basis));
    feld.replaceChildren();
    feld.classList.remove("editor-an", "tafel-an");
    karte = null; tafelEl = null; editorEl = null; ui.editor = null;
    karteBauen();
    hudBauen();
    tempo(ich().routen.length ? 1 : 0);
    ui.letzterAbschluss = st.letzterTag && st.letzterTag.tag;
    st.meldungen = [];
  }

  // ---------- Tipps ----------
  let tippEl = null;
  function tippZeigen(text, ziel, seite, knopf) {
    if (tippEl) tippEl.remove();
    tippEl = el("div", { class: "tipp pfeil-" + ({ unten: "oben", oben: "unten", links: "rechts", rechts: "links" }[seite] || "oben") }, text,
      knopf ? el("div", {}, el("button", { text: knopf, onclick: tippWeg })) : null);
    feld.append(tippEl);
    const f = feld.getBoundingClientRect();
    let r;
    if (ziel && ziel.getBoundingClientRect) {
      const b = ziel.getBoundingClientRect();
      r = { x: (b.left - f.left) / ui.skala, y: (b.top - f.top) / ui.skala, w: b.width / ui.skala, h: b.height / ui.skala };
    } else r = { x: FELD_B / 2 - 100, y: 120, w: 200, h: 0 };
    const tw = tippEl.offsetWidth, th = tippEl.offsetHeight;
    let x, y;
    if (seite === "links") { x = r.x - tw - 10; y = r.y; }
    else if (seite === "rechts") { x = r.x + r.w + 10; y = r.y; }
    else if (seite === "oben") { x = r.x; y = r.y - th - 10; }
    else { x = r.x + r.w / 2 - tw + 28; y = r.y + r.h + 10; }
    tippEl.style.left = Math.max(6, Math.min(FELD_B - tw - 6, x)) + "px";
    tippEl.style.top = Math.max(6, Math.min(FELD_H - th - 6, y)) + "px";
  }
  function tippWeg() { if (tippEl) { tippEl.remove(); tippEl = null; } }

  // ---------- Los ----------
  window.addEventListener("resize", skalieren);
  window.addEventListener("orientationchange", () => setTimeout(skalieren, 200));
  document.addEventListener("visibilitychange", () => { if (document.hidden) speichern(); });
  window.addEventListener("pagehide", speichern);
  skalieren();

  // Kein Seitenzoom wie im Browser (Zwei-Finger, Doppeltipp, Strg+Rad). Die Karte zoomt weiter über ihre eigenen Gesten.
  for (const art of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(art, (e) => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 || e.scale && e.scale !== 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  // Neue Version: regelmäßig nachsehen, auf Knopfdruck laden.
  const VERSION = (document.querySelector('meta[name="luftlinie-version"]') || {}).content || "";
  let updateEl = null;
  function updatePruefen() {
    if (!VERSION || VERSION.startsWith("__") || updateEl) return;
    fetch("../version.json?t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((v) => {
      if (!v || !v.version || v.version === VERSION || updateEl) return;
      updateEl = el("div", { class: "update" }, el("span", { text: "🔄 Neue Version da" }),
        el("button", { text: "Jetzt laden", onclick: () => { speichern(); location.replace(location.pathname + "?u=" + encodeURIComponent(v.version)); } }));
      document.body.appendChild(updateEl);
    });
  }
  setTimeout(updatePruefen, 3000);
  setInterval(updatePruefen, 120000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { updatePruefen(); landNeuZeichnen(); } });
  window.addEventListener("pageshow", (e) => { if (e.persisted) landNeuZeichnen(); });
  // Safari zeichnet große Pfade nach dem Zurückkehren manchmal nicht neu: das Land einmal frisch einsetzen.
  function landNeuZeichnen() {
    if (!karte) return;
    const alt = karte.svg.querySelector(".landschaft");
    if (alt) alt.replaceWith(alt.cloneNode(true));
  }

  // Spielen nur als App vom Home-Bildschirm (Florians Wunsch). Im Browser kommt eine Anleitung.
  function alsAppGestartet() {
    if (window.navigator.standalone === true) return true;
    if (window.matchMedia && (matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches)) return true;
    try { if (localStorage.getItem("luftlinie-entwickler") === "1") return true; } catch (e) {}
    return false;
  }
  function anleitungZeigen() {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);
    const schritte = ios ? [
      ["📤", "Tippe unten auf „Teilen“"],
      ["📲", "Wähle „Zum Home-Bildschirm“"],
      [null, "Tippe auf „Hinzufügen“ und starte Airlines über das neue Symbol"],
    ] : android ? [
      ["⋮", "Tippe oben rechts auf das Menü"],
      ["📲", "Wähle „App installieren“ oder „Zum Startbildschirm“"],
      [null, "Starte Airlines über das neue Symbol"],
    ] : [
      ["📲", "Öffne diese Seite auf deinem iPhone in Safari"],
      ["📤", "Tippe auf „Teilen“ und dann „Zum Home-Bildschirm“"],
      [null, "Starte Airlines über das neue Symbol"],
    ];
    document.body.classList.add("anleitung-an");
    document.body.append(el("div", { class: "anleitung" },
      el("img", { class: "anleitung-logo", src: "../app-icon-180.png", alt: "" }),
      el("h1", { text: "Airlines installieren" }),
      el("p", { text: "Airlines läuft nur als App auf deinem Home-Bildschirm. So geht's:" }),
      el("ol", {}, schritte.map(([ic, text], i) => el("li", {},
        el("span", { class: "nr", text: String(i + 1) }),
        ic ? el("span", { class: "anleitung-ic", text: ic }) : el("img", { class: "anleitung-ic klein-logo", src: "../app-icon-180.png", alt: "" }),
        el("span", { class: "anleitung-text", text }))))));
  }

  // Erst wenn alle Grafiken offline da sind (airline-laden.js), geht es los.
  (window.luftlinieBereit || Promise.resolve()).then(() => fetch("../grafiken/vorhanden.json", { cache: "no-cache" })).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((liste) => {
    for (const n of liste) dateien.add(n);
    return fetch("../grafiken/lack.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  }).then((lacke) => {
    for (const n of lacke) lack.add(n);
    if (!alsAppGestartet()) { anleitungZeigen(); return; }
    const alt = lesen(SPEICHER, null);
    st = alt ? L.laden(alt) : null;
    try { altHinweis = !st && !!localStorage.getItem(SPEICHER_ALT); } catch (e) { /* egal */ }
    if (st && !st.ende) { spielStarten(); lackMerken(); }
    else startSeite();
    requestAnimationFrame(schleife);
  });

  // Für Tests im Browser.
  window.luftlinie = { get st() { return st; }, set st(x) { st = x; }, ui, tempo, zeigeRang, zeigeGelegenheit, zeigeDuell, editorOeffnen, zeigeSlot, zeigeHandel, flugSeite, tafelSeite, zeigeFlotte, meineAirline, kabineSeite, zeigeStadt, slotListe, statistikZeigen, regelkarte, regelbuch, bietErgebnisZeigen, nachAktion, spielStarten, zeigeRoute, zeigeBericht, zoomAuf: (id) => { kameraPassend(gegend(id)); kameraSetzen(); } };
})();
