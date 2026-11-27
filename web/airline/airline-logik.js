// Spielregeln von "Luftlinie", dem Airline-Manager. Ohne Bildschirm, damit sie sich testen lassen.
//
// Du führst eine Airline in Europa. Die Zeit läuft: Flugzeuge fliegen Routen,
// jede Landung bringt Geld. Nachfrage hängt von Städten, Wochentag, Jahreszeit
// und Messen ab. Vier Airlines (du und drei Rivalen) teilen sich die Fluggäste.
// Alle Airlines rechnen nach denselben Regeln, auch die Rivalen.
(function (wurzel, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik();
  else wurzel.AirLogik = fabrik();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SPIELER = "p";

  // Alle Stellschrauben an einem Ort, damit das Balancing leicht fällt.
  const REGELN = {
    betriebsStunden: 20,     // so lange am Tag wird geflogen
    nachfrage: 7.5,          // Fluggäste pro Richtung und Tag = nachfrage × Größe A × Größe B
    grundpreis: 85,          // Ticket = grundpreis + proKm × Entfernung
    proKm: 0.11,
    gebuehr: { 1: 700, 2: 2200, 3: 4800 },       // pro Landung, mal Flugzeuggröße
    slotPreis: { 1: 40000, 2: 200000, 3: 500000 },
    slotPlaetze: { 1: 99, 2: 16, 3: 10 },          // so viele Slots gibt es je Flughafen für alle zusammen
    slotAufschlag: 1.5,      // Slots werden teurer, je weniger frei sind
    drehkreuzAb: 3,          // ab so vielen eigenen Routen steigen in einer Stadt Leute um
    umsteigerAnteil: 0.32,
    umwegMax: 1.6,           // Umsteigen nur, wenn der Umweg nicht zu groß ist
    startGeld: 2500000,
    startSlots: 2,
    rufStart: 50,
    rufMax: 90,
    rufWechsel: 30,          // so viel Ruf kostet ein Wechsel der Servicelinie
    wechselKosten: 1500000,
    saisonTage: 7,           // eine Jahreszeit dauert eine Woche, ein Jahr 28 Tage
    slotGutAb: 0.5,          // ab dieser Auslastung behält man Slots nach der Saison
    ersteSlotPruefung: 14,
    verkaufAnteil: 0.6,      // ein Flugzeug bringt beim Verkauf so viel vom Neupreis
    kreditZins: 0.012,       // pro Tag
    mahnTage: 2,
    letzteChanceTage: 3,
    stufe2Wert: 30000000,    // Firmenwert für größere Flugzeuge
    gelegenheitAb: 2,
    dividende: 0.6,          // Anteil am Tagesgewinn, den Rivalen nicht wieder anlegen
  };

  // Drei Servicelinien. Jede hat eine eigene Stärke.
  const SERVICE = {
    billig: {
      name: "Billig", icon: "🪙", farbe: "#F2B33D",
      sitze: 1.3, preis: 0.66, kosten: 2, wende: 0.4, betrieb: 0.85,
      gast: { urlaub: 2.4, geschaeft: 0.45 }, umsteiger: 0.8,
      staerke: "Enge Sitze, schnelle Wende: mehr Flüge am Tag.",
    },
    standard: {
      name: "Standard", icon: "✈️", farbe: "#7FC4E8",
      sitze: 1.0, preis: 1.0, kosten: 9, wende: 0.9, betrieb: 1,
      gast: { urlaub: 1.0, geschaeft: 1.0 }, umsteiger: 1.5,
      staerke: "Die meisten Umsteiger an deinen Drehkreuzen.",
    },
    premium: {
      name: "Premium", icon: "🥂", farbe: "#C9A0F0",
      sitze: 0.76, preis: 1.45, kosten: 20, wende: 1.1, betrieb: 1.05,
      gast: { urlaub: 0.5, geschaeft: 1.5 }, umsteiger: 1.0, treu: true,
      staerke: "Geschäftsreisende bleiben auch bei hohen Preisen.",
    },
  };

  // Preis pro Route: angreifen, normal, abschöpfen.
  const STUFEN = {
    angreifen: { name: "Angreifen", icon: "⬇", preis: 0.82, urlaub: 1.4, geschaeft: 1.12 },
    normal: { name: "Normal", icon: "●", preis: 1.0, urlaub: 1.0, geschaeft: 1.0 },
    abschoepfen: { name: "Abschöpfen", icon: "⬆", preis: 1.25, urlaub: 0.55, geschaeft: 0.82, geschaeftTreu: 0.98 },
  };

  // Erfundene Flugzeugtypen.
  const TYPEN = {
    libelle: { name: "Libelle 50", sitze: 50, kmh: 480, reichweite: 1400, preis: 600000, verbrauch: 1.6, groesse: 0.45, crew: 2500, stufe: 1 },
    falke: { name: "Falke 130", sitze: 130, kmh: 790, reichweite: 3300, preis: 1400000, verbrauch: 3.6, groesse: 1.0, crew: 5500, stufe: 1 },
    kranich: { name: "Kranich 190", sitze: 190, kmh: 820, reichweite: 5000, preis: 2400000, verbrauch: 4.9, groesse: 1.35, crew: 7500, stufe: 2 },
    albatros: { name: "Albatros 320", sitze: 320, kmh: 900, reichweite: 13000, preis: 5500000, verbrauch: 8.2, groesse: 2.1, crew: 13000, stufe: 3 },
  };

  // Städte: g = Größe (Nachfrage), w = Anteil Geschäftsreisende, k = Flughafenklasse
  // (3 Weltdrehkreuz, 2 Großflughafen, 1 Regionalflughafen), t = sonne/schnee.
  const STAEDTE = [
    { id: "london", name: "London", lon: -0.45, lat: 51.47, g: 10, w: 0.5, k: 3 },
    { id: "paris", name: "Paris", lon: 2.55, lat: 49.01, g: 9.5, w: 0.45, k: 3 },
    { id: "frankfurt", name: "Frankfurt", lon: 8.57, lat: 50.03, g: 8, w: 0.55, k: 3 },
    { id: "amsterdam", name: "Amsterdam", lon: 4.76, lat: 52.31, g: 8, w: 0.45, k: 3 },
    { id: "madrid", name: "Madrid", lon: -3.57, lat: 40.49, g: 8, w: 0.4, k: 3 },
    { id: "istanbul", name: "Istanbul", lon: 28.75, lat: 41.27, g: 9, w: 0.35, k: 3 },
    { id: "muenchen", name: "München", lon: 11.79, lat: 48.35, g: 6.5, w: 0.5, k: 2 },
    { id: "rom", name: "Rom", lon: 12.25, lat: 41.8, g: 7, w: 0.3, k: 2, t: "sonne" },
    { id: "barcelona", name: "Barcelona", lon: 2.08, lat: 41.3, g: 7, w: 0.3, k: 2, t: "sonne" },
    { id: "zuerich", name: "Zürich", lon: 8.55, lat: 47.46, g: 5, w: 0.6, k: 2, t: "schnee" },
    { id: "wien", name: "Wien", lon: 16.57, lat: 48.11, g: 5.5, w: 0.45, k: 2 },
    { id: "kopenhagen", name: "Kopenhagen", lon: 12.65, lat: 55.62, g: 5.5, w: 0.45, k: 2 },
    { id: "dublin", name: "Dublin", lon: -6.27, lat: 53.43, g: 5, w: 0.4, k: 2 },
    { id: "lissabon", name: "Lissabon", lon: -9.13, lat: 38.77, g: 5.5, w: 0.3, k: 2, t: "sonne" },
    { id: "mailand", name: "Mailand", lon: 8.72, lat: 45.63, g: 6.5, w: 0.5, k: 2 },
    { id: "bruessel", name: "Brüssel", lon: 4.48, lat: 50.9, g: 5, w: 0.6, k: 2 },
    { id: "stockholm", name: "Stockholm", lon: 17.92, lat: 59.65, g: 5, w: 0.45, k: 2 },
    { id: "athen", name: "Athen", lon: 23.94, lat: 37.94, g: 5.5, w: 0.25, k: 2, t: "sonne" },
    { id: "berlin", name: "Berlin", lon: 13.5, lat: 52.37, g: 7, w: 0.4, k: 2 },
    { id: "warschau", name: "Warschau", lon: 20.97, lat: 52.17, g: 5, w: 0.4, k: 2 },
    { id: "oslo", name: "Oslo", lon: 11.1, lat: 60.19, g: 4.5, w: 0.45, k: 2, t: "schnee" },
    { id: "hamburg", name: "Hamburg", lon: 9.99, lat: 53.63, g: 4.5, w: 0.45, k: 1 },
    { id: "duesseldorf", name: "Düsseldorf", lon: 6.77, lat: 51.29, g: 4, w: 0.5, k: 1 },
    { id: "stuttgart", name: "Stuttgart", lon: 9.22, lat: 48.69, g: 3.5, w: 0.5, k: 1 },
    { id: "manchester", name: "Manchester", lon: -2.27, lat: 53.35, g: 4.5, w: 0.35, k: 1 },
    { id: "edinburgh", name: "Edinburgh", lon: -3.37, lat: 55.95, g: 3, w: 0.35, k: 1 },
    { id: "lyon", name: "Lyon", lon: 5.08, lat: 45.73, g: 3, w: 0.45, k: 1, t: "schnee" },
    { id: "nizza", name: "Nizza", lon: 7.21, lat: 43.66, g: 3.5, w: 0.25, k: 1, t: "sonne" },
    { id: "palma", name: "Palma", lon: 2.73, lat: 39.55, g: 4, w: 0.1, k: 1, t: "sonne" },
    { id: "malaga", name: "Málaga", lon: -4.49, lat: 36.67, g: 4, w: 0.1, k: 1, t: "sonne" },
    { id: "porto", name: "Porto", lon: -8.68, lat: 41.24, g: 3, w: 0.25, k: 1, t: "sonne" },
    { id: "neapel", name: "Neapel", lon: 14.29, lat: 40.88, g: 3, w: 0.2, k: 1, t: "sonne" },
    { id: "venedig", name: "Venedig", lon: 12.35, lat: 45.5, g: 3.5, w: 0.2, k: 1 },
    { id: "prag", name: "Prag", lon: 14.26, lat: 50.1, g: 4, w: 0.35, k: 1 },
    { id: "budapest", name: "Budapest", lon: 19.26, lat: 47.44, g: 3.5, w: 0.35, k: 1 },
    { id: "krakau", name: "Krakau", lon: 19.78, lat: 50.08, g: 2.5, w: 0.3, k: 1 },
    { id: "salzburg", name: "Salzburg", lon: 13.0, lat: 47.79, g: 2, w: 0.2, k: 1, t: "schnee" },
    { id: "innsbruck", name: "Innsbruck", lon: 11.34, lat: 47.26, g: 2, w: 0.15, k: 1, t: "schnee" },
    { id: "genf", name: "Genf", lon: 6.11, lat: 46.24, g: 3, w: 0.5, k: 1, t: "schnee" },
    { id: "split", name: "Split", lon: 16.3, lat: 43.54, g: 2.5, w: 0.1, k: 1, t: "sonne" },
    { id: "kreta", name: "Kreta", lon: 25.18, lat: 35.34, g: 3, w: 0.05, k: 1, t: "sonne" },
    { id: "helsinki", name: "Helsinki", lon: 24.96, lat: 60.32, g: 3.5, w: 0.45, k: 1, t: "schnee" },
    { id: "bukarest", name: "Bukarest", lon: 26.08, lat: 44.57, g: 3.5, w: 0.35, k: 1 },
  ];
  // Die Welt jenseits von Europa öffnet sich auf Platz 1.
  const WELT = [
    { id: "newyork", name: "New York", lon: -73.78, lat: 40.64, g: 12, w: 0.5, k: 3, welt: true },
    { id: "saopaulo", name: "São Paulo", lon: -46.47, lat: -23.43, g: 9, w: 0.35, k: 3, welt: true },
    { id: "kairo", name: "Kairo", lon: 31.4, lat: 30.12, g: 7, w: 0.3, k: 3, welt: true, t: "sonne" },
    { id: "dubai", name: "Dubai", lon: 55.36, lat: 25.25, g: 11, w: 0.45, k: 3, welt: true },
    { id: "singapur", name: "Singapur", lon: 103.99, lat: 1.36, g: 10, w: 0.5, k: 3, welt: true },
    { id: "tokio", name: "Tokio", lon: 139.78, lat: 35.55, g: 12, w: 0.55, k: 3, welt: true },
  ];
  const ALLE = STAEDTE.concat(WELT);
  const STADT = Object.fromEntries(ALLE.map((s) => [s.id, s]));

  // Saisonfaktor für Urlauber.
  const SAISONEN = [
    { name: "Frühling", icon: "🌱", sonne: 1.0, schnee: 0.8 },
    { name: "Sommer", icon: "☀️", sonne: 1.75, schnee: 0.7 },
    { name: "Herbst", icon: "🍂", sonne: 0.9, schnee: 0.85 },
    { name: "Winter", icon: "❄️", sonne: 0.6, schnee: 1.9 },
  ];
  const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Die Rivalen, jeder mit eigenem Stil. Namen und Gesichter sind erfunden.
  const RIVALEN = {
    k: {
      name: "Kontinentia", chef: "Harald Brenner", farbe: "#E0574F", service: "standard", basis: "paris", ersatz: "frankfurt",
      stil: "platzhirsch", geld: 9000000, start: 7, text: "Der Platzhirsch: alt, groß, sitzt auf den besten Slots.",
      sprueche: { gross: "Die guten Slots? Längst vergeben.", gegen: "Junge Airlines kommen und gehen.", verliert: "Hm. Sie sind hartnäckiger als gedacht." },
    },
    s: {
      name: "Spatzflug", chef: "Bruno Kiesel", farbe: "#F08A24", service: "billig", basis: "barcelona", ersatz: "mailand",
      stil: "billig", geld: 3000000, start: 4, text: "Der Billigflieger: kleine Flughäfen, volle Flieger, Kampfpreise.",
      sprueche: { gross: "Für 19 Euro nach Mallorca. Mach das mal nach!", gegen: "Ich unterbiete dich überall.", verliert: "Gut, gut. Ich fliege halt woanders hin." },
    },
    a: {
      name: "Aurelia", chef: "Valérie Morand", farbe: "#B388EB", service: "premium", basis: "zuerich", ersatz: "wien",
      stil: "premium", geld: 5000000, start: 3, text: "Die Edle: wenige Strecken, reiche Städte, hohe Preise.",
      sprueche: { gross: "Qualität hat ihren Preis.", gegen: "Ihre Gäste werden zu mir wechseln.", verliert: "Respekt. Das hätte ich nicht erwartet." },
    },
  };
  const NAMEN = [
    { name: "Nordwind", farbe: "#4FD1A5" },
    { name: "Silberfalke", farbe: "#6EC6FF" },
    { name: "Morgenrot", farbe: "#FF7FA8" },
  ];
  const HEIMAT = ["london", "paris", "frankfurt", "amsterdam", "madrid", "istanbul", "muenchen", "berlin", "rom", "wien"];

  // ---------- Zufall (mit Startwert, damit Partien nachspielbar sind) ----------
  function zufall(st) {
    st.rng = (st.rng + 0x6d2b79f5) | 0;
    let t = st.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const waehle = (st, liste) => liste[Math.floor(zufall(st) * liste.length)];

  // ---------- Grundlagen ----------
  const cache = new WeakMap();
  function geaendert(st) { st.stand = (st.stand || 0) + 1; }

  const entfernungen = {};
  function entfernung(a, b) {
    const k = a < b ? a + "|" + b : b + "|" + a;
    if (entfernungen[k] != null) return entfernungen[k];
    const A = STADT[a], B = STADT[b];
    const r = Math.PI / 180;
    const h = Math.sin(((B.lat - A.lat) * r) / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(((B.lon - A.lon) * r) / 2) ** 2;
    return (entfernungen[k] = Math.round(2 * 6371 * Math.asin(Math.sqrt(h))));
  }
  const paar = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const tagVon = (st) => Math.floor(st.zeit / 24) + 1;
  const wochentag = (tag) => (tag - 1) % 7;
  const saison = (tag) => SAISONEN[Math.floor((tag - 1) / REGELN.saisonTage) % 4];
  const ticket = (km) => REGELN.grundpreis + REGELN.proKm * km;

  function staedte(st) { return st.welt ? ALLE : STAEDTE; }

  function stadtFaktor(s, sai) { return s.t ? sai[s.t] : 1; }
  function entfernungsFaktor(km) {
    if (km < 250) return 0.35;              // da fährt man Zug
    if (km < 600) return 0.35 + 0.65 * (km - 250) / 350;
    if (km < 1200) return 1;
    return Math.max(0.45, 1 - (km - 1200) / 4000);
  }

  // Grundnachfrage pro Richtung und Tag, getrennt nach Urlaubern und Geschäftsreisenden.
  function grundNachfrage(st, a, b, tag) {
    const A = STADT[a], B = STADT[b];
    const km = entfernung(a, b);
    const basis = REGELN.nachfrage * A.g * B.g * entfernungsFaktor(km) / (A.welt || B.welt ? 1.6 : 1);
    const wt = wochentag(tag), sai = saison(tag);
    const w = (A.w + B.w) / 2;
    let geschaeft = basis * w * (wt < 5 ? 1.22 : 0.45);
    let urlaub = basis * (1 - w) * (wt < 5 ? 0.86 : 1.4) * Math.min(2, stadtFaktor(A, sai) * stadtFaktor(B, sai));
    for (const m of st.messen) {
      if (tag >= m.von && tag <= m.bis && (m.stadt === a || m.stadt === b)) geschaeft *= 2.6;
    }
    return { urlaub, geschaeft };
  }

  // ---------- Neues Spiel ----------
  function neueAirline(id, d) {
    return {
      id, name: d.name, farbe: d.farbe, service: d.service, basis: d.basis, stil: d.stil || null,
      ruf: REGELN.rufStart, geld: d.geld, kredit: 0, slots: {}, flotte: [], routen: [], naechste: 1,
      wechselBis: 0, verlauf: [],
    };
  }

  function neuesSpiel(opt) {
    opt = opt || {};
    const st = {
      version: 1, zeit: 6, rng: (opt.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
      kerosin: 1, kerosinBis: 0, messen: [], gelegenheiten: [], meldungen: [], naechsteGel: 1,
      welt: false, platz1: false, stufe: 1, pleite: { stufe: 0, tage: 0 }, ende: null,
      airlines: {}, reihenfolge: [SPIELER, "k", "s", "a"], letzterTag: null, stand: 0,
    };
    const basis = opt.basis || "frankfurt";
    const name = opt.name || NAMEN[0];
    const p = neueAirline(SPIELER, { name: name.name, farbe: name.farbe, service: opt.service || "standard", basis, geld: REGELN.startGeld });
    p.slots[basis] = REGELN.startSlots;
    flugzeugHinzu(p, "falke");
    st.airlines[SPIELER] = p;
    for (const [id, r] of Object.entries(RIVALEN)) {
      const b = r.basis === basis ? r.ersatz : r.basis;
      const a = neueAirline(id, { name: r.name, farbe: r.farbe, service: r.service, basis: b, stil: r.stil, geld: r.geld });
      a.slots[b] = 3;
      st.airlines[id] = a;
    }
    // Rivalen starten mit einem kleinen Netz.
    for (const id of ["k", "s", "a"]) {
      const a = st.airlines[id];
      for (let i = 0; i < RIVALEN[id].start; i++) {
        a.geld += 8000000;
        kiAusbauen(st, id, { start: true });
      }
    }
    for (const id of ["k", "s", "a"]) {
      const a = st.airlines[id];
      a.geld = RIVALEN[id].geld;
    }
    // Der Platzhirsch hortet Slots an den Weltdrehkreuzen.
    const k = st.airlines.k;
    for (const s of STAEDTE.filter((x) => x.k === 3)) {
      while ((k.slots[s.id] || 0) < 3 && slotsFrei(st, s.id) > 4) k.slots[s.id] = (k.slots[s.id] || 0) + 1;
    }
    geaendert(st);
    return st;
  }

  // ---------- Flotte, Slots, Routen ----------
  function flugzeugHinzu(a, typ) {
    const f = { id: a.id + "f" + a.naechste++, typ, route: null };
    a.flotte.push(f);
    return f;
  }
  const flugzeugeAuf = (a, rid) => a.flotte.filter((f) => f.route === rid);
  const freieFlugzeuge = (a) => a.flotte.filter((f) => !f.route);
  function slotsBelegt(st, stadt) {
    let n = 0;
    for (const id of st.reihenfolge) n += st.airlines[id].slots[stadt] || 0;
    return n;
  }
  function slotsFrei(st, stadt) { return REGELN.slotPlaetze[STADT[stadt].k] - slotsBelegt(st, stadt); }
  function slotPreis(st, stadt) {
    const k = STADT[stadt].k;
    const anteil = slotsBelegt(st, stadt) / REGELN.slotPlaetze[k];
    return Math.round(REGELN.slotPreis[k] * (1 + REGELN.slotAufschlag * Math.min(1, anteil)) / 10000) * 10000;
  }
  function slotsGenutzt(a, stadt) {
    let n = 0;
    for (const r of a.routen) if (r.a === stadt || r.b === stadt) n += flugzeugeAuf(a, r.id).length;
    return n;
  }
  const slotsUebrig = (a, stadt) => (a.slots[stadt] || 0) - slotsGenutzt(a, stadt);
  function typFrei(st, a, typ) {
    const t = TYPEN[typ];
    if (a.id !== SPIELER) return t.stufe < 3 || st.welt;
    return t.stufe <= st.stufe;
  }
  function routeVon(a, x, y) { return a.routen.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x)); }

  // Was kostet es, einer Route ein Flugzeug dazuzugeben (oder sie zu eröffnen)?
  function kostenFuer(st, aid, x, y, typ) {
    const a = st.airlines[aid];
    const frei = freieFlugzeuge(a).find((f) => f.typ === typ);
    let slots = 0, slotFehlt = false;
    for (const s of [x, y]) {
      if (slotsUebrig(a, s) > 0) continue;
      if (slotsFrei(st, s) <= 0) slotFehlt = true;
      slots += slotPreis(st, s);
    }
    const flugzeug = frei ? 0 : TYPEN[typ].preis;
    return { flugzeug, slots, gesamt: flugzeug + slots, slotFehlt, frei: !!frei };
  }

  function kannFliegen(st, aid, x, y, typ) {
    if (x === y) return { ok: false, grund: "gleich" };
    const a = st.airlines[aid];
    if (!typFrei(st, a, typ)) return { ok: false, grund: "gesperrt" };
    if (entfernung(x, y) > TYPEN[typ].reichweite) return { ok: false, grund: "reichweite" };
    if ((STADT[x].welt || STADT[y].welt) && !st.welt) return { ok: false, grund: "welt" };
    const k = kostenFuer(st, aid, x, y, typ);
    if (k.slotFehlt) return { ok: false, grund: "slots", kosten: k };
    if (k.gesamt > a.geld) return { ok: false, grund: "geld", kosten: k };
    return { ok: true, kosten: k };
  }

  // Eröffnet eine Route oder setzt ein weiteres Flugzeug darauf.
  function fliegen(st, aid, x, y, typ, opt) {
    const test = kannFliegen(st, aid, x, y, typ);
    if (!test.ok) return test;
    const a = st.airlines[aid];
    const k = test.kosten;
    for (const s of [x, y]) {
      if (slotsUebrig(a, s) > 0) continue;
      a.slots[s] = (a.slots[s] || 0) + 1;
    }
    a.geld -= k.gesamt;
    let f = freieFlugzeuge(a).find((z) => z.typ === typ);
    if (!f) f = flugzeugHinzu(a, typ);
    let r = routeVon(a, x, y);
    if (!r) {
      r = { id: a.id + "r" + a.naechste++, a: x, b: y, stufe: (opt && opt.stufe) || "normal", seit: tagVon(st), auslastung: null, minus: 0 };
      a.routen.push(r);
    }
    f.route = r.id;
    f.ab = st.zeit;
    geaendert(st);
    return { ok: true, route: r, flugzeug: f, kosten: k };
  }

  // Nimmt ein Flugzeug von der Route. Das letzte schließt sie. Slots bleiben bis Saisonende.
  function abziehen(st, aid, rid) {
    const a = st.airlines[aid];
    const fs = flugzeugeAuf(a, rid);
    if (!fs.length) return false;
    fs[fs.length - 1].route = null;
    if (fs.length === 1) a.routen = a.routen.filter((r) => r.id !== rid);
    geaendert(st);
    return true;
  }
  function routeSchliessen(st, aid, rid) {
    while (abziehen(st, aid, rid));
  }
  function verkaufen(st, aid, fid) {
    const a = st.airlines[aid];
    const f = a.flotte.find((z) => z.id === fid);
    if (!f || f.route) return false;
    a.flotte = a.flotte.filter((z) => z !== f);
    a.geld += Math.round(TYPEN[f.typ].preis * REGELN.verkaufAnteil);
    geaendert(st);
    return true;
  }
  function kaufen(st, aid, typ, preis) {
    const a = st.airlines[aid];
    preis = preis ?? TYPEN[typ].preis;
    if (a.geld < preis || !typFrei(st, a, typ)) return null;
    a.geld -= preis;
    geaendert(st);
    return flugzeugHinzu(a, typ);
  }
  function preisStufe(st, aid, rid, stufe) {
    const r = st.airlines[aid].routen.find((x) => x.id === rid);
    if (!r || !STUFEN[stufe]) return false;
    r.stufe = stufe;
    geaendert(st);
    return true;
  }
  function serviceWechseln(st, aid, service) {
    const a = st.airlines[aid];
    if (a.service === service || a.geld < REGELN.wechselKosten) return false;
    a.geld -= REGELN.wechselKosten;
    a.service = service;
    a.ruf = Math.max(5, a.ruf - REGELN.rufWechsel);
    geaendert(st);
    return true;
  }

  // ---------- Flugbetrieb ----------
  function umlauf(typ, km, service) {
    const t = TYPEN[typ];
    const flug = km / t.kmh + 0.35;            // Start, Landung, Rollen
    const wende = SERVICE[service].wende;
    const rund = 2 * (flug + wende);
    const runden = Math.max(1, Math.floor(REGELN.betriebsStunden / rund));
    return { flug, wende, legs: runden * 2 };
  }

  function drehkreuze(a) {
    const n = {};
    for (const r of a.routen) { n[r.a] = (n[r.a] || 0) + 1; n[r.b] = (n[r.b] || 0) + 1; }
    return Object.keys(n).filter((s) => n[s] >= REGELN.drehkreuzAb);
  }

  function anziehung(a, stufe, gast) {
    const sv = SERVICE[a.service], sf = STUFEN[stufe];
    let preis = gast === "geschaeft" ? (sv.treu && sf.geschaeftTreu ? sf.geschaeftTreu : sf.geschaeft) : sf.urlaub;
    return sv.gast[gast] * preis * (0.55 + a.ruf / 100);
  }
  const marktGroesse = (summe) => Math.pow(summe, 0.7);   // billige Preise locken neue Gäste, Konkurrenz teilt

  // Die ganze Tagesrechnung: Wer fliegt wie viele Leute, was bleibt hängen?
  function rechnung(st) {
    const c = cache.get(st);
    const tag = tagVon(st);
    if (c && c.stand === st.stand && c.tag === tag) return c.r;
    const r = berechnen(st, tag);
    cache.set(st, { stand: st.stand, tag, r });
    return r;
  }

  function berechnen(st, tag, nurAirline) {
    const angebote = {};       // Paar → Liste von Angeboten
    const routen = {};         // Routen-ID → Ergebnis
    const nd = {};
    const nachfrage = (x, y) => nd[paar(x, y)] || (nd[paar(x, y)] = grundNachfrage(st, x, y, tag));
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      for (const r of a.routen) {
        const fs = flugzeugeAuf(a, r.id);
        if (!fs.length) continue;
        const km = entfernung(r.a, r.b);
        let sitze = 0, legs = 0, kerosin = 0, gebuehr = 0, crew = 0;
        const g = (REGELN.gebuehr[STADT[r.a].k] + REGELN.gebuehr[STADT[r.b].k]) / 2;
        for (const f of fs) {
          const t = TYPEN[f.typ], u = umlauf(f.typ, km, a.service);
          sitze += Math.round(t.sitze * SERVICE[a.service].sitze) * u.legs / 2;
          legs += u.legs;
          kerosin += u.legs * km * t.verbrauch * st.kerosin * SERVICE[a.service].betrieb;
          gebuehr += u.legs * g * t.groesse * SERVICE[a.service].betrieb;
          crew += t.crew;
        }
        const e = {
          id: r.id, airline: aid, a: r.a, b: r.b, km, flugzeuge: fs.length, legs, sitze,
          lokal: { urlaub: 0, geschaeft: 0 }, umsteiger: [], kerosin, gebuehr, crew,
        };
        routen[r.id] = e;
        (angebote[paar(r.a, r.b)] = angebote[paar(r.a, r.b)] || []).push({ a, r, e });
      }
    }
    // Direkte Fluggäste: Markt aufteilen.
    for (const [k, liste] of Object.entries(angebote)) {
      const [x, y] = k.split("|");
      const n = nachfrage(x, y);
      for (const gast of ["urlaub", "geschaeft"]) {
        const att = liste.map((o) => anziehung(o.a, o.r.stufe, gast));
        const summe = att.reduce((s, v) => s + v, 0);
        const markt = n[gast] * marktGroesse(summe);
        liste.forEach((o, i) => { o.e.lokal[gast] = markt * att[i] / summe; });
      }
    }
    // Umsteiger an Drehkreuzen.
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const sv = SERVICE[a.service];
      for (const h of drehkreuze(a)) {
        const speichen = a.routen.filter((r) => (r.a === h || r.b === h) && routen[r.id]);
        for (let i = 0; i < speichen.length; i++) {
          for (let j = i + 1; j < speichen.length; j++) {
            const r1 = speichen[i], r2 = speichen[j];
            const y = r1.a === h ? r1.b : r1.a, x = r2.a === h ? r2.b : r2.a;
            if (x === y || routeVon(a, x, y)) continue;
            const d1 = entfernung(y, h), d2 = entfernung(h, x), dd = entfernung(x, y);
            if (d1 + d2 > REGELN.umwegMax * dd || dd < 300) continue;
            const n = nachfrage(x, y);
            const direkt = angebote[paar(x, y)] ? 0.5 : 1;
            let pax = 0;
            for (const gast of ["urlaub", "geschaeft"]) pax += n[gast] * anziehung(a, "normal", gast) * 0.6;
            pax *= REGELN.umsteigerAnteil * sv.umsteiger * direkt;
            const preis = ticket(dd) * sv.preis * 0.9;
            const u = { pax, preis, wege: [r1.id, r2.id], km: [d1, d2], ziel: [y, x], ueber: h };
            routen[r1.id].umsteiger.push(u);
            routen[r2.id].umsteiger.push(u);
          }
        }
      }
    }
    // Plätze begrenzen.
    for (const e of Object.values(routen)) {
      const bedarf = e.lokal.urlaub + e.lokal.geschaeft + e.umsteiger.reduce((s, u) => s + u.pax, 0);
      e.bedarf = bedarf;
      e.faktor = bedarf > 0 ? Math.min(1, e.sitze / bedarf) : 1;
    }
    for (const e of Object.values(routen)) {
      const a = st.airlines[e.airline];
      const r = a.routen.find((x) => x.id === e.id);
      const sv = SERVICE[a.service], sf = STUFEN[r.stufe];
      const preis = ticket(e.km) * sv.preis * sf.preis;
      const lokal = (e.lokal.urlaub + e.lokal.geschaeft) * e.faktor;
      let umst = 0, umstErl = 0, zubringerWert = 0;
      for (const u of e.umsteiger) {
        const anderer = routen[u.wege[0] === e.id ? u.wege[1] : u.wege[0]];
        const pax = u.pax * Math.min(e.faktor, anderer.faktor);
        const meinAnteil = u.wege[0] === e.id ? u.km[0] / (u.km[0] + u.km[1]) : u.km[1] / (u.km[0] + u.km[1]);
        umst += pax;
        umstErl += 2 * pax * u.preis * meinAnteil;
        zubringerWert += 2 * pax * u.preis * (1 - meinAnteil);
      }
      e.pax = 2 * (lokal + umst);
      e.auslastung = e.sitze > 0 ? (lokal + umst) / e.sitze : 0;
      e.erloes = 2 * lokal * preis + umstErl;
      e.service = e.pax * sv.kosten;
      e.kosten = e.kerosin + e.gebuehr + e.crew + e.service;
      e.gewinn = e.erloes - e.kosten;
      e.zubringer = zubringerWert;
      e.umsteigerPax = 2 * umst;
      e.preis = preis;
      e.wert = e.gewinn + zubringerWert;  // was die Route dem ganzen Netz bringt
    }
    const summe = {};
    for (const aid of st.reihenfolge) summe[aid] = 0;
    for (const e of Object.values(routen)) summe[e.airline] += e.gewinn;
    return { routen, summe, tag };
  }

  // Probe: Was würde eine Änderung am ganzen Netz pro Tag verändern?
  function probe(st, aid, aenderung) {
    const vorher = rechnung(st).summe[aid];
    const kopie = klonen(st);
    const res = aenderung(kopie);
    if (res && res.ok === false) return null;
    const nachher = berechnen(kopie, tagVon(kopie)).summe[aid];
    return { delta: nachher - vorher, kopie, res };
  }
  function klonen(st) { return JSON.parse(JSON.stringify(st)); }

  // Grobe, schnelle Schätzung für die KI und den Bot (ohne volle Rechnung).
  function schaetzen(st, aid, x, y, typ) {
    const a = st.airlines[aid];
    const tag = tagVon(st);
    const km = entfernung(x, y);
    const n = grundNachfrage(st, x, y, tag);
    const andere = [];
    for (const bid of st.reihenfolge) {
      if (bid === aid) continue;
      const b = st.airlines[bid];
      const r = routeVon(b, x, y);
      if (r && flugzeugeAuf(b, r.id).length) andere.push({ b, r });
    }
    const eigene = routeVon(a, x, y);
    let pax = 0;
    for (const gast of ["urlaub", "geschaeft"]) {
      const meine = anziehung(a, "normal", gast);
      const summe = andere.reduce((s, o) => s + anziehung(o.b, o.r.stufe, gast), meine);
      pax += n[gast] * marktGroesse(summe) * meine / summe;
    }
    // Umsteiger grob: über eigene Routen an x und y.
    const sv = SERVICE[a.service];
    for (const [h, z] of [[x, y], [y, x]]) {
      const speichen = a.routen.filter((r) => r.a === h || r.b === h);
      if (speichen.length + 1 < REGELN.drehkreuzAb) continue;
      for (const r of speichen) {
        const o = r.a === h ? r.b : r.a;
        if (o === z) continue;
        const dd = entfernung(o, z);
        if (dd < 300 || entfernung(o, h) + km > REGELN.umwegMax * dd) continue;
        const m = grundNachfrage(st, o, z, tag);
        pax += (m.urlaub + m.geschaeft) * 0.6 * REGELN.umsteigerAnteil * sv.umsteiger * 0.7;
      }
    }
    const t = TYPEN[typ], u = umlauf(typ, km, a.service);
    let sitze = Math.round(t.sitze * sv.sitze) * u.legs / 2;
    let vorhanden = 0;
    if (eigene) for (const f of flugzeugeAuf(a, eigene.id)) vorhanden += Math.round(TYPEN[f.typ].sitze * sv.sitze) * umlauf(f.typ, km, a.service).legs / 2;
    const flieg = Math.max(0, Math.min(sitze, pax - vorhanden));
    const preis = ticket(km) * sv.preis;
    const g = (REGELN.gebuehr[STADT[x].k] + REGELN.gebuehr[STADT[y].k]) / 2;
    const kosten = u.legs * (km * t.verbrauch * st.kerosin + g * t.groesse) * sv.betrieb + t.crew + 2 * flieg * sv.kosten;
    return { gewinn: 2 * flieg * preis - kosten, auslastung: flieg / sitze, pax: 2 * flieg };
  }

  // ---------- Zeit ----------
  // Bewegt die Uhr weiter. Gibt die Landungen zurück (für kleine Geld-Anzeigen).
  function vorruecken(st, stunden) {
    const landungen = [];
    if (st.ende) return landungen;
    let rest = stunden;
    while (rest > 1e-9 && !st.ende) {
      const tagEnde = Math.floor(st.zeit / 24) * 24 + 24;
      const schritt = Math.min(rest, tagEnde - st.zeit);
      const t0 = st.zeit, t1 = st.zeit + schritt;
      buchen(st, t0, t1, landungen);
      st.zeit = t1;
      rest -= schritt;
      ablaufen(st);
      if (st.zeit >= tagEnde - 1e-9) { st.zeit = tagEnde; tagesAbschluss(st); }
    }
    return landungen;
  }

  function buchen(st, t0, t1, landungen) {
    const rg = rechnung(st);
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      for (const r of a.routen) {
        const e = rg.routen[r.id];
        if (!e) continue;
        const proLeg = e.gewinn / e.legs;
        for (const f of flugzeugeAuf(a, r.id)) {
          const u = umlauf(f.typ, e.km, a.service);
          const takt = 24 / u.legs;
          const versatz = (f.ab || 0) + u.flug;
          const n0 = Math.floor((t0 - versatz) / takt), n1 = Math.floor((t1 - versatz) / takt);
          if (n1 > n0) {
            const betrag = proLeg * (n1 - n0);
            a.geld += betrag;
            a.heute = (a.heute || 0) + betrag;
            if (aid === SPIELER && landungen.length < 60) {
              const ziel = (n1 % 2 === 0) ? r.b : r.a;
              landungen.push({ route: r.id, stadt: ziel, betrag });
            }
          }
        }
      }
    }
  }

  // Lage eines Flugzeugs für die Anzeige: 0..1 entlang der Route und Richtung.
  function position(st, aid, f) {
    const a = st.airlines[aid];
    const r = a.routen.find((x) => x.id === f.route);
    if (!r) return null;
    const km = entfernung(r.a, r.b);
    const u = umlauf(f.typ, km, a.service);
    const takt = 24 / u.legs;
    const t = st.zeit - (f.ab || 0);
    const n = Math.floor(t / takt);
    const im = t - n * takt;
    const hin = ((n % 2) + 2) % 2 === 0;
    const flugAnteil = Math.min(u.flug, takt * 0.85);
    const p = Math.min(1, im / flugAnteil);
    const amBoden = im >= flugAnteil;
    return { r, anteil: hin ? p : 1 - p, hin, amBoden };
  }

  function ablaufen(st) {
    const vorher = st.gelegenheiten.length;
    for (const g of st.gelegenheiten) {
      if (g.bis <= st.zeit && g.art === "auktion") auktionVerloren(st, g);
    }
    st.gelegenheiten = st.gelegenheiten.filter((g) => g.bis > st.zeit);
    if (st.gelegenheiten.length !== vorher) geaendert(st);
  }

  function melden(st, m) { st.meldungen.push(Object.assign({ tag: tagVon(st) }, m)); }

  function tagesAbschluss(st) {
    const tag = tagVon(st) - 1;         // der Tag, der gerade zu Ende ging
    const rg = berechnen(st, tag);
    const p = st.airlines[SPIELER];
    // Kreditzinsen.
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      if (a.kredit > 0) {
        const zins = Math.round(a.kredit * REGELN.kreditZins);
        a.geld -= zins;
        a.heute = (a.heute || 0) - zins;
      }
      for (const r of a.routen) {
        const e = rg.routen[r.id];
        if (!e) continue;
        r.auslastung = r.auslastung == null ? e.auslastung : r.auslastung * 0.6 + e.auslastung * 0.4;
        r.minus = e.wert < 0 ? (r.minus || 0) + 1 : 0;
      }
      a.ruf = Math.min(REGELN.rufMax, a.ruf + (a.ruf < 70 ? 1.5 : 0.5));
      // Rivalen schütten einen Teil des Gewinns an ihre Eigentümer aus. Sonst ziehen sie davon.
      if (aid !== SPIELER && a.heute > 0) a.geld -= a.heute * REGELN.dividende;
      a.verlauf.push(Math.round(a.heute || 0));
      if (a.verlauf.length > 14) a.verlauf.shift();
      a.heute = 0;
    }
    st.letzterTag = {
      tag, gewinn: p.verlauf[p.verlauf.length - 1],
      routen: p.routen.filter((r) => rg.routen[r.id]).map((r) => {
        const e = rg.routen[r.id];
        return { id: r.id, a: r.a, b: r.b, gewinn: Math.round(e.gewinn), zubringer: Math.round(e.zubringer), auslastung: e.auslastung };
      }).sort((x, y) => y.gewinn - x.gewinn),
    };
    // Pleite-Stufen.
    pleitePruefen(st);
    if (st.ende) return;
    // Rivalen planen.
    for (const aid of ["k", "s", "a"]) kiTag(st, aid);
    // Saisonende: Slots prüfen.
    if (tag % REGELN.saisonTage === 0 && tag >= REGELN.ersteSlotPruefung) slotsPruefen(st, tag);
    else if (tag % REGELN.saisonTage === 0) melden(st, { art: "saison", text: "Neue Jahreszeit: " + saison(tag + 1).name });
    // Kerosin, Messen, Gelegenheiten.
    neuerTag(st, tag + 1);
    rangPruefen(st);
    geaendert(st);
  }

  function pleitePruefen(st) {
    const p = st.airlines[SPIELER];
    const pl = st.pleite;
    if (p.geld >= 0) {
      if (pl.stufe === 1 || pl.stufe === 3) { pl.stufe = pl.stufe === 3 ? 2 : 0; pl.tage = 0; melden(st, { art: "gerettet", text: "Die Bank ist zufrieden: Konto wieder im Plus." }); }
      return;
    }
    pl.tage++;
    if (pl.stufe === 0) {
      pl.stufe = 1; pl.tage = 0;
      melden(st, { art: "mahnung", text: "Die Bank mahnt: Dein Konto ist im Minus." });
    } else if (pl.stufe === 1 && pl.tage >= REGELN.mahnTage) {
      const betrag = Math.max(2000000, Math.ceil((-p.geld + 1500000) / 500000) * 500000);
      p.kredit += betrag; p.geld += betrag;
      pl.stufe = 2; pl.tage = 0;
      melden(st, { art: "kredit", text: "Die Bank gibt dir einen Kredit.", betrag });
    } else if (pl.stufe === 2) {
      pl.stufe = 3; pl.tage = 0;
      const k = staerksterRivale(st);
      st.uebernahme = { von: k, preis: Math.max(500000, Math.round(firmenwert(st, SPIELER) * 0.5)) };
      melden(st, { art: "uebernahme", text: RIVALEN[k].name + " will dich übernehmen.", von: k });
    } else if (pl.stufe === 3 && pl.tage >= REGELN.letzteChanceTage) {
      st.ende = { grund: "pleite", tag: tagVon(st) };
    }
  }
  function uebernahmeAnnehmen(st) {
    if (st.pleite.stufe !== 3) return false;
    st.ende = { grund: "verkauft", tag: tagVon(st), von: st.uebernahme && st.uebernahme.von };
    return true;
  }
  function uebernahmeAblehnen(st) {
    if (!st.uebernahme) return false;
    st.uebernahme.abgelehnt = true;
    return true;
  }
  function tilgen(st, betrag) {
    const p = st.airlines[SPIELER];
    betrag = Math.min(betrag ?? p.kredit, p.kredit, Math.max(0, p.geld));
    if (betrag <= 0) return false;
    p.geld -= betrag; p.kredit -= betrag;
    if (p.kredit <= 0 && st.pleite.stufe >= 2) { st.pleite = { stufe: 0, tage: 0 }; st.uebernahme = null; }
    geaendert(st);
    return true;
  }

  // ---------- Saison: Slots laufen aus ----------
  function slotsPruefen(st, tag) {
    melden(st, { art: "saison", text: "Saisonende: Slots werden neu vergeben. Neue Jahreszeit: " + saison(tag + 1).name });
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      for (const stadt of Object.keys(a.slots)) {
        const genutzt = slotsGenutzt(a, stadt);
        const schutz = stadt === a.basis ? REGELN.startSlots : 0;
        const ungenutzt = a.slots[stadt] - Math.max(genutzt, schutz);
        if (ungenutzt > 0) {
          a.slots[stadt] -= ungenutzt;
          if (aid === SPIELER) melden(st, { art: "slotweg", text: `${ungenutzt} ungenutzte${ungenutzt > 1 ? "" : "r"} Slot${ungenutzt > 1 ? "s" : ""} in ${STADT[stadt].name} zurückgegeben.` });
        }
        if (!a.slots[stadt]) delete a.slots[stadt];
      }
      // Schwach genutzte Routen: ein Slot geht in die Versteigerung.
      for (const r of a.routen) {
        if (r.auslastung == null || r.auslastung >= REGELN.slotGutAb || tag - r.seit < 4) continue;
        const stadt = STADT[r.a].k >= STADT[r.b].k ? r.a : r.b;
        if (STADT[stadt].k === 1) continue;            // an kleinen Flughäfen gibt es genug
        const preis = slotPreis(st, stadt);
        if (aid === SPIELER) {
          st.gelegenheiten.push({ id: "g" + st.naechsteGel++, art: "auktion", stadt, route: r.id, preis, bis: st.zeit + 10, dauer: 10 });
        } else {
          const e = rechnung(st).routen[r.id];
          if (e && e.wert > 0 && a.geld > preis * 2) a.geld -= preis;
          else { abziehen(st, aid, r.id); a.slots[stadt] = Math.max(0, (a.slots[stadt] || 0) - 1); }
        }
      }
    }
  }
  function auktionVerloren(st, g) {
    const p = st.airlines[SPIELER];
    const r = p.routen.find((x) => x.id === g.route);
    if (r) abziehen(st, SPIELER, r.id);
    p.slots[g.stadt] = Math.max(0, (p.slots[g.stadt] || 0) - 1);
    // Ein Rivale schnappt sich den Slot gern.
    const k = st.airlines.k;
    if (slotsFrei(st, g.stadt) > 0) k.slots[g.stadt] = (k.slots[g.stadt] || 0) + 1;
    melden(st, { art: "slotverloren", text: `Slot in ${STADT[g.stadt].name} verloren. Ein Flugzeug steht jetzt frei.` });
    geaendert(st);
  }

  // ---------- Neuer Tag: Kerosin, Messen, Gelegenheiten ----------
  function neuerTag(st, tag) {
    if (st.kerosinBis && tag > st.kerosinBis) { st.kerosin = 1; st.kerosinBis = 0; melden(st, { art: "kerosin", text: "Kerosin kostet wieder normal." }); }
    st.messen = st.messen.filter((m) => m.bis >= tag);
    if (tag < REGELN.gelegenheitAb) return;
    const offen = st.gelegenheiten.filter((g) => g.art !== "auktion").length;
    if (offen < 2 && zufall(st) < 0.7) gelegenheitErzeugen(st, tag);
  }

  function gelegenheitErzeugen(st, tag) {
    const p = st.airlines[SPIELER];
    const arten = ["slot", "gebraucht", "messe", "messe"].concat(st.kerosinBis ? [] : ["kerosin"]);
    const art = waehle(st, arten);
    const id = "g" + st.naechsteGel++;
    if (art === "slot") {
      const voll = STAEDTE.filter((s) => s.k >= 2 && slotsFrei(st, s.id) <= 3 && !st.gelegenheiten.some((g) => g.stadt === s.id));
      const s = voll.length ? waehle(st, voll) : waehle(st, STAEDTE.filter((x) => x.k === 3));
      const preis = Math.round(REGELN.slotPreis[s.k] * 1.2 / 10000) * 10000;
      st.gelegenheiten.push({ id, art, stadt: s.id, preis, bis: st.zeit + 9, dauer: 9 });
    } else if (art === "gebraucht") {
      const typen = Object.keys(TYPEN).filter((t) => typFrei(st, p, t));
      const typ = waehle(st, typen);
      st.gelegenheiten.push({ id, art, typ, preis: Math.round(TYPEN[typ].preis * 0.55 / 10000) * 10000, bis: st.zeit + 8, dauer: 8 });
    } else if (art === "messe") {
      const s = waehle(st, STAEDTE.filter((x) => x.w >= 0.35 && !st.messen.some((m) => m.stadt === x.id)));
      const m = { stadt: s.id, von: tag + 1, bis: tag + 3 };
      st.messen.push(m);
      st.gelegenheiten.push({ id, art, stadt: s.id, von: m.von, bis: st.zeit + 24 + 24 * 3 - (st.zeit % 24), dauer: 24 * 4, info: true });
    } else if (art === "kerosin") {
      const billig = zufall(st) < 0.5;
      st.kerosin = billig ? 0.8 : 1.25;
      st.kerosinBis = tag + 4;
      st.gelegenheiten.push({ id, art, billig, bis: st.zeit + 24 * 5 - (st.zeit % 24), dauer: 24 * 5, info: true });
    }
  }

  function gelegenheitAnnehmen(st, gid) {
    const g = st.gelegenheiten.find((x) => x.id === gid);
    if (!g || g.info) return { ok: false };
    const p = st.airlines[SPIELER];
    if (p.geld < g.preis) return { ok: false, grund: "geld" };
    p.geld -= g.preis;
    if (g.art === "slot") p.slots[g.stadt] = (p.slots[g.stadt] || 0) + 1;
    else if (g.art === "gebraucht") flugzeugHinzu(p, g.typ);
    // Auktion: Slot bleibt, nichts weiter zu tun.
    st.gelegenheiten = st.gelegenheiten.filter((x) => x !== g);
    geaendert(st);
    return { ok: true, g };
  }
  function gelegenheitAblehnen(st, gid) {
    const g = st.gelegenheiten.find((x) => x.id === gid);
    if (!g) return false;
    if (g.art === "auktion") auktionVerloren(st, g);
    st.gelegenheiten = st.gelegenheiten.filter((x) => x !== g);
    geaendert(st);
    return true;
  }

  // ---------- Rangliste ----------
  function flottenWert(a) { return a.flotte.reduce((s, f) => s + TYPEN[f.typ].preis * REGELN.verkaufAnteil, 0); }
  function slotWert(a) {
    let s = 0;
    for (const [stadt, n] of Object.entries(a.slots)) s += n * REGELN.slotPreis[STADT[stadt].k] * 0.5;
    return s;
  }
  function firmenwert(st, aid) {
    const a = st.airlines[aid];
    const verlauf = a.verlauf.slice(-7);
    const schnitt = verlauf.length ? verlauf.reduce((s, v) => s + v, 0) / verlauf.length : 0;
    return Math.round(a.geld - a.kredit + flottenWert(a) + slotWert(a) + Math.max(0, schnitt) * 10);
  }
  function rangliste(st) {
    return st.reihenfolge.map((id) => ({ id, name: st.airlines[id].name, farbe: st.airlines[id].farbe, wert: firmenwert(st, id), routen: st.airlines[id].routen.length, flugzeuge: st.airlines[id].flotte.length }))
      .sort((x, y) => y.wert - x.wert);
  }
  function platz(st) { return rangliste(st).findIndex((x) => x.id === SPIELER) + 1; }
  function staerksterRivale(st) { return rangliste(st).find((x) => x.id !== SPIELER).id; }

  function rangPruefen(st) {
    const pl = platz(st);
    if (st.letzterPlatz && pl < st.letzterPlatz) melden(st, { art: "aufstieg", text: `Du bist auf Platz ${pl} aufgestiegen!`, platz: pl });
    st.letzterPlatz = pl;
    st.bestPlatz = Math.min(st.bestPlatz || 9, pl);
    if (st.stufe < 2 && firmenwert(st, SPIELER) >= REGELN.stufe2Wert) {
      st.stufe = 2;
      melden(st, { art: "stufe", text: "Deine Airline ist gewachsen: Der Kranich 190 ist jetzt zu haben.", typ: "kranich" });
    }
    if (pl === 1 && !st.platz1) {
      st.platz1 = true; st.welt = true; st.stufe = 3;
      melden(st, { art: "welt", text: "Platz 1 in Europa! Die Welt öffnet sich: Langstrecke mit dem Albatros 320.", typ: "albatros" });
    }
  }

  // ---------- Rivalen (und Bot für Probepartien) ----------
  const STIL = {
    platzhirsch: { reserve: 2500000, amortisation: 30, klasse: { 1: 0.7, 2: 1, 3: 1.3 }, proTag: 1, typen: ["falke", "kranich", "albatros"] },
    billig: { reserve: 800000, amortisation: 22, klasse: { 1: 1.4, 2: 1, 3: 0.6 }, proTag: 1, typen: ["falke", "kranich", "libelle"] },
    premium: { reserve: 1500000, amortisation: 26, klasse: { 1: 0.6, 2: 1.1, 3: 1.2 }, proTag: 1, typen: ["falke", "kranich", "albatros"] },
    bot: { reserve: 300000, amortisation: 40, klasse: { 1: 1, 2: 1, 3: 1 }, proTag: 3, typen: ["libelle", "falke", "kranich", "albatros"] },
  };

  function kiTag(st, aid) {
    const a = st.airlines[aid];
    // Verlustrouten aufgeben.
    for (const r of a.routen.slice()) {
      if (r.minus >= 3) {
        abziehen(st, aid, r.id);
        if (aid !== SPIELER && zufall(st) < 0.5) melden(st, { art: "rivale", text: `${a.name} gibt ${STADT[r.a].name}–${STADT[r.b].name} auf.`, wer: aid });
      }
    }
    if (a.geld < 0) {
      // Not: freie Flugzeuge verkaufen.
      for (const f of freieFlugzeuge(a)) if (a.geld < 0) verkaufen(st, aid, f.id);
      return;
    }
    // Wöchentlich etwas langsamer, damit die Rivalen nicht davonziehen.
    const stil = STIL[a.stil] || STIL.bot;
    for (let i = 0; i < stil.proTag; i++) if (!kiAusbauen(st, aid)) break;
  }

  function kiAusbauen(st, aid, opt) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const reserve = opt && opt.start ? 0 : stil.reserve;
    if (a.geld < reserve + 400000) return false;
    const orte = new Set([a.basis]);
    for (const r of a.routen) { orte.add(r.a); orte.add(r.b); }
    const kandidaten = [];
    const typen = stil.typen.filter((t) => typFrei(st, a, t));
    for (const x of orte) {
      for (const s of staedte(st)) {
        const y = s.id;
        if (y === x) continue;
        for (const typ of typen) {
          if (entfernung(x, y) > TYPEN[typ].reichweite) continue;
          const k = kostenFuer(st, aid, x, y, typ);
          if (k.slotFehlt || k.gesamt > a.geld - reserve) continue;
          const sch = schaetzen(st, aid, x, y, typ);
          if (sch.gewinn <= 0 || sch.auslastung < 0.45) continue;
          const vorliebe = stil.klasse[STADT[y].k] * (a.stil === "premium" ? 0.6 + (STADT[x].w + STADT[y].w) : 1) * (x === a.basis ? 1.15 : 1);
          const tage = (k.gesamt + 1) / sch.gewinn;
          if (tage > stil.amortisation * 1.5) continue;
          kandidaten.push({ x, y, typ, wert: (sch.gewinn * vorliebe) / Math.max(k.gesamt, 300000), tage, sch });
        }
      }
    }
    kandidaten.sort((p, q) => q.wert - p.wert);
    // Die besten drei genau prüfen.
    for (const c of kandidaten.slice(0, 3)) {
      const pr = probe(st, aid, (kopie) => fliegen(kopie, aid, c.x, c.y, c.typ));
      if (!pr) continue;
      const kost = kostenFuer(st, aid, c.x, c.y, c.typ).gesamt;
      if (pr.delta > 0 && (kost / pr.delta) <= stil.amortisation) {
        fliegen(st, aid, c.x, c.y, c.typ);
        return true;
      }
    }
    return false;
  }

  // ---------- Speichern ----------
  function laden(json) {
    const st = typeof json === "string" ? JSON.parse(json) : json;
    if (!st || st.version !== 1) return null;
    return st;
  }

  return {
    SPIELER, REGELN, SERVICE, STUFEN, TYPEN, STAEDTE, WELT, ALLE, STADT, SAISONEN, WOCHENTAGE, RIVALEN, NAMEN, HEIMAT, STIL,
    neuesSpiel, laden, klonen, entfernung, tagVon, wochentag, saison, ticket, grundNachfrage, staedte,
    flugzeugeAuf, freieFlugzeuge, slotsBelegt, slotsFrei, slotPreis, slotsGenutzt, slotsUebrig, typFrei, routeVon,
    kostenFuer, kannFliegen, fliegen, abziehen, routeSchliessen, verkaufen, kaufen, preisStufe, serviceWechseln,
    umlauf, drehkreuze, rechnung, berechnen, probe, schaetzen, vorruecken, position,
    gelegenheitAnnehmen, gelegenheitAblehnen, uebernahmeAnnehmen, uebernahmeAblehnen, tilgen,
    firmenwert, rangliste, platz, kiTag, kiAusbauen, tagesAbschluss,
  };
});
