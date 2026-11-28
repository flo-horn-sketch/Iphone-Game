// Oberfläche von "Luftlinie". Alle Regeln stehen in airline-logik.js, die Karte in airline-karte.js.
//
// Aufbau: Die Karte ist zum Schauen da. Neue Linien entstehen nur im Linien-Editor (✏️).
// Flugzeuge kauft man im Store (🛒). Unten steht immer genau ein Ziel.
(function () {
  "use strict";

  const L = window.AirLogik;
  const K = window.AirKarte;
  const SPEICHER = "luftlinie-v2";
  const EINFUEHRUNG = "luftlinie-einfuehrung-v2";
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
    "🤝": "aufkauf", "✊": "streik", "⛈": "sturm", "⛽": "kerosin", "⬇": "pfeil-runter", "⬆": "pfeil-hoch", "🔻": "billiger", "🔺": "teurer",
    "👥": "rivalen", "🏁": "rennen", "🏆": "pokal", "🥇": "gold", "🥈": "silber", "🥉": "bronze", "⏳": "sanduhr", "⏱": "stoppuhr",
    "📋": "bericht", "🎯": "ziel", "🎁": "geschenk", "👔": "geschaeft", "🏖": "urlaub", "🎫": "ticket", "💸": "kosten", "💰": "kasse",
    "💶": "preis", "🪙": "muenze", "🏦": "bank", "🍽": "essen", "🥂": "premium", "🧳": "koffer", "💺": "sitz", "📏": "reichweite",
    "👩": "crew", "🔁": "umsteiger", "🔄": "neu", "⭐": "stern", "★": "stern", "☆": "stern-leer", "🏳": "aufgeben", "🏗": "ausbau",
    "🔎": "lupe", "🔬": "gruendlich", "⚡": "schnell", "➕": "extra", "🛡": "sicher", "🎲": "risiko", "✅": "ok", "✨": "beste",
    "🔒": "schloss", "⚠": "warnung", "🌍": "welt", "🗓": "kalender", "📰": "zeitung", "💥": "pleite", "📖": "regeln", "🏠": "heimat", "❗": "hinweis", "📊": "statistik", "🏢": "verwaltung", "📺": "werbung",
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
  const GRUND = { reichweite: "zu weit", geld: "zu wenig Geld", slots: "keine Landerechte mehr frei", gesperrt: "noch gesperrt", keinFlugzeug: "kein freies Flugzeug" };

  // ---------- Zustand ----------
  let st = null;
  const ui = {
    rivalen: rivalenLesen(),             // welche Rivalen-Linien auf der Karte zu sehen sind, z. B. { k: true }
    skala: 1, tempo: 0, kamera: { x: 0, y: 0, z: 1 }, zMin: 0.5,
    tafel: null, stadt: null, route: null,
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

  function kameraSetzen() {
    const c = ui.kamera;
    const r = { x0: -40, x1: K.B + 40, y0: -40, y1: K.H + 40 };
    c.z = Math.max(ui.zMin, Math.min(6, c.z));
    c.x = Math.min(FELD_B - 60 - r.x0 * c.z, Math.max(60 - r.x1 * c.z, c.x));
    c.y = Math.min(FELD_H - 60 - r.y0 * c.z, Math.max(60 - r.y1 * c.z, c.y));
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
    svg.addEventListener("pointerdown", (e) => {
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      zeiger.set(e.pointerId, punkt(e));
      bewegt = false;
      start = { kamera: { ...ui.kamera }, punkte: [...zeiger.values()].map((p) => ({ ...p })), ziel: e.target };
    });
    svg.addEventListener("pointermove", (e) => {
      if (!zeiger.has(e.pointerId) || !start) return;
      zeiger.set(e.pointerId, punkt(e));
      const pts = [...zeiger.values()];
      if (pts.length !== start.punkte.length) start = { kamera: { ...ui.kamera }, punkte: pts.map((p) => ({ ...p })), ziel: null };
      if (pts.length === 1) {
        const dx = pts[0].x - start.punkte[0].x, dy = pts[0].y - start.punkte[0].y;
        if (Math.abs(dx) + Math.abs(dy) > 6) bewegt = true;
        if (!bewegt) return;
        ui.kamera.x = start.kamera.x + dx; ui.kamera.y = start.kamera.y + dy;
      } else {
        bewegt = true;
        const [a, b] = pts, [a0, b0] = start.punkte;
        const d = Math.hypot(a.x - b.x, a.y - b.y), d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mx0 = (a0.x + b0.x) / 2, my0 = (a0.y + b0.y) / 2;
        const z = Math.max(ui.zMin, Math.min(6, start.kamera.z * d / d0));
        const wx = (mx0 - start.kamera.x) / start.kamera.z, wy = (my0 - start.kamera.y) / start.kamera.z;
        ui.kamera.z = z; ui.kamera.x = mx - wx * z; ui.kamera.y = my - wy * z;
      }
      kameraSetzen();
    });
    svg.addEventListener("pointerup", (e) => {
      if (!zeiger.has(e.pointerId)) return;
      zeiger.delete(e.pointerId);
      if (!bewegt && zeiger.size === 0 && start && start.ziel) tippen(start.ziel);
    });
    svg.addEventListener("pointercancel", (e) => { zeiger.delete(e.pointerId); bewegt = true; });
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
    const t = ziel.closest ? ziel.closest("[data-stadt],[data-route],[data-gel],[data-duell]") : null;
    if (ui.heimat) { if (t && t.dataset.stadt && L.HEIMAT.includes(t.dataset.stadt)) heimatGewaehlt(t.dataset.stadt); return; }
    if (t && t.dataset.gel) { zeigeGelegenheit(t.dataset.gel); return; }
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
    const freie = [...new Set(L.freieFlugzeuge(p).map((f) => f.typ))];
    const typen = freie.length ? freie : Object.keys(L.TYPEN).filter((t) => L.typFrei(st, p, t));
    const werte = {};
    for (const c of L.staedte(st)) {
      if (c.id === e.start) continue;
      let best = null;
      for (const typ of typen) {
        if (L.entfernung(e.start, c.id) > L.TYPEN[typ].reichweite) continue;
        if (L.kostenFuer(st, L.SPIELER, e.start, c.id, typ).slotFehlt) continue;
        const s = L.schaetzen(st, L.SPIELER, e.start, c.id, typ);
        if (!best || s.gewinn > best.gewinn) best = s;
      }
      werte[c.id] = !best ? "grau" : best.gewinn > 25000 ? "gruen" : best.gewinn > 0 ? "gelb" : "rot";
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
      for (const r of p.routen) {
        if (r.duell) {
          const [dx, dy] = punktAuf(r.a, r.b, 0.68);
          const grp = sv("g", { "data-duell": r.id, class: "huepfen" });
          grp.append(sv("circle", { cx: dx, cy: dy, r: 8.5 * s, fill: "rgba(9,18,28,.92)", stroke: st.airlines[r.duell.gegen].farbe, "stroke-width": 1.4 * s }));
          grp.append(svIcon("⚔️", dx, dy, 10 * s));
          karte.schilder.append(grp);
        }
        const hw = !r.duell && (p.hinweise || []).find((h) => h.id === r.id);
        if (hw) {
          const [hx, hy] = punktAuf(r.a, r.b, 0.5);
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
      const eigen = p && (p.slots[c.id] || 0) > 0;
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
        const sw = ui.heimat && L.SCHWIERIGKEIT[c.id];
        if (sw && z > 0.9) karte.namen.append(sv("text", { x: x + r + 2.5 * s, y: y + 12 * s, class: "stadt-name", "font-size": 7.5 * s, "stroke-width": 2.2 * s, fill: SCHWER_FARBE[sw], text: sw }));
      }
      let zeichen = null;
      if (messen.has(c.id)) zeichen = "🎪";
      else if ((c.t === "sonne" && sai.sonne > 1.2) || (c.t === "sued" && sai.sued > 1.2) || (c.t === "tropen" && sai.tropen > 1.2)) zeichen = "☀️";
      else if (c.t === "schnee" && sai.schnee > 1.2) zeichen = "⛷️";
      if (zeichen && !ui.heimat && z > 0.7) g.append(svIcon(zeichen, x - r - 4.5 * s, y - r - 4 * s, 9 * s));
      // Landerechte knapp: kleines Schild unter der Stadt (🎟 und wie viele noch frei sind).
      // Nur beim Planen (Editor) oder nah herangezoomt, sonst wird die Karte zu voll.
      const fr = st && !ui.heimat && (ui.editor || z > 1.3) ? L.slotsFrei(st, c.id) : 99;
      if (fr <= 2) {
        const farbeS = fr <= 0 ? "#F87171" : "#FB923C", by = y + r + 8 * s;
        const schild = sv("g", { class: "slot-schild" });
        schild.append(sv("rect", { x: x - 11.5 * s, y: by - 5.5 * s, width: 23 * s, height: 11 * s, rx: 5.5 * s, fill: "rgba(8,16,24,.85)", stroke: farbeS, "stroke-width": 0.8 * s }));
        schild.append(svIcon("🎟️", x - 5 * s, by, 8 * s));
        schild.append(sv("text", { x: x + 5.5 * s, y: by + 3.2 * s, "font-size": 9 * s, "font-weight": 800, "text-anchor": "middle", fill: farbeS, text: String(Math.max(0, fr)) }));
        g.append(schild);
      }
      karte.staedte.append(g);
    }
    symboleZeichnen();
  }

  // Gelegenheiten als Symbol an der Stadt, mit ablaufendem Ring.
  const GEL_ICON = { slot: "🎟️", gebraucht: "🛩️", messe: "🎪", auktion: "🔨", plan: "📣", versteigerung: "🏛️", aufkauf: "🤝", streik: "✊", sturm: "⛈️", kerosin: "⛽" };
  const gelIcon = (g) => GEL_ICON[g.art === "wahl" ? g.typ : g.art];
  function gelegenheitOrt(g) { return g.stadt || (g.art === "gebraucht" || g.art === "wahl" ? ich().basis : null); }
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
        if (!f.route) continue;
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
    hud.geldK = el("button", { class: "kachel geld", onclick: zeigeKasse }, hud.name, hud.geldB, hud.geldS);
    hud.tag = el("span"); hud.saison = el("span"); hud.balken = el("i"); hud.kerosin = el("span", { class: "kerosin" });
    hud.uhr = el("div", { class: "kachel uhr" }, el("div", { class: "zeile" }, hud.tag, hud.saison, hud.kerosin), el("div", { class: "balken" }, hud.balken));
    hud.tempo = el("button", { class: "kachel tempoknopf", onclick: tempoWeiter, "aria-label": "Tempo" });
    hud.platz = el("button", { class: "kachel treppchen", onclick: zeigeRang, "aria-label": "Rangliste" });
    hud.store = el("button", { class: "kachel rundknopf knopf-mit", onclick: storeZeigen, "aria-label": "Flugzeug-Store" }, "🛒");
    hud.frei = el("span", { class: "abzeichen" });
    hud.linien = el("button", { class: "kachel linienknopf knopf-mit", onclick: () => editorOeffnen() }, "✏️ Linien", hud.frei);
    hud.menue = el("button", { class: "kachel rundknopf", onclick: menueZeigen, "aria-label": "Menü" }, "☰");
    hud.bericht = el("button", { class: "kachel rundknopf berichtknopf", onclick: zeigeBericht, "aria-label": "Berichte" });
    oben.append(hud.geldK, hud.uhr, hud.tempo, el("div", { class: "luecke" }), hud.bericht, hud.platz, hud.store, hud.linien, hud.menue);
    hud.ziel = el("button", { class: "zielleiste", onclick: zielAntippen });
    hud.warn = el("div");
    // Schalter unten links: Rivalen-Linien auf der Karte zeigen oder ausblenden.
    hud.rivalen = el("div", { class: "rivalenknopf" });
    feld.append(oben, hud.ziel, hud.warn, hud.rivalen);
    rivalenKnopf();
    hudAktualisieren();
  }

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
          el("i"), a.name.slice(0, 3));
      }));
  }

  function hudAktualisieren() {
    if (!st || !hud.geldB) return;
    const p = ich();
    const tag = L.tagVon(st);
    const rufSig = p.name + p.farbe + Math.round(p.ruf);
    if (hud.rufSig !== rufSig) { hud.rufSig = rufSig; hud.name.replaceChildren(el("span", { class: "punkt", style: { background: p.farbe } }), p.name, el("span", { class: "ruf-chip", text: "⭐ " + Math.round(p.ruf) })); }
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
    hud.platz.replaceChildren(el("span", { class: "stufen-bild" }, [3, 1, 2].map((i) => el("i", { class: i === pl ? "an" : "", style: { height: (i === 1 ? 14 : i === 2 ? 10 : 7) + "px" } }))), el("b", { text: pl + "." }),
      ...(st.rennen ? [el("span", { class: "abzeichen rennen-abzeichen", text: "🏁" })] : []));
    const frei = L.freieFlugzeuge(p).length;
    hud.frei.textContent = frei; hud.frei.style.display = frei ? "" : "none";
    const au = Object.values(p.auftraege || {}).filter(Boolean);
    const ctrl = L.assistent(p, "controller");
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
    if (z.id === "kaufen" || (z.id === "route" && !ich().routen.length)) angeboteZeigen();
    else if (["route", "drehkreuz", "kontinent", "kontinente4"].includes(z.id)) editorOeffnen();
    else if (z.id === "flotte5") storeZeigen();
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
    if (tafelEl) tafelEl.remove();
    ui.tafel = art;
    tafelEl = el("div", { class: "tafel" + (ui.editor ? " im-editor" : "") },
      el("div", { class: "kopf" }, el("h2", {}, titel, untertitel ? el("small", { text: untertitel }) : null),
        ui.editor ? null : el("button", { class: "zu", text: "✕", onclick: tafelZu, "aria-label": "Schließen" })),
      el("div", { class: "rumpf" }, inhalt));
    feld.append(tafelEl);
    feld.classList.add("tafel-an");
    karteZeichnen();
    return tafelEl;
  }
  // Ruhige Zeit: Eine Entscheidung (Versteigerung, Wahl, Aufkauf) hält die Uhr an, bis die Tafel zu ist. Immer nur eine.
  const ENTSCHEIDUNG = new Set(["versteigerung", "wahl", "aufkauf", "auktion"]);
  function entscheidungPruefen() {
    if (!st || ui.modal || ui.editor || ui.entscheidung) return;
    const g = st.gelegenheiten.find((x) => ENTSCHEIDUNG.has(x.art) && !x.gezeigt);
    if (!g) return;
    g.gezeigt = true;
    ui.entscheidung = { id: g.id, tempo: ui.tempo };
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
  }

  const chipAirline = (aid) => el("span", { class: "chip" }, el("span", { class: "punkt", style: { background: st.airlines[aid].farbe } }), st.airlines[aid].name);

  function zeigeStadt(id) {
    const c = L.STADT[id];
    const p = ich();
    ui.stadt = id; ui.route = null;
    const tag = L.tagVon(st);
    const frei = L.slotsFrei(st, id);
    const meine = p.slots[id] || 0, genutzt = L.slotsGenutzt(p, id);
    const hub = L.drehkreuze(p).includes(id);
    const routen = p.routen.filter((r) => r.a === id || r.b === id);
    const andere = ["k", "s", "a"].filter((aid) => st.airlines[aid].routen.some((r) => r.a === id || r.b === id));
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
    tafel("stadt", c.name, KLASSE[c.k] + " · " + L.KONTINENTE[c.r] + (istAusgebaut ? " · ausgebautes Drehkreuz" : hub ? " · dein Drehkreuz" : p.basis === id ? " · deine Heimat" : ""),
      el("div", { class: "symbolzeile" },
        symbol("👥", "Größe", "●".repeat(Math.round(c.g / 2.5)) || "●"),
        symbol("👔", "Geschäft", Math.round(c.w * 100) + " %"),
        symbol("🛬", "Gebühr", geld(L.REGELN.gebuehr[c.k]))),
      saisonText ? el("div", { class: "hinweis", text: saisonText }) : null,
      messe ? el("div", { class: "hinweis", text: `🎪 Messe Tag ${messe.von} bis ${messe.bis}: doppelt so viele Geschäftsreisende.` }) : null,
      trend ? el("div", { class: "hinweis " + (trend > 0 ? "gruen" : "rot"), text: trend > 0 ? "📈 Wird gerade beliebter: jeden Tag mehr Gäste." : "📉 Verliert gerade Gäste." }) : null,
      el("div", { class: "zeile" }, el("span", { text: "🎟️ Deine Landerechte" }), el("b", { class: "rechts", text: meine ? `${genutzt} von ${meine} genutzt` : "keine" })),
      el("div", { class: "zeile blass mini" }, el("span", { text: frei > 0 ? `🎟️ Noch ${frei} Landerechte frei` : "🎟️ Alle Landerechte vergeben" }), el("span", { class: "rechts", text: frei > 0 ? "je " + geld(L.slotPreis(st, id)) : "ausverkauft" })),
      andere.length ? el("div", { class: "chips" }, el("span", { class: "blass mini", text: "Hier fliegen auch:" }), andere.map(chipAirline)) : null,
      ausbauPreis ? el("div", { class: "ausbau" },
        el("div", {}, el("b", { text: "🏗️ Zum Drehkreuz ausbauen" }), el("small", { text: "+60 % Umsteiger, Linien hier ziehen mehr Gäste an." })),
        el("button", { class: "nebenknopf", disabled: p.geld < ausbauPreis, text: geld(ausbauPreis), onclick: () => { L.drehkreuzAusbauen(st, L.SPIELER, id); nachAktion(); meldung("🏗️", c.name + " ist jetzt dein ausgebautes Drehkreuz."); zeigeStadt(id); } })) : null,
      routen.map(routeZeile),
      el("button", { class: "hauptknopf", text: "✏️ Neue Linie ab " + c.name, onclick: () => editorOeffnen({ start: id }) }));
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
      el("button", { class: "hauptknopf", text: "✏️ Im Editor bearbeiten", onclick: () => editorOeffnen({ linie: rid }) }));
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
    tafel("flotte", "Deine Flotte", p.flotte.length + " Flugzeuge · " + frei.length + " stehen frei",
      p.flotte.length ? null : el("div", { class: "hinweis", text: "Noch keine Flugzeuge. Kauf dein erstes im 🛒 Store." }),
      Object.keys(L.TYPEN).map((typ) => {
        const alle = p.flotte.filter((f) => f.typ === typ);
        if (!alle.length) return null;
        const freiT = alle.filter((f) => !f.route);
        return el("div", { class: "wahl" },
          el("div", { class: "ic" }, bildEl("air-flugzeug-" + typ, TYP_ICON[typ])),
          el("div", { class: "mitte" }, el("b", { text: L.TYPEN[typ].name + " · " + alle.length + "×" }), el("span", { text: (alle.length - freiT.length) + " fliegen · " + freiT.length + " frei" })),
          freiT.length ? el("button", { class: "nebenknopf", text: "Verkaufen", onclick: () => { L.verkaufen(st, L.SPIELER, freiT[0].id); nachAktion(); zeigeFlotte(); } }) : null);
      }),
      el("div", { class: "knopfreihe" },
        el("button", { class: "nebenknopf", text: "🛒 Store", onclick: storeZeigen }),
        el("button", { class: "nebenknopf", text: "✏️ Linien", onclick: () => editorOeffnen() })),
      el("div", { class: "blass mini", text: "Verkaufen bringt " + Math.round(L.REGELN.verkaufAnteil * 100) + " % vom Neupreis." }));
  }

  function zeigeRang() {
    const liste = L.rangliste(st);
    const max = Math.max(...liste.map((r) => r.wert), 1);
    const meinPlatz = liste.findIndex((x) => x.id === L.SPIELER);
    const R = st.rennen;
    tafel("rang", "Rangliste der Welt", "gezählt wird der Firmenwert",
      R ? el("div", { class: "rennen" }, el("b", { text: "🏁 " + R.text }),
        el("small", { text: `Preis ${R.preis / 1e6} Mio + Pokal · noch ${Math.max(0, R.bis - L.tagVon(st) + 1)} Tage · du: ${Math.min(L.rennenStand(st, L.SPIELER), R.soll)} / ${R.soll}` })) : null,
      liste.map((r, i) => {
        const riv = L.RIVALEN[r.id];
        const spruch = riv ? (i === 0 ? riv.sprueche.gross : meinPlatz < i ? riv.sprueche.verliert : riv.sprueche.gegen) : null;
        return el("div", { class: "rang" + (riv ? "" : " ich") },
          el("span", { class: "nr", text: ["🥇", "🥈", "🥉", "4"][i] }),
          el("div", { class: "gesicht", style: { background: r.farbe } }, riv ? bildEl(CHEF[r.id], riv.chef[0]) : "★"),
          el("div", { class: "mitte" },
            el("b", { text: r.name + (riv ? " · " + riv.chef : " (du)") + (st.airlines[r.id].pokale ? " " + "🏆".repeat(Math.min(5, st.airlines[r.id].pokale)) : "") }),
            el("span", { class: "blass mini", text: `${geld(r.wert)} · ${r.routen} Linien · ${r.flugzeuge} ✈` }),
            el("div", { class: "spur" }, el("i", { style: { width: (r.wert / max * 100).toFixed(1) + "%", background: r.farbe } })),
            spruch ? el("div", { class: "spruch", text: "„" + spruch + "“" }) : null));
      }));
    erklaeren("rangliste");
  }

  // ---------- Meine Airline ----------
  // Name, Grundsätze und Assistenten. Jederzeit über das Menü erreichbar, alles änderbar.
  const FARBEN = ["#4FD1A5", "#6EC6FF", "#FF7FA8", "#F2C14E", "#B794F6", "#F6AD55"];
  const ROLLE = { analyst: { icon: "🔎", titel: "Routen-Analyse", text: "prüft, welche neuen Linien sich lohnen" }, preis: { icon: "💶", titel: "Preis-Check", text: "prüft die Preise deiner Linien" }, controller: { icon: "📋", titel: "Controlling", text: "meldet Probleme bei Linien und schreibt den Wochenbericht" } };
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
    const art = L.SERVICE[pr.art];
    const ohneEssen = p.grundsaetze.essen === "keins";
    const seite = el("div", { class: "seite store meine" },
      el("div", { class: "store-kopf" }, el("h1", { text: "✈️ Meine Airline" }),
        el("button", { class: "zu", text: "✕", "aria-label": "Schließen", onclick: () => { seite.remove(); ui.modal = false; } })),
      el("div", { class: "meine-reihe" },
        el("div", { class: "meine-spalte" },
          el("b", { class: "spaltentitel", text: "Name" }),
          el("input", { class: "namensfeld", value: p.name, maxlength: 18, onchange: (e) => { L.umbenennen(st, L.SPIELER, e.target.value); nachAktion(); neu(); } }),
          el("div", { class: "farben" }, FARBEN.map((f) => el("button", { class: "farbpunkt" + (p.farbe === f ? " an" : ""), style: { background: f }, "aria-label": "Farbe", onclick: () => { L.umbenennen(st, L.SPIELER, null, f); karte.fliegerEls.forEach((x) => x.remove()); karte.fliegerEls.clear(); nachAktion(); neu(); } }))),
          el("div", { class: "zeile" }, el("span", { text: "⭐ Ruf" }), el("b", { class: "rechts", text: Math.round(p.ruf) + " / 100" })),
          el("div", { class: "auslastung" }, el("i", { style: { width: p.ruf + "%", background: "#F2C14E" } })),
          el("div", { class: "blass mini", text: rufWirkung(p) }),
          werbeKnopf(neu)),
        el("div", { class: "meine-spalte breit" },
          el("b", { class: "spaltentitel", text: "Deine Art von Airline" }),
          el("div", { class: "profilwahl" }, [["billig", "Günstig"], ["standard", "Ausgewogen"], ["premium", "Premium"]].map(([id, name]) => {
            const passt = Object.entries(L.VORLAGEN[id]).every(([k, w]) => p.grundsaetze[k] === w);
            return el("button", { class: "profil-knopf" + (passt ? " an" : ""), onclick: () => { L.vorlageSetzen(st, L.SPIELER, id); nachAktion(); neu(); } },
              el("div", { class: "art-bild" }, bildEl("air-service-" + id, L.SERVICE[id].icon)), el("b", { text: name }), el("small", { text: L.SERVICE[id].staerke }));
          })),
          el("div", { class: "blass mini mitte-text", text: "Ein Tipp stellt alles passend ein. Schlechter für die Gäste kostet etwas Ruf." }),
          detailsBox("grundsaetze", "Details: einzelne Grundsätze",
            Object.entries(L.GRUNDSAETZE).map(([k, g]) => el("div", { class: "grundsatz" + (k === "essenZahlen" && ohneEssen ? " aus" : "") },
              el("span", { class: "gs-icon", text: g.icon }), el("span", { class: "gs-name", text: g.name }),
              el("div", { class: "segment klein" }, Object.entries(g.optionen).map(([id, o]) => el("button", { class: p.grundsaetze[k] === id ? "an" : "", onclick: () => { L.grundsatzSetzen(st, L.SPIELER, k, id); nachAktion(); neu(); } }, o.name)))))),
          el("div", { class: "wirkung" },
            el("div", {}, el("small", { text: "🏖️ Urlauber" }), el("b", { text: punkte(pr.gast.urlaub) })),
            el("div", {}, el("small", { text: "👔 Geschäftsleute" }), el("b", { text: punkte(pr.gast.geschaeft) })),
            el("div", {}, el("small", { text: "🎫 Ticketpreis" }), el("b", { text: Math.round(pr.preis * 100) + " %" })),
            el("div", {}, el("small", { text: "➕ Gebühren" }), el("b", { text: pr.extra ? "+" + pr.extra + " € / Gast" : "keine" })),
            el("div", {}, el("small", { text: "⭐ Qualität" }), el("b", { class: "sterne", text: "★".repeat(pr.sterne) + "☆".repeat(5 - pr.sterne) })),
            el("div", {}, el("small", { text: "🍽️ Kostet dich" }), el("b", { class: pr.essenKosten > 0 ? "minus" : "", text: pr.essenKosten > 0 ? Math.round(pr.essenKosten) + " € / Gast" : "nichts" }))),
          ),
        el("div", { class: "meine-spalte" },
          el("b", { class: "spaltentitel", text: "Assistenten" }),
          assistKarte("controller", neu), assistKarte("analyst", neu), assistKarte("preis", neu))));
    feld.append(seite);
    seite.querySelector(".meine-spalte.breit").scrollTop = scroll;
    erklaeren("meine");
  }
  function assistKarte(rolle, neu) {
    const p = ich();
    const x = L.assistent(p, rolle);
    const R = ROLLE[rolle];
    const liste = rolle === "analyst" ? L.ANALYSTEN : rolle === "preis" ? L.PREISPROFIS : L.CONTROLLER;
    const kopf = el("div", { class: "assist-kopf" }, el("span", { text: R.icon }), el("b", { text: R.titel }));
    if (!x) {
      return el("div", { class: "assist" }, kopf, el("div", { class: "blass mini", text: "Noch niemand. Wer " + R.text + "?" }),
        Object.entries(liste).map(([id, k]) => el("div", { class: "kandidat" },
          el("div", { class: "gesicht klein-gesicht" }, bildEl(k.bild, k.name[0])),
          el("div", { class: "mitte" }, el("b", { text: k.name }), el("span", { class: "sterne", text: sterne(k.sterne) }), el("small", { text: geld(k.gehalt) + "/Tag · " + k.mackeText })),
          el("button", { class: "nebenknopf", text: "Einstellen", onclick: () => { L.einstellen(st, L.SPIELER, rolle, id); nachAktion(); neu(); } }))));
    }
    const au = p.auftraege && p.auftraege[rolle];
    let aktion;
    if (rolle === "controller") aktion = el("div", {}, el("div", { class: "blass mini", text: "Meldet sich von selbst bei Problemen (❗ an der Linie). Jeden Sonntag: Wochenbericht." }),
      p.wochenbericht || (p.hinweise && p.hinweise.length) ? el("button", { class: "nebenknopf", text: "📋 Bericht ansehen", onclick: () => { meineZu(); zeigeBericht(); } }) : null);
    else if (au && !au.bericht) aktion = el("div", { class: "hinweis", text: "⏳ arbeitet … noch " + Math.max(1, Math.ceil(au.fertig - st.zeit)) + " Std" });
    else aktion = el("div", { class: "knopfreihe" },
      el("button", { class: "nebenknopf", text: "⚡ Schnell", onclick: () => { auftrag(rolle, false); meineZu(); } }),
      el("button", { class: "nebenknopf", text: "🔬 Gründlich", onclick: () => { auftrag(rolle, true); meineZu(); } }));
    return el("div", { class: "assist" }, kopf,
      el("div", { class: "kandidat" },
        el("div", { class: "gesicht klein-gesicht" }, bildEl(x.bild, x.name[0])),
        el("div", { class: "mitte" }, el("b", { text: x.name }), el("span", { class: "sterne", text: sterne(x.sterne) }), el("small", { text: geld(x.gehalt) + "/Tag · " + x.mackeText })),
        el("button", { class: "zu", text: "✕", title: "Entlassen", "aria-label": "Entlassen", onclick: () => { L.einstellen(st, L.SPIELER, rolle, null); nachAktion(); neu(); } })),
      au && au.bericht ? el("button", { class: "hauptknopf", text: "📋 Bericht ansehen", onclick: () => { meineZu(); zeigeBericht(); } }) : null,
      rolle === "controller" ? null : el("div", { class: "blass mini", text: rolle === "analyst" ? "Prüft Ziele ab " + L.STADT[p.basis].name + ":" : "Prüft alle deine Linien:" }),
      aktion);
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
  const VORSCHLAG = { vergleich: "⚔️ Vergleichen", abziehen: "− Ein Flugzeug abziehen", schliessen: "Linie schließen", billiger: "🔻 Preis senken", groesser: "⬆ Größeres Flugzeug" };
  function hinweisAusfuehren(h) {
    const p = ich();
    const r = p.routen.find((x) => x.id === h.id);
    p.hinweise = (p.hinweise || []).filter((x) => x !== h);
    if (!r) { tafelZu(); return; }
    if (h.vorschlag === "vergleich") { zeigeDuell(r.id); return; }
    if (h.vorschlag === "groesser") { editorOeffnen({ linie: r.id }); return; }
    if (h.vorschlag === "abziehen") L.abziehen(st, L.SPIELER, r.id);
    else if (h.vorschlag === "schliessen") L.routeSchliessen(st, L.SPIELER, r.id);
    else if (h.vorschlag === "billiger") L.preisStufe(st, L.SPIELER, r.id, "angreifen");
    nachAktion();
    if (p.routen.some((x) => x.id === r.id)) zeigeRoute(r.id); else tafelZu();
  }
  function hinweisBox(h, mitName) {
    h.gelesen = true;
    return el("div", { class: "hinweis orange" }, el("div", { text: "❗ " + (mitName ? L.STADT[h.a].name + " – " + L.STADT[h.b].name + ": " : "") + h.text }),
      h.vorschlag ? el("button", { class: "nebenknopf", text: VORSCHLAG[h.vorschlag], onclick: () => hinweisAusfuehren(h) }) : null,
      mitName ? el("button", { class: "nebenknopf", text: "Ansehen", onclick: () => zeigeRoute(h.id) }) : null);
  }
  function meineZu() { const m = feld.querySelector(".meine"); if (m) m.remove(); ui.modal = false; }
  function auftrag(rolle, gruendlich, stadt) {
    L.auftragGeben(st, L.SPIELER, rolle, stadt || ich().basis, gruendlich);
    nachAktion();
    const x = L.assistent(ich(), rolle);
    meldung("⏳", x.name + ": Bin dran! " + (gruendlich ? "Gründlich dauert einen Tag." : "In ein paar Stunden weiß ich mehr."));
    if (ui.tempo === 0) tempo(1);
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
    const ctrl = L.assistent(p, "controller");
    if (ctrl) {
      teile.push(el("div", { class: "bericht-kopf" }, el("div", { class: "gesicht klein-gesicht" }, bildEl(ctrl.bild, ctrl.name[0])),
        el("div", {}, el("b", { text: ctrl.name + " " + sterne(ctrl.sterne) }), el("small", { class: "blass", text: "Controlling" }))));
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
            const txt = !k ? null : k.art === "preis" ? STUFE_TEXT[k.stufe] : k.art === "sitze" ? "✨ Sitze neu aufteilen" : k.art === "abziehen" ? "− Ein Flugzeug abziehen" : "Linie schließen";
            return el("div", { class: "zeile mini" }, el("span", { class: "farbstrich", style: { background: farbeGewinn(x.gewinn) } }), el("span", { text: L.STADT[x.a].name + " – " + L.STADT[x.b].name + " " + kurz(x.gewinn) }),
              k && !x.erledigt ? el("button", { class: "nebenknopf rechts", text: txt + " · " + vonBis(x.plus, kurz), onclick: () => { L.wochenVorschlagUebernehmen(st, i); nachAktion(); zeigeBericht(); } })
                : el("span", { class: "rechts", text: x.erledigt ? "✓ erledigt" : "passt so" }));
          })));
      }
    }
    for (const rolle of ["analyst", "preis"]) {
      const au = p.auftraege && p.auftraege[rolle];
      const x = L.assistent(p, rolle);
      if (!au || !x) continue;
      if (!au.bericht) { teile.push(el("div", { class: "hinweis", text: `⏳ ${x.name} arbeitet noch (${Math.max(1, Math.ceil(au.fertig - st.zeit))} Std).` })); continue; }
      teile.push(el("div", { class: "bericht-kopf" }, el("div", { class: "gesicht klein-gesicht" }, bildEl(x.bild, x.name[0])),
        el("div", {}, el("b", { text: x.name + " " + sterne(x.sterne) }), el("small", { class: "blass", text: (rolle === "analyst" ? "Ziele ab " + L.STADT[au.stadt].name : "Deine Linien") + " · Stand Tag " + au.tag + (au.gruendlich ? " · gründlich" : "") }))));
      if (rolle === "analyst") {
        if (!au.bericht.length) teile.push(el("div", { class: "hinweis", text: "Ich habe von hier nichts gefunden, das sich lohnt." }));
        for (const v of au.bericht) {
          const n = L.TYPEN[v.typ].kurz;
          teile.push(el("div", { class: "vorschlag" },
            el("div", { class: "zeile" }, el("b", { text: "→ " + L.STADT[v.ziel].name }), el("span", { class: "rechts plus", text: vonBis(v.gewinn, kurz) })),
            el("div", { class: "chips" },
              el("span", { class: "chip", text: "👥 " + vonBis(v.gaeste, (z) => Math.max(0, z)) + " Gäste" }),
              el("span", { class: "chip", text: "👔 " + v.geschaeft + " %" }),
              el("span", { class: "chip", text: v.konkurrenz ? "⚔️ " + v.konkurrenz + "×" : "⚔️ keine" }),
              el("span", { class: "chip", text: STUFE_TEXT[v.preis] }),
              el("span", { class: "chip", text: TYP_ICON[v.typ] + " " + n })),
            el("button", { class: "nebenknopf", text: "✏️ Im Editor öffnen", onclick: () => editorOeffnen({ start: v.start, ziel: v.ziel, stufe: v.preis, typ: v.typ }) })));
        }
      } else {
        for (const v of au.bericht) {
          const r = p.routen.find((x) => x.id === v.id);
          if (!r) continue;
          teile.push(el("div", { class: "vorschlag" },
            el("div", { class: "zeile" }, el("b", { text: L.STADT[v.a].name + " – " + L.STADT[v.b].name })),
            el("div", { class: "zeile mini" }, el("span", { class: "blass", text: v.lage }),
              v.plus && !v.erledigt && r.stufe !== v.stufe ? el("button", { class: "nebenknopf rechts", text: STUFE_TEXT[v.stufe] + " · " + vonBis(v.plus, kurz), onclick: () => { L.preisVorschlagUebernehmen(st, v.id); nachAktion(); zeigeBericht(); } })
                : el("span", { class: "rechts", text: r.stufe === v.stufe ? "✓ passt so" : "–" }))));
        }
      }
      teile.push(el("div", { class: "blass mini", text: "Nur eine Schätzung (" + x.mackeText + "). Jahreszeit und Konkurrenz ändern die Nachfrage." }));
    }
    tafel("bericht", "📋 Berichte", null, teile.length ? teile : el("div", { class: "hinweis", text: "Noch kein Bericht. Stelle in ✈️ Meine Airline jemanden ein." }),
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
    let titel = "", text = "", ja = null, bildName = "air-ereignis-slot";
    if (g.art === "slot") { titel = "Landerecht frei in " + stadt; text = "Dort ist sonst alles voll. Wer zuerst kommt …"; ja = "Kaufen · " + geld(g.preis); }
    else if (g.art === "gebraucht") { bildName = "air-ereignis-gebraucht"; titel = "Gebrauchter " + L.TYPEN[g.typ].name; text = "Fast halber Preis. Steht danach frei in deiner Flotte."; ja = "Kaufen · " + geld(g.preis); }
    else if (g.art === "messe") { bildName = "air-ereignis-messe"; titel = "Messe in " + stadt; text = "Ab Tag " + g.von + " drei Tage lang doppelt so viele Geschäftsreisende."; }
    else if (g.art === "auktion") { titel = "Landerecht in " + stadt + " wird versteigert"; text = "Deine Linie dort war zu leer. Behalten, sonst fällt ein Flugzeug weg."; ja = "Behalten · " + geld(g.preis); }
    const extra = [];
    if (g.art === "plan") {
      const a = st.airlines[g.aid];
      bildName = "air-ereignis-plan";
      titel = a.name + " plant " + L.STADT[g.von].name + " – " + stadt;
      text = `In ${Math.max(1, g.tag - L.tagVon(st))} Tagen geht es los. Fliegst du die Strecke vorher, verzichtet ${a.name}.`;
      extra.push(el("button", { class: "hauptknopf", text: "✏️ Zuvorkommen", onclick: () => editorOeffnen({ start: g.von, ziel: g.stadt }) }));
    } else if (g.art === "versteigerung") {
      bildName = "air-ereignis-versteigerung";
      titel = "Versteigerung in " + stadt;
      text = `${L.REGELN.versteigerungStueck} neue Landerechte. Jede Airline bietet einmal verdeckt, das höchste Gebot gewinnt und zahlt. Wer zu viel bietet, hat weniger für Flugzeuge.`;
      extra.push(el("div", { class: "segment" }, [1, 2, 3].map((n) => el("button", { class: g.gebot === n ? "an" : "", disabled: p.geld < n * g.stufe, onclick: () => { L.bieten(st, g.id, g.gebot === n ? 0 : n); nachAktion(); zeigeGelegenheit(g.id); } }, ["Wenig", "Mittel", "Viel"][n - 1] + " · " + geld(n * g.stufe)))));
      extra.push(el("div", { class: "blass mini mitte-text", text: g.gebot ? "Dein Gebot steht. Ergebnis, wenn die Uhr abgelaufen ist." : "Noch kein Gebot." }));
    } else if (g.art === "aufkauf") {
      const a = st.airlines[g.aid];
      bildName = "air-ereignis-aufkauf";
      titel = g.pleite ? a.name + " ist pleite" : a.name + " in der Krise";
      text = `${g.flugzeuge} Flugzeuge und alle Landerechte von ${a.name}. Die Flugzeuge stehen danach frei in deiner Flotte, ${a.name} fängt neu an.`;
      ja = "Alles kaufen · " + geld(g.preis);
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
    }
    const stunden = Math.max(0, Math.ceil(g.bis - st.zeit));
    tafel("gelegenheit", titel, g.info && g.art !== "plan" ? null : "Noch " + stunden + " Stunden",
      el("div", { class: "ereignisbild" }, bildEl(bildName, gelIcon(g))),
      el("div", { text }),
      ja ? el("button", { class: "hauptknopf", disabled: p.geld < g.preis, text: ja, onclick: () => { L.gelegenheitAnnehmen(st, g.id); nachAktion(); tafelZu(); } }) : null,
      ja ? el("button", { class: "nebenknopf", text: "Nein danke", onclick: () => { L.gelegenheitAblehnen(st, g.id); nachAktion(); tafelZu(); } }) : null,
      g.art === "messe" ? el("button", { class: "hauptknopf", text: "✏️ Linie nach " + stadt + " planen", onclick: () => editorOeffnen({ start: ich().basis, ziel: g.stadt }) }) : null,
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
      ui.angebote.map((o) => el("button", { class: "wahl angebot " + o.art, onclick: () => { ui.angebote = null; editorOeffnen({ start: p.basis, ziel: o.ziel, typ: o.typ }); } },
        el("div", { class: "mitte" },
          el("small", { class: "angebot-art", text: ANGEBOT[o.art].icon + " " + ANGEBOT[o.art].titel }),
          el("div", { class: "angebot-zeile" }, el("b", { text: "→ " + L.STADT[o.ziel].name }), el("span", { class: "plus", text: kurz(o.von) + " bis " + kurz(o.bis) + " / Woche" })),
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
    ui.editor = { start: opt.start || (opt.linie ? null : ich().basis), ziel: opt.ziel || null, linie: opt.linie || null, typ: opt.typ || null, stufe: opt.stufe || "normal" };
    feld.classList.add("editor-an");
    editorZeichnen();
    if (!gesehen("editor")) tippZeigen("Das ist der Linien-Editor. Die Startstadt ist schon gewählt. Grün leuchtende Ziele lohnen sich: Tippe eins an.", editorEl.querySelector(".editor-mitte"), "unten", "Okay");
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
    else mitte = "③ Flugzeug wählen und eröffnen";
    editorEl = el("div", { class: "editor" },
      el("div", { class: "editor-kopf" },
        el("span", { class: "editor-titel", text: "✏️ Linien-Editor" }),
        el("span", { class: "editor-mitte", text: mitte }),
        el("button", { class: "hauptknopf klein", text: "Fertig", onclick: editorZu })),
      liste);
    feld.append(editorEl);
    if (e.linie) linieBearbeiten(e.linie);
    else if (e.start && e.ziel) linieNeu(e.start, e.ziel);
    else if (e.start) startTafel(e.start);
    else if (tafelEl) { tafelEl.remove(); tafelEl = null; } feld.classList.remove("tafel-an");
    karteZeichnen();
  }

  function startTafel(id) {
    const p = ich();
    const freie = L.freieFlugzeuge(p);
    const heat = heatmap() || {};
    const gruen = Object.values(heat).filter((v) => v === "gruen").length;
    tafel("editor", "Start: " + L.STADT[id].name, KLASSE[L.STADT[id].k],
      el("div", { class: "legende gross" }, [["gruen", "lohnt sich"], ["gelb", "knapp"], ["rot", "Verlust"], ["grau", "nicht möglich"]].map(([k, t]) => el("span", {}, el("i", { style: { background: HEAT[k] } }), t))),
      el("div", { class: "hinweis gruen", text: gruen ? `${gruen} Ziele leuchten grün. Tippe eins auf der Karte an.` : "Von hier lohnt sich gerade kein Ziel." }),
      freie.length ? el("div", { class: "blass mini", text: "Freie Flugzeuge: " + freie.map((f) => L.TYPEN[f.typ].name).join(", ") }) : el("div", { class: "hinweis", text: "Du hast kein freies Flugzeug. Die Farben zeigen, was ein neues bringen würde." }),
      freie.length ? null : el("button", { class: "hauptknopf", text: "🛒 Zum Flugzeug-Store", onclick: storeZeigen }),
      analystKnopf(id),
      el("button", { class: "nebenknopf", text: "Andere Startstadt wählen", onclick: () => { ui.editor.wahlStart = true; ui.editor.ziel = null; editorZeichnen(); } }));
  }

  function analystKnopf(id) {
    const p = ich();
    const x = L.assistent(p, "analyst");
    if (!x) return null;
    const au = p.auftraege && p.auftraege.analyst;
    if (au && !au.bericht) return el("div", { class: "blass mini", text: "⏳ " + x.name + " prüft gerade " + L.STADT[au.stadt].name + "." });
    return el("button", { class: "nebenknopf", text: "🔎 " + x.name.split(" ").slice(-1)[0] + " soll Ziele ab " + L.STADT[id].name + " prüfen", onclick: () => { editorZu(); auftrag("analyst", false, id); } });
  }

  function linieNeu(a, b) {
    const p = ich();
    const e = ui.editor;
    const km = L.entfernung(a, b);
    const vorhanden = L.routeVon(p, a, b);
    const n = L.grundNachfrage(st, a, b, L.tagVon(st));
    const konkurrenz = ["k", "s", "a"].filter((aid) => L.routeVon(st.airlines[aid], a, b));
    const freieTypen = [...new Set(L.freieFlugzeuge(p).map((f) => f.typ))];
    const optionen = freieTypen.map((typ) => {
      const test = L.kannFliegen(st, L.SPIELER, a, b, typ, { nurFrei: true });
      let delta = null;
      if (test.ok || test.grund === "geld") {
        const pr = L.probe(st, L.SPIELER, (k) => { k.airlines[L.SPIELER].geld = 1e12; const r = L.fliegen(k, L.SPIELER, a, b, typ, { nurFrei: true }); if (r.ok) L.preisStufe(k, L.SPIELER, r.route.id, e.stufe); return r; });
        delta = pr ? pr.delta : null;
      }
      return { typ, test, delta };
    });
    // Kein passendes freies Flugzeug? Dann direkt hier kaufen: der vorgeschlagene Typ oder die drei besten.
    const kaufTypen = [];
    if (e.typ && !freieTypen.includes(e.typ)) kaufTypen.push(e.typ);
    if (!optionen.some((o) => o.test.ok)) {
      const geschaetzt = Object.keys(L.TYPEN).filter((typ) => !freieTypen.includes(typ) && !kaufTypen.includes(typ) && L.kannFliegen(st, L.SPIELER, a, b, typ).ok)
        .map((typ) => ({ typ, g: L.schaetzen(st, L.SPIELER, a, b, typ).gewinn })).sort((x, y) => y.g - x.g).slice(0, Math.max(0, 3 - kaufTypen.length));
      kaufTypen.push(...geschaetzt.map((x) => x.typ));
    }
    for (const typ of kaufTypen) {
      const test = L.kannFliegen(st, L.SPIELER, a, b, typ);
      let delta = null;
      if (test.ok || test.grund === "geld") {
        const pr = L.probe(st, L.SPIELER, (k) => { k.airlines[L.SPIELER].geld = 1e12; const r = L.fliegen(k, L.SPIELER, a, b, typ, { stufe: e.stufe }); if (r.ok) L.preisStufe(k, L.SPIELER, r.route.id, e.stufe); return r; });
        delta = pr ? pr.delta : null;
      }
      optionen.push({ typ, test, delta, kaufen: true });
    }
    if (!e.typ || !optionen.some((o) => o.typ === e.typ)) {
      const beste = optionen.filter((o) => o.test.ok).sort((x, y) => (y.delta || -1e9) - (x.delta || -1e9))[0];
      e.typ = beste ? beste.typ : null;
    }
    const wahl = optionen.find((o) => o.typ === e.typ);
    const slotKosten = [a, b].map((s) => ({ s, da: L.slotsUebrig(p, s) > 0, preis: L.slotPreis(st, s), voll: L.slotsFrei(st, s) <= 0 }));
    tafel("editor", L.STADT[a].name + " → " + L.STADT[b].name, km.toLocaleString("de-DE") + " km" + (vorhanden ? " · du fliegst hier schon" : ""),
      el("div", { class: "symbolzeile" },
        symbol("👥", "Gäste/Tag", "≈ " + Math.round(n.urlaub + n.geschaeft)),
        symbol("👔", "Geschäft", Math.round(n.geschaeft / Math.max(1, n.urlaub + n.geschaeft) * 100) + " %"),
        symbol("⚔️", "Konkurrenz", konkurrenz.length ? konkurrenz.length + "×" : "keine")),
      konkurrenz.length ? el("div", { class: "chips" }, konkurrenz.map(chipAirline)) : null,
      el("div", { class: "chips" }, slotKosten.map((x) => el("span", { class: "chip" + (x.voll && !x.da ? " rot" : "") }, x.da ? "✓ " : "🎟️ ", L.STADT[x.s].name, x.da ? "" : x.voll ? " ausverkauft" : " " + geld(x.preis)))),
      optionen.length ? el("div", { class: "blass mini", text: optionen.some((o) => !o.kaufen) ? "Welches Flugzeug?" : "Welches Flugzeug kaufen?" }) : el("div", { class: "hinweis", text: "Kein Flugzeug schafft diese Strecke mit deinem Geld." }),
      optionen.map((o) => el("button", {
        class: "wahl" + (e.typ === o.typ ? " an" : "") + (o.test.ok && o.delta > 0 ? " gut" : ""), disabled: !o.test.ok && o.test.grund !== "geld",
        onclick: () => { e.typ = o.typ; editorZeichnen(); },
      },
      el("div", { class: "ic" }, bildEl("air-flugzeug-" + o.typ, TYP_ICON[o.typ])),
      el("div", { class: "mitte" }, el("b", { text: L.TYPEN[o.typ].name }), el("span", { text: (o.kaufen ? "🛒 " + geld(L.TYPEN[o.typ].preis) + " · " : "frei · ") + (o.test.ok ? L.TYPEN[o.typ].sitze + " Sitze" : GRUND[o.test.grund]) })),
      el("div", { class: "wert", style: { color: o.delta == null ? "#9FB4C4" : farbeGewinn(o.delta) } }, o.delta == null ? "–" : kurz(o.delta), el("small", { text: "pro Tag" })))),
      wahl ? el("div", { class: "blass mini", text: "Ticketpreis:" }) : null,
      wahl ? preisSegment(e.stufe, km, (s) => { e.stufe = s; editorZeichnen(); }) : null,
      wahl ? el("button", {
        class: "hauptknopf gross-knopf", disabled: !wahl.test.ok,
        text: !wahl.test.ok ? GRUND[wahl.test.grund] : wahl.kaufen ? `🛒 Kaufen & Linie eröffnen · ${geld(wahl.test.kosten.gesamt)}` : `Linie eröffnen · ${kurz(wahl.delta || 0)} am Tag`,
        onclick: () => eroeffnen(a, b, wahl.typ, e.stufe, wahl.kaufen),
      }) : null,
      wahl && wahl.kaufen && wahl.test.ok ? el("div", { class: "blass mini mitte-text", text: "Bringt etwa " + kurz(wahl.delta || 0) + " am Tag" + (wahl.test.kosten.slots ? " · Landerechte im Preis: " + geld(wahl.test.kosten.slots) : "") }) : null,
      wahl && !wahl.kaufen && wahl.test.kosten && wahl.test.kosten.slots ? el("div", { class: "blass mini mitte-text", text: "Landerechte kosten einmalig " + geld(wahl.test.kosten.slots) }) : null,
      el("button", { class: "nebenknopf", text: "🛒 Anderes Flugzeug im Store", onclick: storeZeigen }));
  }

  function preisSegment(stufe, km, wenn) {
    const p = ich();
    return el("div", { class: "segment" }, Object.entries(L.STUFEN).map(([id, s]) => el("button", { class: stufe === id ? "an" : "", onclick: () => wenn(id) },
      { angreifen: "🔻 Billiger", normal: "● Normal", abschoepfen: "🔺 Teurer" }[id],
      el("small", { text: Math.round(L.ticket(km) * L.profil(p).preis * s.preis) + " €" }))));
  }

  function eroeffnen(a, b, typ, stufe, kaufen) {
    const r = L.fliegen(st, L.SPIELER, a, b, typ, kaufen ? { stufe } : { nurFrei: true, stufe });
    if (!r.ok) return;
    L.preisStufe(st, L.SPIELER, r.route.id, stufe);
    if (ui.tempo === 0 && ich().routen.length === 1) tempo(1);
    L.zielPruefen(st);
    nachAktion();
    meldungenZeigen();
    ui.editor = { start: null, ziel: null, linie: r.route.id, typ: null, stufe: "normal" };
    editorZeichnen();
    if (!gesehen("erste-linie")) tippZeigen("Deine erste Linie fliegt! Jede Landung bringt Geld. Tippe auf „Fertig“, um zuzuschauen.", editorEl.querySelector(".hauptknopf.klein"), "unten", "Okay");
  }

  function linieBearbeiten(rid) {
    const p = ich();
    const r = p.routen.find((x) => x.id === rid);
    if (!r) { ui.editor = { start: p.basis, ziel: null, linie: null, typ: null, stufe: "normal" }; editorZeichnen(); return; }
    const e = L.rechnung(st).routen[rid];
    const fs = L.flugzeugeAuf(p, rid);
    const passend = [...new Set(L.freieFlugzeuge(p).map((f) => f.typ))].filter((typ) => L.TYPEN[typ].reichweite >= e.km);
    tafel("editor", L.STADT[r.a].name + " – " + L.STADT[r.b].name, e.km.toLocaleString("de-DE") + " km",
      el("div", { class: "zeile" }, el("span", { class: "gross zahl", style: { color: farbeGewinn(e.gewinn) }, text: kurz(e.gewinn) }), el("span", { class: "blass", text: "pro Tag" })),
      e.zubringer > 1000 ? el("div", { class: "hinweis gruen", text: `🔁 Bringt zusätzlich ${kurz(e.zubringer)} auf Anschlussflügen.` }) : null,
      sitzplan(e.auslastung),
      el("div", { class: "blass mini", text: "Flugzeuge auf dieser Linie:" }),
      el("div", { class: "flugzeugreihe" },
        fs.map((f) => el("div", { class: "flugzeug-chip" }, bildEl("air-flugzeug-" + f.typ, TYP_ICON[f.typ]), el("small", { text: L.TYPEN[f.typ].kurz }))),
        el("button", { class: "flugzeug-chip minus-knopf", text: "−", onclick: () => { L.abziehen(st, L.SPIELER, rid); nachAktion(); editorZeichnen(); }, "aria-label": "Flugzeug abziehen" }),
        passend.map((typ) => el("button", { class: "flugzeug-chip plus-knopf", onclick: () => { L.fliegen(st, L.SPIELER, r.a, r.b, typ, { nurFrei: true }); L.zielPruefen(st); nachAktion(); editorZeichnen(); } }, "＋", el("small", { text: L.TYPEN[typ].kurz })))),
      passend.length ? null : el("div", { class: "blass mini", text: e.auslastung > 0.9 ? "Fast voll! Ein weiteres Flugzeug würde sich lohnen: 🛒 Store." : "Kein freies Flugzeug zum Dazunehmen." }),
      el("div", { class: "blass mini", text: "Ticketpreis:" }),
      preisSegment(r.stufe, e.km, (s) => { L.preisStufe(st, L.SPIELER, rid, s); nachAktion(); editorZeichnen(); }),
      detailsBox("linie", "Details: Umrüsten, Sitzklassen", umruestenZeile(r, e), klassenEditor(r, e)),
      el("button", { class: "nebenknopf", text: "Linie schließen", onclick: () => { L.routeSchliessen(st, L.SPIELER, rid); nachAktion(); ui.editor = { start: p.basis, ziel: null, linie: null, typ: null, stufe: "normal" }; editorZeichnen(); } }),
      el("div", { class: "blass mini", text: "Abgezogene Flugzeuge stehen danach frei." }));
    if (einf.gesehen["erste-linie"] && !tippEl) erklaeren("linie");
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
  // Sitzaufteilung: Flugzeug von oben, zwei Schieber, ein Knopf für die beste Aufteilung.
  function klassenEditor(r, e) {
    const p = ich();
    const kl = L.klassenVon(r, p);
    const k = e.klassen;
    const reihen = 18;
    const fR = Math.round(reihen * kl.first), bR = Math.round(reihen * kl.business);
    const kabine = el("div", { class: "kabine" }, el("span", { class: "nase" }),
      el("div", { class: "reihen" }, Array.from({ length: reihen }, (_, i) => {
        const art = i < fR ? "first" : i < fR + bR ? "business" : "eco";
        const n = art === "first" ? 2 : art === "business" ? 3 : 5;
        return el("div", { class: "reihe " + art }, Array.from({ length: n }, () => el("i")));
      })), el("span", { class: "heck" }));
    const zeile = (art, wert, max, schritt, wenn) => {
      const KL = L.KLASSEN[art];
      const info = k[art];
      return el("div", { class: "klassenzeile" },
        el("span", { class: "klassenpunkt", style: { background: KL.farbe } }),
        el("b", { text: KL.name }),
        wenn ? el("input", { type: "range", min: 0, max, step: schritt, value: wert, onchange: (ev) => wenn(parseFloat(ev.target.value)) }) : el("span", { class: "luecke" }),
        el("small", { text: Math.round(info.pax) + " / " + Math.round(info.sitze) }));
    };
    const setzen = (b, f) => { L.klassenSetzen(st, L.SPIELER, r.id, b, f); nachAktion(); editorZeichnen(); };
    return el("div", { class: "klassen" },
      el("div", { class: "blass mini", text: "Sitzaufteilung (Gäste / Plätze pro Richtung und Tag):" }),
      kabine,
      zeile("first", kl.first, 0.3, 0.1, (v) => setzen(kl.business, v)),
      zeile("business", kl.business, 0.6, 0.1, (v) => setzen(v, kl.first)),
      zeile("eco", 0, 0, 0, null),
      el("button", { class: "nebenknopf", text: "✨ Beste Aufteilung finden", onclick: () => { const b = L.besteKlassen(st, L.SPIELER, r.id); setzen(b.business, b.first); } }));
  }

  // ---------- Flugzeug-Store ----------
  function storeZeigen() {
    const p = ich();
    // Aus dem Linien-Editor heraus: nur Flugzeuge, die die geplante Strecke schaffen.
    const plan = ui.editor && ui.editor.start && ui.editor.ziel ? [ui.editor.start, ui.editor.ziel] : null;
    const planKm = plan ? L.entfernung(plan[0], plan[1]) : 0;
    ui.storeGruppe = ui.storeGruppe || "regional";
    ui.modal = true;
    if (feld.querySelector(".store")) feld.querySelector(".store").remove();
    const seite = el("div", { class: "seite store" },
      el("div", { class: "store-kopf" },
        el("h1", { text: "🛒 Flugzeug-Store" }),
        plan ? el("span", { class: "store-plan", text: "Für " + L.STADT[plan[0]].name + " – " + L.STADT[plan[1]].name + " · " + Math.round(planKm).toLocaleString("de-DE") + " km" }) : null,
        el("span", { class: "store-geld", text: "Dein Geld: " + geld(p.geld) }),
        el("button", { class: "zu", text: "✕", onclick: () => { seite.remove(); ui.modal = false; if (ui.editor) editorZeichnen(); } })),
      el("div", { class: "segment store-reiter" }, Object.entries(L.GRUPPEN).map(([g, name]) => el("button", { class: ui.storeGruppe === g ? "an" : "", onclick: () => { ui.storeGruppe = g; seite.remove(); storeZeigen(); } }, name,
        el("small", { text: Object.values(L.TYPEN).filter((t) => t.gruppe === g).length + " Typen" })))),
      el("div", { class: "store-reihe" }, Object.entries(L.TYPEN).filter(([, t]) => t.gruppe === ui.storeGruppe).map(([typ, t]) => {
        const offen = L.typFrei(st, p, typ);
        const zuWeit = planKm && t.reichweite < planKm;
        const zahl = p.flotte.filter((f) => f.typ === typ).length;
        const leiste = (wert, max) => el("div", { class: "wertleiste" }, el("i", { style: { width: Math.min(100, wert / max * 100) + "%" } }));
        return el("div", { class: "store-karte" + (offen && !zuWeit ? "" : " zu-karte") },
          el("div", { class: "store-bild" }, bildEl("air-flugzeug-" + typ, TYP_ICON[typ]), zahl ? el("span", { class: "abzeichen gross", text: zahl + "×" }) : null, offen ? null : el("span", { class: "schloss", text: "🔒" })),
          el("b", { class: "store-name", text: t.name }),
          el("div", { class: "blass mini", text: TYP_TEXT[typ] }),
          el("div", { class: "werte" },
            el("span", { text: "💺" }), leiste(Math.sqrt(t.sitze), Math.sqrt(575)), el("small", { text: t.sitze }),
            el("span", { text: "📏" }), leiste(t.reichweite, 15000), el("small", { text: t.reichweite.toLocaleString("de-DE") + " km" }),
            el("span", { text: "⛽" }), leiste(t.verbrauch / t.sitze, 0.034), el("small", { text: t.verbrauch / t.sitze < 0.026 ? "sparsam" : t.verbrauch / t.sitze < 0.029 ? "mittel" : "durstig" })),
          zuWeit ? el("div", { class: "gesperrt-text", text: "📏 zu weit für diese Linie" }) : offen ? el("button", {
            class: "hauptknopf", disabled: p.geld < t.preis, text: "Kaufen · " + geld(t.preis),
            onclick: () => {
              L.kaufen(st, L.SPIELER, typ); L.zielPruefen(st); nachAktion(); meldungenZeigen();
              if (ui.editor) editorZeichnen();   // der Editor dahinter kennt das neue Flugzeug sofort
              seite.remove(); ui.modal = false; storeZeigen();
              if (!gesehen("gekauft")) tippZeigen("Gekauft! Jetzt öffne den ✏️ Linien-Editor und gib deinem Flugzeug eine Linie.", hud.linien, "unten", "Okay");
            },
          }) : el("div", { class: "gesperrt-text", text: "ab Firmenwert " + geld(L.REGELN["stufe" + t.stufe + "Wert"]) }));
      })),
      el("div", { class: "blass mini mitte-text", text: "Tipp: Kleine Flugzeuge für kleine Städte und Zubringer, große für volle Strecken zwischen Großstädten." }));
    feld.append(seite);
    erklaeren("store");
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
      r, e, wert: e.wert, aus: Math.min(1, e.auslastung), gaeste: Math.round(e.pax || 0), n: L.flugzeugeAuf(p, r.id).length,
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
        el("div", { class: "stat-zeile stat-kopf staedte" }, el("span", { text: "Stadt" }), el("span", { text: "Linien" }), el("span", { text: "🔁 Umsteiger" }), el("span", { text: "🎟️ Landerechte" }), el("span", { text: "Gewinn/Tag" })),
        liste.map((o) => el("button", { class: "stat-zeile staedte", onclick: () => { zu(); zeigeStadt(o.c); } },
          el("span", { class: "stat-name" }, (o.c === p.basis ? "🏠 " : "") + ((p.ausgebaut || []).includes(o.c) ? "🏗️ " : "") + L.STADT[o.c].name),
          el("span", { text: String(o.linien) + (o.linien >= L.REGELN.drehkreuzAb ? " 🔁" : "") }),
          el("span", { text: Math.round(o.umst).toLocaleString("de-DE") }),
          el("span", { text: L.slotsGenutzt(p, o.c) + " / " + (p.slots[o.c] || 0) + " · frei " + Math.max(0, L.slotsFrei(st, o.c)) }),
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
      punkt("🛒", "Flugzeug-Store", storeZeigen),
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
    start: { bild: "air-regel-start", icon: "✈️", titel: "So fängst du an", text: "Kaufe im 🛒 Store ein Flugzeug. Gib ihm im ✏️ Linien-Editor eine Strecke. Dann landet es immer wieder und bringt Geld. Unten steht immer dein nächstes 🎯 Ziel." },
    store: { bild: "air-regel-store", icon: "🛒", titel: "Der Flugzeug-Store", text: "Oben die Reiter: von kleinen Propellern bis zu Riesen-Jets. 💺 Plätze, 📏 Reichweite, ⛽ Verbrauch. 🔒 Größere Flugzeuge gibt es, wenn deine Airline mehr wert ist." },
    farben: { bild: "air-regel-farben", icon: "📈", titel: "Grün, Gelb, Rot", text: "Deine Linien leuchten nach Gewinn pro Tag: grün lohnt sich, gelb gerade so, rot kostet Geld. Tippe eine Linie an, dann siehst du warum." },
    tempo: { bild: "air-regel-tempo", icon: "⏳", titel: "Die Zeit läuft", text: "Ein Tag dauert eine Minute. Oben neben der Uhr machst du schneller oder hältst an. Abends wird abgerechnet." },
    linie: { bild: "air-regel-linie", icon: "✏️", titel: "Deine Linie einstellen", text: "Hier machst du alles für eine Linie: Flugzeuge ＋ dazu oder − weg, Preis 🔻 billiger oder 🔺 teurer, und die Sitze für Economy, Business und First. ✨ findet die beste Aufteilung." },
    meine: { bild: "air-regel-meine", icon: "✈️", titel: "Meine Airline", text: "Im Menü ☰ unter „Meine Airline“: Name, Farbe und deine Grundsätze wie Essen, Koffer und Sitzplatzwahl. Mehr Service bringt ⭐ Qualität, kostet aber Geld pro Gast." },
    assistenten: { bild: "air-regel-assistenten", icon: "🔎", titel: "Assistenten", text: "In „Meine Airline“ stellst du Leute ein: 🔎 sucht neue Strecken, 💶 prüft deine Preise. ⚡ schnell ist ungenau, 🔬 gründlich dauert länger. Ihre Berichte liegen unter 📋." },
    rangliste: { bild: "air-regel-rangliste", icon: "🏆", titel: "Die Rangliste", text: "Gezählt wird, was deine Airline wert ist. Werde 🥇 Nummer eins, dann öffnet sich die ganze 🌍 Welt." },
    verwaltung: { bild: "air-regel-verwaltung", icon: "🏢", titel: "Größer heißt teurer", text: "Ab der 9. Linie kostet jede weitere Verwaltung, und zwar immer mehr. Wenige starke Linien schlagen viele schwache. Rüste lieber um ⬆, statt immer neue Linien zu eröffnen." },
    ruf: { bild: "air-regel-ruf", icon: "⭐", titel: "Dein Ruf", text: "Oben neben deinem Namen steht dein ⭐ Ruf. Je höher, desto mehr Gäste. Bis 70 wächst er von selbst, darüber nur mit 📺 Werbung in „Meine Airline“, und dann sinkt er langsam wieder." },
    controlling: { bild: "air-regel-controlling", icon: "📋", titel: "Controlling", text: "Stelle in „Meine Airline“ jemanden fürs Controlling ein. Dann zeigt ❗ an einer Linie, wenn dort etwas nicht stimmt, mit einem Vorschlag zum Antippen. Jeden Sonntag kommt der Wochenbericht." },
    statistik: { bild: "air-regel-statistik", icon: "📊", titel: "Statistik", text: "Im Menü ☰ unter „Statistik“: alle Linien mit Auslastung und Gewinn, sortierbar, dazu Städte und Verlauf. Antippen springt zur Linie." },
    spaet: { bild: "air-regel-spaet", icon: "🎯", titel: "Besser statt mehr", text: "Ab jetzt fragen die Ziele auch nach Qualität: alle Linien im Plus, volle Flieger, bester Ruf, starke Linien. Und Entscheidungen halten die Uhr an, bis du sie getroffen hast." },
    pleite: { bild: "air-regel-pleite", icon: "⚠️", titel: "Achtung, Minus!", text: "Ist dein Konto im Minus, mahnt die 🏦 Bank. Drei Stufen: Mahnung, Kredit, dann will dich ein Rivale kaufen. Schließe rote Linien oder verkaufe ein Flugzeug." },
    drehkreuz: { bild: "air-regel-drehkreuz", icon: "🔁", titel: "Dein Drehkreuz!", text: "Ab drei Linien steigen Gäste in deiner Stadt um. Kleine Zubringer füllen so deine großen Flugzeuge." },
    rivalen: { bild: "air-regel-rivalen", icon: "⚔️", titel: "Die Konkurrenz", text: "Drei Airlines wollen denselben Himmel. Fliegen sie dieselbe Strecke, teilt ihr euch die Gäste. Ihre Linien zeigst du unten links: Kon, Spa und Aur antippen." },
    landerechte: { bild: "air-regel-saison", icon: "🎟️", titel: "Landerechte und Jahreszeiten", text: "Jede Woche ist eine Jahreszeit: Im Sommer wollen alle ans Meer, im Winter in die Berge. Jeder Flughafen hat nur wenige freie Landerechte, beliebte Ziele sind schnell weg: 🎟️ unter einer Stadt zeigt, wie viele noch frei sind. Am Ende der Woche verfallen ungenutzte." },
    plaene: { bild: "air-regel-plaene", icon: "📣", titel: "Rivalen kündigen an", text: "Manchmal verraten die Rivalen ihren nächsten Zug: 📣 auf der Karte. Fliegst du die Strecke vorher, verzichten sie." },
    duell: { bild: "air-regel-duell", icon: "⚔️", titel: "Preiskampf", text: "Fliegt ein Rivale auf deine Strecke, erscheint ⚔️. Tipp drauf: Ihr steht nebeneinander. Unterbieten, Preis halten oder aufgeben. Bei gleichem Preis gewinnt die bessere Qualität." },
    trends: { bild: "air-regel-trends", icon: "📈", titel: "Die Nachfrage ändert sich", text: "Städte werden beliebter ▲ oder verlieren Gäste ▼, manche Strecken kommen in Mode 🔥. Die Pfeile siehst du an Städten und Linien." },
    versteigerung: { bild: "air-regel-versteigerung", icon: "🏛️", titel: "Versteigerung", text: "Am Ende jeder Jahreszeit gibt es irgendwo neue Landerechte. Alle bieten einmal verdeckt, das höchste Gebot gewinnt." },
    wahl: { bild: "air-regel-wahl", icon: "🎲", titel: "Sicher oder Risiko?", text: "Streik, Sturm oder Kerosin: Du wählst. Sicher kostet sofort, Risiko kann gut ausgehen oder teuer werden." },
    rennen: { bild: "air-regel-rennen", icon: "🏁", titel: "Das Rennen der Jahreszeit", text: "Jede Jahreszeit ein Rennen gegen die Rivalen. Wer zuerst ans Ziel kommt, bekommt Geld und einen Pokal: +3 % Gäste für immer. Steht in der Rangliste." },
    ausbau: { bild: "air-regel-ausbau", icon: "🏗️", titel: "Ein zweites Drehkreuz", text: "Eine Stadt mit drei Linien kannst du ausbauen: viel mehr Umsteiger, und deine Linien dort ziehen mehr Gäste. Tipp die Stadt an." },
    aufkauf: { bild: "air-regel-aufkauf", icon: "🤝", titel: "Rivalen in Not", text: "Rivalen können in die Krise geraten oder pleitegehen. Dann gibt es ihre Flugzeuge und Landerechte günstig, aber nur kurz." },
    gelegenheiten: { bild: "air-ereignis-messe", icon: "🎪", titel: "Gelegenheiten", text: "Ab jetzt tauchen Symbole auf der Karte auf: Messen, freie Landerechte, gebrauchte Flugzeuge. Der gelbe Ring zeigt, wie lange sie noch gelten." },
  };
  const REGEL_FOLGE = ["start", "store", "farben", "tempo", "linie", "meine", "assistenten", "drehkreuz", "rivalen", "rangliste", "landerechte", "gelegenheiten", "plaene", "duell", "trends", "versteigerung", "wahl", "rennen", "ausbau", "aufkauf", "ruf", "statistik", "controlling", "verwaltung", "spaet", "pleite"];
  // Erklärung beim ersten Auftauchen einer Funktion (z. B. beim ersten Öffnen des Stores).
  function erklaeren(id) { if (!einf.gesehen["regel-" + id]) regelkarte(id); }
  function regelnPruefen() {
    if (!st || ui.modal) return;
    const tag = L.tagVon(st), p = ich();
    let id = null;
    const g = (x) => !einf.gesehen["regel-" + x];
    if (st.pleite && st.pleite.stufe && g("pleite")) id = "pleite";
    else if (p.routen.length && st.letzterTag && g("farben")) id = "farben";
    else if (p.routen.length && tag >= 2 && g("tempo")) id = "tempo";
    else if (L.drehkreuze(p).length && !einf.gesehen["regel-drehkreuz"]) id = "drehkreuz";
    else if (tag >= 4 && p.routen.length && g("meine")) id = "meine";
    else if (tag >= 6 && p.routen.length && g("assistenten")) id = "assistenten";
    else if (tag >= 10 && g("rangliste")) id = "rangliste";
    else if (p.routen.length > L.REGELN.verwaltungFrei && g("verwaltung")) id = "verwaltung";
    else if (tag >= 12 && g("ruf")) id = "ruf";
    else if (p.routen.length >= 6 && g("controlling")) id = "controlling";
    else if (p.routen.length >= 8 && g("statistik")) id = "statistik";
    else if (st.ziel >= 13 && g("spaet")) id = "spaet";
    else if (tag >= 8 && !einf.gesehen["regel-rivalen"]) id = "rivalen";
    else if (tag >= 15 && !einf.gesehen["regel-landerechte"]) id = "landerechte";
    else if (tag >= L.REGELN.gelegenheitAb && !einf.gesehen["regel-gelegenheiten"]) id = "gelegenheiten";
    else if (st.gelegenheiten.some((g) => g.art === "plan") && !einf.gesehen["regel-plaene"]) id = "plaene";
    else if (p.routen.some((r) => r.duell) && !einf.gesehen["regel-duell"]) id = "duell";
    else if (tag >= L.REGELN.trendAb && !einf.gesehen["regel-trends"]) id = "trends";
    else if (st.gelegenheiten.some((g) => g.art === "versteigerung") && !einf.gesehen["regel-versteigerung"]) id = "versteigerung";
    else if (st.gelegenheiten.some((g) => g.art === "wahl") && !einf.gesehen["regel-wahl"]) id = "wahl";
    else if (st.rennen && !einf.gesehen["regel-rennen"]) id = "rennen";
    else if (p.routen.length && L.drehkreuze(p).some((c) => L.kannAusbauen(st, L.SPIELER, c)) && !einf.gesehen["regel-ausbau"]) id = "ausbau";
    else if (st.gelegenheiten.some((g) => g.art === "aufkauf") && !einf.gesehen["regel-aufkauf"]) id = "aufkauf";
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
    if (jetzt - letzteHud > 250) { hudAktualisieren(); ringeAktualisieren(); letzteHud = jetzt; }
    if (jetzt - letztesSpeichern > 5000) { speichern(); letztesSpeichern = jetzt; }
  }

  function tagEnde() {
    heatCache = null;
    karteZeichnen();
    tafelNeu();
    meldungenZeigen();
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

  const MELDUNG_ICON = { bericht: "📋", mahnung: "⚠️", kredit: "🏦", uebernahme: "🤝", gerettet: "✅", aufstieg: "🏆", abstieg: "📉", stufe: "✈️", welt: "🌍", saison: "🗓️", slotweg: "🎟️", slotverloren: "🔨", kerosin: "⛽", rivale: "📰", angriff: "⚔️", ziel: "🎯" };
  function meldungenZeigen() {
    const neu = st.meldungen.splice(0);
    let verzoegerung = 0;
    // Wichtiges zuerst, höchstens vier auf einmal.
    const wichtig = ["duell", "plan", "pleite", "krise", "versteigerungsieg", "rennensieg", "rennen", "ziel", "mahnung", "kredit", "uebernahme"];
    const auswahl = neu.filter((m) => wichtig.includes(m.art)).concat(neu.filter((m) => !wichtig.includes(m.art))).slice(0, 4);
    for (const m of auswahl) {
      setTimeout(() => {
        const mitBild = /^\p{Extended_Pictographic}/u.test(m.text);   // neue Meldungen bringen ihr Zeichen selbst mit
        const e = el("div", { class: "meldung" + (m.art === "ziel" ? " ziel" : "") }, mitBild ? null : MELDUNG_ICON[m.art] || "📰", el("span", { text: m.text }));
        feld.append(e);
        setTimeout(() => e.remove(), 4300);
      }, verzoegerung);
      verzoegerung += 1500;
    }
  }

  function nachAktion() {
    heatCache = null;
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
        el("div", { class: "mitte" }, el("b", { style: { fontSize: "16px" }, text: riv.chef + " von " + riv.name }),
          el("div", { class: "spruch", style: { fontSize: "13px" }, text: `„Ihre Airline ist am Ende. Ich zahle Ihnen ${geld(u.preis)}, und Ihre Flugzeuge fliegen ab morgen für mich.“` }))),
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
    const titel = e.grund === "verkauft" ? "Verkauft an " + L.RIVALEN[e.von].name : "Pleite";
    feld.append(el("div", { class: "seite" },
      bild("air-ende") ? el("img", { class: "bg", src: bild("air-ende"), alt: "" }) : null,
      el("h1", {}, titel, el("small", { text: p.name + " hat " + (e.tag - 1) + " Tage durchgehalten. Bester Platz: " + (st.bestPlatz || L.platz(st)) + "." })),
      el("button", { class: "hauptknopf", text: "Neue Airline gründen", onclick: neuStart })));
  }

  // ---------- Start ----------
  function neuStart() {
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
    st = null;
    startSeite();
  }

  function startSeite() {
    feld.replaceChildren();
    feld.classList.remove("editor-an", "tafel-an");
    karte = null; tafelEl = null; editorEl = null; ui.tafel = null; ui.editor = null; ui.stadt = null; ui.route = null; ui.modal = false;
    const seite = el("div", { class: "seite" });
    function zeichnen() {
      seite.replaceChildren();
      seite.append(...[
        bild("air-start") ? el("img", { class: "bg", src: bild("air-start"), alt: "" }) : null,
        el("h1", {}, "Luftlinie", el("small", { text: "Alle starten bei Null. Wer wird die größte Airline der Welt?" })),
        el("div", { class: "start-punkte" },
          el("span", { text: "🛒 Erstes Flugzeug kaufen" }), el("span", { text: "✏️ Linien planen" }), el("span", { text: "🏆 Die Rivalen überholen" })),
        el("button", { class: "hauptknopf", text: "Airline gründen ▶", onclick: heimatWaehlen })].filter(Boolean));
    }
    zeichnen();
    feld.append(seite);
  }

  const SCHWER_FARBE = { leicht: "#4ADE80", mittel: "#F2C14E", schwer: "#F87171" };
  function heimatWaehlen() {
    feld.replaceChildren();
    ui.heimat = true;
    kameraPassend();
    karteBauen();
    feld.append(el("div", { class: "heimatwahl" }, "Wo soll deine Airline zu Hause sein?", el("small", { text: "Tippe auf eine leuchtende Stadt. Wischen und mit zwei Fingern zoomen geht auch." }),
      el("div", { class: "legende" }, Object.entries(SCHWER_FARBE).map(([k, f]) => el("span", {}, el("i", { style: { background: f } }), { leicht: "leichter Start", mittel: "mittel", schwer: "schwerer Start" }[k])))),
      el("button", { class: "kachel rundknopf", onclick: () => { ui.heimat = false; startSeite(); }, style: { position: "absolute", left: "6px", top: "6px", height: "38px", zIndex: 9 }, "aria-label": "Zurück", text: "◀" }));
  }

  function heimatGewaehlt(id) {
    ui.heimat = false;
    st = L.neuesSpiel({ basis: id, service: "standard", name: L.NAMEN[0] });
    einf = { gesehen: {} };
    schreiben(EINFUEHRUNG, einf);
    spielStarten();
    angeboteZeigen();
    tippZeigen("Willkommen! Alle Airlines starten bei Null. Hier sind drei Vorschläge für deine erste Linie: Tippe einen an. Flugzeug kaufen und Linie eröffnen geht dann in einem Schritt.", tafelEl, "links", "Los geht's");
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

  fetch("../grafiken/vorhanden.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((liste) => {
    for (const n of liste) dateien.add(n);
    const alt = lesen(SPEICHER, null);
    st = alt ? L.laden(alt) : null;
    if (st && !st.ende) spielStarten();
    else startSeite();
    requestAnimationFrame(schleife);
  });

  // Für Tests im Browser.
  window.luftlinie = { get st() { return st; }, ui, tempo, zeigeGelegenheit, zeigeDuell, editorOeffnen, zoomAuf: (id) => { kameraPassend(gegend(id)); kameraSetzen(); } };
})();
