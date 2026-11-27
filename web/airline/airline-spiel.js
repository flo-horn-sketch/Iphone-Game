// Oberfläche von "Luftlinie". Alle Regeln stehen in airline-logik.js, die Karte in airline-karte.js.
(function () {
  "use strict";

  const L = window.AirLogik;
  const K = window.AirKarte;
  const SPEICHER = "luftlinie-v1";
  const EINFUEHRUNG = "luftlinie-einfuehrung";
  const FELD_B = 844, FELD_H = 390;
  const SEK_PRO_STUNDE = 2.5;          // ein Tag dauert eine Minute
  const SVG = "http://www.w3.org/2000/svg";

  const feld = document.getElementById("feld");
  const rahmen = document.getElementById("rahmen");

  function skalieren() {
    const cs = getComputedStyle(rahmen);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const w = rahmen.clientWidth - pl - pr, h = rahmen.clientHeight - pt - pb;
    ui.skala = Math.max(0.2, Math.min(w / FELD_B, h / FELD_H));
    feld.style.left = pl + w / 2 + "px";
    feld.style.top = pt + h / 2 + "px";
    feld.style.transform = `translate(-50%, -50%) scale(${ui.skala})`;
  }

  function el(tag, props, ...kinder) {
    const e = document.createElement(tag);
    setzen(e, props);
    for (const kind of kinder.flat(Infinity)) {
      if (kind == null || kind === false) continue;
      e.append(kind.nodeType ? kind : String(kind));
    }
    return e;
  }
  function sv(tag, props) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "text") e.textContent = v;
      else if (k === "class") e.setAttribute("class", v);
      else e.setAttribute(k, v);
    }
    return e;
  }
  function setzen(e, props) {
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
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
    return pfad ? el("img", { src: pfad, alt: "" }) : ersatz != null ? document.createTextNode(ersatz) : null;
  }
  const TYP_ICON = { libelle: "🛩️", falke: "✈️", kranich: "✈️", albatros: "🛫" };
  const CHEF = { k: "air-chef-kontinentia", s: "air-chef-spatzflug", a: "air-chef-aurelia" };

  // ---------- Zustand ----------
  let st = null;
  const ui = {
    skala: 1, tempo: 0, letztesTempo: 1, kamera: { x: 0, y: 0, z: 1 }, auswahl: null, plan: null, tafel: null,
    tipp: null, heimat: null, startWahl: { service: "standard", name: 0 }, fertig: false,
    gezeigt: new Set(), letzteMeldung: 0, letzterAbschluss: null,
  };
  let einf = lesen(EINFUEHRUNG, { schritt: 0, fertig: false });

  function speichern() { if (st && !st.ende) schreiben(SPEICHER, st); }
  function neuStart() {
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* egal */ }
    st = null;
    startSeite();
  }

  // ---------- Karte ----------
  const stadtXY = {};
  for (const s of L.ALLE) {
    let [x, y] = K.projektion(s.lon, s.lat);
    if (s.welt) { x = Math.max(18, Math.min(K.B - 18, x)); y = Math.max(18, Math.min(K.H - 18, y)); }
    stadtXY[s.id] = [x, y];
  }
  // Ausschnitt mit allen europäischen Städten.
  const rand = (() => {
    const xs = L.STAEDTE.map((s) => stadtXY[s.id][0]), ys = L.STAEDTE.map((s) => stadtXY[s.id][1]);
    return { x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, y0: Math.min(...ys) - 22, y1: Math.max(...ys) + 18 };
  })();
  function kameraPassend(ganzeWelt) {
    const r = ganzeWelt ? { x0: 0, x1: K.B, y0: 0, y1: K.H } : rand;
    const z = Math.min((FELD_B - 20) / (r.x1 - r.x0), (FELD_H - 50) / (r.y1 - r.y0));
    ui.kamera = { z, x: FELD_B / 2 - ((r.x0 + r.x1) / 2) * z, y: 44 + (FELD_H - 44) / 2 - ((r.y0 + r.y1) / 2) * z };
    ui.zMin = z * 0.9;
  }
  kameraPassend(false);

  let karte = null;      // { svg, kamera, routen, staedte, flieger, effekte }
  function karteBauen() {
    const svg = sv("svg", { id: "karte", viewBox: `0 0 ${FELD_B} ${FELD_H}` });
    const defs = sv("defs");
    const verlauf = sv("radialGradient", { id: "meerlicht", cx: "50%", cy: "35%", r: "75%" });
    verlauf.append(sv("stop", { offset: "0%", "stop-color": "#173A55" }), sv("stop", { offset: "100%", "stop-color": "#0A1828" }));
    const clip = sv("clipPath", { id: "kartenrand" });
    clip.append(sv("rect", { x: 0, y: 0, width: K.B, height: K.H }));
    defs.append(verlauf, clip);
    svg.append(defs, sv("rect", { x: 0, y: 0, width: FELD_B, height: FELD_H, fill: "url(#meerlicht)" }));
    const g = sv("g");
    const netz = sv("g", { class: "netz" });
    for (let x = 0; x <= K.B; x += 50) netz.append(sv("line", { x1: x, y1: 0, x2: x, y2: K.H }));
    for (let y = 0; y <= K.H; y += 50) netz.append(sv("line", { x1: 0, y1: y, x2: K.B, y2: y }));
    const landG = sv("g", { "clip-path": "url(#kartenrand)" });
    landG.append(netz, sv("path", { class: "land", d: K.land }), sv("path", { class: "grenze", d: K.grenzen }));
    g.append(landG);
    const fremd = sv("g"), routen = sv("g"), staedte = sv("g"), schilder = sv("g"), flieger = sv("g"), effekte = sv("g");
    g.append(fremd, routen, flieger, staedte, schilder, effekte);
    svg.append(g);
    feld.append(svg);
    karte = { svg, g, fremd, routen, staedte, schilder, flieger, effekte, fliegerEls: new Map() };
    gestenAn(svg);
    kameraSetzen();
  }

  function kameraSetzen() {
    const c = ui.kamera;
    const r = ui.heimat || (st && st.welt) ? { x0: -40, x1: K.B + 40, y0: -40, y1: K.H + 40 } : { x0: rand.x0 - 80, x1: rand.x1 + 80, y0: rand.y0 - 60, y1: rand.y1 + 60 };
    c.z = Math.max(ui.zMin || 0.5, Math.min(4, c.z));
    c.x = Math.min(FELD_B - 60 - r.x0 * c.z, Math.max(60 - r.x1 * c.z, c.x));
    c.y = Math.min(FELD_H - 60 - r.y0 * c.z, Math.max(60 - r.y1 * c.z, c.y));
    karte.g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) scale(${c.z.toFixed(4)})`);
    karteZeichnen();
  }
  const bildschirm = (id) => { const [x, y] = stadtXY[id]; return [x * ui.kamera.z + ui.kamera.x, y * ui.kamera.z + ui.kamera.y]; };

  // Wischen verschiebt, zwei Finger zoomen. Ein kurzes Tippen wählt aus.
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
      if (!zeiger.has(e.pointerId)) return;
      zeiger.set(e.pointerId, punkt(e));
      const pts = [...zeiger.values()];
      if (pts.length !== start.punkte.length) start = { kamera: { ...ui.kamera }, punkte: pts.map((p) => ({ ...p })), ziel: null };
      if (pts.length === 1) {
        const dx = pts[0].x - start.punkte[0].x, dy = pts[0].y - start.punkte[0].y;
        if (Math.abs(dx) + Math.abs(dy) > 6) bewegt = true;
        if (!bewegt) return;
        ui.kamera.x = start.kamera.x + dx; ui.kamera.y = start.kamera.y + dy;
      } else if (pts.length >= 2) {
        bewegt = true;
        const [a, b] = pts, [a0, b0] = start.punkte;
        const d = Math.hypot(a.x - b.x, a.y - b.y), d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mx0 = (a0.x + b0.x) / 2, my0 = (a0.y + b0.y) / 2;
        const z = Math.max(ui.zMin, Math.min(4, start.kamera.z * d / d0));
        const wx = (mx0 - start.kamera.x) / start.kamera.z, wy = (my0 - start.kamera.y) / start.kamera.z;
        ui.kamera.z = z; ui.kamera.x = mx - wx * z; ui.kamera.y = my - wy * z;
      }
      kameraSetzen();
    });
    const ende = (e) => {
      if (!zeiger.has(e.pointerId)) return;
      zeiger.delete(e.pointerId);
      if (!bewegt && zeiger.size === 0 && start && start.ziel) tippen(start.ziel);
    };
    svg.addEventListener("pointerup", ende);
    svg.addEventListener("pointercancel", (e) => { zeiger.delete(e.pointerId); bewegt = true; });
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = punkt(e);
      const z = Math.max(ui.zMin, Math.min(4, ui.kamera.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const wx = (p.x - ui.kamera.x) / ui.kamera.z, wy = (p.y - ui.kamera.y) / ui.kamera.z;
      ui.kamera.z = z; ui.kamera.x = p.x - wx * z; ui.kamera.y = p.y - wy * z;
      kameraSetzen();
    }, { passive: false });
  }

  function tippen(ziel) {
    const t = ziel.closest ? ziel.closest("[data-stadt],[data-route]") : null;
    if (ui.heimat) { if (t && t.dataset.stadt && L.HEIMAT.includes(t.dataset.stadt)) heimatGewaehlt(t.dataset.stadt); return; }
    if (!t) { auswahlWeg(); return; }
    if (t.dataset.route) { zeigeRoute(t.dataset.route); return; }
    const id = t.dataset.stadt;
    if (ui.auswahl && ui.auswahl !== id && (ui.tafel === "stadt" || ui.tafel === "plan")) zeigePlan(ui.auswahl, id);
    else zeigeStadt(id);
  }

  // Alles Statische der Karte (Städte, Routen, Schilder). Flieger kommen pro Bild.
  function karteZeichnen() {
    if (!karte) return;
    const z = ui.kamera.z;
    const s = 1 / z;    // so bleiben Punkte und Schrift gleich groß
    karte.fremd.replaceChildren(); karte.routen.replaceChildren(); karte.staedte.replaceChildren(); karte.schilder.replaceChildren();
    const sichtbar = st ? L.staedte(st) : L.STAEDTE;
    const p = st && st.airlines[L.SPIELER];
    const rg = st ? L.rechnung(st) : null;
    const tag = st ? L.tagVon(st) : 1;
    const sai = L.saison(tag);
    // Rivalen dünn.
    if (st) {
      for (const aid of ["k", "s", "a"]) {
        const a = st.airlines[aid];
        for (const r of a.routen) {
          const [x1, y1] = stadtXY[r.a], [x2, y2] = stadtXY[r.b];
          karte.fremd.append(sv("line", { x1, y1, x2, y2, stroke: a.farbe, "stroke-width": 1.1 * s, "stroke-opacity": 0.38, "stroke-dasharray": `${4 * s} ${3 * s}` }));
        }
      }
    }
    // Eigene Routen kräftig, Farbe nach Gewinn. Schilder nur, wo Platz ist.
    const belegt = [];
    const frei = (x, y, w, h) => {
      const sx = x * z + ui.kamera.x, sy = y * z + ui.kamera.y, sw = w * z, sh = h * z;
      if (belegt.some((b) => Math.abs(b.x - sx) < (b.w + sw) / 2 + 2 && Math.abs(b.y - sy) < (b.h + sh) / 2 + 1)) return false;
      belegt.push({ x: sx, y: sy, w: sw, h: sh });
      return true;
    };
    if (p) {
      const sortiert = p.routen.slice().sort((r1, r2) => {
        const e1 = rg.routen[r1.id], e2 = rg.routen[r2.id];
        const w = (r) => (ui.route === r.id ? 1e12 : 0);
        return w(r2) - w(r1) + (e2 ? Math.abs(e2.gewinn) : 0) - (e1 ? Math.abs(e1.gewinn) : 0);
      });
      for (const r of sortiert) {
        const e = rg.routen[r.id];
        if (!e) continue;
        const [x1, y1] = stadtXY[r.a], [x2, y2] = stadtXY[r.b];
        const farbe = farbeGewinn(e.gewinn + e.zubringer);
        const gewaehlt = ui.tafel === "route" && ui.route === r.id;
        karte.routen.append(sv("line", { x1, y1, x2, y2, stroke: "#06101a", "stroke-width": (3.6 + e.flugzeuge) * s, "stroke-linecap": "round", "stroke-opacity": 0.6 }));
        karte.routen.append(sv("line", { x1, y1, x2, y2, stroke: farbe, "stroke-width": (gewaehlt ? 3.4 : 1.8 + e.flugzeuge * 0.6) * s, "stroke-linecap": "round" }));
        karte.routen.append(sv("line", { x1, y1, x2, y2, class: "route-ziel", "stroke-width": 16 * s, "data-route": r.id }));
        // Schild mit Tagesgewinn.
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const text = kurz(e.gewinn);
        const w = (text.length * 6.2 + 8) * s, h = 13 * s;
        if (!frei(mx, my, w, h)) continue;
        const schild = sv("g", { class: "preis-schild", "data-route": r.id });
        schild.append(sv("rect", { x: mx - w / 2, y: my - h / 2, width: w, height: h, rx: h / 2, stroke: farbe, "stroke-width": 0.8 * s }));
        schild.append(sv("text", { x: mx, y: my + 0.5 * s, fill: farbe, "font-size": 9.5 * s, text }));
        karte.schilder.append(schild);
      }
    }
    // Geplante Route gestrichelt.
    if (ui.plan) {
      const [x1, y1] = stadtXY[ui.plan.a], [x2, y2] = stadtXY[ui.plan.b];
      karte.routen.append(sv("line", { x1, y1, x2, y2, stroke: "#F2C14E", "stroke-width": 2.4 * s, "stroke-dasharray": `${6 * s} ${4 * s}`, "stroke-linecap": "round" }));
    }
    const hubs = p ? new Set(L.drehkreuze(p)) : new Set();
    const messen = st ? new Set(st.messen.filter((m) => tag >= m.von - 1 && tag <= m.bis).map((m) => m.stadt)) : new Set();
    for (const c of sichtbar) {
      const [x, y] = stadtXY[c.id];
      const g = sv("g", { "data-stadt": c.id });
      const r = (c.k === 3 ? 6 : c.k === 2 ? 4.6 : 3.4) * s;
      g.append(sv("circle", { cx: x, cy: y, r: Math.max(r, 11 * s), fill: "transparent" }));
      if (ui.heimat && L.HEIMAT.includes(c.id)) g.append(sv("circle", { cx: x, cy: y, r: r * 2.2, fill: "#F2C14E", class: "puls", opacity: 0.6 }));
      const eigen = p && (p.slots[c.id] || 0) > 0;
      const basis = p && p.basis === c.id;
      if (hubs.has(c.id) || basis) g.append(sv("circle", { cx: x, cy: y, r: r + 3.2 * s, fill: "none", stroke: "#F2C14E", "stroke-width": 1.6 * s }));
      if (ui.auswahl === c.id) g.append(sv("circle", { cx: x, cy: y, r: r + 6 * s, fill: "none", stroke: "#fff", "stroke-width": 1.4 * s, class: "puls" }));
      const fuell = eigen ? p.farbe : c.k === 3 ? "#EAF2F8" : c.k === 2 ? "#C5D6E2" : "#93A9B8";
      g.append(sv("circle", { cx: x, cy: y, r, fill: fuell, class: "stadt-punkt", "stroke-width": 1.2 * s }));
      if (c.welt) g.append(sv("text", { x, y: y + 3.4 * s, "font-size": 8 * s, "text-anchor": "middle", fill: "#0B1622", text: "🌍" }));
      const zeigeName = c.k >= 2 || z > 1.5 || ui.auswahl === c.id || (ui.plan && (ui.plan.a === c.id || ui.plan.b === c.id)) || eigen || ui.heimat;
      if (zeigeName && !(ui.heimat && !L.HEIMAT.includes(c.id))) {
        g.append(sv("text", { x: x + r + 2.5 * s, y: y + 3.2 * s, class: "stadt-name", "font-size": (c.k === 3 ? 10.5 : 9) * s, "stroke-width": 2.6 * s, text: c.name }));
      }
      // Jahreszeit und Messen sichtbar machen.
      let zeichen = null;
      if (messen.has(c.id)) zeichen = "🎪";
      else if (c.t === "sonne" && sai.sonne > 1.2) zeichen = "☀️";
      else if (c.t === "schnee" && sai.schnee > 1.2) zeichen = "⛷️";
      if (zeichen && !ui.heimat) g.append(sv("text", { x: x - r - 1 * s, y: y - r - 1 * s, "font-size": 10 * s, "text-anchor": "end", text: zeichen }));
      karte.staedte.append(g);
    }
  }

  // Flieger bewegen, jedes Bild neu.
  const FLIEGER_FORM = "M6 0 L1 -1.2 L-1 -5 L-2.4 -5 L-1.2 -1.2 L-4 -1 L-5 -2.4 L-6 -2.4 L-5.2 0 L-6 2.4 L-5 2.4 L-4 1 L-1.2 1.2 L-2.4 5 L-1 5 L1 1.2 Z";
  function fliegerZeichnen() {
    if (!karte || !st) return;
    const s = 1 / ui.kamera.z;
    const da = new Set();
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const ich = aid === L.SPIELER;
      for (const f of a.flotte) {
        if (!f.route) continue;
        const pos = L.position(st, aid, f);
        if (!pos) continue;
        const [x1, y1] = stadtXY[pos.r.a], [x2, y2] = stadtXY[pos.r.b];
        const x = x1 + (x2 - x1) * pos.anteil, y = y1 + (y2 - y1) * pos.anteil;
        let winkel = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        if (!pos.hin) winkel += 180;
        let e = karte.fliegerEls.get(f.id);
        if (!e) {
          e = sv("path", { d: FLIEGER_FORM, class: "flieger", fill: a.farbe, stroke: "#06101a", "stroke-width": 0.8 });
          karte.flieger.append(e);
          karte.fliegerEls.set(f.id, e);
        }
        const gr = (ich ? 1.25 : 0.8) * s;
        e.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${winkel.toFixed(1)}) scale(${gr.toFixed(3)})`);
        e.setAttribute("opacity", pos.amBoden ? 0 : ich ? 1 : 0.75);
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

  // ---------- Oberfläche ----------
  const hud = {};
  function hudBauen() {
    const p = st.airlines[L.SPIELER];
    const oben = el("div", { class: "oben" });
    hud.heim = el("a", { class: "kachel rundknopf", href: "../", "aria-label": "Zur Spielauswahl", text: "⌂" });
    hud.name = el("div", { class: "airline-name" });
    hud.geldB = el("b", { class: "zahl" });
    hud.geldS = el("small", { class: "zahl" });
    const geldK = el("button", { class: "kachel geld", onclick: () => zeigeFinanzen() }, hud.name, hud.geldB, hud.geldS);
    hud.tag = el("span"); hud.saison = el("span");
    hud.balken = el("i");
    const uhr = el("div", { class: "kachel uhr" }, el("div", { class: "zeile" }, hud.tag, hud.saison), el("div", { class: "balken" }, hud.balken));
    hud.tempo = [0, 1, 2, 4].map((t) => el("button", { onclick: () => tempo(t), text: ["❚❚", "▶", "▶▶", "▶▶▶"][[0, 1, 2, 4].indexOf(t)], "aria-label": t ? t + "-fache Zeit" : "Pause" }));
    const tempoK = el("div", { class: "kachel tempo" }, hud.tempo);
    hud.platz = el("span", { class: "platz" });
    const rangK = el("button", { class: "kachel", onclick: () => zeigeRang(), "aria-label": "Rangliste" }, "🏆", hud.platz);
    hud.frei = el("span", { class: "abzeichen" });
    const flotteK = el("button", { class: "kachel rundknopf knopf-mit", onclick: () => zeigeFlotte(), "aria-label": "Flotte" }, "🛩️", hud.frei);
    hud.service = el("button", { class: "kachel rundknopf", onclick: () => zeigeService(), "aria-label": "Service" });
    oben.append(hud.heim, geldK, uhr, tempoK, el("div", { class: "luecke" }), rangK, flotteK, hud.service);
    hud.gel = el("div", { class: "gelegenheiten" });
    hud.warn = el("div");
    feld.append(oben, hud.gel, hud.warn);
    hudAktualisieren();
  }

  function hudAktualisieren() {
    if (!st || !hud.geldB) return;
    const p = st.airlines[L.SPIELER];
    const tag = L.tagVon(st);
    hud.name.replaceChildren(el("span", { class: "punkt", style: { background: p.farbe } }), p.name);
    hud.geldB.textContent = geld(p.geld);
    hud.geldB.className = "zahl" + (p.geld < 0 ? " minus" : "");
    const gestern = p.verlauf.length ? p.verlauf[p.verlauf.length - 1] : null;
    hud.geldS.textContent = (p.kredit > 0 ? "Kredit " + geld(p.kredit) + " · " : "") + (gestern == null ? "noch kein Tag" : "gestern " + geld(gestern, true));
    hud.tag.textContent = "Tag " + tag + " · " + L.WOCHENTAGE[L.wochentag(tag)];
    const sai = L.saison(tag);
    hud.saison.textContent = sai.icon + " " + sai.name;
    hud.balken.style.width = ((st.zeit % 24) / 24 * 100).toFixed(1) + "%";
    hud.tempo.forEach((b, i) => b.classList.toggle("an", [0, 1, 2, 4][i] === ui.tempo));
    hud.platz.textContent = L.platz(st) + ".";
    const frei = L.freieFlugzeuge(p).length;
    hud.frei.textContent = frei; hud.frei.style.display = frei ? "" : "none";
    hud.service.textContent = L.SERVICE[p.service].icon;
    warnungZeichnen();
    gelegenheitenZeichnen();
  }

  function warnungZeichnen() {
    const pl = st.pleite;
    const sig = pl.stufe + "|" + (st.uebernahme && st.uebernahme.abgelehnt);
    if (hud.warnSig === sig) return;
    hud.warnSig = sig;
    hud.warn.replaceChildren();
    if (!pl.stufe) return;
    const texte = { 1: "Die Bank mahnt: Konto im Minus!", 2: "Kredit läuft. Noch einmal ins Minus, und ein Rivale will dich kaufen.", 3: "Letzte Chance: Konto ins Plus, sonst ist die Airline pleite!" };
    const stufen = el("span", { class: "stufen" }, [1, 2, 3].map((i) => el("i", { class: i <= pl.stufe ? "an" : "" })));
    const w = el("div", { class: "warnung" }, stufen, texte[pl.stufe]);
    if (pl.stufe === 3 && st.uebernahme && !st.uebernahme.abgelehnt) w.append(el("button", { text: "Angebot ansehen", onclick: uebernahmeZeigen }));
    hud.warn.append(w);
    if (pl.stufe === 3 && st.uebernahme && !st.uebernahme.abgelehnt) uebernahmeZeigen();
  }

  function gelegenheitenZeichnen() {
    const sig = st.gelegenheiten.map((g) => g.id).join(",");
    if (hud.gelSig !== sig) {
      hud.gelSig = sig;
      hud.gel.replaceChildren();
      hud.gelEls = new Map();
      for (const g of st.gelegenheiten.slice(-3)) {
        const e = gelegenheitKarte(g);
        hud.gel.append(e);
        hud.gelEls.set(g.id, e);
      }
      if (st.gelegenheiten.some((g) => !g.info) && einf.schritt >= 4) tippEinmal("gelegenheit", "Eine Gelegenheit! Der gelbe Balken zeigt, wie lange sie noch gilt.", hud.gel, "links");
    }
    for (const g of st.gelegenheiten) {
      const e = hud.gelEls && hud.gelEls.get(g.id);
      if (e) e.querySelector(".rest").style.width = Math.max(0, (g.bis - st.zeit) / g.dauer * 100) + "%";
    }
  }

  function gelegenheitKarte(g) {
    const p = st.airlines[L.SPIELER];
    let icon = "✨", bildName = null, titel = "", text = "", ja = null;
    const stadt = g.stadt && L.STADT[g.stadt].name;
    if (g.art === "slot") { icon = "🎟️"; bildName = "air-ereignis-slot"; titel = "Slot frei in " + stadt; text = "Sonst ist dort alles voll."; ja = "Kaufen " + geld(g.preis); }
    else if (g.art === "gebraucht") { icon = TYP_ICON[g.typ]; bildName = "air-ereignis-gebraucht"; titel = "Gebrauchter " + L.TYPEN[g.typ].name; text = "Fast halber Preis. Steht danach frei in deiner Flotte."; ja = "Kaufen " + geld(g.preis); }
    else if (g.art === "messe") { icon = "🎪"; bildName = "air-ereignis-messe"; titel = "Messe in " + stadt; text = "Ab Tag " + g.von + " drei Tage lang viel mehr Geschäftsreisende."; }
    else if (g.art === "kerosin") { icon = "⛽"; bildName = "air-ereignis-kerosin"; titel = g.billig ? "Kerosin billiger" : "Kerosin teurer"; text = g.billig ? "Fünf Tage 20 % günstiger: lange Strecken lohnen sich mehr." : "Fünf Tage 25 % teurer."; }
    else if (g.art === "auktion") { icon = "🔨"; bildName = "air-ereignis-slot"; titel = "Slot in " + stadt + " wird versteigert"; text = "Deine Route dort war zu leer. Behalten?"; ja = "Halten " + geld(g.preis); }
    const knoepfe = el("div", { class: "knoepfe" });
    if (ja) {
      knoepfe.append(el("button", { class: "ja", text: ja, disabled: p.geld < g.preis, onclick: () => { L.gelegenheitAnnehmen(st, g.id); nachAktion(); } }));
      knoepfe.append(el("button", { text: "Nein", onclick: () => { L.gelegenheitAblehnen(st, g.id); nachAktion(); } }));
    } else if (g.stadt) {
      knoepfe.append(el("button", { text: "Zeigen", onclick: () => { zeigeStadt(g.stadt); } }));
    }
    return el("div", { class: "gel" + (g.info ? " info" : "") },
      el("div", { class: "bildchen" }, bildEl(bildName, icon)),
      el("div", { class: "inhalt" }, el("div", { class: "titel", text: titel }), el("div", { class: "klein", text }), knoepfe),
      el("div", { class: "rest" }));
  }

  // ---------- Seitentafel ----------
  let tafelEl = null;
  function tafel(art, titel, untertitel, ...inhalt) {
    if (tafelEl) tafelEl.remove();
    ui.tafel = art;
    tafelEl = el("div", { class: "tafel" },
      el("div", { class: "kopf" }, el("h2", {}, titel, untertitel ? el("small", { text: untertitel }) : null), el("button", { class: "zu", text: "✕", onclick: auswahlWeg, "aria-label": "Schließen" })),
      el("div", { class: "rumpf" }, inhalt));
    feld.append(tafelEl);
    karteZeichnen();
    return tafelEl;
  }
  function auswahlWeg() {
    if (tafelEl) tafelEl.remove();
    tafelEl = null; ui.tafel = null; ui.auswahl = null; ui.plan = null; ui.route = null;
    karteZeichnen();
  }
  function tafelNeu() {
    // Inhalt der offenen Tafel auffrischen (z. B. nach Tagesende).
    if (ui.tafel === "stadt") zeigeStadt(ui.auswahl, true);
    else if (ui.tafel === "plan") zeigePlan(ui.plan.a, ui.plan.b, true);
    else if (ui.tafel === "route") { if (st.airlines[L.SPIELER].routen.some((r) => r.id === ui.route)) zeigeRoute(ui.route, true); else auswahlWeg(); }
    else if (ui.tafel === "flotte") zeigeFlotte(true);
    else if (ui.tafel === "rang") zeigeRang(true);
    else if (ui.tafel === "service") zeigeService(true);
    else if (ui.tafel === "finanzen") zeigeFinanzen(true);
  }

  const KLASSE = { 3: "Weltdrehkreuz", 2: "Großflughafen", 1: "Regionalflughafen" };
  function zeigeStadt(id, still) {
    const c = L.STADT[id];
    const p = st.airlines[L.SPIELER];
    ui.auswahl = id; ui.plan = null; ui.route = null;
    const tag = L.tagVon(st);
    const frei = L.slotsFrei(st, id);
    const meine = p.slots[id] || 0, genutzt = L.slotsGenutzt(p, id);
    const hub = L.drehkreuze(p).includes(id);
    const routen = p.routen.filter((r) => r.a === id || r.b === id);
    const andere = ["k", "s", "a"].filter((aid) => st.airlines[aid].routen.some((r) => r.a === id || r.b === id));
    const sai = L.saison(tag);
    let saisonText = null;
    if (c.t === "sonne") saisonText = sai.sonne > 1.2 ? "☀️ Sommer: viele Urlauber!" : sai.sonne < 0.8 ? "🌧️ Nebensaison: wenig Urlauber" : "☀️ Urlaubsziel, im Sommer gefragt";
    if (c.t === "schnee") saisonText = sai.schnee > 1.2 ? "⛷️ Winter: Skiurlauber!" : "⛷️ Im Winter gefragt";
    const messe = st.messen.find((m) => m.stadt === id);
    tafel("stadt", c.name, KLASSE[c.k] + (hub ? " · dein Drehkreuz" : p.basis === id ? " · deine Heimat" : ""),
      el("div", { class: "chips" },
        el("span", { class: "chip", text: "👥 Größe " + c.g }),
        el("span", { class: "chip", text: "👔 " + Math.round(c.w * 100) + " % Geschäft" }),
        el("span", { class: "chip", text: "🛬 Gebühr " + geld(L.REGELN.gebuehr[c.k]) })),
      saisonText ? el("div", { class: "hinweis", text: saisonText }) : null,
      messe ? el("div", { class: "hinweis", text: `🎪 Messe von Tag ${messe.von} bis ${messe.bis}: doppelt so viele Geschäftsreisende.` }) : null,
      el("div", { class: "zeile" }, el("span", { text: "🎟️ Deine Slots" }), el("b", { class: "rechts", text: meine ? `${genutzt} von ${meine} belegt` : "keine" })),
      el("div", { class: "zeile blass mini" }, el("span", { text: c.k === 1 ? "Hier gibt es genug Slots." : `Noch ${Math.max(0, frei)} frei für alle Airlines` }), el("span", { class: "rechts", text: frei > 0 ? "je " + geld(L.slotPreis(st, id)) : "ausverkauft" })),
      andere.length ? el("div", { class: "chips" }, el("span", { class: "blass mini", text: "Hier fliegen auch:" }), andere.map((aid) => el("span", { class: "chip" }, el("span", { class: "punkt", style: { background: st.airlines[aid].farbe } }), st.airlines[aid].name))) : null,
      routen.length ? el("div", { class: "blass mini", text: "Deine Routen von hier:" }) : null,
      routen.map((r) => routeZeile(r)),
      el("div", { class: "hinweis gruen", text: "✈️ Tippe jetzt eine zweite Stadt auf der Karte an, um eine Route zu planen." }));
    if (!still) tippEinfuehrung();
  }

  function routeZeile(r) {
    const e = L.rechnung(st).routen[r.id];
    const g = e ? e.gewinn : 0;
    return el("button", { class: "wahl", onclick: () => zeigeRoute(r.id) },
      el("div", { class: "mitte" }, el("b", { text: L.STADT[r.a].name + " – " + L.STADT[r.b].name }), el("span", { text: (e ? e.flugzeuge : 0) + " ✈ · " + Math.round((e ? e.auslastung : 0) * 100) + " % voll" })),
      el("div", { class: "wert", style: { color: farbeGewinn(g) }, text: kurz(g) }));
  }

  const GRUND = { reichweite: "zu weit", geld: "zu teuer", slots: "keine Slots frei", gesperrt: "später", welt: "erst auf Platz 1" };
  function zeigePlan(a, b, still) {
    const p = st.airlines[L.SPIELER];
    ui.plan = { a, b }; ui.auswahl = a; ui.route = null;
    const km = L.entfernung(a, b);
    const vorhanden = L.routeVon(p, a, b);
    const tag = L.tagVon(st);
    const n = L.grundNachfrage(st, a, b, tag);
    const gaeste = Math.round(n.urlaub + n.geschaeft);
    const konkurrenz = ["k", "s", "a"].filter((aid) => L.routeVon(st.airlines[aid], a, b));
    const optionen = [];
    for (const typ of Object.keys(L.TYPEN)) {
      const t = L.TYPEN[typ];
      if (t.stufe > st.stufe + 1) continue;
      const test = L.kannFliegen(st, L.SPIELER, a, b, typ);
      let delta = null;
      if (test.ok || test.grund === "geld") {
        const pr = L.probe(st, L.SPIELER, (k) => { k.airlines[L.SPIELER].geld = 1e12; return L.fliegen(k, L.SPIELER, a, b, typ); });
        delta = pr ? pr.delta : null;
      }
      const kosten = test.kosten || L.kostenFuer(st, L.SPIELER, a, b, typ);
      optionen.push({ typ, t, test, delta, kosten });
    }
    const beste = optionen.filter((o) => o.test.ok && o.delta > 0).sort((x, y) => y.delta - x.delta)[0];
    const slotInfo = [a, b].map((s) => {
      const da = L.slotsUebrig(p, s) > 0;
      return el("span", { class: "chip", text: (da ? "✓ " : "🎟️ ") + L.STADT[s].name + (da ? "" : L.slotsFrei(st, s) > 0 ? " " + geld(L.slotPreis(st, s)) : " voll") });
    });
    tafel("plan", L.STADT[a].name + " – " + L.STADT[b].name, km.toLocaleString("de-DE") + " km" + (vorhanden ? " · du fliegst hier schon" : " · neue Route"),
      el("div", { class: "chips" },
        el("span", { class: "chip", text: "👥 ≈ " + gaeste + " Gäste pro Tag und Richtung" }),
        konkurrenz.length ? konkurrenz.map((aid) => el("span", { class: "chip" }, el("span", { class: "punkt", style: { background: st.airlines[aid].farbe } }), st.airlines[aid].name)) : el("span", { class: "chip", text: "Keine Konkurrenz" })),
      el("div", { class: "chips" }, slotInfo),
      el("div", { class: "blass mini", text: vorhanden ? "Noch ein Flugzeug dazu:" : "Welches Flugzeug?" }),
      optionen.map((o) => {
        const gesperrt = !o.test.ok;
        const kostenText = o.kosten.gesamt ? geld(o.kosten.gesamt) : "frei";
        const wert = o.delta == null ? "–" : kurz(o.delta);
        return el("button", {
          class: "wahl" + (!gesperrt && o.delta > 0 ? " gut" : !gesperrt && o.delta <= 0 ? " schlecht" : ""), disabled: gesperrt,
          onclick: () => eroeffnen(a, b, o.typ),
        },
        el("div", { class: "ic" }, bildEl("air-flugzeug-" + o.typ, TYP_ICON[o.typ])),
        el("div", { class: "mitte" }, el("b", { text: o.t.name }), el("span", { text: gesperrt ? GRUND[o.test.grund] || "" : (o.kosten.frei ? "steht frei · " : "") + "Kosten " + kostenText })),
        el("div", { class: "wert", style: { color: o.delta == null ? "#9FB4C4" : farbeGewinn(o.delta) } }, wert, el("small", { text: "pro Tag" })));
      }),
      beste ? null : el("div", { class: "hinweis", text: "Hier lohnt sich gerade kein Flugzeug. Probier eine größere Stadt oder eine andere Entfernung." }));
    if (!still) tippEinfuehrung();
  }

  function eroeffnen(a, b, typ) {
    const r = L.fliegen(st, L.SPIELER, a, b, typ);
    if (!r.ok) return;
    if (ui.tempo === 0 && einf.schritt <= 2) tempo(1);
    nachAktion();
    zeigeRoute(r.route.id);
    if (einf.schritt <= 2) { einf.schritt = 3; schreiben(EINFUEHRUNG, einf); tippEinfuehrung(); }
  }

  function zeigeRoute(rid, still) {
    const p = st.airlines[L.SPIELER];
    const r = p.routen.find((x) => x.id === rid);
    if (!r) { auswahlWeg(); return; }
    ui.route = rid; ui.plan = null; ui.auswahl = null;
    const e = L.rechnung(st).routen[rid];
    const fs = L.flugzeugeAuf(p, rid);
    const maxBalken = Math.max(e.erloes, e.kosten, 1);
    const balken = (name, wert, farbe) => el("div", { class: "balkenzeile" }, el("span", { text: name }),
      el("div", { class: "spur" }, el("i", { style: { width: (wert / maxBalken * 100).toFixed(1) + "%", background: farbe } })), el("span", { class: "betrag zahl", text: geld(wert) }));
    const ausl = Math.round(e.auslastung * 100);
    const konkurrenz = ["k", "s", "a"].filter((aid) => L.routeVon(st.airlines[aid], r.a, r.b));
    const umst = Math.round(e.umsteigerPax);
    tafel("route", L.STADT[r.a].name + " – " + L.STADT[r.b].name, e.km.toLocaleString("de-DE") + " km · " + fs.map((f) => L.TYPEN[f.typ].name).join(", "),
      el("div", { class: "zeile" }, el("span", { class: "gross zahl", style: { color: farbeGewinn(e.gewinn) }, text: kurz(e.gewinn) }), el("span", { class: "blass", text: "pro Tag" })),
      e.zubringer > 1000 ? el("div", { class: "hinweis gruen", text: `🔁 Bringt zusätzlich ${kurz(e.zubringer)} auf deinen Anschlussflügen (${umst} Umsteiger am Tag).` }) : umst > 0 ? el("div", { class: "blass mini", text: `🔁 ${umst} Umsteiger am Tag` }) : null,
      el("div", { class: "auslastung" }, el("i", { style: { width: Math.min(100, ausl) + "%", background: ausl >= 85 ? "#4ADE80" : ausl >= 55 ? "#FACC15" : "#F87171" } }), el("span", { text: ausl + " % der Plätze verkauft" })),
      balken("Tickets", e.erloes, "#4ADE80"),
      balken("Kerosin", e.kerosin, "#F87171"),
      balken("Gebühren", e.gebuehr, "#FB923C"),
      balken("Service", e.service, "#C084FC"),
      balken("Crew", e.crew, "#94A3B8"),
      el("div", { class: "blass mini", text: "Preis auf dieser Route:" }),
      el("div", { class: "segment" }, Object.entries(L.STUFEN).map(([id, s]) => el("button", {
        class: r.stufe === id ? "an" : "", onclick: () => { L.preisStufe(st, L.SPIELER, rid, id); nachAktion(); zeigeRoute(rid, true); },
      }, s.icon + " " + s.name, el("small", { text: geld(L.ticket(e.km) * L.SERVICE[p.service].preis * s.preis) + " €" })))),
      konkurrenz.length ? el("div", { class: "chips" }, el("span", { class: "blass mini", text: "Konkurrenz:" }), konkurrenz.map((aid) => el("span", { class: "chip" }, el("span", { class: "punkt", style: { background: st.airlines[aid].farbe } }), st.airlines[aid].name))) : null,
      el("div", { class: "knopfreihe" },
        el("button", { class: "nebenknopf", text: "＋ Flugzeug", onclick: () => zeigePlan(r.a, r.b) }),
        el("button", { class: "nebenknopf", text: fs.length > 1 ? "− Flugzeug" : "Schließen", onclick: () => { L.abziehen(st, L.SPIELER, rid); nachAktion(); zeigeRoute(rid, true); } })),
      el("div", { class: "blass mini", text: "Abgezogene Flugzeuge stehen danach frei in deiner Flotte." }));
    if (!still) tippEinfuehrung();
  }

  function zeigeFlotte(still) {
    const p = st.airlines[L.SPIELER];
    const frei = L.freieFlugzeuge(p);
    const imEinsatz = p.flotte.length - frei.length;
    tafel("flotte", "Deine Flotte", p.flotte.length + " Flugzeuge · " + imEinsatz + " fliegen",
      frei.length ? el("div", { class: "blass mini", text: "Stehen frei (für die nächste Route):" }) : null,
      frei.map((f) => el("div", { class: "wahl" },
        el("div", { class: "ic" }, bildEl("air-flugzeug-" + f.typ, TYP_ICON[f.typ])),
        el("div", { class: "mitte" }, el("b", { text: L.TYPEN[f.typ].name }), el("span", { text: "Verkaufen bringt " + geld(L.TYPEN[f.typ].preis * L.REGELN.verkaufAnteil) })),
        el("button", { class: "nebenknopf", text: "Verkaufen", onclick: () => { L.verkaufen(st, L.SPIELER, f.id); nachAktion(); zeigeFlotte(true); } }))),
      el("div", { class: "blass mini", text: "Flugzeugtypen:" }),
      Object.entries(L.TYPEN).map(([typ, t]) => {
        const offen = L.typFrei(st, p, typ);
        const zahl = p.flotte.filter((f) => f.typ === typ).length;
        return el("div", { class: "wahl", style: { opacity: offen ? 1 : 0.5 } },
          el("div", { class: "ic" }, bildEl("air-flugzeug-" + typ, TYP_ICON[typ])),
          el("div", { class: "mitte" }, el("b", { text: t.name + (zahl ? " · " + zahl + "×" : "") }),
            el("span", { text: offen ? `${t.sitze} Sitze · bis ${t.reichweite.toLocaleString("de-DE")} km · ${geld(t.preis)}` : t.stufe === 2 ? "ab Firmenwert " + geld(L.REGELN.stufe2Wert) : "ab Platz 1 in Europa" })),
          offen ? el("button", { class: "nebenknopf", text: "Kaufen", disabled: p.geld < t.preis, onclick: () => { L.kaufen(st, L.SPIELER, typ); nachAktion(); zeigeFlotte(true); } }) : el("span", { text: "🔒" }));
      }),
      el("div", { class: "hinweis", text: "Am einfachsten: Stadt antippen, zweite Stadt antippen, Flugzeug wählen. Fehlt eins, wird es dabei gekauft." }));
  }

  function zeigeRang(still) {
    const liste = L.rangliste(st);
    const max = Math.max(...liste.map((r) => r.wert), 1);
    tafel("rang", "Rangliste Europa", st.welt ? "Die Welt ist offen 🌍" : "Platz 1 öffnet die Welt 🌍",
      liste.map((r, i) => {
        const ich = r.id === L.SPIELER;
        const riv = L.RIVALEN[r.id];
        const spruch = riv ? (i === 0 ? riv.sprueche.gross : liste.findIndex((x) => x.id === L.SPIELER) < i ? riv.sprueche.verliert : riv.sprueche.gegen) : null;
        return el("div", { class: "rang" + (ich ? " ich" : "") },
          el("span", { class: "nr", text: i + 1 }),
          el("div", { class: "gesicht", style: { background: r.farbe } }, riv ? bildEl(CHEF[r.id], riv.chef[0]) : "★"),
          el("div", { class: "mitte" },
            el("b", { text: r.name + (riv ? " · " + riv.chef : " (du)") }),
            el("span", { class: "blass mini", text: `${geld(r.wert)} · ${r.routen} Routen · ${r.flugzeuge} ✈` }),
            el("div", { class: "spur" }, el("i", { style: { width: (r.wert / max * 100).toFixed(1) + "%", background: r.farbe } })),
            spruch ? el("div", { class: "spruch", text: "„" + spruch + "“" }) : null));
      }),
      el("div", { class: "blass mini", text: "Gezählt wird der Firmenwert: Geld, Flugzeuge, Slots und was die Airline täglich verdient, minus Kredit." }));
  }

  function zeigeService(still) {
    const p = st.airlines[L.SPIELER];
    tafel("service", "Deine Servicelinie", "gilt für die ganze Airline",
      el("div", { class: "zeile" }, el("span", { text: "Ruf" }), el("b", { class: "rechts", text: Math.round(p.ruf) + " / 100" })),
      el("div", { class: "auslastung" }, el("i", { style: { width: p.ruf + "%", background: "#F2C14E" } })),
      Object.entries(L.SERVICE).map(([id, s]) => el("div", { class: "wahl" + (p.service === id ? " gut" : "") },
        el("div", { class: "ic" }, bildEl("air-service-" + id, s.icon)),
        el("div", { class: "mitte" }, el("b", { text: s.name + (p.service === id ? " (jetzt)" : "") }), el("span", { text: s.staerke })),
        p.service === id ? null : el("button", { class: "nebenknopf", disabled: p.geld < L.REGELN.wechselKosten, text: "Wechseln", onclick: () => { L.serviceWechseln(st, L.SPIELER, id); nachAktion(); zeigeService(true); } }))),
      el("div", { class: "hinweis", text: `Wechseln kostet ${geld(L.REGELN.wechselKosten)} und ${L.REGELN.rufWechsel} Punkte Ruf. Der Ruf wächst danach jeden Tag wieder.` }));
  }

  function zeigeFinanzen(still) {
    const p = st.airlines[L.SPIELER];
    const lt = st.letzterTag;
    const max = Math.max(1, ...p.verlauf.map(Math.abs));
    tafel("finanzen", "Kasse", "Geld " + geld(p.geld) + (p.kredit ? " · Kredit " + geld(p.kredit) : ""),
      el("div", { class: "blass mini", text: "Gewinn der letzten Tage:" }),
      el("div", { style: { display: "flex", alignItems: "flex-end", gap: "3px", height: "60px" } },
        p.verlauf.map((v) => el("div", { title: geld(v), style: { flex: 1, height: Math.max(3, Math.abs(v) / max * 58) + "px", background: v >= 0 ? "#4ADE80" : "#F87171", borderRadius: "3px" } }))),
      p.kredit > 0 ? el("button", { class: "hauptknopf", disabled: p.geld <= 0, text: "Kredit tilgen (" + geld(Math.min(p.kredit, Math.max(0, p.geld))) + ")", onclick: () => { L.tilgen(st); nachAktion(); zeigeFinanzen(true); } }) : null,
      p.kredit > 0 ? el("div", { class: "blass mini", text: "Zinsen: " + geld(p.kredit * L.REGELN.kreditZins) + " pro Tag" }) : null,
      lt ? el("div", { class: "blass mini", text: "Tag " + lt.tag + " pro Route:" }) : null,
      lt ? lt.routen.map((r) => el("div", { class: "zeile mini" }, el("span", { text: L.STADT[r.a].name + " – " + L.STADT[r.b].name }), el("b", { class: "rechts", style: { color: farbeGewinn(r.gewinn) }, text: kurz(r.gewinn) }))) : null);
  }

  // ---------- Zeit ----------
  function tempo(t) {
    ui.tempo = t;
    if (t) ui.letztesTempo = t;
    hudAktualisieren();
  }

  let letzterRahmen = null, letztesSpeichern = 0, letzteHud = 0;
  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    if (!st || st.ende || ui.heimat) { letzterRahmen = jetzt; return; }
    const dt = letzterRahmen == null ? 0 : Math.min(0.25, (jetzt - letzterRahmen) / 1000);
    letzterRahmen = jetzt;
    if (ui.tempo > 0 && dt > 0 && !ui.modal) {
      const tagVorher = L.tagVon(st);
      const landungen = L.vorruecken(st, dt * ui.tempo / SEK_PRO_STUNDE);
      for (const l of landungen.slice(0, 6)) landungZeigen(l);
      if (L.tagVon(st) !== tagVorher) tagEnde();
      if (st.ende) { endeSeite(); return; }
    }
    fliegerZeichnen();
    if (jetzt - letzteHud > 200) { hudAktualisieren(); letzteHud = jetzt; }
    if (jetzt - letztesSpeichern > 5000) { speichern(); letztesSpeichern = jetzt; }
  }

  function tagEnde() {
    karteZeichnen();
    tafelNeu();
    meldungenZeigen();
    const lt = st.letzterTag;
    if (lt && lt.tag !== ui.letzterAbschluss) {
      ui.letzterAbschluss = lt.tag;
      const alt = feld.querySelector(".abschluss");
      if (alt) alt.remove();
      const beste = lt.routen.slice(0, 2), schlechteste = lt.routen.filter((r) => r.gewinn < 0).slice(-1);
      const box = el("div", { class: "abschluss" },
        el("div", {}, el("div", { class: "blass mini", text: "Tag " + lt.tag + " abgerechnet" }), el("div", { class: "gross zahl", style: { color: farbeGewinn(lt.gewinn) }, text: geld(lt.gewinn, true) })),
        lt.routen.length ? el("div", { class: "liste" }, beste.concat(schlechteste).map((r) => el("div", {},
          el("span", { style: { color: farbeGewinn(r.gewinn) }, text: kurz(r.gewinn) + " " }), L.STADT[r.a].name + " – " + L.STADT[r.b].name,
          r.zubringer > 1000 ? el("span", { class: "plus", text: " (bringt " + kurz(r.zubringer) + " weiter)" }) : null))) : null);
      feld.append(box);
      setTimeout(() => box.remove(), 6200);
    }
    if (einf.schritt === 3) { einf.schritt = 4; schreiben(EINFUEHRUNG, einf); tippEinfuehrung(); }
    tippEinfuehrung();
    speichern();
  }

  const MELDUNG_ICON = { mahnung: "⚠️", kredit: "🏦", uebernahme: "🤝", gerettet: "✅", aufstieg: "🏆", stufe: "✈️", welt: "🌍", saison: "🗓️", slotweg: "🎟️", slotverloren: "🔨", kerosin: "⛽", rivale: "📰", angriff: "⚔️", abstieg: "📉" };
  function meldungenZeigen() {
    const neu = st.meldungen.splice(0);
    let verzoegerung = 0;
    for (const m of neu.slice(-3)) {
      setTimeout(() => {
        const e = el("div", { class: "meldung" }, MELDUNG_ICON[m.art] || "📰", el("span", { text: m.text }));
        feld.append(e);
        setTimeout(() => e.remove(), 4300);
      }, verzoegerung);
      verzoegerung += 1500;
      if (m.art === "welt") { kameraPassend(true); kameraSetzen(); }
    }
  }

  function nachAktion() {
    hud.gelSig = null;
    karteZeichnen();
    hudAktualisieren();
    speichern();
  }

  // ---------- Übernahme, Ende ----------
  function uebernahmeZeigen() {
    if (feld.querySelector(".seite")) return;
    const u = st.uebernahme;
    const riv = L.RIVALEN[u.von];
    ui.modal = true;
    const seite = el("div", { class: "seite" },
      bildEl("air-ereignis-uebernahme") ? el("img", { class: "bg", src: bild("air-ereignis-uebernahme"), alt: "" }) : null,
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
    const p = st.airlines[L.SPIELER];
    const e = st.ende;
    const titel = e.grund === "verkauft" ? "Verkauft an " + L.RIVALEN[e.von].name : "Pleite";
    const seite = el("div", { class: "seite" },
      bild("air-ende") ? el("img", { class: "bg", src: bild("air-ende"), alt: "" }) : null,
      el("h1", {}, titel, el("small", { text: p.name + " hat " + (e.tag - 1) + " Tage durchgehalten. Bester Platz: " + (st.bestPlatz || L.platz(st)) + "." })),
      el("button", { class: "hauptknopf", text: "Neue Airline gründen", onclick: () => { seite.remove(); neuStart(); } }));
    feld.append(seite);
  }

  // ---------- Start ----------
  function startSeite() {
    feld.replaceChildren();
    karte = null; tafelEl = null; ui.tafel = null; ui.auswahl = null; ui.plan = null;
    const w = ui.startWahl;
    const seite = el("div", { class: "seite" });
    function zeichnen() {
      seite.replaceChildren();
      seite.append(...[
        bild("air-start") ? el("img", { class: "bg", src: bild("air-start"), alt: "" }) : null,
        el("h1", {}, "Luftlinie", el("small", { text: "Gründe deine Airline und erobere Europas Himmel" })),
        el("div", { class: "namen" }, el("span", { class: "blass", text: "Name:" }), L.NAMEN.map((n, i) => el("button", { class: w.name === i ? "an" : "", onclick: () => { w.name = i; zeichnen(); } },
          el("span", { class: "punkt", style: { background: n.farbe } }), n.name))),
        el("div", { class: "karten" }, Object.entries(L.SERVICE).map(([id, s]) => el("button", { class: "karte-wahl" + (w.service === id ? " an" : ""), onclick: () => { w.service = id; zeichnen(); } },
          el("div", { class: "bild" }, bildEl("air-service-" + id, s.icon)),
          el("div", { class: "txt" }, el("b", { text: s.name }), el("span", { text: s.staerke }))))),
        el("button", { class: "hauptknopf", text: "Weiter: Heimat wählen ▶", onclick: heimatWaehlen })].filter(Boolean));
    }
    zeichnen();
    feld.append(seite);
  }

  function heimatWaehlen() {
    feld.replaceChildren();
    ui.heimat = true;
    kameraPassend(false);
    karteBauen();
    feld.append(el("div", { class: "heimatwahl" }, "Wo soll deine Airline zu Hause sein?", el("small", { text: "Tippe auf eine leuchtende Stadt. Große Städte: viel Nachfrage, aber teure Gebühren." })),
      el("a", { class: "kachel rundknopf", href: "../", style: { position: "absolute", left: "6px", top: "6px", height: "38px", zIndex: 9 }, text: "⌂" }));
  }

  function heimatGewaehlt(id) {
    ui.heimat = false;
    st = L.neuesSpiel({ basis: id, service: ui.startWahl.service, name: L.NAMEN[ui.startWahl.name] });
    einf = { schritt: 1, fertig: false };
    schreiben(EINFUEHRUNG, einf);
    spielStarten();
    zeigeStadt(id);
  }

  function spielStarten() {
    feld.replaceChildren();
    karte = null; tafelEl = null;
    karteBauen();
    hudBauen();
    tempo(einf.fertig || einf.schritt >= 3 ? 1 : 0);
    ui.letzterAbschluss = st.letzterTag && st.letzterTag.tag;
    st.meldungen = [];
    tippEinfuehrung();
  }

  // ---------- Einführung ----------
  // Kurze Tipps, je einer, an der Stelle, um die es geht.
  let tippEl = null;
  function tippZeigen(text, ziel, seite, knopf) {
    if (tippEl) tippEl.remove();
    tippEl = el("div", { class: "tipp pfeil-" + ({ unten: "oben", oben: "unten", links: "rechts", rechts: "links" }[seite] || "oben") }, text,
      knopf ? el("div", {}, el("button", { text: knopf, onclick: () => { tippEl.remove(); tippEl = null; } })) : null);
    feld.append(tippEl);
    const f = feld.getBoundingClientRect();
    let r;
    if (ziel && ziel.getBoundingClientRect) {
      const b = ziel.getBoundingClientRect();
      r = { x: (b.left - f.left) / ui.skala, y: (b.top - f.top) / ui.skala, w: b.width / ui.skala, h: b.height / ui.skala };
    } else if (Array.isArray(ziel)) r = { x: ziel[0] - 4, y: ziel[1] - 4, w: 8, h: 8 };
    else r = { x: FELD_B / 2 - 100, y: 120, w: 200, h: 0 };
    const tw = tippEl.offsetWidth, th = tippEl.offsetHeight;
    let x, y;
    if (seite === "links") { x = r.x - tw - 10; y = r.y; }
    else if (seite === "rechts") { x = r.x + r.w + 10; y = r.y; }
    else if (seite === "oben") { x = r.x; y = r.y - th - 10; }
    else { x = r.x + r.w / 2 - 28; y = r.y + r.h + 10; }
    tippEl.style.left = Math.max(6, Math.min(FELD_B - tw - 6, x)) + "px";
    tippEl.style.top = Math.max(6, Math.min(FELD_H - th - 6, y)) + "px";
  }
  function tippWeg() { if (tippEl) { tippEl.remove(); tippEl = null; } }
  function tippEinmal(id, text, ziel, seite) {
    einf.gesehen = einf.gesehen || {};
    if (einf.gesehen[id]) return;
    einf.gesehen[id] = true;
    schreiben(EINFUEHRUNG, einf);
    tippZeigen(text, ziel, seite, "Verstanden");
  }

  function tippEinfuehrung() {
    if (!st || einf.fertig) return;
    const p = st.airlines[L.SPIELER];
    const s = einf.schritt;
    if (s <= 1 && ui.tafel !== "plan") {
      const [x, y] = bildschirm(p.basis);
      tippZeigen("Das ist deine Heimat " + L.STADT[p.basis].name + ". Tippe jetzt auf eine andere Stadt, um deine erste Route zu planen.", [x, y], x > 420 ? "links" : "rechts");
      einf.schritt = 1;
    } else if (s <= 2 && ui.tafel === "plan") {
      einf.schritt = 2; schreiben(EINFUEHRUNG, einf);
      tippZeigen("Wähle ein Flugzeug. Grün heißt: Die Route verdient so viel pro Tag. Dein erstes Flugzeug steht schon bereit.", tafelEl, "links");
    } else if (s === 3) {
      tippZeigen("Dein Flugzeug fliegt! Jede Landung bringt Geld. Mit ▶▶ läuft die Zeit schneller.", hud.tempo[2], "unten", "Okay");
      einf.schritt = 3.5; schreiben(EINFUEHRUNG, einf);
    } else if (s === 4) {
      tippZeigen("Der Tag ist abgerechnet. Grüne Routen verdienen, rote kosten. Tippe auf eine Route, um zu sehen, woran es liegt.", feld.querySelector(".abschluss"), "oben", "Okay");
      einf.schritt = 5; schreiben(EINFUEHRUNG, einf);
    } else if (s === 5 && p.routen.length >= 1 && p.geld > 1000000) {
      tippZeigen("Du hast genug Geld für ein zweites Flugzeug. Tippe wieder auf eine Stadt und dann auf ein Ziel.", hud.geldB, "unten", "Okay");
      einf.schritt = 6; schreiben(EINFUEHRUNG, einf);
    } else if (s === 6 && p.routen.filter((r) => r.a === p.basis || r.b === p.basis).length >= 2) {
      tippZeigen("Tipp: Ab drei Routen wird eine Stadt zum Drehkreuz (goldener Ring). Dann steigen Leute bei dir um und füllen deine Flugzeuge.", bildschirm(p.basis), "rechts", "Verstanden");
      einf.schritt = 7; schreiben(EINFUEHRUNG, einf);
    } else if (s === 7 && L.tagVon(st) >= 10) {
      tippZeigen("Am Ende jeder Jahreszeit (alle 7 Tage) verfallen Slots, die du nicht nutzt. Und Routen unter halb voll müssen ihren Slot neu ersteigern.", hud.tag, "unten", "Verstanden");
      einf.schritt = 8; schreiben(EINFUEHRUNG, einf);
    } else if (s === 8 && L.tagVon(st) >= 12) {
      tippZeigen("Schau ab und zu in die Rangliste 🏆: Wer Platz 1 in Europa schafft, darf in die ganze Welt fliegen.", hud.platz, "unten", "Los geht's");
      einf.schritt = 9; einf.fertig = true; schreiben(EINFUEHRUNG, einf);
    } else if (s >= 3 && s < 4) {
      // wartet auf das Tagesende
    } else if (s > 2 && ui.tafel !== "plan") {
      // nichts
    }
  }

  // ---------- Los ----------
  window.addEventListener("resize", skalieren);
  window.addEventListener("orientationchange", () => setTimeout(skalieren, 200));
  document.addEventListener("visibilitychange", () => { if (document.hidden) speichern(); });
  window.addEventListener("pagehide", speichern);
  skalieren();

  fetch("../grafiken/vorhanden.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((liste) => {
    for (const n of liste) dateien.add(n);
    const alt = lesen(SPEICHER, null);
    st = alt ? L.laden(alt) : null;
    if (st && !st.ende) spielStarten();
    else startSeite();
    requestAnimationFrame(schleife);
  });

  // Für Tests im Browser.
  window.luftlinie = { get st() { return st; }, ui, tempo };
})();
