// Oberfläche der Web-Version von "Die Fahrenden".
// Alle Regeln stehen in logik.js, hier wird nur gezeichnet und getippt.
(function () {
  "use strict";

  const L = window.Logik;
  const FELD_B = 844;
  const FELD_H = 390;
  const SPEICHER = "diefahrenden-spielstand-v1";
  const BEARBEITEN = location.hash === "#bearbeiten";

  const feld = document.getElementById("feld");
  const rahmen = document.getElementById("rahmen");
  let skala = 1;

  // ---------- Skalieren auf jede Bildschirmgröße ----------

  function skalieren() {
    const cs = getComputedStyle(rahmen);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const w = rahmen.clientWidth - pl - pr;
    const h = rahmen.clientHeight - pt - pb;
    skala = Math.max(0.2, Math.min(w / FELD_B, h / FELD_H));
    feld.style.position = "absolute";
    feld.style.left = pl + w / 2 + "px";
    feld.style.top = pt + h / 2 + "px";
    feld.style.transform = `translate(-50%, -50%) scale(${skala})`;
  }
  window.addEventListener("resize", skalieren);
  window.addEventListener("orientationchange", () => setTimeout(skalieren, 200));

  // ---------- Kleine Helfer ----------

  function el(tag, props, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kind of kinder.flat(Infinity)) {
      if (kind == null || kind === false) continue;
      e.append(kind.nodeType ? kind : String(kind));
    }
    return e;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, ...kinder) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    for (const kind of kinder) if (kind) e.append(kind.nodeType ? kind : String(kind));
    return e;
  }

  function stufe(feldpunkt) {
    const r = feld.getBoundingClientRect();
    return { x: (feldpunkt.clientX - r.left) / skala, y: (feldpunkt.clientY - r.top) / skala };
  }

  // ---------- Bilder ----------
  // Jedes Bild hat einen festen Namen (siehe GRAFIKEN.md). Liegt es in
  // grafiken/ und steht in grafiken/vorhanden.json, wird es gezeigt.
  // Sonst erscheint ein Platzhalter.

  const ERSATZ = {
    "symbol-brot": "🍞", "symbol-muenze": "🪙", "symbol-holz": "🪵", "symbol-moral": "🙂",
    "symbol-tag": "☀️", "symbol-gefahr": "⚠️", "symbol-wald": "🌲", "symbol-jubel": "👏",
    "symbol-panne": "💥", "symbol-gaehnen": "🥱", "symbol-schloss": "🔒", "symbol-krank": "🤒",
    "symbol-tod": "✝️", "symbol-pflege": "🌿",
    "gefuehl-spannung": "⚡", "gefuehl-humor": "🎭", "gefuehl-staunen": "✨", "gefuehl-herz": "❤️",
    "disziplin-akrobatik": "🤸", "disziplin-narretei": "🃏", "disziplin-tiere": "🐾",
    "disziplin-gaukelei": "🤹", "disziplin-musik": "🎵", "disziplin-feuer": "🔥", "disziplin-erzaehlung": "📖",
    "ort-dorf": "🏘️", "ort-markt": "🧺", "ort-burg": "🏰", "ort-kloster": "⛪", "wagen": "🎪",
    "publikum-volk": "🧑‍🌾", "publikum-adel": "🤴", "publikum-geistlichkeit": "🙏",
  };
  const GEFUEHL_BILD = { tension: "gefuehl-spannung", humor: "gefuehl-humor", wonder: "gefuehl-staunen", heart: "gefuehl-herz" };
  const DISZIPLIN_BILD = {
    acrobatics: "disziplin-akrobatik", foolery: "disziplin-narretei", animals: "disziplin-tiere",
    juggling: "disziplin-gaukelei", music: "disziplin-musik", fire: "disziplin-feuer", story: "disziplin-erzaehlung",
  };
  const ORT_BILD = { village: "ort-dorf", market: "ort-markt", castle: "ort-burg", monastery: "ort-kloster" };
  const BUEHNE_BILD = { village: "buehne-dorf", market: "buehne-markt", castle: "buehne-burg", monastery: "buehne-kloster" };
  const PUBLIKUM = {
    village: Array(9).fill("publikum-volk"),
    market: ["publikum-volk", "publikum-volk", "publikum-adel", "publikum-volk", "publikum-geistlichkeit", "publikum-volk", "publikum-volk", "publikum-adel", "publikum-volk", "publikum-volk"],
    castle: ["publikum-adel", "publikum-adel", "publikum-adel", "publikum-geistlichkeit", "publikum-adel", "publikum-adel"],
    monastery: Array(6).fill("publikum-geistlichkeit").concat(["publikum-volk", "publikum-volk"]),
  };

  const dateien = new Map(); // Bildname → Dateiname
  const seiten = new Map(); // Bildname → Seitenverhältnis

  const istGross = (name) => /^(karte|buehne|ereignis)-/.test(name);
  const groesse = (name) => (istGross(name) ? "1536 × 1024" : "1024 × 1024");

  function grossesBild(name) {
    const datei = dateien.get(name);
    if (datei) {
      const img = el("img", { class: "bild", src: "grafiken/" + encodeURIComponent(datei), alt: "", draggable: "false" });
      img.addEventListener("load", () => {
        const a = img.naturalWidth / img.naturalHeight;
        if (!seiten.has(name) || Math.abs(seiten.get(name) - a) > 0.01) {
          const neu = !seiten.has(name);
          seiten.set(name, a);
          if (neu && name.startsWith("karte-")) zeichnen();
        }
      });
      return img;
    }
    return el("div", { class: "platzhalter" },
      el("b", { text: name + ".png" }),
      el("small", { text: groesse(name) }));
  }

  function symbol(name, px, extraClass) {
    const datei = dateien.get(name);
    const s = el("span", { class: "symbol" + (extraClass ? " " + extraClass : ""), style: { width: px + "px", height: px + "px", fontSize: Math.round(px * 0.82) + "px" }, "aria-hidden": "true" });
    if (datei) s.append(el("img", { src: "grafiken/" + encodeURIComponent(datei), alt: "", draggable: "false" }));
    else s.textContent = ERSATZ[name] || "▫️";
    return s;
  }

  function ringFarbe(m) {
    if (!m.isAlive) return "#777";
    if (m.health > 60) return "var(--gut)";
    if (m.health > 30) return "var(--mittel)";
    return "var(--schlecht)";
  }

  function portrait(m, px) {
    const datei = dateien.get(m.portrait);
    const kopf = el("div", { class: "kopf", style: { fontSize: Math.round(px * 0.42) + "px" } });
    if (datei) kopf.append(el("img", { src: "grafiken/" + encodeURIComponent(datei), alt: "", draggable: "false" }));
    else kopf.textContent = m.name[0];
    const r = 46;
    const umfang = 2 * Math.PI * r;
    const anteil = m.isAlive ? m.health / 100 : 1;
    const ring = svg("svg", { viewBox: "0 0 100 100" },
      svg("circle", { cx: 50, cy: 50, r, fill: "none", stroke: "rgba(0,0,0,.35)", "stroke-width": 7 }),
      svg("circle", { cx: 50, cy: 50, r, fill: "none", stroke: ringFarbe(m), "stroke-width": 7, "stroke-linecap": "round", "stroke-dasharray": `${umfang * anteil} ${umfang}` }));
    const p = el("div", { class: "portrait" + (m.isAlive ? "" : " tot"), style: { width: px + "px", height: px + "px" }, title: m.name },
      kopf, ring);
    if (m.isAlive && m.isSick) p.append(el("span", { class: "marke" }, symbol("symbol-krank", Math.round(px * 0.4))));
    if (!m.isAlive) p.append(el("span", { class: "marke" }, symbol("symbol-tod", Math.round(px * 0.4))));
    return p;
  }

  function aenderung(bildname, betrag, px) {
    return el("span", { class: "aenderung" }, symbol(bildname, px || 17),
      el("span", { class: betrag >= 0 ? "plus" : "minus", text: betrag > 0 ? "+" + betrag : String(betrag).replace("-", "−") }));
  }

  function aenderungen(r) {
    const teile = [];
    if (r.food) teile.push(aenderung("symbol-brot", r.food));
    if (r.coins) teile.push(aenderung("symbol-muenze", r.coins));
    if (r.wood) teile.push(aenderung("symbol-holz", r.wood));
    if (r.morale) teile.push(aenderung("symbol-moral", r.morale));
    return teile;
  }

  function hauptknopf(text, aktion, aus) {
    return el("button", { class: "hauptknopf", onclick: aktion, disabled: !!aus }, text);
  }

  // ---------- Spielstand ----------

  let welt;
  let s;
  const ui = {
    schirm: "region",
    region: "mittelreich",
    gewaehlt: null,
    reise: null,
    karte: null,
    zoom: 1.4,
    pan: null,
    zeige: null,
    hinweis: null,
    vorst: null,
    wackelt: null,
  };

  function speichern() {
    try { localStorage.setItem(SPEICHER, JSON.stringify(s)); } catch (e) { /* ohne Speicher spielbar */ }
  }

  function laden() {
    try {
      const roh = localStorage.getItem(SPEICHER);
      if (!roh) return null;
      const g = JSON.parse(roh);
      return g && welt.ort(g.location) ? g : null;
    } catch (e) {
      return null;
    }
  }

  function neuerStartwert() {
    const a = new Uint32Array(2);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : (a[0] = Date.now(), a[1] = Math.random() * 2 ** 32);
    return (BigInt(a[0]) << 32n) | BigInt(a[1]) || 1n;
  }

  const ortHier = () => welt.ort(s.location);

  // ---------- Zeichnen ----------

  function zeichnen() {
    feld.replaceChildren();
    if (ui.schirm === "welt") feld.append(weltSchirm());
    else if (ui.schirm === "region") feld.append(regionSchirm());
    else if (ui.schirm === "vorstellung") feld.append(vorstellungSchirm());
    else feld.append(endeSchirm());
    if (ui.karte) feld.append(karteSchirm());
  }

  function leiste() {
    const r = s.resources;
    const n = L.lebende(s).length;
    const wert = (bild, zahl, warn) => el("span", { class: "wert" + (warn ? " warn" : "") }, symbol(bild, 19), String(zahl));
    return el("div", { class: "leiste" },
      wert("symbol-brot", r.food, r.food < n * 2),
      wert("symbol-muenze", r.coins),
      wert("symbol-holz", r.wood, r.wood < 2),
      wert("symbol-moral", r.morale, r.morale < 25),
      el("span", { class: "trenner" }),
      el("span", { class: "wert" }, symbol("symbol-tag", 17), String(s.day), el("span", { class: "zeit", text: L.jahreszeit(s) })));
  }

  function truppenLeiste() {
    const leiste = el("div", { class: "truppe" });
    for (const m of s.troupe) {
      leiste.append(el("button", {
        "aria-label": m.name,
        onclick: (e) => { e.stopPropagation(); ui.zeige = ui.zeige === m.id ? null : m.id; zeichnen(); },
      }, portrait(m, 36)));
    }
    const wrap = el("div", {}, leiste);
    const m = ui.zeige && L.mitglied(s, ui.zeige);
    if (m) {
      wrap.append(el("div", {
        class: "tafel",
        style: { left: "10px", right: "auto", bottom: "60px", width: "auto", flexDirection: "row", alignItems: "center", gap: "12px" },
      },
      portrait(m, 54),
      el("div", { style: { display: "flex", flexDirection: "column", gap: "3px" } },
        el("h2", { text: m.name }),
        el("span", { class: "art", text: m.role }),
        el("span", { class: "reihe" }, symbol(DISZIPLIN_BILD[m.discipline], 19), symbol(GEFUEHL_BILD[m.feeling], 19),
          el("span", { style: { color: "var(--gold)" }, text: "★".repeat(m.skill) }),
          m.fatigue > 50 ? el("span", { class: "aenderung" }, symbol("symbol-gaehnen", 16), String(m.fatigue)) : null))));
    }
    return wrap;
  }

  // ---------- Weltkarte ----------

  function weltSchirm() {
    const a = seiten.get("karte-welt") || 1.5;
    let w = FELD_B, h = FELD_B / a;
    if (FELD_B / FELD_H > a) { h = FELD_H; w = FELD_H * a; }
    const karte = el("div", { style: { position: "absolute", left: (FELD_B - w) / 2 + "px", top: (FELD_H - h) / 2 + "px", width: w + "px", height: h + "px" } },
      grossesBild("karte-welt"));
    const hier = ortHier().region;
    for (const r of welt.regions) {
      karte.append(el("button", {
        class: "region-marke" + (r.isOpen ? "" : " zu") + (ui.wackelt === r.id ? " wackeln" : ""),
        style: { left: r.worldPosition.x * 100 + "%", top: r.worldPosition.y * 100 + "%" },
        onclick: () => {
          if (r.isOpen) { ui.schirm = "region"; ui.region = r.id; ui.pan = null; ui.gewaehlt = null; zeichnen(); }
          else { ui.wackelt = r.id; zeichnen(); setTimeout(() => { ui.wackelt = null; }, 350); }
        },
      },
      r.id === hier ? symbol("wagen", 34) : (!r.isOpen ? symbol("symbol-schloss", 20) : null),
      el("span", { class: "region-name", text: r.name })));
    }
    return el("div", { class: "schirm welt-karte", onclick: () => { if (ui.zeige) { ui.zeige = null; zeichnen(); } } },
      karte, leiste(), truppenLeiste());
  }

  // ---------- Regionskarte ----------

  function kartenGroesse(region) {
    const a = seiten.get(region.mapImage) || 1.5;
    const h = Math.max(FELD_H, FELD_B / a) * ui.zoom;
    return { w: h * a, h };
  }

  function panBegrenzen(g) {
    ui.pan.x = Math.min(0, Math.max(FELD_B - g.w, ui.pan.x));
    ui.pan.y = Math.min(0, Math.max(FELD_H - g.h, ui.pan.y));
  }

  function regionSchirm() {
    const region = welt.region(ui.region);
    const g = kartenGroesse(region);
    const orte = welt.orteIn(region.id);
    if (!ui.pan) {
      const p = ortHier().position;
      ui.pan = { x: FELD_B / 2 - p.x * g.w, y: FELD_H / 2 - p.y * g.h };
    }
    panBegrenzen(g);

    const flaeche = el("div", { class: "karte-flaeche", style: { width: g.w + "px", height: g.h + "px", transform: `translate(${ui.pan.x}px, ${ui.pan.y}px)` } },
      el("div", { style: { position: "absolute", inset: "0" } }, grossesBild(region.mapImage)));

    // Wege mit Reisetagen
    const wege = svg("svg", {});
    for (const weg of welt.roads) {
      const a = welt.ort(weg.from), b = welt.ort(weg.to);
      if (a.region !== region.id || b.region !== region.id) continue;
      const vonHier = !ui.reise && (weg.from === s.location || weg.to === s.location);
      const farbe = vonHier ? "#F3D27A" : "rgba(27,42,43,.85)";
      const strich = weg.kind === "forest" ? "10 8" : "none";
      const pos = { x1: a.position.x * 100 + "%", y1: a.position.y * 100 + "%", x2: b.position.x * 100 + "%", y2: b.position.y * 100 + "%" };
      wege.append(svg("line", Object.assign({ stroke: "rgba(0,0,0,.35)", "stroke-width": (vonHier ? 5 : 3) + 3, "stroke-linecap": "round", "stroke-dasharray": strich }, pos)));
      wege.append(svg("line", Object.assign({ stroke: farbe, "stroke-width": vonHier ? 5 : 3, "stroke-linecap": "round", "stroke-dasharray": strich }, pos)));
      const mx = ((a.position.x + b.position.x) / 2) * 100 + "%";
      const my = ((a.position.y + b.position.y) / 2) * 100 + "%";
      wege.append(svg("circle", { cx: mx, cy: my, r: 11, fill: "rgba(13,23,24,.88)", stroke: farbe, "stroke-width": 1.5 }));
      wege.append(svg("text", { x: mx, y: my, dy: "0.35em", "text-anchor": "middle", fill: "#E8EDE6", "font-family": "Cinzel, Georgia, serif", "font-size": 13, "font-weight": 700 }, String(weg.days)));
    }
    flaeche.append(wege);

    for (const ort of orte) {
      const hier = ort.id === s.location && !ui.reise;
      const erreichbar = !!welt.weg(s.location, ort.id);
      flaeche.append(el("button", {
        class: "ort" + (erreichbar || hier ? "" : " fern") + (ui.gewaehlt === ort.id ? " gewaehlt" : ""),
        style: { left: ort.position.x * 100 + "%", top: ort.position.y * 100 + "%" },
        "data-ort": ort.id,
        onclick: (e) => {
          e.stopPropagation();
          if (ziehen.bewegt || ui.reise) return;
          ui.gewaehlt = ort.id;
          ui.zeige = null;
          zeichnen();
        },
      }, symbol(ORT_BILD[ort.kind], 44), el("span", { class: "name", text: ort.name })));
    }

    const start = ui.reise ? welt.ort(ui.reise.von).position : ortHier().position;
    const wagen = el("div", { class: "wagen", id: "wagen", style: { left: start.x * 100 + "%", top: start.y * 100 + "%" } }, symbol("wagen", 46));
    flaeche.append(wagen);

    const blick = el("div", { class: "region-blick" }, flaeche);
    kartenGesten(blick, flaeche, region);

    const kopf = el("div", { style: { position: "absolute", left: "10px", top: "8px", display: "flex", alignItems: "center", gap: "8px", zIndex: 6 } },
      el("button", { class: "rund", style: { position: "static" }, "aria-label": "Weltkarte", onclick: (e) => { e.stopPropagation(); ui.schirm = "welt"; ui.gewaehlt = null; zeichnen(); } }, "🌍"),
      el("span", { style: { fontFamily: "var(--titel)", fontSize: "16px", color: "var(--hellgold)", textShadow: "0 1px 3px #000" }, text: region.name }));

    const teile = [blick, kopf, leiste(), truppenLeiste()];
    if (ui.gewaehlt && !ui.reise) teile.push(ortTafel(welt.ort(ui.gewaehlt)));
    if (ui.hinweis) teile.push(el("div", { class: "hinweis", text: ui.hinweis }));
    return el("div", { class: "schirm" }, teile);
  }

  const ziehen = { bewegt: false };

  function kartenGesten(blick, flaeche, region) {
    const zeiger = new Map();
    let startAbstand = 0, startZoom = 1, summe = 0;

    const anwenden = () => {
      const g = kartenGroesse(region);
      panBegrenzen(g);
      flaeche.style.width = g.w + "px";
      flaeche.style.height = g.h + "px";
      flaeche.style.transform = `translate(${ui.pan.x}px, ${ui.pan.y}px)`;
    };
    const abstand = () => {
      const [a, b] = [...zeiger.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const mitte = () => {
      const [a, b] = [...zeiger.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    blick.addEventListener("pointerdown", (e) => {
      zeiger.set(e.pointerId, stufe(e));
      if (zeiger.size === 1) { ziehen.bewegt = false; summe = 0; }
      if (zeiger.size === 2) { startAbstand = abstand(); startZoom = ui.zoom; }
    });
    const bewegen = (e) => {
      if (!zeiger.has(e.pointerId)) return;
      const neu = stufe(e);
      const alt = zeiger.get(e.pointerId);
      if (zeiger.size === 1) {
        ui.pan.x += neu.x - alt.x;
        ui.pan.y += neu.y - alt.y;
        summe += Math.abs(neu.x - alt.x) + Math.abs(neu.y - alt.y);
        if (summe > 6) ziehen.bewegt = true;
        zeiger.set(e.pointerId, neu);
        anwenden();
      } else if (zeiger.size === 2) {
        const m = mitte();
        const gAlt = kartenGroesse(region);
        const fx = (m.x - ui.pan.x) / gAlt.w;
        const fy = (m.y - ui.pan.y) / gAlt.h;
        zeiger.set(e.pointerId, neu);
        ui.zoom = Math.min(3, Math.max(1, startZoom * (abstand() / startAbstand)));
        const g = kartenGroesse(region);
        ui.pan.x = m.x - fx * g.w;
        ui.pan.y = m.y - fy * g.h;
        ziehen.bewegt = true;
        anwenden();
      }
    };
    const loslassen = (e) => { zeiger.delete(e.pointerId); };
    blick.addEventListener("pointermove", bewegen);
    blick.addEventListener("pointerup", loslassen);
    blick.addEventListener("pointercancel", loslassen);
    blick.addEventListener("pointerleave", loslassen);
    blick.addEventListener("wheel", (e) => {
      e.preventDefault();
      const m = stufe(e);
      const gAlt = kartenGroesse(region);
      const fx = (m.x - ui.pan.x) / gAlt.w, fy = (m.y - ui.pan.y) / gAlt.h;
      ui.zoom = Math.min(3, Math.max(1, ui.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      const g = kartenGroesse(region);
      ui.pan.x = m.x - fx * g.w;
      ui.pan.y = m.y - fy * g.h;
      anwenden();
    }, { passive: false });

    blick.addEventListener("click", (e) => {
      if (ziehen.bewegt || e.target.closest(".ort")) return;
      const p = stufe(e);
      const g = kartenGroesse(region);
      ui.gewaehlt = null;
      ui.zeige = null;
      if (BEARBEITEN) {
        const x = Math.round(((p.x - ui.pan.x) / g.w) * 100) / 100;
        const y = Math.round(((p.y - ui.pan.y) / g.h) * 100) / 100;
        ui.hinweis = `"position": { "x": ${x}, "y": ${y} }`;
      }
      zeichnen();
    });
  }

  function ortTafel(ort) {
    const weg = welt.weg(s.location, ort.id);
    const hier = ort.id === s.location;
    const muender = L.lebende(s).length;
    const geschmack = el("div", { class: "reihe" },
      ort.likes.map((f) => symbol(GEFUEHL_BILD[f], 22)),
      ort.banned.map((d) => symbol(DISZIPLIN_BILD[d], 22, "verboten")),
      el("span", { class: "reihe", style: { gap: "3px" }, title: "Bühnenbretter" }, Array.from({ length: L.BRETTER[ort.kind] }, () => el("span", { class: "brett-mini" }))));
    let unten;
    if (weg) {
      unten = [
        el("div", { class: "reihe" },
          el("span", { class: "aenderung" }, symbol("symbol-tag", 18), String(weg.days)),
          aenderung("symbol-brot", -weg.days * muender),
          aenderung("symbol-holz", -weg.days),
          weg.kind === "forest" ? [symbol("symbol-wald", 18), symbol("symbol-gefahr", 18)] : null),
        el("div", {}, hauptknopf("Aufbrechen", (e) => { e.stopPropagation(); aufbrechen(ort.id); })),
      ];
    } else if (hier) {
      unten = el("div", { class: "reihe" }, symbol("wagen", 28));
    } else {
      unten = el("div", { class: "reihe", style: { opacity: ".65" } }, symbol("symbol-schloss", 16), "Kein direkter Weg");
    }
    return el("div", { class: "tafel", onclick: (e) => e.stopPropagation() },
      el("div", { class: "reihe" }, symbol(ORT_BILD[ort.kind], 30),
        el("div", {}, el("h2", { text: ort.name }), el("span", { class: "art", text: L.ORTSART[ort.kind] }))),
      geschmack, unten);
  }

  // ---------- Reise ----------

  function aufbrechen(ziel) {
    if (ui.reise || ui.karte) return;
    const von = s.location;
    let bericht;
    try { bericht = L.reisen(s, ziel, welt); } catch (e) { return; }
    speichern();
    ui.gewaehlt = null;
    ui.hinweis = null;
    ui.reise = { von, nach: ziel, bericht };
    zeichnen();
    const wagen = document.getElementById("wagen");
    const z = welt.ort(ziel).position;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wagen.classList.add("faehrt");
      wagen.style.left = z.x * 100 + "%";
      wagen.style.top = z.y * 100 + "%";
    }));
    const dauer = matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 2400;
    setTimeout(reiseFertig, dauer);
  }

  function reiseFertig() {
    const r = ui.reise.bericht;
    ui.reise = null;
    if (r.hungryDays || r.coldDays || r.deaths.length || r.fellSick.length) ui.karte = { art: "bericht", bericht: r };
    else if (r.event) ui.karte = { art: "ereignis", ereignis: r.event };
    else return ankommen();
    zeichnen();
  }

  function ankommen() {
    ui.karte = null;
    if (L.spielVorbei(s)) {
      ui.schirm = "ende";
    } else {
      ui.schirm = "vorstellung";
      ui.vorst = { bretter: Array(L.BRETTER[ortHier().kind]).fill(null), ergebnis: null, gespielt: 0, fertig: false, timer: null };
    }
    zeichnen();
  }

  // ---------- Tafeln: Reisebericht, Ereignis, Folgen ----------

  function karteSchirm() {
    const k = ui.karte;
    let inhalt;
    if (k.art === "bericht") {
      const r = k.bericht;
      const leute = r.fellSick.filter((id) => !r.deaths.includes(id)).concat(r.deaths).map((id) => L.mitglied(s, id)).filter(Boolean);
      inhalt = el("div", { class: "bericht" },
        el("div", { class: "reihe", style: { gap: "18px" } },
          el("span", { class: "aenderung gross" }, symbol("symbol-tag", 24), String(r.days)),
          r.foodEaten ? aenderung("symbol-brot", -r.foodEaten, 20) : null, r.woodBurned ? aenderung("symbol-holz", -r.woodBurned, 20) : null),
        r.hungryDays || r.coldDays ? el("div", { class: "reihe" },
          Array.from({ length: r.hungryDays }, () => symbol("symbol-brot", 26, "verboten")),
          Array.from({ length: r.coldDays }, () => symbol("symbol-holz", 26, "verboten"))) : null,
        leute.length ? el("div", { class: "reihe", style: { gap: "14px" } },
          leute.map((m) => el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" } }, portrait(m, 52), el("span", { class: "nummer-name", style: { fontFamily: "var(--titel)", fontSize: "12px" }, text: m.name })))) : null,
        hauptknopf("Weiter", () => {
          if (r.event) { ui.karte = { art: "ereignis", ereignis: r.event }; zeichnen(); }
          else ankommen();
        }));
    } else {
      const e = k.ereignis;
      const seite = el("div", { class: "seite" }, el("h2", { text: e.title }));
      if (k.art === "ereignis") {
        seite.append(el("p", { text: e.text }), el("div", { class: "luft" }));
        for (const o of e.options) {
          const frei = L.optionMoeglich(s, o);
          seite.append(el("button", {
            class: "option", disabled: !frei,
            onclick: () => {
              const folge = L.entscheiden(s, o, e, welt);
              speichern();
              ui.karte = { art: "folge", ereignis: e, folge };
              zeichnen();
            },
          },
          el("span", { class: "label" }, !frei ? symbol("symbol-schloss", 14) : null, o.requires ? symbol(DISZIPLIN_BILD[o.requires], 16) : null, o.label),
          el("span", { class: "reihe" }, folgenSymbole(o.effect))));
        }
      } else {
        const f = k.folge;
        seite.append(el("p", { text: f.outcome }),
          el("div", { class: "reihe" }, aenderungen(f.change),
            f.joined.map((id) => mini(L.mitglied(s, id), "+")),
            f.left.map((id) => mini(welt.troupe.find((m) => m.id === id) || welt.recruits.find((m) => m.id === id), "−")),
            f.deaths.map((id) => portrait(L.mitglied(s, id), 30))),
          el("div", { class: "luft" }),
          el("div", {}, hauptknopf("Weiter", ankommen)));
      }
      inhalt = el("div", { class: "ereignis" }, el("div", {}, grossesBild(e.image)), seite);
    }
    return el("div", { class: "schleier" }, inhalt);
  }

  function mini(m, zeichen) {
    if (!m) return null;
    const lebend = Object.assign({ health: 100, isAlive: true }, m);
    return el("span", { class: "aenderung" }, el("span", { class: zeichen === "+" ? "plus" : "minus", text: zeichen }), portrait(lebend, 20));
  }

  function folgenSymbole(e) {
    const teile = aenderungen({ food: e.food || 0, coins: e.coins || 0, wood: e.wood || 0, morale: e.morale || 0 });
    if (e.healthAll) teile.push(el("span", { class: "aenderung" }, "👥", aenderung("symbol-pflege", e.healthAll)));
    if (e.healthRandom) teile.push(el("span", { class: "aenderung" }, "❔", aenderung("symbol-pflege", e.healthRandom)));
    if (e.recruit) teile.push(mini(welt.recruits.find((m) => m.id === e.recruit), "+"));
    if (e.removeMember) teile.push(mini(L.mitglied(s, e.removeMember), "−"));
    if (e.makeSick) {
      const m = L.mitglied(s, e.makeSick);
      if (m) teile.push(el("span", { class: "aenderung" }, portrait(m, 20), symbol("symbol-krank", 14)));
    }
    return teile;
  }

  // ---------- Vorstellung ----------

  const BRETT_B = 84, BRETT_ABSTAND = 10, FADEN_H = 56;

  function vorstellungSchirm() {
    const ort = ortHier();
    const v = ui.vorst;
    const gefuellt = v.bretter.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
    const spielt = v.ergebnis && !v.fertig;

    const kopf = el("div", { class: "kopfzeile" },
      symbol(ORT_BILD[ort.kind], 26),
      el("h1", { text: ort.name }),
      ort.likes.map((f) => symbol(GEFUEHL_BILD[f], 20)),
      ort.banned.map((d) => symbol(DISZIPLIN_BILD[d], 20, "verboten")),
      leiste());

    const publikum = el("div", { class: "publikum" },
      PUBLIKUM[ort.kind].map((fig, i) => el("div", { class: "figur" },
        i % 3 === 1 && ort.likes[0] ? symbol(GEFUEHL_BILD[ort.likes[0]], 12) : el("span", { style: { height: "12px" } }),
        symbol(fig, 26))));

    // Goldener Faden
    const breite = v.bretter.length * BRETT_B + (v.bretter.length - 1) * BRETT_ABSTAND;
    const x = (i) => (i == null ? 0 : i * (BRETT_B + BRETT_ABSTAND) + BRETT_B / 2);
    const y = (st) => FADEN_H - (st / 100) * (FADEN_H - 6) - 3;
    const punkte = (kurve) => [{ i: null, st: kurve[0] }].concat(gefuellt.slice(0, kurve.length - 1).map((i, k) => ({ i, st: kurve[k + 1] })));
    const pfad = (pkte) => {
      let d = `M ${x(pkte[0].i)} ${y(pkte[0].st)}`;
      for (let k = 1; k < pkte.length; k++) {
        const a = pkte[k - 1], b = pkte[k];
        const mx = (x(a.i) + x(b.i)) / 2;
        d += ` C ${mx} ${y(a.st)}, ${mx} ${y(b.st)}, ${x(b.i)} ${y(b.st)}`;
      }
      return d;
    };
    const programm = gefuellt.map((i) => L.mitglied(s, v.bretter[i]));
    const erwartet = v.ergebnis ? null : L.erwarteteKurve(programm, ort, s.resources.morale);
    const fadenSvg = svg("svg", { width: breite, height: FADEN_H });
    if (erwartet) {
      fadenSvg.append(svg("path", { d: pfad(punkte(erwartet)), fill: "none", stroke: "#F3D27A", "stroke-width": 3, "stroke-linecap": "round", style: "filter: drop-shadow(0 0 4px #C9963A)" }));
    } else {
      const kurve = v.ergebnis.curve.slice(0, v.gespielt + 1);
      fadenSvg.append(svg("path", { d: pfad(punkte(kurve)), fill: "none", stroke: "#F3D27A", "stroke-width": 4, "stroke-linecap": "round", style: "filter: drop-shadow(0 0 6px #F3D27A)" }));
    }
    const faden = el("div", { class: "faden", style: { width: breite + "px" } }, fadenSvg);
    if (v.ergebnis) {
      gefuellt.forEach((i, k) => {
        if (k >= v.gespielt) return;
        const n = v.ergebnis.acts[k];
        const bild = n.mishap ? "symbol-panne" : n.delta >= 10 ? "symbol-jubel" : n.delta < 3 ? "symbol-gaehnen" : null;
        if (bild) faden.append(el("span", { class: "reaktion", style: { left: x(i) + "px" } }, symbol(bild, 26)));
      });
    }

    const licht = spielt ? gefuellt[v.gespielt] : null;
    const bretter = el("div", { class: "bretter" },
      v.bretter.map((id, i) => {
        const m = id && L.mitglied(s, id);
        return el("div", { class: "brett" + (m ? " voll" : "") + (licht === i ? " licht" : ""), "data-brett": i },
          m ? nummernKarte(m, true, "brett", i) : el("span", { class: "nr", text: String(i + 1) }));
      }));

    const teile = [
      el("div", { class: "hintergrund" }, grossesBild(BUEHNE_BILD[ort.kind])),
      el("div", { class: "verlauf" }),
      kopf, publikum,
      el("div", { class: "buehne" }, faden, bretter),
    ];

    if (!v.ergebnis) {
      const aufBuehne = new Set(v.bretter.filter(Boolean));
      teile.push(el("div", { class: "hand" },
        L.lebende(s).filter((m) => !aufBuehne.has(m.id)).map((m) => nummernKarte(m, L.darfAuftreten(m, ort), "hand"))));
      const moeglich = L.lebende(s).some((m) => L.darfAuftreten(m, ort));
      teile.push(el("div", { class: "vorhang" }, moeglich
        ? hauptknopf("Vorhang auf", vorhangAuf, gefuellt.length === 0)
        : hauptknopf("Weiterziehen", zurKarte)));
    }
    if (v.fertig) teile.push(ergebnisTafel(ort));

    return el("div", {
      class: "schirm vorstellung",
      onclick: () => { if (ui.vorst && ui.vorst.ergebnis && !ui.vorst.fertig) ueberspringen(); },
    }, teile);
  }

  function nummernKarte(m, erlaubt, wo, brettIndex) {
    const muede = m.fatigue > 60 || m.health < 40;
    const karte = el("div", {
      class: "nummer" + (erlaubt ? "" : " gesperrt") + (muede && wo === "hand" ? " muede" : ""),
      "data-id": m.id,
    },
    el("div", { style: { position: "relative" } }, portrait(m, wo === "brett" ? 44 : 46),
      erlaubt ? null : el("span", { style: { position: "absolute", right: "-4px", bottom: "-2px" } }, symbol("symbol-schloss", 18))),
    el("span", { class: "wer", text: m.name }),
    el("span", { class: "reihe", style: { gap: "4px" } }, symbol(GEFUEHL_BILD[m.feeling], 16), symbol(DISZIPLIN_BILD[m.discipline], 16)));
    if (erlaubt && !ui.vorst.ergebnis) karteZiehbar(karte, m.id, wo, brettIndex);
    return karte;
  }

  // Tippen legt die Karte aufs nächste freie Brett (oder nimmt sie herunter),
  // Ziehen legt sie auf ein bestimmtes Brett.
  function karteZiehbar(karte, id, wo, brettIndex) {
    karte.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const start = stufe(e);
      let geist = null;
      let ziel = null;
      const bewegen = (ev) => {
        const p = stufe(ev);
        if (!geist && Math.hypot(p.x - start.x, p.y - start.y) > 8) {
          geist = karte.cloneNode(true);
          geist.classList.add("geist");
          geist.classList.remove("muede");
          feld.append(geist);
        }
        if (geist) {
          geist.style.left = p.x + "px";
          geist.style.top = p.y + "px";
          geist.style.display = "none";
          const unter = document.elementFromPoint(ev.clientX, ev.clientY);
          geist.style.display = "";
          const brett = unter && unter.closest(".brett");
          if (ziel && ziel !== brett) ziel.classList.remove("ziel");
          ziel = brett;
          if (ziel) ziel.classList.add("ziel");
        }
      };
      const ende = () => {
        window.removeEventListener("pointermove", bewegen);
        window.removeEventListener("pointerup", ende);
        window.removeEventListener("pointercancel", ende);
        const b = ui.vorst.bretter;
        if (geist) {
          geist.remove();
          if (ziel) {
            const i = Number(ziel.dataset.brett);
            const alt = b.indexOf(id);
            if (alt >= 0) b[alt] = b[i];
            b[i] = id;
          } else if (wo === "brett") {
            b[brettIndex] = null;
          }
        } else if (wo === "hand") {
          const frei = b.indexOf(null);
          if (frei >= 0) b[frei] = id;
        } else {
          b[brettIndex] = null;
        }
        zeichnen();
      };
      window.addEventListener("pointermove", bewegen);
      window.addEventListener("pointerup", ende);
      window.addEventListener("pointercancel", ende);
    });
  }

  function vorhangAuf(e) {
    if (e) e.stopPropagation();
    const v = ui.vorst;
    const ids = v.bretter.filter(Boolean);
    if (!ids.length) return;
    v.ergebnis = L.auftreten(s, ids, welt);
    speichern();
    v.gespielt = 0;
    zeichnen();
    const schnell = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const schritt = () => {
      if (ui.vorst !== v || v.fertig) return;
      if (v.gespielt < v.ergebnis.acts.length) {
        v.gespielt += 1;
        zeichnen();
        v.timer = setTimeout(schritt, schnell ? 250 : 1300);
      } else {
        v.fertig = true;
        zeichnen();
      }
    };
    v.timer = setTimeout(schritt, schnell ? 250 : 1300);
  }

  function ueberspringen() {
    const v = ui.vorst;
    clearTimeout(v.timer);
    v.gespielt = v.ergebnis.acts.length;
    v.fertig = true;
    zeichnen();
  }

  function ergebnisTafel(ort) {
    const e = ui.vorst.ergebnis;
    const sterne = Math.max(1, Math.min(5, Math.ceil(e.score / 20)));
    const handel = ort.kind === "monastery" ? null : el("div", { class: "reihe", style: { gap: "12px" } },
      ["food", "wood"].map((ware) => el("button", {
        class: "handel", disabled: !L.kannKaufen(s, ware),
        onclick: (ev) => { ev.stopPropagation(); L.kaufen(s, ware); speichern(); zeichnen(); },
      },
      aenderung("symbol-muenze", -L.HANDEL[ware].preis), "→",
      aenderung(ware === "food" ? "symbol-brot" : "symbol-holz", L.HANDEL[ware].menge))));
    const kopie = leiste();
    kopie.style.position = "static";
    kopie.style.transform = "none";
    return el("div", { class: "schleier", onclick: (ev) => ev.stopPropagation() },
      el("div", { class: "ergebnis" },
        el("div", { class: "sterne", "aria-label": sterne + " von 5 Sternen", text: "★".repeat(sterne) + "☆".repeat(5 - sterne) }),
        el("div", { class: "reihe", style: { gap: "14px" } }, aenderungen(e.reward), e.healing ? aenderung("symbol-pflege", e.healing) : null),
        handel, handel ? kopie : null,
        hauptknopf("Weiter", zurKarte)));
  }

  function zurKarte(e) {
    if (e) e.stopPropagation();
    if (ui.vorst) clearTimeout(ui.vorst.timer);
    ui.vorst = null;
    ui.schirm = L.spielVorbei(s) ? "ende" : "region";
    ui.region = ortHier().region;
    ui.pan = null;
    zeichnen();
  }

  // ---------- Ende ----------

  function endeSchirm() {
    return el("div", { class: "schirm ende" },
      el("h1", { text: "Die Reise endet hier" }),
      el("div", { class: "reihe", style: { gap: "10px", justifyContent: "center" } }, s.troupe.map((m) => portrait(m, 54))),
      el("div", { style: { opacity: ".7" }, text: "Tag " + s.day }),
      hauptknopf("Neu beginnen", () => {
        s = L.neuesSpiel(welt, neuerStartwert());
        speichern();
        Object.assign(ui, { schirm: "region", region: ortHier().region, gewaehlt: null, reise: null, karte: null, pan: null, vorst: null });
        zeichnen();
      }));
  }

  // ---------- Start ----------

  async function start(hot) {
    skalieren();
    const daten = await fetch("welt.json").then((r) => r.json());
    welt = L.welt(daten);
    try {
      const liste = await fetch("grafiken/vorhanden.json").then((r) => (r.ok ? r.json() : []));
      for (const datei of liste) dateien.set(datei.replace(/\.(png|jpe?g|webp)$/i, ""), datei);
    } catch (e) { /* ohne Bilderliste: nur Platzhalter */ }
    s = (hot && hot.s && welt.ort(hot.s.location) && hot.s) || laden() || L.neuesSpiel(welt, neuerStartwert());
    ui.region = ortHier().region;
    if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => ({ s }));
    zeichnen();
  }

  const h = window.claude && window.claude.hot;
  if (h && h.ready) h.ready(start);
  else start(h && h.data ? h.data : {});
})();
