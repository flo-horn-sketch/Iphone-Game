// Oberfläche der Web-Version von "Die Fahrenden".
// Alle Regeln stehen in logik.js, hier wird nur gezeichnet und getippt.
(function () {
  "use strict";

  const L = window.Logik;
  const FELD_B = 844;
  const FELD_H = 390;
  const SPEICHER = "diefahrenden-tour-v1";
  const WAGEN_SPEICHER = "diefahrenden-leichter-wagen";
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
    "symbol-tod": "✝️", "symbol-pflege": "🌿", "symbol-verletzt": "🩹", "symbol-ziel": "🚩",
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

  const BILD_VERSION = "2";
  const bildPfad = (datei) => "grafiken/" + encodeURIComponent(datei) + "?v=" + BILD_VERSION;
  const dateien = new Map(); // Bildname → Dateiname
  const seiten = new Map(); // Bildname → Seitenverhältnis

  const istGross = (name) => /^(karte|buehne|ereignis)-/.test(name);
  const groesse = (name) => (istGross(name) ? "1536 × 1024" : "1024 × 1024");

  function grossesBild(name) {
    const datei = dateien.get(name);
    if (datei) {
      const img = el("img", { class: "bild", src: bildPfad(datei), alt: "", draggable: "false" });
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
    if (datei) s.append(el("img", { src: bildPfad(datei), alt: "", draggable: "false" }));
    else s.textContent = ERSATZ[name] || "▫️";
    return s;
  }

  function ringFarbe(m) {
    if (m.zustand === "tot") return "#777";
    if (m.zustand === "verletzt") return "var(--schlecht)";
    return "var(--gut)";
  }

  function portrait(m, px) {
    const datei = dateien.get(m.portrait);
    const kopf = el("div", { class: "kopf", style: { fontSize: Math.round(px * 0.42) + "px" } });
    if (datei) kopf.append(el("img", { src: bildPfad(datei), alt: "", draggable: "false" }));
    else kopf.textContent = m.name[0];
    const r = 46;
    const umfang = 2 * Math.PI * r;
    const anteil = 1;
    const ring = svg("svg", { viewBox: "0 0 100 100" },
      svg("circle", { cx: 50, cy: 50, r, fill: "none", stroke: "rgba(0,0,0,.35)", "stroke-width": 7 }),
      svg("circle", { cx: 50, cy: 50, r, fill: "none", stroke: ringFarbe(m), "stroke-width": 7, "stroke-linecap": "round", "stroke-dasharray": `${umfang * anteil} ${umfang}` }));
    const tot = m.zustand === "tot";
    const p = el("div", { class: "portrait" + (tot ? " tot" : ""), style: { width: px + "px", height: px + "px" }, title: m.name },
      kopf, ring);
    if (m.zustand === "verletzt") p.append(el("span", { class: "marke" }, symbol("symbol-verletzt", Math.round(px * 0.4))));
    if (tot) p.append(el("span", { class: "marke" }, symbol("symbol-tod", Math.round(px * 0.4))));
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
      return g && g.tour && welt.ort(g.location) ? g : null;
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

  function wagenFrei() {
    if (s && s.tour.status === "gewonnen") return true;
    try { return localStorage.getItem(WAGEN_SPEICHER) === "ja"; } catch (e) { return false; }
  }

  function tourStarten(wagen) {
    s = L.neueTour(welt, neuerStartwert(), wagen);
    Object.assign(ui, { schirm: "region", region: ortHier().region, gewaehlt: null, reise: null, karte: null, pan: null, vorst: null, hinweis: null });
    speichern();
    zeichnen();
  }

  function tourAnkunftWiederherstellen() {
    const h = s.tour.halt;
    if (!h) return;
    const e = h.ereignis && welt.ereignis(h.ereignis);
    if (h.art === "folge" && e) ui.karte = { art: "folge", ereignis: e, folge: h.folge, geheilt: h.geheilt };
    else if (e) ui.karte = { art: "ereignis", ereignis: e, geheilt: h.geheilt };
    else if (h.geheilt.length) ui.karte = { art: "heilung", geheilt: h.geheilt };
    else { ankommen(); return; }
    zeichnen();
  }

  // ---------- Zeichnen ----------

  function zeichnen() {
    feld.replaceChildren();
    if (!s) { feld.append(tourStartSchirm()); return; }
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
    const k = L.kapitel(s, welt);
    return el("div", { class: "leiste" },
      wert("symbol-brot", r.food, r.food < n * 2),
      wert("symbol-muenze", r.coins),
      k ? el("span", { class: "trenner" }) : null,
      k ? zielAnzeige(k) : null,
      s.tour ? el("span", { class: "tour-stand", title: "Winterquartier: " + welt.ort(s.tour.finale).name + " · " + s.tour.ziel + " Applaus im Finale", text: s.tour.schritte + "/" + L.TOUR_LIMIT + " Etappen" }) : null);
  }

  // Kapitelziel: Fähnchen, Zielort und wie viel Gold noch fehlt, als Balken.
  function zielAnzeige(k) {
    const ziel = welt.ort(k.place);
    const anteil = Math.min(1, s.resources.coins / k.coins);
    return el("span", { class: "ziel-anzeige" + (anteil >= 1 ? " voll" : ""), title: k.title },
      symbol("symbol-ziel", 17), symbol(ORT_BILD[ziel.kind], 17),
      el("span", { class: "ziel-balken" }, el("span", { style: { width: anteil * 100 + "%" } })),
      el("span", { class: "ziel-zahl", text: Math.min(s.resources.coins, k.coins) + "/" + k.coins }));
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
          L.RISKANT.has(m.discipline) ? symbol("symbol-gefahr", 16) : null))));
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
      const offen = L.tourWeg(s, weg);
      const vonHier = offen && !ui.reise && (weg.from === s.location || weg.to === s.location);
      const farbe = !offen ? "#9c635c" : vonHier ? "#F3D27A" : "rgba(27,42,43,.85)";
      const strich = !offen ? "3 7" : weg.kind === "forest" ? "10 8" : "none";
      const pos = { x1: a.position.x * 100 + "%", y1: a.position.y * 100 + "%", x2: b.position.x * 100 + "%", y2: b.position.y * 100 + "%" };
      wege.append(svg("line", Object.assign({ stroke: "rgba(0,0,0,.35)", "stroke-width": (vonHier ? 5 : 3) + 3, "stroke-linecap": "round", "stroke-dasharray": strich }, pos)));
      wege.append(svg("line", Object.assign({ stroke: farbe, "stroke-width": vonHier ? 5 : 3, "stroke-linecap": "round", "stroke-dasharray": strich }, pos)));
      const mx = ((a.position.x + b.position.x) / 2) * 100 + "%";
      const my = ((a.position.y + b.position.y) / 2) * 100 + "%";
      wege.append(svg("circle", { cx: mx, cy: my, r: 11, fill: "rgba(13,23,24,.88)", stroke: farbe, "stroke-width": 1.5 }));
      wege.append(svg("text", { x: mx, y: my, dy: "0.35em", "text-anchor": "middle", fill: "#E8EDE6", "font-family": "Cinzel, Georgia, serif", "font-size": 13, "font-weight": 700 }, offen ? String(L.wegKosten(s, weg)) : "×"));
    }
    flaeche.append(wege);

    for (const ort of orte) {
      const hier = ort.id === s.location && !ui.reise;
      const erreichbar = L.tourWeg(s, welt.weg(s.location, ort.id));
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
      }, symbol(ORT_BILD[ort.kind], 44), el("span", { class: "name", text: ort.name }),
      (s.tour ? s.tour.finale === ort.id : L.kapitel(s, welt) && L.kapitel(s, welt).place === ort.id) ? el("span", { class: "fahne" }, symbol("symbol-ziel", 26)) : null,
      s.tour && s.tour.jahrmarkt === ort.id ? el("span", { class: "tour-markt", title: "Jahrmarkt", text: "✦" }) : null));
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
    if (!ui.reise && !ui.karte && !(s.tutorial && s.tutorial.karte)) teile.push(kartenHilfe());
    return el("div", { class: "schirm" }, teile);
  }

  // Erste Reise: Berta erklärt die Karte in einem Satz, eine Hand tippt.
  function kartenHilfe() {
    const berta = L.mitglied(s, "berta") || L.lebende(s)[0];
    const nachbar = welt.nachbarn(s.location).map((id) => welt.ort(id)).filter((o) => o.region === ui.region)
      .sort((a, b) => welt.weg(s.location, a.id).days - welt.weg(s.location, b.id).days)[0];
    const satz = ui.gewaehlt
      ? "Jeder Weg kostet Brot. Im Ort spielen wir, und es gibt neues. Los geht's!"
      : "Wir müssen weiter, das Brot reicht nicht ewig. Tipp einen Ort an.";
    const ziel = ui.gewaehlt ? ".tafel .hauptknopf" : nachbar ? `[data-ort="${nachbar.id}"]` : null;
    const hilfe = el("div", { class: "berta", style: ui.gewaehlt ? { bottom: "auto", top: "52px" } : {} },
      berta ? portrait(berta, 40) : null, el("div", { class: "blase", text: satz }));
    const hand = el("div", { class: "zeigehand", "aria-hidden": "true" }, "👆");
    requestAnimationFrame(() => handBewegen(hand, null, ziel));
    return [hilfe, hand];
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

  // Was zahlt ein Ort? Dorf und Kloster in Brot, Markt und Burg in Gold.
  const LOHN_BILD = { village: ["symbol-brot"], market: ["symbol-muenze"], castle: ["symbol-muenze", "symbol-muenze"], monastery: ["symbol-brot", "symbol-pflege"] };

  function ortTafel(ort) {
    const weg = welt.weg(s.location, ort.id);
    const hier = ort.id === s.location;
    const k = L.kapitel(s, welt);
    const geschmack = el("div", { class: "reihe" },
      ort.likes.map((f) => symbol(GEFUEHL_BILD[f], 24)),
      el("span", { style: { opacity: ".5" }, text: "→" }),
      LOHN_BILD[ort.kind].map((b) => symbol(b, 22)),
      k && k.place === ort.id ? el("span", { class: "aenderung" }, symbol("symbol-ziel", 20), symbol("symbol-muenze", 18), String(k.coins)) : null);
    let unten;
    if (weg && L.tourWeg(s, weg)) {
      const kosten = L.wegKosten(s, weg);
      const zeit = s.tour && L.TOUR_LIMIT - s.tour.schritte - 1;
      const zuSpaet = !!s.tour && L.tourRestweg(s, welt, ort.id) > zeit;
      const vorFinale = s.tour && ort.id === s.tour.finale && s.tour.schritte + 1 < L.TOUR_FINALE_AB;
      unten = [
        el("div", { class: "reihe" },
          aenderung("symbol-brot", -kosten, 20),
          kosten > s.resources.food ? el("span", { class: "minus", text: "Hunger!" }) : null,
          weg.kind === "forest" ? [symbol("symbol-wald", 20), symbol("symbol-gefahr", 18)] : null),
        vorFinale ? el("span", { class: "tour-detail", text: "Das Winterfinale öffnet ab Etappe " + L.TOUR_FINALE_AB + "." }) : null,
        zuSpaet ? el("span", { class: "tour-detail", text: "Danach reicht die Zeit nicht mehr fürs Winterfinale." }) : null,
        el("div", {}, hauptknopf("Aufbrechen", (e) => { e.stopPropagation(); aufbrechen(ort.id); })),
      ];
    } else if (hier) {
      unten = el("div", { class: "reihe" }, symbol("wagen", 28),
        s.tour && s.tour.schritte === 0 && !s.tour.startAuftritt ? hauptknopf("Erste Vorstellung", () => { ui.gewaehlt = null; ankommen(); }) : null);
    } else {
      unten = el("div", { class: "reihe", style: { opacity: ".65" } }, symbol("symbol-schloss", 16), weg ? "Auf dieser Tour gesperrt" : "Kein direkter Weg");
    }
    return el("div", { class: "tafel", onclick: (e) => e.stopPropagation() },
      el("div", { class: "reihe" }, symbol(ORT_BILD[ort.kind], 30),
        el("div", {}, el("h2", { text: ort.name }), el("span", { class: "art", text: L.ORTSART[ort.kind] }))),
      geschmack,
      s.tour && ort.id === s.tour.jahrmarkt ? el("span", { class: "tour-detail", text: "Jahrmarkt: extra Gold für deinen Auftritt." }) : null,
      s.tour && ort.id === s.tour.finale ? el("span", { class: "tour-detail", text: "Winterfinale · " + s.tour.ziel + " Applaus nötig." }) : null,
      unten);
  }

  // ---------- Reise ----------

  function aufbrechen(ziel) {
    if (ui.reise || ui.karte) return;
    const von = s.location;
    let bericht;
    try { bericht = L.reisen(s, ziel, welt); } catch (e) { return; }
    s.tutorial = Object.assign({ karte: false, vorstellung: false }, s.tutorial, { karte: true });
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
    if (r.event) ui.karte = { art: "ereignis", ereignis: r.event, geheilt: r.geheilt };
    else if (r.geheilt.length) ui.karte = { art: "heilung", geheilt: r.geheilt };
    else return ankommen();
    zeichnen();
  }

  function ankommen() {
    ui.karte = null;
    if (L.spielVorbei(s)) {
      if (s.tour) { s.tour.halt = null; speichern(); }
      ui.schirm = "ende";
    } else if (L.zielErreichbar(s, welt)) {
      ui.karte = { art: "ziel", kapitel: L.kapitel(s, welt) };
    } else {
      ui.schirm = "vorstellung";
      if (!s.show) L.showStarten(s, welt);
      speichern();
      ui.vorst = { letzte: null, ergebnis: null };
    }
    zeichnen();
  }

  // ---------- Tafeln: Ereignis, Folgen, Heilung, Kapitel ----------

  function leuteReihe(ids, zeichen) {
    return ids.map((id) => L.mitglied(s, id)).filter(Boolean).map((m) =>
      el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" } },
        portrait(m, 52), el("span", { style: { fontFamily: "var(--titel)", fontSize: "12px" }, text: m.name }), zeichen ? symbol(zeichen, 20) : null));
  }

  function karteSchirm() {
    const k = ui.karte;
    let inhalt;
    if (k.art === "heilung") {
      inhalt = el("div", { class: "bericht" },
        el("div", { class: "reihe" }, symbol("ort-kloster", 30), symbol("symbol-pflege", 30)),
        el("div", { class: "reihe", style: { gap: "14px" } }, leuteReihe(k.geheilt)),
        hauptknopf("Weiter", ankommen));
    } else if (k.art === "ziel" || k.art === "start") {
      const kap = k.kapitel;
      const ort = welt.ort(kap.place);
      const geschafft = k.art === "ziel";
      inhalt = el("div", { class: "bericht kapitel" },
        el("div", { class: "kapitel-nr", text: geschafft ? "Kapitel geschafft!" : "Kapitel " + (s.kapitel + 1) }),
        el("h2", { text: kap.title }),
        geschafft ? el("div", { class: "jubel", text: "🎉" }) : el("p", { text: kap.text }),
        el("div", { class: "reihe", style: { gap: "12px", fontFamily: "var(--titel)", fontSize: "18px" } },
          symbol("symbol-ziel", 26), symbol(ORT_BILD[ort.kind], 30), ort.name, symbol("symbol-muenze", 22), (geschafft ? "−" : "") + kap.coins),
        hauptknopf(geschafft ? "Feiern!" : "Los geht's", () => {
          if (geschafft) {
            L.zielEinloesen(s, welt);
            speichern();
            const naechstes = L.kapitel(s, welt);
            if (naechstes) { ui.karte = { art: "start", kapitel: naechstes, nachZiel: true }; zeichnen(); return; }
            ui.karte = { art: "frei" };
            zeichnen();
            return;
          }
          ui.karte = null;
          if (k.nachZiel) ankommen(); else zeichnen();
        }));
    } else if (k.art === "frei") {
      inhalt = el("div", { class: "bericht kapitel" },
        el("h2", { text: "Die Geschichte ist erzählt" }),
        el("p", { text: "Ab jetzt zieht ihr frei durchs Land, so lange Brot und Glück reichen." }),
        hauptknopf("Weiterziehen", () => { ui.karte = null; ankommen(); }));
    } else {
      const e = k.ereignis;
      const seite = el("div", { class: "seite" }, el("h2", { text: e.title }));
      if (k.art === "ereignis") {
        seite.append(el("p", { text: e.text }), el("div", { class: "luft" }));
        for (const o of e.options) {
          seite.append(el("button", {
            class: "option",
            onclick: () => {
              const folge = L.entscheiden(s, o, e, welt);
              if (s.tour) s.tour.halt = { art: "folge", ereignis: e.id, folge, geheilt: k.geheilt };
              speichern();
              ui.karte = { art: "folge", ereignis: e, folge, geheilt: k.geheilt };
              zeichnen();
            },
          },
          el("span", { class: "label" }, o.label),
          el("span", { class: "reihe" }, folgenSymbole(o.effect))));
        }
      } else {
        const f = k.folge;
        seite.append(el("p", { text: f.outcome }),
          el("div", { class: "reihe" }, aenderungen(f.change),
            f.joined.map((id) => mini(L.mitglied(s, id), "+")),
            f.left.map((id) => mini(welt.troupe.find((m) => m.id === id) || welt.recruits.find((m) => m.id === id), "−")),
            f.hurt.concat(f.deaths).map((id) => portrait(L.mitglied(s, id), 34))),
          el("div", { class: "luft" }),
          el("div", {}, hauptknopf("Weiter", () => {
            if (k.geheilt && k.geheilt.length) { ui.karte = { art: "heilung", geheilt: k.geheilt }; zeichnen(); }
            else ankommen();
          })));
      }
      inhalt = el("div", { class: "ereignis" }, el("div", {}, grossesBild(e.image)), seite);
    }
    return el("div", { class: "schleier" }, inhalt);
  }

  function mini(m, zeichen) {
    if (!m) return null;
    const lebend = Object.assign({ zustand: "fit" }, m);
    return el("span", { class: "aenderung" }, el("span", { class: zeichen === "+" ? "plus" : "minus", text: zeichen }), portrait(lebend, 22));
  }

  function folgenSymbole(e) {
    const teile = aenderungen({ food: e.food || 0, coins: e.coins || 0 });
    if (e.hurt) teile.push(el("span", { class: "aenderung" }, "❔", symbol("symbol-verletzt", 18)));
    if (e.hurtMember) {
      const m = L.mitglied(s, e.hurtMember);
      if (m) teile.push(el("span", { class: "aenderung" }, portrait(m, 22), symbol(m.zustand === "verletzt" ? "symbol-tod" : "symbol-verletzt", 16)));
    }
    if (e.recruit) teile.push(mini(welt.recruits.find((m) => m.id === e.recruit), "+"));
    if (e.removeMember) teile.push(mini(L.mitglied(s, e.removeMember), "−"));
    return teile;
  }

  // ---------- Vorstellung „Noch eine Nummer?“ ----------
  // Das Publikum ruft einen Wunsch. Man tippt eine Figur an, sie tritt auf.
  // Danach: „Noch eine!“ wagen oder den Hut rumgehen lassen.

  const GEDULD_GUT = "🙂";
  const GEDULD_WEG = "😠";

  function vorstellungSchirm() {
    const ort = ortHier();
    const v = ui.vorst;
    const sh = s.show;
    const teile = [
      el("div", { class: "hintergrund" }, grossesBild(BUEHNE_BILD[ort.kind])),
      el("div", { class: "verlauf" }),
      el("div", { class: "kopfzeile" }, symbol(ORT_BILD[ort.kind], 26), el("h1", { text: ort.name }), leiste()),
      L.tourFinale(s) ? el("span", { class: "finale-badge", text: "Winterfinale · " + s.tour.ziel + " Applaus" }) : null,
    ];

    if (!sh) {
      // schon kassiert: nur noch die Ergebnistafel
      if (v.ergebnis) teile.push(ergebnisTafel(ort));
      return el("div", { class: "schirm vorstellung" }, teile);
    }

    const geht = sh.verlaufen;
    teile.push(el("div", { class: "publikum" + (geht ? " geht" : "") },
      PUBLIKUM[ort.kind].map((fig) => el("div", { class: "figur" }, symbol(fig, 26)))));

    // Geduld des Publikums: drei Gesichter, die nach und nach böse werden
    teile.push(el("div", { class: "geduld", "aria-label": "Geduld " + sh.geduld + " von " + L.GEDULD },
      Array.from({ length: L.GEDULD }, (_, i) => el("span", { class: i < sh.geduld ? "" : "weg" + (v.letzte && !v.letzte.passt && i === sh.geduld ? " neu" : ""), text: i < sh.geduld ? GEDULD_GUT : GEDULD_WEG }))));

    // Der Ruf: groß in der Mitte, solange das Publikum auf eine Nummer wartet
    if (sh.offen) {
      teile.push(el("div", { class: "ruf", key: sh.gespielt.length }, symbol(GEFUEHL_BILD[sh.ruf], 54)));
    }

    // Die Bühne zeigt die letzte Nummer mit ihrem Applaus
    if (v.letzte && !sh.offen) {
      const n = v.letzte;
      const m = L.mitglied(s, n.memberID);
      teile.push(el("div", { class: "auftritt" },
        el("div", { class: "nummer gross" + (n.passt ? " passt" : " daneben") },
          el("span", { class: "gefuehl" }, symbol(GEFUEHL_BILD[m.feeling], 26)),
          portrait(m, 58),
          el("span", { class: "wer", text: m.name })),
        el("div", { class: "knall " + (n.passt ? "gut" : "schlecht") },
          n.panne ? symbol("symbol-panne", 30) : n.passt ? symbol("symbol-jubel", 30) : symbol("symbol-gaehnen", 30),
          n.punkte ? "+" + n.punkte : "")));
    }

    // Der Hut mit dem Applaus und der Serie
    teile.push(el("div", { class: "hut" + (sh.vorbei ? "" : " spielt") + (geht ? " leer" : "") },
      el("div", { class: "hut-zahl" }, symbol("symbol-jubel", 24), String(sh.applaus)),
      el("div", { class: "hut-bild" }, "🎩"),
      sh.serie > 1 ? el("div", { class: "serie", key: sh.serie }, "🔥 ×" + sh.serie) : el("div", { class: "hut-text", text: "Applaus" }),
      geht ? el("div", { class: "verlust", text: "−" + sh.verloren }) : null));

    // Die Hand: wer noch auftreten kann, mit Vorschau
    const frei = L.showFrei(s);
    const gespielt = new Set(sh.gespielt);
    teile.push(el("div", { class: "hand" + (sh.offen ? "" : " ruht") },
      L.lebende(s).map((m) => {
        const kann = frei.includes(m);
        return figurKarte(m, kann && sh.offen ? L.showVorschau(s, m) : null, gespielt.has(m.id));
      })));

    const hut = L.hutVorschau(s, welt);
    const auszahlung = [hut.food ? hut.food + " Brot" : "", hut.coins ? hut.coins + " Gold" : ""].filter(Boolean).join(" · ") || "0";
    const impro = L.improvisationsKandidat(s);
    const improKnopf = () => impro && el("button", { class: "zweitknopf", onclick: improvisieren,
      title: "Sicher, einmal pro Vorstellung" }, impro.name + " improvisiert");
    // Knöpfe
    if (sh.vorbei) {
      teile.push(el("div", { class: "entscheiden" },
        geht ? el("div", { class: "schild schlecht", text: "Das Publikum läuft davon!" }) : el("div", { class: "schild", text: "Alle sind aufgetreten" }),
        el("span", { class: "tour-kassiert", text: auszahlung }),
        hauptknopf("🎩 Hut rumgehen lassen", kassieren)));
    } else if (!sh.offen) {
      teile.push(el("div", { class: "entscheiden" },
        sh.naechsterRuf ? el("div", { class: "tour-naechster", "data-next-call": sh.naechsterRuf },
          symbol(GEFUEHL_BILD[sh.naechsterRuf], 20), "Als Nächstes: " + L.GEFUEHL[sh.naechsterRuf]) : null,
        el("button", { class: "hauptknopf wagen-knopf", onclick: nochEine }, "Noch eine!"),
        improKnopf(),
        el("button", { class: "zweitknopf", onclick: kassieren }, "🎩 Hut rumgehen lassen", el("span", { class: "tour-kassiert", text: auszahlung }))));
    } else if (!frei.length) {
      teile.push(el("div", { class: "entscheiden" }, hauptknopf("Weiterziehen", zurKarte)));
    } else if (impro) {
      teile.push(el("div", { class: "entscheiden" }, improKnopf(),
        sh.gespielt.length ? el("button", { class: "zweitknopf", onclick: kassieren }, "🎩 Hut rumgehen lassen", el("span", { class: "tour-kassiert", text: auszahlung })) : null));
    } else if (sh.gespielt.length) {
      teile.push(el("div", { class: "entscheiden" }, el("button", { class: "zweitknopf", onclick: kassieren }, "🎩 Hut rumgehen lassen", el("span", { class: "tour-kassiert", text: auszahlung }))));
    }

    if (!s.tutorial || !s.tutorial.vorstellung) teile.push(bertaHilfe(sh));
    if (v.ergebnis) teile.push(ergebnisTafel(ort));

    return el("div", { class: "schirm vorstellung" }, teile);
  }

  function figurKarte(m, vorschau, schonDran) {
    const karte = el("button", {
      class: "nummer" + (vorschau ? (vorschau.passt ? " passt" : " daneben") : " aus") + (schonDran ? " dran" : ""),
      "data-id": m.id,
      disabled: !vorschau,
      onclick: vorschau ? (e) => { e.stopPropagation(); spielen(m.id); } : null,
    },
    el("span", { class: "gefuehl" }, symbol(GEFUEHL_BILD[m.feeling], 24)),
    portrait(m, 42),
    el("span", { class: "wer", text: m.name }),
    vorschau
      ? el("span", { class: "vorschau " + (vorschau.passt ? "gut" : "schlecht") },
        vorschau.passt ? "+" + vorschau.punkte : GEDULD_WEG,
        vorschau.riskant ? el("span", { class: "nummer-risiko", title: "Pannenrisiko", text: Math.round(vorschau.risiko * 100) + " %" }) : null)
      : el("span", { class: "reihe", style: { gap: "3px" } }, symbol(DISZIPLIN_BILD[m.discipline], 14),
        el("span", { class: "sterne-klein", text: "★".repeat(m.skill) })));
    return karte;
  }

  function spielen(id) {
    const v = ui.vorst;
    if (!s.show || !s.show.offen) return;
    v.letzte = L.showNummer(s, id);
    speichern();
    zeichnen();
  }

  function nochEine(e) {
    if (e) e.stopPropagation();
    L.showWeiter(s, welt);
    ui.vorst.letzte = null;
    speichern();
    zeichnen();
  }

  function improvisieren(e) {
    if (e) e.stopPropagation();
    ui.vorst.letzte = L.showImprovisieren(s, welt);
    speichern();
    zeichnen();
  }

  function kassieren(e) {
    if (e) e.stopPropagation();
    ui.vorst.ergebnis = L.showKassieren(s, welt);
    if (s.tour && s.tour.status === "gewonnen" && !wagenFreiVorSieg()) {
      s.tour.freigeschaltet = true;
      try { localStorage.setItem(WAGEN_SPEICHER, "ja"); } catch (e) { /* optional */ }
    }
    ui.vorst.letzte = null;
    speichern();
    zeichnen();
  }

  function wagenFreiVorSieg() {
    try { return localStorage.getItem(WAGEN_SPEICHER) === "ja"; } catch (e) { return false; }
  }

  // Die alte Gauklerin erklärt die erste Vorstellung mit einem Satz und
  // einer Hand, die zeigt, wohin man tippt.
  function bertaHilfe(sh) {
    const berta = L.mitglied(s, "berta") || L.lebende(s)[0];
    let satz, ziel = null;
    if (sh.offen && !sh.gespielt.length) {
      const passend = L.showFrei(s).find((m) => m.feeling === sh.ruf);
      satz = "Das Publikum ruft, was es sehen will. Schick jemanden, der dazu passt!";
      ziel = passend ? `.hand .nummer[data-id="${passend.id}"]` : ".hand .nummer:not([disabled])";
    } else if (!sh.offen && !sh.vorbei && sh.gespielt.length === 1) {
      satz = "Noch eine wagen? Die Serie bringt immer mehr. Aber sind die Leute dreimal enttäuscht, laufen sie davon.";
      ziel = ".wagen-knopf";
    } else if (sh.offen) {
      satz = "Passt keiner? Dann kannst du einmal pro Vorstellung sicher improvisieren.";
    } else {
      return null;
    }
    const hilfe = el("div", { class: "berta" }, berta ? portrait(berta, 40) : null, el("div", { class: "blase", text: satz }));
    if (!ziel) return hilfe;
    const hand = el("div", { class: "zeigehand", "aria-hidden": "true" }, "👆");
    requestAnimationFrame(() => handBewegen(hand, null, ziel));
    return [hilfe, hand];
  }

  function mitteVon(selektor) {
    const ziel = selektor && feld.querySelector(selektor);
    if (!ziel) return null;
    const r = ziel.getBoundingClientRect();
    const f = feld.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - f.left) / skala, y: (r.top + r.height / 2 - f.top) / skala };
  }

  function handBewegen(hand, von, nach) {
    const a = mitteVon(von), b = mitteVon(nach);
    if (!b) { hand.style.display = "none"; return; }
    const start = a || { x: b.x, y: b.y + 40 };
    hand.style.setProperty("--von-x", start.x + "px");
    hand.style.setProperty("--von-y", start.y + "px");
    hand.style.setProperty("--nach-x", b.x + "px");
    hand.style.setProperty("--nach-y", b.y + "px");
    hand.classList.add(a ? "zieht" : "tippt");
  }


  function ergebnisTafel(ort) {
    const e = ui.vorst.ergebnis;
    const markt = [];
    const t = s.tour;
    const weiter = !t || !t.angebot.length;
    if ((!t || t.status === "unterwegs") && (ort.kind === "village" || ort.kind === "market")) {
      markt.push(el("button", {
        class: "handel", disabled: !L.kannBrotKaufen(s, ort),
        onclick: (ev) => { ev.stopPropagation(); L.brotKaufen(s, ort); speichern(); zeichnen(); },
      }, aenderung("symbol-muenze", -L.BROT_KAUF.preis), "→", aenderung("symbol-brot", L.BROT_KAUF.menge)));
    }
    const b = (!t || t.status === "unterwegs") && L.bewerber(s, welt);
    if (b) {
      markt.push(el("button", {
        class: "handel bewerber", disabled: s.resources.coins < b.price,
        onclick: (ev) => { ev.stopPropagation(); L.anwerben(s, welt); speichern(); zeichnen(); },
      },
      el("span", { class: "plus", text: "+" }),
      portrait(Object.assign({ zustand: "fit" }, b), 40),
      el("span", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1px" } },
        el("span", { style: { fontFamily: "var(--titel)", fontSize: "13px" }, text: b.name }),
        el("span", { class: "reihe", style: { gap: "3px" } }, symbol(GEFUEHL_BILD[b.feeling], 16), symbol(DISZIPLIN_BILD[b.discipline], 14),
          el("span", { class: "sterne-klein", text: "★".repeat(b.skill) }))),
      aenderung("symbol-muenze", -b.price)));
    }
    const kopie = leiste();
    kopie.style.position = "static";
    kopie.style.transform = "none";
    return el("div", { class: "schleier", onclick: (ev) => ev.stopPropagation() },
      el("div", { class: "ergebnis" },
        el("div", { class: "sterne", "aria-label": e.sterne + " von 5 Sternen", text: "★".repeat(e.sterne) + "☆".repeat(5 - e.sterne) }),
        el("div", { class: "reihe", style: { gap: "6px", fontFamily: "var(--titel)", fontSize: "20px" } }, "🎩", symbol("symbol-jubel", 24), String(e.applaus), el("span", { style: { opacity: ".6" }, text: "→" }), aenderungen(e.reward)),
        markt.length ? el("div", { class: "reihe", style: { gap: "12px", justifyContent: "center" } }, markt) : null,
        markt.length ? kopie : null,
        t && t.auszahlung.finale ? el("p", { class: "tour-detail", text: t.auszahlung.erfolg ? "Das Winterquartier öffnet seine Tore." : "Finale: " + t.auszahlung.applaus + "/" + t.ziel + " Applaus." }) : null,
        t && t.angebot.length ? el("div", { class: "tour-perks" },
          el("strong", { text: "Wähle eine Verbesserung für diese Tour" }),
          el("div", { class: "tour-perk-paar" }, t.angebot.map((id) =>
            el("button", { class: "zweitknopf", "data-perk": id, onclick: () => { L.tourVerbessern(s, id); speichern(); zeichnen(); } },
              el("strong", { text: L.VERBESSERUNGEN[id].name }), el("span", { text: L.VERBESSERUNGEN[id].text }))))) : null,
        t && t.perks.length && weiter ? el("p", { class: "tour-detail", text: "Aktiv: " + t.perks.map((id) => L.VERBESSERUNGEN[id].name).join(" · ") }) : null,
        hauptknopf(t && t.status !== "unterwegs" ? "Tour abschließen" : "Weiter", zurKarte, !weiter)));
  }

  function zurKarte(e) {
    if (e) e.stopPropagation();
    if (ui.vorst) clearTimeout(ui.vorst.timer);
    if (s.tour && s.tour.auszahlung) {
      if (s.tour.angebot.length) return;
      L.tourAufbruch(s);
    } else if (s.tour && s.show && !L.showFrei(s).length && !s.show.gespielt.length) {
      L.tourOhneAuftritt(s);
    }
    ui.vorst = null;
    s.show = null;
    speichern();
    ui.schirm = L.spielVorbei(s) ? "ende" : "region";
    ui.region = ortHier().region;
    ui.pan = null;
    zeichnen();
  }

  // ---------- Ende ----------

  function tourStartSchirm() {
    const frei = wagenFrei();
    const wagenBild = dateien.get("wagen");
    return el("div", { class: "schirm ende tour-start" },
      wagenBild ? el("img", { class: "tour-start-art", src: bildPfad(wagenBild), alt: "" }) : null,
      el("div", { class: "kapitel-nr", text: "Die Fahrenden" }),
      el("h1", { text: "Die Wintertour" }),
      el("p", { text: "Sechs Etappen. Spiel ab Etappe fünf im Kloster St. Ilgen um dein Winterquartier. Wege und Jahrmarkt wechseln bei jeder Tour." }),
      el("div", { class: "tour-perk-paar" }, Object.entries(L.WAGEN).map(([id, wagen]) =>
        el("button", { class: "zweitknopf tour-wagen", disabled: id === "leicht" && !frei, "data-wagen": id,
          onclick: () => tourStarten(id) }, el("strong", { text: wagen.name }),
          el("span", { text: id === "leicht" && !frei ? "Nach deiner ersten erfolgreichen Tour." : wagen.text })))));
  }

  function endeSchirm() {
    const sieg = s.tour.status === "gewonnen";
    return el("div", { class: "schirm ende tour-start" },
      el("div", { class: "kapitel-nr", text: "Ende der Tour" }),
      el("h1", { text: sieg ? "Das Winterquartier ist erreicht!" : "Die Tour endet hier" }),
      el("p", { text: sieg ? s.tour.freigeschaltet ? "Freigeschaltet: der leichtere Wagen." : "Deine Truppe hat es geschafft." :
        L.lebende(s).length ? "Bis zum Winterfinale hat es diesmal nicht gereicht." : "Die Truppe ist auseinandergegangen." }),
      el("div", { class: "reihe", style: { gap: "10px", justifyContent: "center" } }, s.troupe.map((m) => portrait(m, 54))),
      hauptknopf("Neue Tour", () => {
        if (sieg) try { localStorage.setItem(WAGEN_SPEICHER, "ja"); } catch (e) { /* optional */ }
        s = null;
        try { localStorage.removeItem(SPEICHER); } catch (e) { /* optional */ }
        ui.karte = null;
        zeichnen();
      }));
  }

  // ---------- Start ----------

  async function start(hot) {
    skalieren();
    const daten = await fetch("welt.json").then((r) => r.json());
    welt = L.welt(daten);
    try {
      const liste = await fetch("grafiken/vorhanden.json?v=" + BILD_VERSION, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : []));
      for (const datei of liste) dateien.set(datei.replace(/\.(png|jpe?g|webp)$/i, ""), datei);
    } catch (e) { /* ohne Bilderliste: nur Platzhalter */ }
    s = (hot && hot.s && hot.s.tour && welt.ort(hot.s.location) && hot.s) || laden();
    if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => ({ s }));
    if (!s) { zeichnen(); return; }
    ui.region = ortHier().region;
    if (s.show || s.tour.auszahlung) {
      ui.schirm = "vorstellung";
      ui.vorst = { letzte: null, ergebnis: s.tour.auszahlung };
    } else if (L.spielVorbei(s)) {
      ui.schirm = "ende";
    } else if (s.tour.halt) {
      tourAnkunftWiederherstellen();
      return;
    }
    zeichnen();
  }

  const h = window.claude && window.claude.hot;
  if (h && h.ready) h.ready(start);
  else start(h && h.data ? h.data : {});
})();
