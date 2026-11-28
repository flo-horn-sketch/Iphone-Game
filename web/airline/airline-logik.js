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
    slotPlaetze: { 1: 8, 2: 7, 3: 6 },            // so viele Slots sind je Flughafen für alle zusammen noch frei (den Rest haben die großen Airlines der Welt)
    heimatPlaetze: 6,        // in der eigenen Heimat hat jede Airline bis zu 6 Landerechte extra, die anderen nichts wegnehmen
    slotAufschlag: 1.5,      // Slots werden teurer, je weniger frei sind
    drehkreuzAb: 3,          // ab so vielen eigenen Routen steigen in einer Stadt Leute um
    umsteigerAnteil: 0.32,
    umwegMax: 1.6,           // Umsteigen nur, wenn der Umweg nicht zu groß ist
    startGeld: 2500000,
    startSlots: 2,
    rufStart: 50,
    rufMax: 100,
    rufNatur: 70,            // bis hierhin wächst der Ruf von selbst; darüber nur mit Werbung, und er sinkt langsam wieder
    werbungRuf: 6, werbungAnteil: 0.02, werbungMin: 500000,   // Werbekampagne: +6 Ruf für 2 % vom Firmenwert (mind. 0,5 Mio)
    verwaltungFrei: 8, verwaltung: 3500, verwaltungExp: 1.5,  // ab der 9. Linie kostet jede Linie Verwaltung, und zwar immer mehr
    umruestenAnteil: 0.6,    // beim Umrüsten bekommt man so viel vom Preis des alten Flugzeugs zurück
    rufVerschlechtern: 4,    // so viel Ruf kostet es, wenn ein Grundsatz für die Gäste schlechter wird (pro Komfortpunkt)
    auftragStunden: 8,       // so lange braucht ein Assistent für einen Bericht
    saisonTage: 7,           // eine Jahreszeit dauert eine Woche, ein Jahr 28 Tage
    slotGutAb: 0.5,          // ab dieser Auslastung behält man Slots nach der Saison
    ersteSlotPruefung: 21,   // Woche 3: Landerechte und Jahreszeiten zählen
    rivalenAb: 1,            // Rivalen fliegen von Anfang an (vorgestellt werden sie in Woche 2)
    verkaufAnteil: 0.6,      // ein Flugzeug bringt beim Verkauf so viel vom Neupreis
    kreditZins: 0.012,       // pro Tag
    mahnTage: 2,
    letzteChanceTage: 3,
    stufe2Wert: 30000000,    // Firmenwert für den Kranich
    stufe3Wert: 100000000,   // Firmenwert für die Langstrecken-Jets
    stufe4Wert: 300000000,   // Firmenwert für den A380
    gelegenheitAb: 22,       // Woche 4: Messen und Gelegenheiten
    dividende: 0,            // Anteil am Tagesgewinn, den Rivalen nicht wieder anlegen
    mitteBonus: 0.45,        // Zuschlag an Gästen für eine ausgewogene, klassische Airline
    qualitaet: 0.05,         // pro Komfortpunkt mehr Anziehung: bei gleichem Preis gewinnt die bessere Airline
    planAb: 10,              // ab hier kündigen Rivalen Züge an
    planTage: 3,
    duellAb: 12,             // ab hier gibt es Preiskämpfe
    trendAb: 14,             // ab hier ändert sich die Nachfrage über die Zeit
    wahlAb: 24,              // ab hier Ereignisse mit zwei Wahlen
    rennenAb: 29,            // ab hier jede Jahreszeit ein Rennen
    rennenPreis: 3000000,
    aufkaufAb: 30,           // ab hier können Rivalen in die Krise geraten
    drehkreuzPreis: { 1: 1500000, 2: 4000000, 3: 8000000 },
    ausbauUmsteiger: 1.6,    // ein ausgebautes Drehkreuz bringt so viel mehr Umsteiger
    ausbauGaeste: 1.1,       // und Linien dort ziehen etwas mehr Gäste an
    versteigerungStueck: 3,  // so viele neue Landerechte gibt es bei der Versteigerung
  };

  // Drei Servicelinien. Jede hat eine eigene Stärke.
  // ---------- Grundsätze der Airline ----------
  // Statt fester Service-Stufen legt man einzelne Grundsätze fest. Daraus ergibt sich, wen man anlockt.
  // komfort: mehr = Geschäftsleute zahlen mehr, weniger = Urlauber kommen wegen des Preises.
  const GRUNDSAETZE = {
    sitz: { name: "Sitzabstand", icon: "💺", optionen: {
      eng: { name: "Eng", text: "30 % mehr Sitze", komfort: -1, sitze: 1.3 },
      normal: { name: "Normal", text: "", komfort: 0, sitze: 1 },
      bequem: { name: "Bequem", text: "20 % weniger Sitze", komfort: 1, sitze: 0.8, wende: 0.2 } } },
    essen: { name: "Essen an Bord", icon: "🍽️", optionen: {
      keins: { name: "Keins", text: "spart Kosten", komfort: -1, kosten: 0 },
      snack: { name: "Snack", text: "", komfort: 0, kosten: 7 },
      menue: { name: "Menü", text: "", komfort: 0.8, kosten: 10 },
      gourmet: { name: "Gourmet", text: "teuer, beeindruckt", komfort: 1.6, kosten: 13 } } },
    essenZahlen: { name: "Essen bezahlen", icon: "💶", optionen: {
      inklusive: { name: "Im Preis", text: "", komfort: 0 },
      aufpreis: { name: "Aufpreis", text: "Gäste zahlen selbst", komfort: -0.5, essenAnteil: 0.2 } } },
    platzwahl: { name: "Sitzplatzwahl", icon: "🎟️", optionen: {
      kostenlos: { name: "Kostenlos", text: "", komfort: 0 },
      gebuehr: { name: "Gebühr", text: "+5 € pro Gast", komfort: -0.5, extra: 5 } } },
    koffer: { name: "Koffer", icon: "🧳", optionen: {
      inklusive: { name: "Inklusive", text: "", komfort: 0 },
      gebuehr: { name: "Gebühr", text: "+9 € pro Gast", komfort: -0.7, extra: 9 } } },
    boarding: { name: "Boarding", icon: "⏱️", optionen: {
      schnell: { name: "Schnell", text: "mehr Flüge am Tag", komfort: -0.3, wende: 0.4 },
      gruendlich: { name: "Gründlich", text: "", komfort: 0, wende: 0.9 } } },
  };
  const VORLAGEN = {
    billig: { sitz: "eng", essen: "keins", essenZahlen: "aufpreis", platzwahl: "gebuehr", koffer: "gebuehr", boarding: "schnell" },
    standard: { sitz: "normal", essen: "snack", essenZahlen: "inklusive", platzwahl: "kostenlos", koffer: "inklusive", boarding: "gruendlich" },
    premium: { sitz: "bequem", essen: "gourmet", essenZahlen: "inklusive", platzwahl: "kostenlos", koffer: "inklusive", boarding: "gruendlich" },
  };
  // Aus den Grundsätzen das Profil, mit dem gerechnet wird.
  const profilCache = new Map();
  const profilSchnell = new WeakMap();      // Grundsätze werden nie verändert, nur ersetzt: das Objekt selbst ist der Schlüssel.
  function profil(a) {
    const g = a.grundsaetze || VORLAGEN[a.service] || VORLAGEN.standard;
    const schnell = profilSchnell.get(g);
    if (schnell) return schnell;
    const key = Object.keys(GRUNDSAETZE).map((k) => g[k]).join("|");
    if (profilCache.has(key)) { profilSchnell.set(g, profilCache.get(key)); return profilCache.get(key); }
    const o = {};
    for (const k of Object.keys(GRUNDSAETZE)) o[k] = GRUNDSAETZE[k].optionen[g[k]] || Object.values(GRUNDSAETZE[k].optionen)[0];
    let K = 0;
    for (const k of Object.keys(o)) K += o[k].komfort;
    if (o.essen.kosten === 0) K -= o.essenZahlen.komfort;      // ohne Essen ist der Aufpreis egal
    const essenKosten = o.essen.kosten * (o.essenZahlen.essenAnteil ?? 1);
    const mitte = 1 + REGELN.mitteBonus * Math.exp(-K * K / 2);
    const pr = {
      komfort: K,
      sitze: o.sitz.sitze,
      preis: Math.max(0.7, Math.min(1.3, 1 + 0.08 * K)),
      kosten: 2 + essenKosten,
      extra: (o.platzwahl.extra || 0) + (o.koffer.extra || 0),
      wende: o.boarding.wende + (o.sitz.wende || 0),
      betrieb: K < 0 ? 1 + 0.043 * K : 1 + 0.017 * K,
      // Die Mitte zieht beide Gästegruppen etwas an ("gut für alle").
      gast: { urlaub: Math.exp(-(K < 0 ? 0.25 : 0.23) * K) * mitte, geschaeft: Math.exp((K < 0 ? 0.23 : 0.135) * K) * mitte },
      umsteiger: Math.max(0.8, 1.5 - 0.2 * Math.abs(K)),
      treu: K >= 2.5,
      klassen: o.sitz.sitze > 1 ? "billig" : o.sitz.sitze < 1 ? "premium" : "standard",
    };
    pr.art = K <= -2 ? "billig" : K >= 2 ? "premium" : "standard";
    pr.sterne = Math.max(1, Math.min(5, Math.round(3 + K / 1.4)));   // Qualität, die Gäste sehen
    pr.essenKosten = essenKosten;
    profilCache.set(key, pr);
    return pr;
  }
  // Für Bilder und Namen: grobe Einordnung.
  const SERVICE = {
    billig: { name: "Billigflieger", icon: "🪙", farbe: "#F2B33D", staerke: "Volle Flieger mit Urlaubern, Geld kommt über Gebühren." },
    standard: { name: "Klassische Airline", icon: "✈️", farbe: "#7FC4E8", staerke: "Gut für alle, die meisten Umsteiger an Drehkreuzen." },
    premium: { name: "Premium-Airline", icon: "🥂", farbe: "#C9A0F0", staerke: "Geschäftsreisende zahlen viel und bleiben treu." },
  };

  // Sitzklassen. Business braucht doppelt so viel Platz wie Economy, First dreimal so viel.
  // anteil: welcher Teil der Geschäftsreisenden diese Klasse will (wie in echt: die meisten fliegen Economy).
  // First gibt es fast nur auf Langstrecken zwischen großen Städten (siehe klassenNachfrage).
  const KLASSEN = {
    eco: { name: "Economy", farbe: "#7FC4E8", platz: 1, preis: 1, service: 1, anteil: 0.67 },
    business: { name: "Business", farbe: "#F2C14E", platz: 2, preis: 2.6, service: 3, anteil: 0.25 },
    first: { name: "First", farbe: "#C9A0F0", platz: 3, preis: 4.5, service: 6, anteil: 0.03 },
  };
  const KLASSEN_START = { billig: { business: 0, first: 0 }, standard: { business: 0.2, first: 0 }, premium: { business: 0.3, first: 0 } };
  const KLASSEN_MAX = { business: 0.5, first: 0.2 };
  // Wie viele Gäste wollen welche Klasse? Business: knapp ein Drittel der Geschäftsleute und ein paar Urlauber,
  // auf kurzen Strecken weniger. First: nur ab etwa 2.500 km, richtig erst auf Langstrecke, und vor allem zwischen großen Städten.
  // Premium-Airlines ziehen mehr zahlende Gäste in die vorderen Klassen, Billigflieger weniger.
  function klassenNachfrage(e, sv) {
    const g = e.lokal.geschaeft, u = e.lokal.urlaub;
    const vorne = Math.max(0.6, Math.min(1.5, 1 + 0.18 * (sv ? sv.komfort : 0)));
    const lang = Math.max(0, Math.min(1, (e.km - 2500) / 4500));
    const kMin = Math.min(STADT[e.a].k, STADT[e.b].k);
    const gross = kMin >= 3 ? 1 : kMin >= 2 ? 0.5 : 0.1;
    const kurz = Math.min(1, 0.5 + e.km / 3000);
    const first = g * KLASSEN.first.anteil * lang * gross * vorne;
    const business = (g * KLASSEN.business.anteil * kurz + u * 0.02) * vorne;
    return { first, business, eco: u + g - first - business };
  }
  function klassenVon(r, a) { return r.klassen || KLASSEN_START[profil(a).klassen]; }

  // Preis pro Route: angreifen, normal, abschöpfen.
  const STUFEN = {
    angreifen: { name: "Angreifen", icon: "⬇", preis: 0.82, urlaub: 1.4, geschaeft: 1.12 },
    normal: { name: "Normal", icon: "●", preis: 1.0, urlaub: 1.0, geschaeft: 1.0 },
    abschoepfen: { name: "Abschöpfen", icon: "⬆", preis: 1.25, urlaub: 0.55, geschaeft: 0.82, geschaeftTreu: 0.98 },
  };

  // Erfundene Flugzeugtypen.
  // Echte Flugzeugtypen mit gerundeten echten Eckdaten (Sitze, Reichweite, Reisegeschwindigkeit).
  // Preise und Kosten sind fürs Spiel vereinfacht. Die internen Namen (libelle …) bleiben, damit Spielstände passen.
  const TYPEN = {
    libelle: { name: "ATR 72", kurz: "ATR 72", gruppe: "propeller", sitze: 70, kmh: 510, reichweite: 1500, preis: 600000, verbrauch: 2.0, groesse: 0.5, crew: 2800, stufe: 1 },
    dash8: { name: "Dash 8-400", kurz: "Dash 8", gruppe: "propeller", sitze: 78, kmh: 660, reichweite: 2000, preis: 750000, verbrauch: 2.4, groesse: 0.55, crew: 3000, stufe: 1 },
    crj900: { name: "Bombardier CRJ900", kurz: "CRJ900", gruppe: "regional", sitze: 90, kmh: 830, reichweite: 2900, preis: 900000, verbrauch: 2.8, groesse: 0.7, crew: 3800, stufe: 1 },
    falke: { name: "Embraer E195", kurz: "E195", gruppe: "regional", sitze: 132, kmh: 830, reichweite: 4800, preis: 1400000, verbrauch: 3.6, groesse: 1.0, crew: 5500, stufe: 1 },
    a220: { name: "Airbus A220-300", kurz: "A220", gruppe: "regional", sitze: 140, kmh: 830, reichweite: 6300, preis: 1700000, verbrauch: 3.5, groesse: 1.05, crew: 5800, stufe: 2 },
    b737: { name: "Boeing 737 MAX 8", kurz: "737 MAX", gruppe: "mittel", sitze: 178, kmh: 840, reichweite: 6500, preis: 2100000, verbrauch: 4.6, groesse: 1.25, crew: 7000, stufe: 2 },
    a320: { name: "Airbus A320neo", kurz: "A320", gruppe: "mittel", sitze: 180, kmh: 840, reichweite: 6300, preis: 2150000, verbrauch: 4.5, groesse: 1.25, crew: 7000, stufe: 2 },
    kranich: { name: "Airbus A321neo", kurz: "A321", gruppe: "mittel", sitze: 200, kmh: 840, reichweite: 7400, preis: 2400000, verbrauch: 5.0, groesse: 1.35, crew: 7500, stufe: 2 },
    albatros: { name: "Boeing 787-9", kurz: "787", gruppe: "lang", sitze: 290, kmh: 900, reichweite: 14000, preis: 5500000, verbrauch: 7.6, groesse: 2.0, crew: 12000, stufe: 3 },
    a350: { name: "Airbus A350-900", kurz: "A350", gruppe: "lang", sitze: 315, kmh: 910, reichweite: 15000, preis: 6200000, verbrauch: 8.0, groesse: 2.1, crew: 13000, stufe: 3 },
    b777: { name: "Boeing 777-300ER", kurz: "777", gruppe: "lang", sitze: 396, kmh: 900, reichweite: 13600, preis: 7500000, verbrauch: 10.6, groesse: 2.6, crew: 15500, stufe: 3 },
    a380: { name: "Airbus A380", kurz: "A380", gruppe: "lang", sitze: 575, kmh: 900, reichweite: 15000, preis: 12000000, verbrauch: 16.5, groesse: 3.6, crew: 22000, stufe: 4 },
  };
  const GRUPPEN = { propeller: "Propeller", regional: "Regionaljets", mittel: "Mittelstrecke", lang: "Langstrecke" };

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
  // Der Rest der Welt. Für die langen Strecken braucht man große Flugzeuge.
  const WELT = [
    { id: "newyork", name: "New York", lon: -73.78, lat: 40.64, g: 12, w: 0.5, k: 3 },
    { id: "losangeles", name: "Los Angeles", lon: -118.41, lat: 33.94, g: 10, w: 0.4, k: 3, t: "sonne" },
    { id: "chicago", name: "Chicago", lon: -87.9, lat: 41.98, g: 8, w: 0.5, k: 3 },
    { id: "atlanta", name: "Atlanta", lon: -84.43, lat: 33.64, g: 7, w: 0.45, k: 3 },
    { id: "mexiko", name: "Mexiko-Stadt", lon: -99.07, lat: 19.44, g: 8, w: 0.35, k: 3 },
    { id: "toronto", name: "Toronto", lon: -79.63, lat: 43.68, g: 7, w: 0.45, k: 2 },
    { id: "miami", name: "Miami", lon: -80.29, lat: 25.79, g: 6, w: 0.3, k: 2, t: "tropen" },
    { id: "sanfrancisco", name: "San Francisco", lon: -122.38, lat: 37.62, g: 7, w: 0.55, k: 2 },
    { id: "washington", name: "Washington", lon: -77.46, lat: 38.95, g: 6, w: 0.55, k: 2 },
    { id: "dallas", name: "Dallas", lon: -97.04, lat: 32.9, g: 6, w: 0.45, k: 2 },
    { id: "boston", name: "Boston", lon: -71.0, lat: 42.36, g: 5, w: 0.5, k: 2 },
    { id: "vancouver", name: "Vancouver", lon: -123.18, lat: 49.19, g: 4, w: 0.4, k: 2, t: "schnee" },
    { id: "seattle", name: "Seattle", lon: -122.31, lat: 47.45, g: 4.5, w: 0.5, k: 1 },
    { id: "montreal", name: "Montreal", lon: -73.74, lat: 45.47, g: 4, w: 0.4, k: 1, t: "schnee" },
    { id: "denver", name: "Denver", lon: -104.67, lat: 39.86, g: 4.5, w: 0.4, k: 1, t: "schnee" },
    { id: "lasvegas", name: "Las Vegas", lon: -115.15, lat: 36.08, g: 4, w: 0.1, k: 1 },
    { id: "cancun", name: "Cancún", lon: -86.87, lat: 21.04, g: 3.5, w: 0.05, k: 1, t: "tropen" },
    { id: "houston", name: "Houston", lon: -95.34, lat: 29.98, g: 6, w: 0.5, k: 2 },
    { id: "philadelphia", name: "Philadelphia", lon: -75.24, lat: 39.87, g: 5, w: 0.45, k: 2 },
    { id: "phoenix", name: "Phoenix", lon: -112.01, lat: 33.43, g: 4, w: 0.35, k: 1, t: "sonne" },
    { id: "detroit", name: "Detroit", lon: -83.35, lat: 42.21, g: 3.5, w: 0.5, k: 1 },
    { id: "minneapolis", name: "Minneapolis", lon: -93.22, lat: 44.88, g: 3.5, w: 0.45, k: 1, t: "schnee" },
    { id: "orlando", name: "Orlando", lon: -81.31, lat: 28.43, g: 4.5, w: 0.1, k: 1, t: "tropen" },
    { id: "charlotte", name: "Charlotte", lon: -80.94, lat: 35.21, g: 3.5, w: 0.45, k: 1 },
    { id: "sandiego", name: "San Diego", lon: -117.19, lat: 32.73, g: 3.5, w: 0.35, k: 1, t: "sonne" },
    { id: "neworleans", name: "New Orleans", lon: -90.26, lat: 29.99, g: 3, w: 0.2, k: 1 },
    { id: "calgary", name: "Calgary", lon: -114.02, lat: 51.13, g: 3, w: 0.4, k: 1, t: "schnee" },
    { id: "ottawa", name: "Ottawa", lon: -75.67, lat: 45.32, g: 2.5, w: 0.5, k: 1 },
    { id: "havanna", name: "Havanna", lon: -82.41, lat: 22.99, g: 3, w: 0.05, k: 1, t: "tropen" },
    { id: "saopaulo", name: "São Paulo", lon: -46.47, lat: -23.43, g: 9, w: 0.35, k: 3 },
    { id: "rio", name: "Rio de Janeiro", lon: -43.25, lat: -22.81, g: 6, w: 0.2, k: 2, t: "sued" },
    { id: "buenosaires", name: "Buenos Aires", lon: -58.54, lat: -34.82, g: 7, w: 0.35, k: 2 },
    { id: "bogota", name: "Bogotá", lon: -74.15, lat: 4.7, g: 5, w: 0.35, k: 2 },
    { id: "lima", name: "Lima", lon: -77.11, lat: -12.02, g: 4.5, w: 0.3, k: 2 },
    { id: "santiago", name: "Santiago", lon: -70.79, lat: -33.39, g: 4.5, w: 0.35, k: 1, t: "sued" },
    { id: "brasilia", name: "Brasília", lon: -47.92, lat: -15.87, g: 3.5, w: 0.5, k: 1 },
    { id: "salvador", name: "Salvador", lon: -38.33, lat: -12.91, g: 3, w: 0.1, k: 1, t: "tropen" },
    { id: "montevideo", name: "Montevideo", lon: -56.03, lat: -34.84, g: 2.5, w: 0.35, k: 1, t: "sued" },
    { id: "panama", name: "Panama-Stadt", lon: -79.38, lat: 9.07, g: 4, w: 0.45, k: 2, t: "tropen" },
    { id: "curitiba", name: "Curitiba", lon: -49.18, lat: -25.53, g: 2.5, w: 0.4, k: 1 },
    { id: "kairo", name: "Kairo", lon: 31.4, lat: 30.12, g: 7, w: 0.3, k: 2, t: "sonne" },
    { id: "johannesburg", name: "Johannesburg", lon: 28.24, lat: -26.14, g: 6, w: 0.4, k: 2 },
    { id: "lagos", name: "Lagos", lon: 3.32, lat: 6.58, g: 6, w: 0.35, k: 2 },
    { id: "kapstadt", name: "Kapstadt", lon: 18.6, lat: -33.97, g: 4, w: 0.15, k: 1, t: "sued" },
    { id: "nairobi", name: "Nairobi", lon: 36.93, lat: -1.32, g: 4.5, w: 0.3, k: 1 },
    { id: "casablanca", name: "Casablanca", lon: -7.59, lat: 33.37, g: 4, w: 0.25, k: 1 },
    { id: "marrakesch", name: "Marrakesch", lon: -8.04, lat: 31.6, g: 3, w: 0.05, k: 1, t: "tropen" },
    { id: "addisabeba", name: "Addis Abeba", lon: 38.8, lat: 8.98, g: 4.5, w: 0.35, k: 2 },
    { id: "tunis", name: "Tunis", lon: 10.23, lat: 36.85, g: 3, w: 0.2, k: 1, t: "sonne" },
    { id: "algier", name: "Algier", lon: 3.22, lat: 36.69, g: 3, w: 0.3, k: 1 },
    { id: "accra", name: "Accra", lon: -0.17, lat: 5.61, g: 3, w: 0.3, k: 1 },
    { id: "dakar", name: "Dakar", lon: -17.07, lat: 14.67, g: 2.5, w: 0.3, k: 1 },
    { id: "daressalaam", name: "Daressalam", lon: 39.2, lat: -6.88, g: 2.5, w: 0.3, k: 1 },
    { id: "luanda", name: "Luanda", lon: 13.23, lat: -8.86, g: 2.5, w: 0.35, k: 1 },
    { id: "dubai", name: "Dubai", lon: 55.36, lat: 25.25, g: 11, w: 0.45, k: 3 },
    { id: "doha", name: "Doha", lon: 51.61, lat: 25.27, g: 5, w: 0.45, k: 2 },
    { id: "telaviv", name: "Tel Aviv", lon: 34.89, lat: 32.01, g: 4.5, w: 0.45, k: 1 },
    { id: "riad", name: "Riad", lon: 46.7, lat: 24.96, g: 5, w: 0.45, k: 2 },
    { id: "abudhabi", name: "Abu Dhabi", lon: 54.65, lat: 24.43, g: 5, w: 0.45, k: 2 },
    { id: "dschidda", name: "Dschidda", lon: 39.16, lat: 21.68, g: 4, w: 0.3, k: 1 },
    { id: "amman", name: "Amman", lon: 35.99, lat: 31.72, g: 3, w: 0.35, k: 1 },
    { id: "maskat", name: "Maskat", lon: 58.28, lat: 23.59, g: 2.5, w: 0.35, k: 1 },
    { id: "delhi", name: "Delhi", lon: 77.1, lat: 28.56, g: 9, w: 0.35, k: 3 },
    { id: "mumbai", name: "Mumbai", lon: 72.87, lat: 19.09, g: 9, w: 0.4, k: 3 },
    { id: "malediven", name: "Malediven", lon: 73.53, lat: 4.19, g: 2, w: 0.02, k: 1, t: "tropen" },
    { id: "bangkok", name: "Bangkok", lon: 100.75, lat: 13.69, g: 8, w: 0.25, k: 3, t: "tropen" },
    { id: "singapur", name: "Singapur", lon: 103.99, lat: 1.36, g: 10, w: 0.5, k: 3 },
    { id: "kualalumpur", name: "Kuala Lumpur", lon: 101.71, lat: 2.75, g: 5, w: 0.35, k: 2 },
    { id: "jakarta", name: "Jakarta", lon: 106.66, lat: -6.13, g: 7, w: 0.3, k: 2 },
    { id: "bali", name: "Bali", lon: 115.17, lat: -8.75, g: 4, w: 0.05, k: 1, t: "tropen" },
    { id: "hongkong", name: "Hongkong", lon: 113.91, lat: 22.31, g: 9, w: 0.55, k: 3 },
    { id: "peking", name: "Peking", lon: 116.58, lat: 40.08, g: 10, w: 0.45, k: 3 },
    { id: "shanghai", name: "Shanghai", lon: 121.81, lat: 31.14, g: 10, w: 0.5, k: 3 },
    { id: "tokio", name: "Tokio", lon: 139.78, lat: 35.55, g: 12, w: 0.55, k: 3 },
    { id: "seoul", name: "Seoul", lon: 126.44, lat: 37.46, g: 8, w: 0.5, k: 3 },
    { id: "osaka", name: "Osaka", lon: 135.24, lat: 34.43, g: 5, w: 0.45, k: 2 },
    { id: "taipeh", name: "Taipeh", lon: 121.23, lat: 25.08, g: 5, w: 0.45, k: 2 },
    { id: "manila", name: "Manila", lon: 121.02, lat: 14.51, g: 6, w: 0.3, k: 2 },
    { id: "guangzhou", name: "Guangzhou", lon: 113.3, lat: 23.39, g: 7, w: 0.4, k: 2 },
    { id: "chengdu", name: "Chengdu", lon: 103.95, lat: 30.58, g: 6, w: 0.35, k: 2 },
    { id: "hochiminh", name: "Ho-Chi-Minh-Stadt", lon: 106.66, lat: 10.82, g: 5, w: 0.35, k: 2 },
    { id: "hanoi", name: "Hanoi", lon: 105.81, lat: 21.22, g: 4, w: 0.35, k: 1 },
    { id: "phuket", name: "Phuket", lon: 98.32, lat: 8.11, g: 3, w: 0.05, k: 1, t: "tropen" },
    { id: "busan", name: "Busan", lon: 128.94, lat: 35.18, g: 3.5, w: 0.3, k: 1 },
    { id: "sapporo", name: "Sapporo", lon: 141.69, lat: 42.78, g: 3, w: 0.3, k: 1, t: "schnee" },
    { id: "kolkata", name: "Kolkata", lon: 88.45, lat: 22.65, g: 5, w: 0.3, k: 2 },
    { id: "bangalore", name: "Bangalore", lon: 77.71, lat: 13.2, g: 5, w: 0.5, k: 2 },
    { id: "karachi", name: "Karachi", lon: 67.16, lat: 24.9, g: 5, w: 0.35, k: 2 },
    { id: "colombo", name: "Colombo", lon: 79.88, lat: 7.18, g: 3, w: 0.2, k: 1, t: "tropen" },
    { id: "sydney", name: "Sydney", lon: 151.18, lat: -33.95, g: 8, w: 0.4, k: 3, t: "sued" },
    { id: "melbourne", name: "Melbourne", lon: 144.84, lat: -37.67, g: 6, w: 0.4, k: 2 },
    { id: "perth", name: "Perth", lon: 115.97, lat: -31.94, g: 3.5, w: 0.4, k: 1, t: "sued" },
    { id: "auckland", name: "Auckland", lon: 174.79, lat: -37.01, g: 4, w: 0.35, k: 2, t: "sued" },
    { id: "brisbane", name: "Brisbane", lon: 153.12, lat: -27.38, g: 5, w: 0.4, k: 2, t: "sued" },
    { id: "adelaide", name: "Adelaide", lon: 138.53, lat: -34.95, g: 2.5, w: 0.35, k: 1, t: "sued" },
    { id: "cairns", name: "Cairns", lon: 145.75, lat: -16.88, g: 2.5, w: 0.05, k: 1, t: "tropen" },
    { id: "wellington", name: "Wellington", lon: 174.81, lat: -41.33, g: 2.5, w: 0.45, k: 1, t: "sued" },
    { id: "christchurch", name: "Christchurch", lon: 172.53, lat: -43.49, g: 2, w: 0.3, k: 1, t: "sued" },
    { id: "nadi", name: "Fidschi", lon: 177.44, lat: -17.76, g: 1.5, w: 0.02, k: 1, t: "tropen" },
  ];
  // Kontinent, grob nach Lage.
  function kontinentVon(c, europa) {
    if (europa) return "europa";
    if (c.lon < -30) return c.lat > 14 ? "nordamerika" : "suedamerika";
    if (c.lon > 110 && c.lat < -10) return "ozeanien";
    if (c.lon < 52 && c.lat < 37 && !(c.lon > 34 && c.lat > 29)) return c.lon > 34 && c.lat > 12 ? "nahost" : "afrika";
    if (c.lon < 60) return "nahost";
    return "asien";
  }
  for (const c of STAEDTE) c.r = kontinentVon(c, true);
  for (const c of WELT) c.r = kontinentVon(c, false);
  const KONTINENTE = { europa: "Europa", nordamerika: "Nordamerika", suedamerika: "Südamerika", afrika: "Afrika", nahost: "Nahost", asien: "Asien", ozeanien: "Ozeanien" };
  const ALLE = STAEDTE.concat(WELT);
  const STADT = Object.fromEntries(ALLE.map((s) => [s.id, s]));

  // Saisonfaktor für Urlauber.
  const SAISONEN = [
    { name: "Frühling", icon: "🌱", sonne: 1.0, schnee: 0.8, sued: 0.9, tropen: 1.0 },
    { name: "Sommer", icon: "☀️", sonne: 1.75, schnee: 0.7, sued: 0.7, tropen: 0.8 },
    { name: "Herbst", icon: "🍂", sonne: 0.9, schnee: 0.85, sued: 1.0, tropen: 1.0 },
    { name: "Winter", icon: "❄️", sonne: 0.6, schnee: 1.9, sued: 1.7, tropen: 1.6 },
  ];
  const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Die Rivalen, jeder mit eigenem Stil. Namen und Gesichter sind erfunden.
  const RIVALEN = {
    k: {
      name: "Kontinentia", chef: "Harald Brenner", farbe: "#E0574F", service: "standard", basis: "paris", ersatz: "frankfurt",
      stil: "platzhirsch", geld: 9000000, start: 7, text: "Der Platzhirsch: alt, groß, sitzt auf den besten Slots.",
      sprueche: { gross: "Die guten Landerechte? Gehören bald alle mir.", gegen: "Junge Airlines kommen und gehen.", verliert: "Hm. Sie sind hartnäckiger als gedacht." },
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
  const HEIMAT = ["london", "paris", "frankfurt", "amsterdam", "madrid", "istanbul", "muenchen", "berlin", "rom", "wien",
    "newyork", "losangeles", "chicago", "atlanta", "mexiko", "saopaulo", "dubai", "delhi", "mumbai", "bangkok", "singapur", "hongkong", "peking", "shanghai", "tokio", "seoul", "sydney",
    "dublin", "lissabon", "kopenhagen", "athen", "helsinki", "warschau", "hamburg", "toronto", "miami", "denver", "seattle", "houston",
    "buenosaires", "bogota", "lima", "kairo", "johannesburg", "lagos", "nairobi", "addisabeba", "doha", "riad",
    "osaka", "manila", "kualalumpur", "jakarta", "melbourne", "perth", "auckland", "brisbane"];

  // Wie leicht der Start ist: gemessen in Probepartien (Firmenwert nach 30 Tagen, 5 Partien je Stadt).
  // Entscheidend sind Ziele in der Nähe und wie dicht die Rivalen sitzen. Neu messen, wenn sich Städte ändern.
  const SCHWIERIGKEIT = {
    berlin: "leicht", lissabon: "leicht", helsinki: "leicht", houston: "leicht", muenchen: "leicht", tokio: "leicht", athen: "leicht", hamburg: "leicht", kopenhagen: "leicht", chicago: "leicht", kairo: "leicht", dublin: "leicht", dubai: "leicht", istanbul: "leicht", seattle: "leicht", denver: "leicht", miami: "leicht", rom: "leicht", warschau: "leicht", wien: "leicht", mexiko: "leicht",
    losangeles: "mittel", london: "mittel", manila: "mittel", kualalumpur: "mittel", toronto: "mittel", osaka: "mittel", madrid: "mittel", delhi: "mittel", singapur: "mittel", newyork: "mittel", frankfurt: "mittel", doha: "mittel", bangkok: "mittel", mumbai: "mittel", paris: "mittel", amsterdam: "mittel", hongkong: "mittel", atlanta: "mittel", riad: "mittel", addisabeba: "mittel", seoul: "mittel", peking: "mittel", johannesburg: "mittel", shanghai: "mittel",
    saopaulo: "schwer", jakarta: "schwer", bogota: "schwer", sydney: "schwer", buenosaires: "schwer", lagos: "schwer", lima: "schwer", nairobi: "schwer", brisbane: "schwer", melbourne: "schwer", perth: "schwer", auckland: "schwer",
  };

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

  const entfernungen = new Map();   // Stadt -> Map(Stadt -> km), ohne Zeichenketten zu bauen
  function entfernung(a, b) {
    let zeile = entfernungen.get(a);
    if (!zeile) entfernungen.set(a, (zeile = new Map()));
    const da = zeile.get(b);
    if (da !== undefined) return da;
    const A = STADT[a], B = STADT[b];
    const r = Math.PI / 180;
    const h = Math.sin(((B.lat - A.lat) * r) / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(((B.lon - A.lon) * r) / 2) ** 2;
    const km = Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
    zeile.set(b, km);
    return km;
  }
  const paar = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const tagVon = (st) => Math.floor(st.zeit / 24) + 1;
  const wochentag = (tag) => (tag - 1) % 7;
  const saison = (tag) => SAISONEN[Math.floor((tag - 1) / REGELN.saisonTage) % 4];
  const ticket = (km) => REGELN.grundpreis + REGELN.proKm * km;

  function staedte() { return ALLE; }

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
    const basis = REGELN.nachfrage * A.g * B.g * entfernungsFaktor(km) / (A.r !== B.r ? 1.4 : 1) * trendFaktor(st, a, b, tag);
    const wt = wochentag(tag), sai = saison(tag);
    const w = (A.w + B.w) / 2;
    let geschaeft = basis * w * (wt < 5 ? 1.22 : 0.45);
    let urlaub = basis * (1 - w) * (wt < 5 ? 0.86 : 1.4) * Math.min(2, stadtFaktor(A, sai) * stadtFaktor(B, sai));
    for (const m of st.messen) {
      if (tag >= m.von && tag <= m.bis && (m.stadt === a || m.stadt === b)) geschaeft *= 2.6;
    }
    return { urlaub, geschaeft };
  }

  // Nachfrage ändert sich über die Zeit: Städte wachsen oder schrumpfen, manche Strecken kommen in Mode.
  function trendFaktor(st, a, b, tag) {
    let f = 1;
    if (st.trend) { if (st.trend[a]) f *= st.trend[a].f; if (st.trend[b]) f *= st.trend[b].f; }
    if (st.mode && tag <= st.mode.bis && paar(a, b) === paar(st.mode.a, st.mode.b)) f *= st.mode.f;
    return f;
  }
  // +1 = Nachfrage steigt gerade, -1 = sie sinkt, 0 = ruhig. Für die Pfeile auf der Karte.
  function trendVon(st, a, b) {
    const tag = tagVon(st);
    if (st.mode && tag <= st.mode.bis && paar(a, b) === paar(st.mode.a, st.mode.b)) return 2;
    let d = 0;
    for (const c of [a, b]) { const t = st.trend && st.trend[c]; if (t && t.d && tag <= t.bis) d += Math.sign(t.d); }
    return Math.sign(d);
  }
  function stadtTrend(st, c) {
    const t = st.trend && st.trend[c];
    return t && t.d && tagVon(st) <= t.bis ? Math.sign(t.d) : 0;
  }
  function trendsTag(st, tag) {
    st.trend = st.trend || {};
    for (const [c, t] of Object.entries(st.trend)) {
      if (t.d && tag <= t.bis) t.f = Math.max(0.55, Math.min(1.8, t.f * (1 + t.d)));
      else { t.d = 0; t.f = 1 + (t.f - 1) * 0.97; if (Math.abs(t.f - 1) < 0.02) delete st.trend[c]; }
    }
    if (tag < REGELN.trendAb) return;
    const p = st.airlines[SPIELER];
    const nah = [...new Set(p.routen.flatMap((r) => [r.a, r.b]))];
    if (tag % 4 === 0) {
      const pool = (nah.length && zufall(st) < 0.6 ? nah : ALLE.filter((c) => c.k >= 2).map((c) => c.id)).filter((c) => !stadtTrend(st, c));
      if (pool.length) {
        const c = waehle(st, pool);
        const hoch = zufall(st) < 0.55;
        const dauer = 7 + Math.floor(zufall(st) * 6);
        st.trend[c] = { f: (st.trend[c] && st.trend[c].f) || 1, d: hoch ? 0.035 : -0.03, bis: tag + dauer };
        melden(st, { art: hoch ? "trendhoch" : "trendrunter", stadt: c, text: hoch ? `📈 ${STADT[c].name} wird beliebter: mehr Gäste in den nächsten Tagen.` : `📉 ${STADT[c].name} verliert Gäste: die Nachfrage sinkt eine Weile.` });
      }
    }
    if (tag % 9 === 5 && (!st.mode || tag > st.mode.bis)) {
      const a = nah.length ? waehle(st, nah) : p.basis;
      const ziele = ALLE.filter((c) => c.id !== a && c.k >= 2 && entfernung(a, c.id) > 500 && entfernung(a, c.id) < 4500);
      if (ziele.length) {
        const b = waehle(st, ziele).id;
        st.mode = { a, b, f: 1.8, bis: tag + 8 };
        melden(st, { art: "mode", stadt: b, von: a, text: `🔥 ${STADT[a].name}–${STADT[b].name} ist gerade in Mode: 8 Tage lang viel mehr Gäste.` });
      }
    }
  }

  // ---------- Neues Spiel ----------
  function neueAirline(id, d) {
    return {
      id, name: d.name, farbe: d.farbe, service: d.service, grundsaetze: { ...VORLAGEN[d.service] }, basis: d.basis, stil: d.stil || null,
      assistenten: {},
      ruf: REGELN.rufStart, geld: d.geld, kredit: 0, slots: {}, flotte: [], routen: [], naechste: 1,
      wechselBis: 0, verlauf: [],
    };
  }

  function neuesSpiel(opt) {
    opt = opt || {};
    const st = {
      version: 2, zeit: 6, rng: (opt.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
      kerosin: 1, kerosinBis: 0, messen: [], gelegenheiten: [], meldungen: [], naechsteGel: 1,
      welt: false, platz1: false, stufe: 1, pleite: { stufe: 0, tage: 0 }, ende: null,
      airlines: {}, reihenfolge: [SPIELER, "k", "s", "a"], letzterTag: null, stand: 0,
    };
    const basis = opt.basis || "frankfurt";
    const name = opt.name || NAMEN[0];
    // Alle starten bei Null: kein Flugzeug, keine Route, nur Startgeld und zwei Landerechte daheim.
    const p = neueAirline(SPIELER, { name: name.name, farbe: name.farbe, service: opt.service || "standard", basis, geld: REGELN.startGeld });
    p.slots[basis] = REGELN.startSlots;
    st.airlines[SPIELER] = p;
    // Die Rivalen sitzen in der Nähe: der Platzhirsch im nächsten Weltdrehkreuz, die anderen in Großstädten.
    const vergeben = new Set([basis]);
    const nah = (filter) => ALLE.filter((c) => !vergeben.has(c.id) && filter(c)).sort((x, y) => entfernung(basis, x.id) - entfernung(basis, y.id))[0].id;
    const WAHL = { k: (c) => c.k === 3, s: (c) => c.k === 2, a: (c) => c.k >= 2 && c.w >= 0.45 };
    for (const [id, r] of Object.entries(RIVALEN)) {
      const b = nah(WAHL[id]);
      vergeben.add(b);
      const a = neueAirline(id, { name: r.name, farbe: r.farbe, service: r.service, basis: b, stil: r.stil, geld: REGELN.startGeld });
      a.slots[b] = REGELN.startSlots;
      st.airlines[id] = a;
    }
    st.ziel = 0;
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
    for (const id of st.reihenfolge) { const a = st.airlines[id]; n += Math.max(0, (a.slots[stadt] || 0) - (a.basis === stadt ? REGELN.heimatPlaetze : 0)); }
    return n;
  }
  function slotsFrei(st, stadt) { return REGELN.slotPlaetze[STADT[stadt].k] + ((st.ausbau && st.ausbau[stadt]) || 0) - slotsBelegt(st, stadt); }
  const heimatPlatz = (a, stadt) => stadt === a.basis && (a.slots[stadt] || 0) < REGELN.heimatPlaetze;
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
    if (a.id !== SPIELER) return t.stufe <= (a.stufe || 1);
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
      if (!heimatPlatz(a, s) && slotsFrei(st, s) <= 0) slotFehlt = true;
      slots += slotPreis(st, s);
    }
    const flugzeug = frei ? 0 : TYPEN[typ].preis;
    return { flugzeug, slots, gesamt: flugzeug + slots, slotFehlt, frei: !!frei };
  }

  function kannFliegen(st, aid, x, y, typ, opt) {
    if (x === y) return { ok: false, grund: "gleich" };
    const a = st.airlines[aid];
    if (!typFrei(st, a, typ)) return { ok: false, grund: "gesperrt" };
    if (entfernung(x, y) > TYPEN[typ].reichweite) return { ok: false, grund: "reichweite" };
    const k = kostenFuer(st, aid, x, y, typ);
    if (opt && opt.nurFrei && !k.frei) return { ok: false, grund: "keinFlugzeug", kosten: k };
    if (k.slotFehlt) return { ok: false, grund: "slots", kosten: k };
    if (k.gesamt > a.geld) return { ok: false, grund: "geld", kosten: k };
    return { ok: true, kosten: k };
  }

  // Eröffnet eine Route oder setzt ein weiteres Flugzeug darauf.
  function fliegen(st, aid, x, y, typ, opt) {
    const test = kannFliegen(st, aid, x, y, typ, opt);
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
  // Sitzaufteilung einer Linie: Anteil der Kabine für Business und First (Rest Economy).
  function klassenSetzen(st, aid, rid, business, first) {
    const r = st.airlines[aid].routen.find((x) => x.id === rid);
    if (!r) return false;
    business = Math.max(0, Math.min(KLASSEN_MAX.business, Math.round(business * 10) / 10));
    first = Math.max(0, Math.min(KLASSEN_MAX.first, Math.round(first * 10) / 10));
    r.klassen = { business, first };
    geaendert(st);
    return true;
  }
  // Probiert alle Aufteilungen durch und nimmt die beste.
  function besteKlassen(st, aid, rid) {
    let best = null;
    for (let b = 0; b <= KLASSEN_MAX.business + 0.0001; b += 0.1) {
      for (let f = 0; f <= KLASSEN_MAX.first + 0.0001; f += 0.1) {
        const k = klonen(st);
        klassenSetzen(k, aid, rid, b, f);
        const g = berechnen(k, tagVon(k)).summe[aid];
        if (!best || g > best.g + 1) best = { g, business: Math.round(b * 10) / 10, first: Math.round(f * 10) / 10 };
      }
    }
    return best;
  }

  // Einen Grundsatz ändern. Wird es für die Gäste schlechter, leidet der Ruf ein wenig.
  function grundsatzSetzen(st, aid, k, wert) {
    const a = st.airlines[aid];
    if (!GRUNDSAETZE[k] || !GRUNDSAETZE[k].optionen[wert]) return false;
    a.grundsaetze = a.grundsaetze || { ...VORLAGEN[a.service || "standard"] };
    if (a.grundsaetze[k] === wert) return false;
    const vorher = profil(a).komfort;
    a.grundsaetze = { ...a.grundsaetze, [k]: wert };
    const nachher = profil(a);
    if (nachher.komfort < vorher) a.ruf = Math.max(5, a.ruf - REGELN.rufVerschlechtern * (vorher - nachher.komfort));
    a.service = nachher.art;
    geaendert(st);
    return true;
  }
  function vorlageSetzen(st, aid, vorlage) {
    for (const [k, w] of Object.entries(VORLAGEN[vorlage])) grundsatzSetzen(st, aid, k, w);
  }

  // ---------- Flugbetrieb ----------
  function umlauf(typ, km, a) {
    const t = TYPEN[typ];
    const flug = km / t.kmh + 0.35;            // Start, Landung, Rollen
    const wende = profil(a).wende;
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
    const sv = profil(a), sf = STUFEN[stufe];
    let preis = gast === "geschaeft" ? (sv.treu && sf.geschaeftTreu ? sf.geschaeftTreu : sf.geschaeft) : sf.urlaub;
    const pokale = 1 + 0.03 * Math.min(5, a.pokale || 0);
    return sv.gast[gast] * preis * (0.55 + a.ruf / 100) * (1 + REGELN.qualitaet * sv.komfort) * pokale;
  }
  const ausgebaut = (a, stadt) => !!(a.ausgebaut && a.ausgebaut.includes(stadt));
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
        const fk = wirkung(st, aid, "kapazitaet", tag, r.a, r.b);   // Streik, Sturm: weniger Flüge
        const ker = (wirkung(st, aid, "kerosinFest", tag) < 1 ? 1 : st.kerosin) * wirkung(st, aid, "kerosin", tag);
        for (const f of fs) {
          const t = TYPEN[f.typ], u = umlauf(f.typ, km, a);
          sitze += Math.round(t.sitze * profil(a).sitze) * u.legs / 2 * fk;
          legs += u.legs;
          kerosin += u.legs * km * t.verbrauch * ker * profil(a).betrieb * fk;
          gebuehr += u.legs * g * t.groesse * profil(a).betrieb * fk;
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
        const att = liste.map((o) => anziehung(o.a, o.r.stufe, gast) * (ausgebaut(o.a, x) || ausgebaut(o.a, y) ? REGELN.ausbauGaeste : 1));
        const summe = att.reduce((s, v) => s + v, 0);
        const markt = n[gast] * marktGroesse(summe);
        liste.forEach((o, i) => { o.e.lokal[gast] = markt * att[i] / summe; });
      }
    }
    // Umsteiger an Drehkreuzen.
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const sv = profil(a);
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
            pax *= REGELN.umsteigerAnteil * sv.umsteiger * direkt * (ausgebaut(a, h) ? REGELN.ausbauUmsteiger : 1);
            const preis = ticket(dd) * sv.preis * 0.9;
            const u = { pax, preis, wege: [r1.id, r2.id], km: [d1, d2], ziel: [y, x], ueber: h };
            routen[r1.id].umsteiger.push(u);
            routen[r2.id].umsteiger.push(u);
          }
        }
      }
    }
    // Plätze begrenzen, Klasse für Klasse. Wer in First oder Business keinen Platz findet,
    // fliegt zum Teil eine Klasse tiefer mit. Umsteiger fliegen Economy.
    for (const e of Object.values(routen)) {
      const a = st.airlines[e.airline];
      const r = a.routen.find((x) => x.id === e.id);
      const kl = klassenVon(r, a);
      const S = { first: e.sitze * kl.first / KLASSEN.first.platz, business: e.sitze * kl.business / KLASSEN.business.platz };
      S.eco = e.sitze * (1 - kl.first - kl.business);
      const D = klassenNachfrage(e, profil(a));
      const f = Math.min(D.first, S.first);
      D.business += (D.first - f) * 0.6;
      const b = Math.min(D.business, S.business);
      D.eco += (D.business - b) * 0.5;
      const umst = e.umsteiger.reduce((s, u) => s + u.pax, 0);
      e.bedarf = D.first + D.business + D.eco + umst;
      e.faktor = D.eco + umst > 0 ? Math.min(1, S.eco / (D.eco + umst)) : 1;
      e.klassen = { first: { sitze: S.first, pax: f }, business: { sitze: S.business, pax: b }, eco: { sitze: S.eco, pax: D.eco * e.faktor } };
      e.sitzePlaetze = S.first + S.business + S.eco;
    }
    for (const e of Object.values(routen)) {
      const a = st.airlines[e.airline];
      const r = a.routen.find((x) => x.id === e.id);
      const sv = profil(a), sf = STUFEN[r.stufe];
      const preis = ticket(e.km) * sv.preis * sf.preis;
      const k = e.klassen;
      const lokal = k.eco.pax + k.business.pax + k.first.pax;
      const lokalErl = preis * (k.eco.pax + k.business.pax * KLASSEN.business.preis + k.first.pax * KLASSEN.first.preis);
      const lokalService = k.eco.pax + k.business.pax * KLASSEN.business.service + k.first.pax * KLASSEN.first.service;
      let umst = 0, umstErl = 0, zubringerWert = 0;
      for (const u of e.umsteiger) {
        const anderer = routen[u.wege[0] === e.id ? u.wege[1] : u.wege[0]];
        const pax = u.pax * Math.min(e.faktor, anderer.faktor);
        const meinAnteil = u.wege[0] === e.id ? u.km[0] / (u.km[0] + u.km[1]) : u.km[1] / (u.km[0] + u.km[1]);
        umst += pax;
        umstErl += 2 * pax * u.preis * meinAnteil;
        zubringerWert += 2 * pax * u.preis * (1 - meinAnteil);
      }
      k.eco.pax += umst;
      e.pax = 2 * (lokal + umst);
      e.auslastung = e.sitzePlaetze > 0 ? (lokal + umst) / e.sitzePlaetze : 0;
      e.extras = 2 * (lokal + umst) * sv.extra;
      e.erloes = 2 * lokalErl + umstErl + e.extras;
      e.service = 2 * (lokalService + umst) * sv.kosten;
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
    for (const aid of st.reihenfolge) summe[aid] -= verwaltungKosten(st.airlines[aid]);
    return { routen, summe, tag };
  }

  // Wirkungen auf Zeit (Streik, Sturm, Kerosin-Wette). Gibt den Faktor für Airline, Tag und Stadt zurück.
  function wirkung(st, aid, art, tag, x, y) {
    let f = 1;
    for (const w of st.wirkungen || []) {
      if (w.aid !== aid || w.art !== art || tag < w.von || tag > w.bis) continue;
      if (w.stadt && w.stadt !== x && w.stadt !== y) continue;
      f *= w.f;
    }
    return f;
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
    const sv = profil(a);
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
    const t = TYPEN[typ], u = umlauf(typ, km, a);
    let sitze = Math.round(t.sitze * sv.sitze) * u.legs / 2;
    let vorhanden = 0;
    if (eigene) for (const f of flugzeugeAuf(a, eigene.id)) vorhanden += Math.round(TYPEN[f.typ].sitze * sv.sitze) * umlauf(f.typ, km, a).legs / 2;
    const flieg = Math.max(0, Math.min(sitze, pax - vorhanden));
    const preis = ticket(km) * sv.preis + sv.extra;
    const g = (REGELN.gebuehr[STADT[x].k] + REGELN.gebuehr[STADT[y].k]) / 2;
    const kosten = u.legs * (km * t.verbrauch * st.kerosin + g * t.groesse) * sv.betrieb + t.crew + 2 * flieg * sv.kosten;
    return { gewinn: 2 * flieg * preis - kosten, auslastung: flieg / sitze, pax: 2 * flieg };
  }

  // Drei Vorschläge für die erste Linie: günstig, gut fürs Drehkreuz, große Chance.
  function angebote(st, aid) {
    const a = st.airlines[aid];
    const x = a.basis;
    const kand = [];
    for (const c of ALLE) {
      if (c.id === x || routeVon(a, x, c.id)) continue;
      let best = null;
      for (const typ of Object.keys(TYPEN)) {
        const t = kannFliegen(st, aid, x, c.id, typ);
        if (!t.ok) continue;
        const g = schaetzen(st, aid, x, c.id, typ).gewinn;
        if (g <= 0) continue;
        const o = { ziel: c.id, typ, gesamt: t.kosten.gesamt, gewinn: g, k: c.k };
        if (!best || g / Math.sqrt(o.gesamt) > best.gewinn / Math.sqrt(best.gesamt)) best = o;
      }
      if (best) kand.push(best);
    }
    if (!kand.length) return [];
    const raus = new Set();
    const nimm = (liste, art, grund) => {
      const o = liste.find((v) => !raus.has(v.ziel));
      if (!o) return null;
      raus.add(o.ziel);
      const w = o.gewinn * 7;
      const streu = art === "chance" ? 0.45 : 0.25;
      return Object.assign({}, o, { art, grund: grund(o), von: Math.round(w * (1 - streu) / 1e4) * 1e4, bis: Math.round(w * (1 + streu) / 1e4) * 1e4 });
    };
    const erg = [];
    erg.push(nimm([...kand].sort((p, q) => p.gesamt - q.gesamt || q.gewinn - p.gewinn), "guenstig",
      (o) => "Wenig Geld nötig, viel Reserve."));
    erg.push(nimm(kand.filter((o) => o.k >= 2).sort((p, q) => STADT[q.ziel].k - STADT[p.ziel].k || q.gewinn - p.gewinn), "drehkreuz",
      (o) => "Große Stadt: später viele Umsteiger."));
    // Chance: stärkster Typ zum lohnendsten Ziel, ruhig teurer
    const stark = [];
    for (const o of kand) {
      let b = o;
      for (const typ of Object.keys(TYPEN)) {
        const t = kannFliegen(st, aid, x, o.ziel, typ);
        if (!t.ok) continue;
        const g = schaetzen(st, aid, x, o.ziel, typ).gewinn;
        if (g > b.gewinn) b = { ziel: o.ziel, typ, gesamt: t.kosten.gesamt, gewinn: g, k: o.k };
      }
      stark.push(b);
    }
    erg.push(nimm(stark.sort((p, q) => q.gewinn - p.gewinn), "chance",
      (o) => "Viel Gewinn, braucht aber " + Math.round(o.gesamt / Math.max(1, a.geld) * 100) + " % deines Geldes."));
    return erg.filter(Boolean);
  }

  // ---------- Assistenten ----------
  // Die Analysten sind nie ganz genau: Sie nennen Spannen, und jeder hat eine Macke.
  const ANALYSTEN = {
    tim: { name: "Tim Brandt", bild: "air-assistent-tim", sterne: 1, gehalt: 1500, macke: 1.3, mackeText: "übertreibt gern", streuung: 0.45 },
    mia: { name: "Mia Kaya", bild: "air-assistent-mia", sterne: 2, gehalt: 4000, macke: 1.0, mackeText: "solide", streuung: 0.25 },
    kern: { name: "Dr. Helga Kern", bild: "air-assistent-kern", sterne: 3, gehalt: 9000, macke: 0.85, mackeText: "eher vorsichtig", streuung: 0.12 },
  };
  const PREISPROFIS = {
    paul: { name: "Paul Wendt", bild: "air-assistent-paul", sterne: 2, gehalt: 3000, macke: 1.0, mackeText: "mag Experimente", streuung: 0.3 },
  };
  // Controlling: liefert jeden Sonntag (Ende der Jahreszeit) einen Wochenbericht mit den schwächsten Linien.
  const CONTROLLER = {
    jonas: { name: "Jonas Ritter", bild: "air-assistent-jonas", sterne: 1, gehalt: 2000, macke: 1.0, mackeText: "übersieht manches", streuung: 0.45 },
    lena: { name: "Lena Vogt", bild: "air-assistent-lena", sterne: 2, gehalt: 4500, macke: 1.0, mackeText: "zuverlässig", streuung: 0.2 },
    ines: { name: "Ines Falk", bild: "air-assistent-ines", sterne: 3, gehalt: 9000, macke: 1.0, mackeText: "findet fast alles", streuung: 0.08 },
  };
  const ROLLEN = { analyst: ANALYSTEN, preis: PREISPROFIS, controller: CONTROLLER };
  function assistent(a, rolle) {
    const id = a.assistenten && a.assistenten[rolle];
    return id ? Object.assign({ id }, ROLLEN[rolle][id]) : null;
  }
  function einstellen(st, aid, rolle, id) {
    const a = st.airlines[aid];
    if (!ROLLEN[rolle] || (id && !ROLLEN[rolle][id])) return false;
    a.assistenten = a.assistenten || {};
    a.assistenten[rolle] = id || null;
    a.auftraege = a.auftraege || {};
    delete a.auftraege[rolle];
    return true;
  }
  function gehaelter(a) {
    let g = 0;
    for (const rolle of Object.keys(ROLLEN)) { const x = assistent(a, rolle); if (x) g += x.gehalt; }
    return g;
  }
  function umbenennen(st, aid, name, farbe) {
    const a = st.airlines[aid];
    const n = String(name || "").trim().slice(0, 18);
    if (n) a.name = n;
    if (farbe) a.farbe = farbe;
    return true;
  }
  // Einen Auftrag geben: "routen" ab einer Stadt (Analyst) oder "preise" für alle Linien (Preisprofi).
  // gruendlich: dauert dreimal so lange, ist dafür etwa doppelt so genau.
  function auftragGeben(st, aid, rolle, stadt, gruendlich) {
    const a = st.airlines[aid];
    if (!assistent(a, rolle)) return false;
    a.auftraege = a.auftraege || {};
    a.auftraege[rolle] = { stadt: stadt || null, gruendlich: !!gruendlich, fertig: st.zeit + REGELN.auftragStunden * (gruendlich ? 3 : 1), start: st.zeit };
    return true;
  }
  // Eine Zufallszahl um 1 herum (Glockenkurve), damit Schätzungen mal daneben liegen.
  function rauschen(st, streuung) {
    const u = zufall(st) + zufall(st) + zufall(st) - 1.5;    // grob normalverteilt, -1.5 .. 1.5
    return Math.exp(u * streuung * 1.4);
  }
  function spanne(wert, streuung) {
    const d = Math.abs(wert) * streuung;
    return [Math.round(wert - d), Math.round(wert + d)];
  }
  function routenBericht(st, aid, stadt, wer) {
    const a = st.airlines[aid];
    const tag = tagVon(st);
    const typen = Object.keys(TYPEN).filter((t) => typFrei(st, a, t));
    const kandidaten = [];
    for (const c of ALLE) {
      if (c.id === stadt || routeVon(a, stadt, c.id)) continue;
      let best = null;
      for (const typ of typen) {
        if (entfernung(stadt, c.id) > TYPEN[typ].reichweite) continue;
        const s = schaetzen(st, aid, stadt, c.id, typ);
        if (!best || s.gewinn > best.gewinn) best = { ...s, typ };
      }
      if (best && best.gewinn > 0) kandidaten.push({ ziel: c.id, ...best });
    }
    kandidaten.sort((x, y) => y.gewinn - x.gewinn);
    // Der Analyst schaut sich die besten an, aber er sieht sie durch seine eigene Brille.
    const gesehen = kandidaten.slice(0, 8).map((k) => ({ ...k, schaetzung: k.gewinn * wer.macke * rauschen(st, wer.streuung) }));
    gesehen.sort((x, y) => y.schaetzung - x.schaetzung);
    return gesehen.slice(0, 3).map((k) => {
      const n = grundNachfrage(st, stadt, k.ziel, tag);
      const gaeste = (n.urlaub + n.geschaeft) * wer.macke * rauschen(st, wer.streuung);
      const geschaeft = Math.round(n.geschaeft / Math.max(1, n.urlaub + n.geschaeft) * 10) * 10;
      const konkurrenz = st.reihenfolge.filter((b) => b !== aid && routeVon(st.airlines[b], stadt, k.ziel)).length;
      let preis = konkurrenz >= 2 ? "angreifen" : geschaeft >= 50 && !konkurrenz ? "abschoepfen" : "normal";
      if (zufall(st) < wer.streuung * 0.6) preis = ["angreifen", "normal", "abschoepfen"][Math.floor(zufall(st) * 3)];
      return { start: stadt, ziel: k.ziel, typ: k.typ, km: Math.round(entfernung(stadt, k.ziel)), gewinn: spanne(k.schaetzung, wer.streuung), gaeste: spanne(gaeste, wer.streuung), geschaeft, konkurrenz, preis };
    });
  }
  function preisBericht(st, aid, wer) {
    const a = st.airlines[aid];
    const rg = rechnung(st);
    const routen = a.routen.filter((r) => rg.routen[r.id]).sort((x, y) => rg.routen[y.id].pax - rg.routen[x.id].pax).slice(0, 10);
    const vorschlaege = [];
    for (const r of routen) {
      const e = rg.routen[r.id];
      const voll = e.bedarf > e.sitzePlaetze * 1.05 ? "mehr Gäste als Plätze" : e.auslastung < 0.6 ? "viele leere Plätze" : "passt ungefähr";
      let best = { stufe: r.stufe, wert: 0 };
      for (const stufe of Object.keys(STUFEN)) {
        if (stufe === r.stufe) continue;
        const pr = probe(st, aid, (k) => { preisStufe(k, aid, r.id, stufe); });
        if (!pr) continue;
        const wert = pr.delta * wer.macke + (rauschen(st, wer.streuung) - 1) * Math.max(5000, Math.abs(e.gewinn) * 0.3);
        if (wert > best.wert + 2000) best = { stufe, wert };
      }
      vorschlaege.push({ id: r.id, a: r.a, b: r.b, lage: voll, jetzt: r.stufe, stufe: best.stufe, plus: best.stufe === r.stufe ? null : spanne(best.wert, wer.streuung) });
    }
    return vorschlaege;
  }
  function auftraegePruefen(st) {
    const a = st.airlines[SPIELER];
    if (!a.auftraege) return;
    for (const [rolle, au] of Object.entries(a.auftraege)) {
      if (!au || au.bericht || st.zeit < au.fertig) continue;
      const wer = assistent(a, rolle);
      if (!wer) { delete a.auftraege[rolle]; continue; }
      if (au.gruendlich) wer.streuung /= 2;
      au.tag = tagVon(st);
      if (rolle === "analyst") au.bericht = routenBericht(st, SPIELER, au.stadt, wer);
      else au.bericht = preisBericht(st, SPIELER, wer);
      melden(st, { art: "bericht", text: wer.name + ": Mein Bericht ist fertig!", rolle });
    }
  }
  // Wochenbericht: Woche gegen Vorwoche, beste Linie, die drei schwächsten Linien mit je einem Vorschlag.
  function wochenbericht(st, aid, wer) {
    const a = st.airlines[aid];
    const rg = rechnung(st);
    const v = a.verlauf;
    const summe = (xs) => xs.reduce((s2, x) => s2 + x, 0);
    const linien = a.routen.filter((r) => rg.routen[r.id]).map((r) => ({ r, e: rg.routen[r.id], wert: rg.routen[r.id].gewinn + (rg.routen[r.id].zubringer || 0) }));
    linien.sort((x, y) => x.wert - y.wert);
    const beste = linien.length ? linien[linien.length - 1] : null;
    const schwach = linien.slice(0, Math.min(3, Math.max(0, linien.length - 1))).map(({ r, e, wert }) => {
      const ideen = [];
      for (const stufe of Object.keys(STUFEN)) if (stufe !== r.stufe) ideen.push({ art: "preis", stufe, f: (k) => preisStufe(k, aid, r.id, stufe) });
      const bk = besteKlassen(st, aid, r.id);
      if (bk) ideen.push({ art: "sitze", business: bk.business, first: bk.first, f: (k) => klassenSetzen(k, aid, r.id, bk.business, bk.first) });
      if (flugzeugeAuf(a, r.id).length > 1) ideen.push({ art: "abziehen", f: (k) => abziehen(k, aid, r.id) });
      else if (wert < 0) ideen.push({ art: "schliessen", f: (k) => routeSchliessen(k, aid, r.id) });
      let best = null;
      for (const idee of ideen) {
        const pr = probe(st, aid, idee.f);
        if (!pr) continue;
        const schaetzung = pr.delta * wer.macke + (rauschen(st, wer.streuung) - 1) * Math.max(5000, Math.abs(e.gewinn) * 0.3);
        if (!best || schaetzung > best.schaetzung) best = { ...idee, schaetzung };
      }
      const aktion = best && best.schaetzung > 2000 ? { art: best.art, stufe: best.stufe, business: best.business, first: best.first } : null;
      return { id: r.id, a: r.a, b: r.b, gewinn: Math.round(wert), auslastung: e.auslastung, aktion, plus: aktion ? spanne(best.schaetzung, wer.streuung) : null };
    });
    return {
      tag: tagVon(st), woche: Math.round(summe(v.slice(-7))), vorwoche: v.length > 7 ? Math.round(summe(v.slice(-14, -7))) : null,
      beste: beste ? { id: beste.r.id, a: beste.r.a, b: beste.r.b, gewinn: Math.round(beste.wert) } : null, schwach,
    };
  }
  // Missstände: Was stimmt an den Linien gerade nicht? Wenige, gebündelte Hinweise, die schlimmsten zuerst.
  function missstaende(st, aid, max) {
    const a = st.airlines[aid];
    const rg = rechnung(st);
    const tag = tagVon(st);
    const liste = [];
    for (const r of a.routen) {
      const e = rg.routen[r.id];
      if (!e || tag - (r.seit || 0) < 2) continue;
      const n = flugzeugeAuf(a, r.id).length;
      let h = null;
      if (r.duell) h = { art: "duell", schwere: 4, text: "Ein Rivale fliegt hier billiger.", vorschlag: "vergleich" };
      else if ((r.minus || 0) >= 3) h = { art: "verlust", schwere: 5, text: "Macht seit " + r.minus + " Tagen Verlust.", vorschlag: n > 1 ? "abziehen" : "schliessen" };
      else if (e.auslastung < 0.45) h = { art: "leer", schwere: 3, text: "Mehr als die Hälfte der Plätze bleibt leer.", vorschlag: r.stufe !== "angreifen" ? "billiger" : n > 1 ? "abziehen" : "schliessen" };
      else if (e.bedarf > e.sitzePlaetze * 1.3) h = { art: "voll", schwere: 2, text: "Viel mehr Gäste als Plätze.", vorschlag: "groesser" };
      else if (trendVon(st, r.a, r.b) < 0 && e.auslastung < 0.7) h = { art: "trend", schwere: 1, text: "Die Nachfrage sinkt gerade.", vorschlag: r.stufe !== "angreifen" ? "billiger" : null };
      if (h) liste.push({ id: r.id, a: r.a, b: r.b, ...h, schwere: h.schwere + Math.min(2, Math.abs(e.wert) / 50000) * (e.wert < 0 ? 1 : 0) });
    }
    liste.sort((x, y) => y.schwere - x.schwere);
    return liste.slice(0, max);
  }
  function wochenVorschlagUebernehmen(st, i) {
    const a = st.airlines[SPIELER];
    const w = a.wochenbericht;
    const x = w && w.schwach[i];
    if (!x || !x.aktion || x.erledigt || !a.routen.some((r) => r.id === x.id)) return false;
    const k = x.aktion;
    if (k.art === "preis") preisStufe(st, SPIELER, x.id, k.stufe);
    else if (k.art === "sitze") klassenSetzen(st, SPIELER, x.id, k.business, k.first);
    else if (k.art === "abziehen") abziehen(st, SPIELER, x.id);
    else if (k.art === "schliessen") routeSchliessen(st, SPIELER, x.id);
    x.erledigt = true;
    geaendert(st);
    return true;
  }
  function preisVorschlagUebernehmen(st, rid) {
    const a = st.airlines[SPIELER];
    const au = a.auftraege && a.auftraege.preis;
    const v = au && au.bericht && au.bericht.find((x) => x.id === rid);
    if (!v || !routeVon(a, v.a, v.b)) return false;
    preisStufe(st, SPIELER, rid, v.stufe);
    v.erledigt = true;
    return true;
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
      auftraegePruefen(st);
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
          const u = umlauf(f.typ, e.km, a);
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
    const u = umlauf(f.typ, km, a);
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
      if (g.bis <= st.zeit && g.art === "versteigerung") versteigerungAuswerten(st, g);
      if (g.bis <= st.zeit && g.art === "wahl") { g.bis = st.zeit + 1; wahlTreffen(st, g.id, false); }   // nichts gewählt: es kommt, wie es kommt
      if (g.bis <= st.zeit && g.art === "aufkauf" && g.pleite) rivalNeustart(st, g.aid);
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
      if (a.ruf < REGELN.rufNatur) a.ruf = Math.min(REGELN.rufNatur, a.ruf + 1.5);
      else a.ruf = Math.max(REGELN.rufNatur, a.ruf - 0.3);
      const verw = verwaltungKosten(a);
      if (verw) { a.geld -= verw; a.heute = (a.heute || 0) - verw; }
      const lohn = gehaelter(a);
      if (lohn) { a.geld -= lohn; a.heute = (a.heute || 0) - lohn; }
      // Rivalen schütten einen Teil des Gewinns an ihre Eigentümer aus. Sonst ziehen sie davon.
      if (aid !== SPIELER && a.heute > 0) a.geld -= a.heute * REGELN.dividende;
      a.verlauf.push(Math.round(a.heute || 0));
      if (a.verlauf.length > 14) a.verlauf.shift();
      a.rufVerlauf = a.rufVerlauf || [];
      a.rufVerlauf.push(Math.round(a.ruf));
      if (a.rufVerlauf.length > 14) a.rufVerlauf.shift();
      a.heute = 0;
    }
    st.letzterTag = {
      tag, gewinn: p.verlauf[p.verlauf.length - 1],
      routen: p.routen.filter((r) => rg.routen[r.id]).map((r) => {
        const e = rg.routen[r.id];
        return { id: r.id, a: r.a, b: r.b, gewinn: Math.round(e.gewinn), zubringer: Math.round(e.zubringer), auslastung: e.auslastung };
      }).sort((x, y) => y.gewinn - x.gewinn),
    };
    // Controlling: täglich ein Blick auf Missstände, sonntags der Wochenbericht.
    const ctrl = assistent(p, "controller");
    if (ctrl) {
      const alt = new Set((p.hinweise || []).map((h) => h.id + h.art));
      p.hinweise = missstaende(st, SPIELER, ctrl.sterne);
      const neu = p.hinweise.filter((h) => !alt.has(h.id + h.art));
      if (neu.length) melden(st, { art: "hinweis", text: "❗ " + ctrl.name + ": " + (neu.length === 1 ? STADT[neu[0].a].name + " – " + STADT[neu[0].b].name + ": " + neu[0].text : neu.length + " Linien brauchen deine Aufmerksamkeit.") });
    } else p.hinweise = [];
    if (ctrl && tag % REGELN.saisonTage === 0 && p.routen.length) {
      p.wochenbericht = wochenbericht(st, SPIELER, ctrl);
      melden(st, { art: "bericht", text: "📋 " + ctrl.name + ": Dein Wochenbericht ist da!", rolle: "controller" });
    }
    // Pleite-Stufen.
    pleitePruefen(st);
    if (st.ende) return;
    // Rivalen planen.
    if (tag + 1 >= REGELN.rivalenAb) for (const aid of ["k", "s", "a"]) if (!st.airlines[aid].konkurs) kiTag(st, aid);
    spannungTag(st, tag + 1);
    // Saisonende: Slots prüfen.
    if (tag % REGELN.saisonTage === 0 && tag >= REGELN.ersteSlotPruefung) { slotsPruefen(st, tag); versteigerungAnlegen(st); }
    else if (tag % REGELN.saisonTage === 0) melden(st, { art: "saison", text: "Neue Jahreszeit: " + saison(tag + 1).name });
    // Kerosin, Messen, Gelegenheiten.
    neuerTag(st, tag + 1);
    rangPruefen(st);
    zielPruefen(st);
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
    melden(st, { art: "saison", text: "Saisonende: Landerechte werden neu vergeben. Neue Jahreszeit: " + saison(tag + 1).name });
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      for (const stadt of Object.keys(a.slots)) {
        const genutzt = slotsGenutzt(a, stadt);
        const schutz = stadt === a.basis ? REGELN.startSlots : 0;
        const ungenutzt = a.slots[stadt] - Math.max(genutzt, schutz);
        if (ungenutzt > 0) {
          a.slots[stadt] -= ungenutzt;
          if (aid === SPIELER) melden(st, { art: "slotweg", text: `${ungenutzt} ungenutzte${ungenutzt > 1 ? "" : "s"} Landerecht${ungenutzt > 1 ? "e" : ""} in ${STADT[stadt].name} zurückgegeben.` });
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
    melden(st, { art: "slotverloren", text: `Landerecht in ${STADT[g.stadt].name} verloren. Ein Flugzeug steht jetzt frei.` });
    geaendert(st);
  }

  // ---------- Neuer Tag: Kerosin, Messen, Gelegenheiten ----------
  function neuerTag(st, tag) {
    if (st.kerosinBis && tag > st.kerosinBis) { st.kerosin = 1; st.kerosinBis = 0; melden(st, { art: "kerosin", text: "Kerosin kostet wieder normal." }); }
    st.messen = st.messen.filter((m) => m.bis >= tag);
    if (tag < REGELN.gelegenheitAb) return;
    const offen = st.gelegenheiten.filter((g) => ["slot", "gebraucht", "messe", "kerosin", "wahl"].includes(g.art)).length;
    if (offen < 2 && zufall(st) < 0.7) {
      if (tag >= REGELN.wahlAb && !st.gelegenheiten.some((g) => g.art === "wahl") && zufall(st) < 0.3) wahlAnlegen(st, tag);
      else gelegenheitErzeugen(st, tag);
    }
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
    if (g.art === "aufkauf") { p.geld += g.preis; if (!aufkaufen(st, g)) return { ok: false, grund: "geld" }; }
    else if (g.art === "slot") p.slots[g.stadt] = (p.slots[g.stadt] || 0) + 1;
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
    if (g.art === "aufkauf" && g.pleite) rivalNeustart(st, g.aid);
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
  // Verwaltung: die ersten Linien sind frei, danach kostet jede weitere mehr (Büro, Planung, Personal).
  function verwaltungKosten(a, n) {
    const x = Math.max(0, (n == null ? a.routen.length : n) - REGELN.verwaltungFrei);
    return x ? Math.round(REGELN.verwaltung * x ** REGELN.verwaltungExp) : 0;
  }
  // Werbekampagne: kauft Ruf über die natürliche Grenze hinaus.
  function werbungPreis(st, aid) { return Math.max(REGELN.werbungMin, Math.round(firmenwert(st, aid) * REGELN.werbungAnteil / 50000) * 50000); }
  function werbung(st, aid) {
    const a = st.airlines[aid];
    const preis = werbungPreis(st, aid);
    if (a.geld < preis || a.ruf >= REGELN.rufMax) return { ok: false };
    a.geld -= preis;
    a.ruf = Math.min(REGELN.rufMax, a.ruf + REGELN.werbungRuf);
    geaendert(st);
    return { ok: true, preis };
  }
  // Umrüsten: ein Flugzeug der Linie gegen einen größeren Typ tauschen. Das alte wird verkauft.
  function umruestenKosten(st, aid, rid, typ) {
    const a = st.airlines[aid];
    const fs = flugzeugeAuf(a, rid);
    if (!fs.length) return null;
    const alt = fs.slice().sort((x, y) => TYPEN[x.typ].sitze - TYPEN[y.typ].sitze)[0];
    return { alt, preis: Math.max(0, TYPEN[typ].preis - Math.round(TYPEN[alt.typ].preis * REGELN.umruestenAnteil)) };
  }
  function umruesten(st, aid, rid, typ) {
    const a = st.airlines[aid];
    const r = a.routen.find((x) => x.id === rid);
    if (!r || !TYPEN[typ] || !typFrei(st, a, typ) || entfernung(r.a, r.b) > TYPEN[typ].reichweite) return { ok: false };
    const k = umruestenKosten(st, aid, rid, typ);
    if (!k || TYPEN[typ].sitze <= TYPEN[k.alt.typ].sitze || a.geld < k.preis) return { ok: false };
    a.geld -= k.preis;
    k.alt.typ = typ;
    geaendert(st);
    return { ok: true, preis: k.preis };
  }
  function firmenwert(st, aid) {
    const a = st.airlines[aid];
    const verlauf = a.verlauf.slice(-7);
    const schnitt = verlauf.length ? verlauf.reduce((s, v) => s + v, 0) / verlauf.length : 0;
    return Math.round(a.geld - a.kredit + flottenWert(a) + slotWert(a) + Math.max(0, schnitt) * 10);
  }
  function rangliste(st) {
    return st.reihenfolge.map((id) => ({ id, name: st.airlines[id].name, farbe: st.airlines[id].farbe, wert: firmenwert(st, id), routen: st.airlines[id].routen.length, flugzeuge: st.airlines[id].flotte.length }))
      .sort((x, y) => y.wert - x.wert || (x.id === SPIELER) - (y.id === SPIELER));   // bei Gleichstand liegt der Rivale vorn
  }
  function platz(st) { return rangliste(st).findIndex((x) => x.id === SPIELER) + 1; }
  function staerksterRivale(st) { return rangliste(st).find((x) => x.id !== SPIELER).id; }

  function rangPruefen(st) {
    const pl = platz(st);
    if (st.letzterPlatz && pl < st.letzterPlatz) melden(st, { art: "aufstieg", text: `Du bist auf Platz ${pl} aufgestiegen!`, platz: pl });
    if (st.letzterPlatz && pl > st.letzterPlatz) melden(st, { art: "abstieg", text: `${rangliste(st)[pl - 2].name} hat dich überholt. Jetzt Platz ${pl}.`, platz: pl });
    st.letzterPlatz = pl;
    st.bestPlatz = Math.min(st.bestPlatz || 9, pl);
    // Größere Flugzeuge je nach Firmenwert, für alle Airlines gleich.
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const wert = firmenwert(st, aid);
      const stufe = wert >= REGELN.stufe4Wert ? 4 : wert >= REGELN.stufe3Wert ? 3 : wert >= REGELN.stufe2Wert ? 2 : 1;
      if (stufe > (a.stufe || 1)) {
        a.stufe = stufe;
        if (aid === SPIELER) {
          st.stufe = stufe;
          const neu = Object.keys(TYPEN).filter((t) => TYPEN[t].stufe === stufe);
          melden(st, { art: "stufe", text: "Neu im Store: " + neu.map((t) => TYPEN[t].name).join(", ") + (stufe === 2 ? ". Damit geht es über den Atlantik!" : stufe === 3 ? ". Damit fliegst du um die halbe Welt!" : "."), typ: neu[0] });
        }
      }
    }
    if (pl === 1 && !st.platz1 && tagVon(st) >= 10) {   // nicht schon am Anfang, wenn alle bei Null stehen
      st.platz1 = true;
      melden(st, { art: "aufstieg", text: "Platz 1! Du bist die größte Airline der Welt." });
    }
  }

  // ---------- Ziele: immer genau eins, mit Belohnung ----------
  const heimRouten = (p) => p.routen.filter((r) => r.a === p.basis || r.b === p.basis).length;
  const ZIELE = [
    { id: "kaufen", text: "Starte deine erste Linie: Tippe hier", ist: (st, p) => p.flotte.length, soll: 1, belohnung: 0 },
    { id: "route", text: "Eröffne deine erste Linie im ✏️ Editor", ist: (st, p) => p.routen.length, soll: 1, belohnung: 0 },
    { id: "gewinn", text: "Mach einen Tag mit Gewinn", ist: (st, p) => (p.verlauf.some((v) => v > 0) ? 1 : 0), soll: 1, belohnung: 200000 },
    { id: "drehkreuz", text: "Drei Linien ab deiner Heimat: dein Drehkreuz", ist: (st, p) => heimRouten(p), soll: 3, belohnung: 500000 },
    { id: "flotte5", text: "Baue eine Flotte aus 5 Flugzeugen", ist: (st, p) => p.flotte.length, soll: 5, belohnung: 500000 },
    { id: "wert10", text: "Firmenwert 10 Mio", ist: (st) => Math.round(firmenwert(st, SPIELER) / 1e5) / 10, soll: 10, belohnung: 1000000, mio: true },
    { id: "platz3", text: "Erreiche Platz 3 der Rangliste", ist: (st) => (platz(st) <= 3 ? 1 : 0), soll: 1, belohnung: 1000000 },
    { id: "wert30", text: "Firmenwert 30 Mio: der A321neo schafft den Atlantik", ist: (st) => Math.round(firmenwert(st, SPIELER) / 1e5) / 10, soll: 30, belohnung: 2000000, mio: true },
    { id: "platz2", text: "Erreiche Platz 2 der Rangliste", ist: (st) => (platz(st) <= 2 ? 1 : 0), soll: 1, belohnung: 2000000 },
    { id: "kontinent", text: "Fliege auf einen anderen Kontinent", ist: (st, p) => p.routen.filter((r) => STADT[r.a].r !== STADT[r.b].r).length, soll: 1, belohnung: 3000000 },
    { id: "platz1", text: "Werde die Nummer 1 der Welt", ist: (st) => (platz(st) === 1 ? 1 : 0), soll: 1, belohnung: 5000000 },
    { id: "wert100", text: "Firmenwert 100 Mio: die Boeing 787", ist: (st) => Math.round(firmenwert(st, SPIELER) / 1e5) / 10, soll: 100, belohnung: 5000000, mio: true },
    { id: "kontinente4", text: "Fliege auf vier Kontinente", ist: (st, p) => new Set(p.routen.flatMap((r) => [STADT[r.a].r, STADT[r.b].r])).size, soll: 4, belohnung: 8000000 },
  ];
  // Danach endlos: Firmenwert verdoppeln.
  function zielAktuell(st) {
    if (st.ziel < ZIELE.length) return ZIELE[st.ziel];
    const i = st.ziel - ZIELE.length;
    // Im späten Spiel wechseln sich Firmenwert und Optimier-Ziele ab: lieber gut als viel.
    if (i % 2 === 0) return spaetesZiel(i / 2);
    const stufe = (i - 1) / 2;
    const soll = 200 * 2 ** stufe;
    return { id: "wert" + soll, text: `Firmenwert ${soll} Mio`, ist: (s) => Math.round(firmenwert(s, SPIELER) / 1e5) / 10, soll, belohnung: soll * 50000, mio: true };
  }
  function linienWerte(st, p) {
    const rg = rechnung(st);
    return p.routen.map((r) => rg.routen[r.id]).filter(Boolean);
  }
  function spaetesZiel(j) {
    const stufe = Math.floor(j / 4);
    const art = j % 4;
    if (art === 0) return { id: "rot" + j, text: "Keine rote Linie mehr: alle Linien im Plus", ist: (st, p) => (p.routen.length && linienWerte(st, p).every((e) => e.wert > 0) ? 1 : 0), soll: 1, belohnung: 4000000 * (stufe + 1) };
    if (art === 1) { const soll = Math.min(95, 80 + 5 * stufe); return { id: "auslastung" + j, text: `Volle Flieger: im Schnitt ${soll} % Auslastung`, ist: (st, p) => { const w = linienWerte(st, p); return w.length ? Math.round(w.reduce((s2, e) => s2 + Math.min(1, e.auslastung), 0) / w.length * 100) : 0; }, soll, belohnung: 5000000 * (stufe + 1), einheit: "%" }; }
    if (art === 2) { const soll = Math.min(100, 80 + 5 * stufe); return { id: "ruf" + j, text: `Bester Ruf: ⭐ ${soll} erreichen`, ist: (st, p) => Math.round(p.ruf), soll, belohnung: 5000000 * (stufe + 1) }; }
    const soll = 100 * 2 ** stufe;
    return { id: "proLinie" + j, text: `Starke Linien: im Schnitt ${soll} Tsd Gewinn pro Linie am Tag`, ist: (st, p) => { const w = linienWerte(st, p); return w.length ? Math.round(w.reduce((s2, e) => s2 + e.wert, 0) / w.length / 1000) : 0; }, soll, belohnung: 6000000 * (stufe + 1) };
  }
  function zielStand(st) {
    const z = zielAktuell(st);
    const p = st.airlines[SPIELER];
    return { id: z.id, text: z.text, ist: Math.min(z.ist(st, p), z.soll), soll: z.soll, belohnung: z.belohnung, mio: !!z.mio, einheit: z.einheit || "", nr: st.ziel + 1 };
  }
  function zielPruefen(st) {
    const p = st.airlines[SPIELER];
    let n = 0;
    while (n++ < 5) {
      const z = zielAktuell(st);
      if (z.ist(st, p) < z.soll) break;
      p.geld += z.belohnung;
      melden(st, { art: "ziel", text: "Ziel geschafft: " + z.text + (z.belohnung ? " · Prämie " + Math.round(z.belohnung / 1e5) / 10 + " Mio" : ""), ziel: z.id, belohnung: z.belohnung });
      st.ziel++;
    }
  }

  // ---------- Rivalen (und Bot für Probepartien) ----------
  const STIL = {
    platzhirsch: { reserve: 300000, amortisation: 44, klasse: { 1: 0.7, 2: 1, 3: 1.3 }, proTag: 3, typen: ["crj900", "falke", "a320", "kranich", "albatros", "b777"] },
    billig: { reserve: 200000, amortisation: 42, klasse: { 1: 1.4, 2: 1, 3: 0.6 }, proTag: 3, typen: ["libelle", "crj900", "falke", "b737", "kranich"] },
    premium: { reserve: 300000, amortisation: 42, klasse: { 1: 0.6, 2: 1.1, 3: 1.2 }, proTag: 3, typen: ["dash8", "falke", "a220", "kranich", "albatros", "a350"] },
    ruhig: { reserve: 0, amortisation: 0, klasse: { 1: 1, 2: 1, 3: 1 }, proTag: 0, typen: [] },   // für Tests: tut nichts
    bot: { reserve: 300000, amortisation: 40, klasse: { 1: 1, 2: 1, 3: 1 }, proTag: 3, typen: ["libelle", "dash8", "falke", "a320", "kranich", "albatros", "b777"] },
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
    // Ab und zu ein zweites Drehkreuz.
    if (aid !== SPIELER && tagVon(st) >= REGELN.aufkaufAb && zufall(st) < 0.08) {
      const h = drehkreuze(a).find((c) => kannAusbauen(st, aid, c) && a.geld > 3 * drehkreuzPreis(st, aid, c));
      if (h) drehkreuzAusbauen(st, aid, h);
    }
    const stil = STIL[a.stil] || STIL.bot;
    for (let i = 0; i < stil.proTag; i++) if (!kiAusbauen(st, aid)) break;
  }

  function kiAusbauen(st, aid, opt) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const reserve = opt && opt.start ? 0 : stil.reserve;
    if (a.geld < reserve + 200000) return false;
    const kandidaten = kiKandidaten(st, aid, reserve);
    // Die besten drei genau prüfen.
    for (const c of kandidaten.slice(0, 3)) {
      const pr = probe(st, aid, (kopie) => fliegen(kopie, aid, c.x, c.y, c.typ));
      if (!pr) continue;
      const kost = kostenFuer(st, aid, c.x, c.y, c.typ).gesamt;
      if (pr.delta > 0 && (kost / pr.delta) <= stil.amortisation) {
        kiFliegen(st, aid, c.x, c.y, c.typ, opt);
        return true;
      }
    }
    return false;
  }
  // Fliegt los und reagiert, wenn das eine Strecke des Spielers ist: Preiskampf.
  function kiFliegen(st, aid, x, y, typ, opt) {
    const a = st.airlines[aid];
    const neu = !routeVon(a, x, y);
    const res = fliegen(st, aid, x, y, typ);
    if (!res.ok) return res;
    const p = st.airlines[SPIELER];
    const pr = routeVon(p, x, y);
    if (aid !== SPIELER && !(opt && opt.start) && pr && neu) {
      const offen = p.routen.filter((r) => r.duell).length;
      if (offen >= 2) return res;            // höchstens zwei Preiskämpfe gleichzeitig, sonst wird es unübersichtlich
      if (tagVon(st) >= REGELN.duellAb) {
        pr.duell = { gegen: aid, seit: tagVon(st) };
        if (a.stil === "billig") res.route.stufe = "angreifen";
        melden(st, { art: "duell", wer: aid, route: pr.id, text: `⚔️ Preiskampf! ${a.name} fliegt jetzt auch ${STADT[x].name}–${STADT[y].name}. „${RIVALEN[aid].sprueche.gegen}“` });
      } else {
        melden(st, { art: "angriff", wer: aid, text: `${a.name} fliegt jetzt auch ${STADT[x].name}–${STADT[y].name}! „${RIVALEN[aid].sprueche.gegen}“` });
      }
    }
    return res;
  }
  function kiKandidaten(st, aid, reserve) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const orte = new Set([a.basis]);
    for (const r of a.routen) { orte.add(r.a); orte.add(r.b); }
    const kandidaten = [];
    const typen = stil.typen.filter((t) => typFrei(st, a, t));
    // Kosten je Stadt und Typ nur einmal ausrechnen (sonst wird das späte Spiel zäh).
    const slotKost = new Map();
    const slotVon = (s) => {
      if (!slotKost.has(s)) slotKost.set(s, slotsUebrig(a, s) > 0 ? { preis: 0, fehlt: false } : { preis: slotPreis(st, s), fehlt: !heimatPlatz(a, s) && slotsFrei(st, s) <= 0 });
      return slotKost.get(s);
    };
    const flugzeugPreis = {};
    for (const typ of typen) flugzeugPreis[typ] = freieFlugzeuge(a).some((f) => f.typ === typ) ? 0 : TYPEN[typ].preis;
    const budget = a.geld - reserve;
    const maxWeite = Math.max(0, ...typen.map((t) => TYPEN[t].reichweite));
    const verwZusatz = verwaltungKosten(a, a.routen.length + 1) - verwaltungKosten(a);   // eine neue Linie kostet auch Verwaltung
    for (const x of orte) {
      const sx = slotVon(x);
      if (sx.fehlt) continue;
      for (const s of staedte(st)) {
        const y = s.id;
        if (y === x) continue;
        const km = entfernung(x, y);
        if (km > maxWeite) continue;
        const sy = slotVon(y);
        if (sy.fehlt) continue;
        for (const typ of typen) {
          if (km > TYPEN[typ].reichweite) continue;
          const k = { gesamt: flugzeugPreis[typ] + sx.preis + sy.preis };
          if (k.gesamt > budget) continue;
          const sch = schaetzen(st, aid, x, y, typ);
          if (verwZusatz && !routeVon(a, x, y)) sch.gewinn -= verwZusatz;
          if (sch.gewinn <= 0 || sch.auslastung < 0.45) continue;
          const vorliebe = stil.klasse[STADT[y].k] * (a.stil === "premium" ? 0.6 + (STADT[x].w + STADT[y].w) : 1) * (x === a.basis ? 1.15 : 1);
          const tage = (k.gesamt + 1) / sch.gewinn;
          if (tage > stil.amortisation * 1.5) continue;
          kandidaten.push({ x, y, typ, wert: (sch.gewinn * vorliebe) / Math.max(k.gesamt, 300000), tage, sch });
        }
      }
    }
    kandidaten.sort((p, q) => q.wert - p.wert);
    return kandidaten;
  }


  // ---------- Spannung: Ankündigungen, Preiskampf, Versteigerung, Drehkreuze, Rennen, Aufkauf, Ereignisse ----------
  const neueGel = (st, g) => { g.id = "g" + st.naechsteGel++; st.gelegenheiten.push(g); geaendert(st); return g; };
  const bisTagEnde = (st, tage) => st.zeit + 24 * tage - (st.zeit % 24);

  // Rivalen kündigen ihren nächsten großen Zug an. Wer zuerst fliegt, gewinnt.
  function planenTag(st, tag) {
    st.plaene = st.plaene || [];
    const p = st.airlines[SPIELER];
    for (const pl of st.plaene.filter((x) => x.tag <= tag)) {
      const a = st.airlines[pl.aid];
      if (routeVon(p, pl.x, pl.y)) {
        melden(st, { art: "zuvor", wer: pl.aid, text: `🏁 Du warst schneller! ${a.name} verzichtet auf ${STADT[pl.x].name}–${STADT[pl.y].name}.` });
        p.ruf = Math.min(REGELN.rufMax, p.ruf + 2);
      } else if (!a.konkurs) {
        const res = kiFliegen(st, pl.aid, pl.x, pl.y, pl.typ);
        if (res.ok) melden(st, { art: "rivale", wer: pl.aid, text: `${a.name} fliegt jetzt wie angekündigt ${STADT[pl.x].name}–${STADT[pl.y].name}.` });
      }
    }
    st.plaene = st.plaene.filter((x) => x.tag > tag);
    if (tag < REGELN.planAb) return;
    for (const aid of ["k", "s", "a"]) {
      const a = st.airlines[aid];
      if (a.konkurs || st.plaene.some((x) => x.aid === aid) || zufall(st) > 0.22) continue;
      const c = kiKandidaten(st, aid, -2000000).find((k) => !routeVon(a, k.x, k.y) && STADT[k.y].k >= 2);   // in drei Tagen ist wieder Geld da
      if (!c) continue;
      const pl = { aid, x: c.x, y: c.y, typ: c.typ, tag: tag + REGELN.planTage };
      st.plaene.push(pl);
      neueGel(st, { art: "plan", info: true, aid, stadt: c.y, von: c.x, tag: pl.tag, bis: bisTagEnde(st, REGELN.planTage), dauer: 24 * REGELN.planTage });
      melden(st, { art: "plan", wer: aid, stadt: c.y, text: `📣 ${a.name} kündigt an: in ${REGELN.planTage} Tagen ${STADT[c.x].name}–${STADT[c.y].name}. Fliegst du zuerst, verzichten sie.` });
    }
  }

  // Preiskampf: was die Rivalen auf deinen umkämpften Linien tun.
  function duelleTag(st, tag) {
    const p = st.airlines[SPIELER];
    for (const r of p.routen) {
      if (!r.duell) continue;
      const a = st.airlines[r.duell.gegen];
      const ar = routeVon(a, r.a, r.b);
      if (!ar) {
        melden(st, { art: "duellsieg", wer: a.id, route: r.id, text: `🏆 ${a.name} gibt auf: ${STADT[r.a].name}–${STADT[r.b].name} gehört wieder dir. „${RIVALEN[a.id].sprueche.verliert}“` });
        delete r.duell;
        continue;
      }
      // Antwort auf deinen Kampfpreis: der Billigflieger hält immer dagegen, der Platzhirsch, wenn er Geld hat.
      if (r.stufe === "angreifen" && (a.stil === "billig" || (a.stil === "platzhirsch" && a.geld > 5000000))) ar.stufe = "angreifen";
      if (tag - r.duell.seit > 21) delete r.duell;
    }
  }
  // Zwei gleiche Linien nebeneinander: du und die Rivalen auf derselben Strecke.
  function vergleich(st, rid) {
    const p = st.airlines[SPIELER];
    const r = p.routen.find((x) => x.id === rid);
    if (!r) return null;
    const rg = rechnung(st);
    const zeile = (a, rr) => {
      const e = rg.routen[rr.id];
      const pr = profil(a);
      return { id: a.id, name: a.name, farbe: a.farbe, preis: e ? Math.round(e.preis) : Math.round(ticket(entfernung(r.a, r.b)) * pr.preis * STUFEN[rr.stufe].preis),
        stufe: rr.stufe, sterne: pr.sterne, essen: pr.essenKosten, gaeste: e ? Math.round(e.pax) : 0, auslastung: e ? e.auslastung : 0,
        flugzeuge: flugzeugeAuf(a, rr.id).length, gewinn: a.id === SPIELER && e ? Math.round(e.gewinn) : null };
    };
    const liste = [zeile(p, r)];
    for (const aid of ["k", "s", "a"]) { const ar = routeVon(st.airlines[aid], r.a, r.b); if (ar && flugzeugeAuf(st.airlines[aid], ar.id).length) liste.push(zeile(st.airlines[aid], ar)); }
    return liste;
  }
  function duellAntwort(st, rid, wahl) {
    const p = st.airlines[SPIELER];
    const r = p.routen.find((x) => x.id === rid);
    if (!r) return false;
    if (wahl === "aufgeben") { routeSchliessen(st, SPIELER, rid); return true; }
    preisStufe(st, SPIELER, rid, wahl === "unterbieten" ? "angreifen" : "normal");
    return true;
  }

  // Versteigerung am Saisonende: neue Landerechte an einem begehrten Flughafen, verdeckt geboten.
  function versteigerungAnlegen(st) {
    const p = st.airlines[SPIELER];
    const nah = new Set([p.basis, ...p.routen.flatMap((r) => [r.a, r.b])]);
    const kandidaten = ALLE.filter((c) => (c.k >= 2 || nah.has(c.id)) && (nah.has(c.id) || entfernung(p.basis, c.id) < 1500));
    if (!kandidaten.length) return;
    const knapp = kandidaten.sort((x, y) => slotsFrei(st, x.id) - slotsFrei(st, y.id) || y.g - x.g).slice(0, 4);
    const c = waehle(st, knapp);
    const stufe = Math.max(100000, Math.round(REGELN.slotPreis[c.k] * 1.5 / 50000) * 50000);
    neueGel(st, { art: "versteigerung", stadt: c.id, stufe, gebot: 0, bis: st.zeit + 24, dauer: 24 });
    melden(st, { art: "versteigerung", stadt: c.id, text: `🏛️ Versteigerung in ${c.name}: ${REGELN.versteigerungStueck} neue Landerechte. Biete verdeckt bis morgen.` });
  }
  function bieten(st, gid, stufen) {
    const g = st.gelegenheiten.find((x) => x.id === gid && x.art === "versteigerung");
    if (!g) return false;
    g.gebot = Math.max(0, Math.min(3, stufen | 0));
    geaendert(st);
    return true;
  }
  function versteigerungAuswerten(st, g) {
    const gebote = [];
    const p = st.airlines[SPIELER];
    if (g.gebot && p.geld >= g.gebot * g.stufe) gebote.push({ aid: SPIELER, betrag: g.gebot * g.stufe });
    for (const aid of ["k", "s", "a"]) {
      const a = st.airlines[aid];
      if (a.konkurs) continue;
      let n = a.geld > 6 * g.stufe ? 3 : a.geld > 3 * g.stufe ? 2 : a.geld > 1.5 * g.stufe ? 1 : 0;
      if (n && zufall(st) < 0.4) n--;
      if (n) gebote.push({ aid, betrag: Math.round(n * g.stufe * (0.85 + zufall(st) * 0.3) / 10000) * 10000 });
    }
    gebote.sort((x, y) => y.betrag - x.betrag);
    const liste = gebote.map((x) => `${st.airlines[x.aid].name} ${(Math.round(x.betrag / 1e5) / 10).toLocaleString("de-DE")} Mio`).join(", ");
    if (!gebote.length) { melden(st, { art: "versteigerung", text: `🏛️ Niemand hat in ${STADT[g.stadt].name} geboten.` }); return; }
    const w = gebote[0], a = st.airlines[w.aid];
    a.geld -= w.betrag;
    st.ausbau = st.ausbau || {};
    st.ausbau[g.stadt] = (st.ausbau[g.stadt] || 0) + REGELN.versteigerungStueck;
    a.slots[g.stadt] = (a.slots[g.stadt] || 0) + REGELN.versteigerungStueck;
    melden(st, { art: w.aid === SPIELER ? "versteigerungsieg" : "versteigerung", stadt: g.stadt,
      text: (w.aid === SPIELER ? `🏛️ Gewonnen! ${REGELN.versteigerungStueck} Landerechte in ${STADT[g.stadt].name} gehören dir.` : `🏛️ ${a.name} gewinnt die Landerechte in ${STADT[g.stadt].name}.`) + ` Gebote: ${liste}.` });
  }

  // Zweites Drehkreuz: eine Stadt mit mindestens drei Linien ausbauen.
  function drehkreuzPreis(st, aid, stadt) {
    const a = st.airlines[aid];
    return REGELN.drehkreuzPreis[STADT[stadt].k] * (1 + (a.ausgebaut || []).length);
  }
  function kannAusbauen(st, aid, stadt) {
    const a = st.airlines[aid];
    if (stadt === a.basis || ausgebaut(a, stadt)) return false;
    return a.routen.filter((r) => r.a === stadt || r.b === stadt).length >= REGELN.drehkreuzAb;
  }
  function drehkreuzAusbauen(st, aid, stadt) {
    const a = st.airlines[aid];
    const preis = drehkreuzPreis(st, aid, stadt);
    if (!kannAusbauen(st, aid, stadt) || a.geld < preis) return { ok: false };
    a.geld -= preis;
    a.ausgebaut = (a.ausgebaut || []).concat(stadt);
    if (aid !== SPIELER) melden(st, { art: "rivale", wer: aid, stadt, text: `🏗️ ${a.name} baut ${STADT[stadt].name} zum Drehkreuz aus.` });
    geaendert(st);
    return { ok: true, preis };
  }

  // Jede Jahreszeit ein Rennen. Wer zuerst schafft, bekommt Geld und einen Pokal (+3 % Gäste für immer).
  const PAARE = [["europa", "asien"], ["europa", "nordamerika"], ["europa", "afrika"], ["europa", "nahost"], ["nordamerika", "asien"], ["europa", "suedamerika"], ["asien", "ozeanien"]];
  function rennenStand(st, aid) {
    const R = st.rennen, a = st.airlines[aid];
    if (!R) return 0;
    // Es zählen nur Linien, die gerade fliegen und Gewinn machen. Herumstehende Flugzeuge helfen nicht.
    const rg = rechnung(st);
    const imPlus = a.routen.filter((r) => { const e = rg.routen[r.id]; return e && e.flugzeuge > 0 && e.gewinn + (e.zubringer || 0) > 0; });
    if (R.art === "verbinde") return imPlus.some((r) => new Set([STADT[r.a].r, STADT[r.b].r]).size === 2 && [R.r1, R.r2].includes(STADT[r.a].r) && [R.r1, R.r2].includes(STADT[r.b].r)) ? 1 : 0;
    if (R.art === "plus" || R.art === "flotte") return imPlus.length;
    if (R.art === "stadt") return imPlus.filter((r) => r.a === R.stadt || r.b === R.stadt).length;
    return 0;
  }
  function rennenStarten(st, tag) {
    const alle = st.reihenfolge.map((id) => st.airlines[id]);
    const arten = [];
    const offen = PAARE.find(([x, y]) => !alle.some((a) => a.routen.some((r) => { const s1 = STADT[r.a].r, s2 = STADT[r.b].r; return (s1 === x && s2 === y) || (s1 === y && s2 === x); })));
    if (offen) arten.push({ art: "verbinde", r1: offen[0], r2: offen[1], soll: 1, text: `Wer verbindet zuerst ${KONTINENTE[offen[0]]} mit ${KONTINENTE[offen[1]]}?` });
    const fl = Math.max(...st.reihenfolge.map((id) => { const a = st.airlines[id]; return a.routen.length; })) + 3;
    arten.push({ art: "plus", soll: fl, text: `Wer hat zuerst ${fl} Linien im Plus?` });
    const p = st.airlines[SPIELER];
    const gross = ALLE.filter((c) => c.k === 3 && c.id !== p.basis && !alle.some((a) => a.routen.filter((r) => r.a === c.id || r.b === c.id).length >= 3))
      .sort((x, y) => entfernung(p.basis, x.id) - entfernung(p.basis, y.id))[0];
    if (gross) arten.push({ art: "stadt", stadt: gross.id, soll: 4, text: `Wer fliegt zuerst 4 Linien ab ${gross.name}?` });
    const R = waehle(st, arten);
    st.rennen = Object.assign(R, { bis: tag + REGELN.saisonTage - 1, preis: REGELN.rennenPreis });
    melden(st, { art: "rennen", text: `🏁 Rennen der Jahreszeit: ${R.text} Preis: ${R.preis / 1e6} Mio und ein Pokal.` });
  }
  function rennenTag(st, tag) {
    const R = st.rennen;
    if (R) {
      const sieger = st.reihenfolge.find((id) => rennenStand(st, id) >= R.soll);
      if (sieger) {
        const a = st.airlines[sieger];
        a.geld += R.preis;
        a.pokale = (a.pokale || 0) + 1;
        melden(st, { art: sieger === SPIELER ? "rennensieg" : "rennen", wer: sieger, text: sieger === SPIELER ? `🏆 Rennen gewonnen! ${R.preis / 1e6} Mio und ein Pokal: +3 % Gäste auf allen Linien.` : `🏁 ${a.name} gewinnt das Rennen: ${R.text.replace("Wer ", "").replace("?", "")}.` });
        st.rennen = null;
      } else if (tag > R.bis) {
        melden(st, { art: "rennen", text: "🏁 Das Rennen ist vorbei, niemand hat es geschafft." });
        st.rennen = null;
      }
    }
    if (!st.rennen && tag >= REGELN.rennenAb && (tag - 1) % REGELN.saisonTage === 0) rennenStarten(st, tag);
  }

  // Rivalen können in die Krise geraten oder pleitegehen. Dann gibt es ihre Flotte günstig.
  function rivalNeustart(st, aid) {
    const a = st.airlines[aid];
    a.routen = []; a.flotte = []; a.slots = { [a.basis]: REGELN.startSlots };
    a.geld = REGELN.startGeld * 4; a.kredit = 0; a.konkurs = false; a.minusTage = 0; a.ausgebaut = []; a.verlauf = [];
    st.plaene = (st.plaene || []).filter((x) => x.aid !== aid);
    for (const r of st.airlines[SPIELER].routen) if (r.duell && r.duell.gegen === aid) delete r.duell;
    melden(st, { art: "rivale", wer: aid, text: `🔄 ${a.name} fängt mit neuem Geld von vorn an.` });
    geaendert(st);
  }
  function aufkaufTag(st, tag) {
    if (tag < REGELN.aufkaufAb) return;
    for (const aid of ["k", "s", "a"]) {
      const a = st.airlines[aid];
      if (a.konkurs) continue;
      a.minusTage = a.geld < 0 ? (a.minusTage || 0) + 1 : 0;
      const wert = flottenWert(a) + slotWert(a);
      if (a.minusTage >= 4 && a.flotte.length) {
        a.konkurs = true; a.routen = [];
        neueGel(st, { art: "aufkauf", aid, pleite: true, stadt: a.basis, preis: Math.round(wert * 0.4 / 10000) * 10000, flugzeuge: a.flotte.length, bis: bisTagEnde(st, 2), dauer: 48 });
        melden(st, { art: "pleite", wer: aid, text: `💥 ${a.name} ist pleite! Ihre ${a.flotte.length} Flugzeuge und Landerechte gibt es zwei Tage lang günstig.` });
        return;
      }
      if (st.gelegenheiten.some((g) => g.art === "aufkauf") || (a.angebotTag && tag - a.angebotTag < 14)) continue;
      if (firmenwert(st, SPIELER) >= 2.5 * firmenwert(st, aid) && a.flotte.length >= 3 && zufall(st) < 0.12) {
        a.angebotTag = tag;
        neueGel(st, { art: "aufkauf", aid, stadt: a.basis, preis: Math.round(wert * 0.75 / 10000) * 10000, flugzeuge: a.flotte.length, bis: bisTagEnde(st, 2), dauer: 48 });
        melden(st, { art: "krise", wer: aid, text: `📉 ${a.name} steckt in der Krise und will ihre Flotte verkaufen.` });
      }
    }
  }
  function aufkaufen(st, g) {
    const p = st.airlines[SPIELER], a = st.airlines[g.aid];
    if (p.geld < g.preis) return false;
    p.geld -= g.preis;
    for (const f of a.flotte) flugzeugHinzu(p, f.typ);
    for (const [c, n] of Object.entries(a.slots)) p.slots[c] = (p.slots[c] || 0) + n;
    melden(st, { art: "aufkauf", wer: g.aid, text: `🤝 Gekauft: ${a.flotte.length} Flugzeuge von ${a.name} stehen jetzt frei in deiner Flotte.` });
    rivalNeustart(st, g.aid);
    return true;
  }

  // Ereignisse mit zwei Wahlen: sicher (kostet sofort) oder riskant (vielleicht gut, vielleicht teuer).
  function wahlAnlegen(st, tag) {
    const p = st.airlines[SPIELER];
    if (!p.routen.length) return false;
    const orte = [...new Set(p.routen.flatMap((r) => [r.a, r.b]))];
    const art = waehle(st, ["streik", "sturm", "kerosin"]);
    const tagesUmsatz = Math.max(100000, Math.abs(p.verlauf.slice(-3).reduce((s, v) => s + v, 0) / 3));
    if (art === "streik") return neueGel(st, { art: "wahl", typ: "streik", stadt: p.basis, preis: Math.round(Math.max(150000, tagesUmsatz * 0.4) / 10000) * 10000, bis: st.zeit + 12, dauer: 12 });
    if (art === "sturm") return neueGel(st, { art: "wahl", typ: "sturm", stadt: waehle(st, orte), preis: 0, bis: st.zeit + 10, dauer: 10 });
    return neueGel(st, { art: "wahl", typ: "kerosin", preis: Math.round(Math.max(100000, tagesUmsatz * 0.25) / 10000) * 10000, bis: st.zeit + 12, dauer: 12 });
  }
  function wahlTreffen(st, gid, sicher) {
    const g = st.gelegenheiten.find((x) => x.id === gid && x.art === "wahl");
    if (!g) return null;
    const p = st.airlines[SPIELER];
    const tag = tagVon(st);
    const W = (art, f, von, bis, stadt) => { st.wirkungen = (st.wirkungen || []).filter((w) => w.bis >= tag); st.wirkungen.push({ aid: SPIELER, art, f, von, bis, stadt }); };
    const ort = g.stadt && STADT[g.stadt].name;
    let text;
    if (sicher && p.geld < g.preis) return null;
    if (g.typ === "streik") {
      if (sicher) { p.geld -= g.preis; text = `✊ Mehr Lohn gezahlt: in ${ort} wird weiter geflogen.`; }
      else if (zufall(st) < 0.5) { W("kapazitaet", 0.5, tag, tag + 1, g.stadt); text = `✊ Streik in ${ort}! Zwei Tage fliegt dort nur die Hälfte.`; }
      else text = `✊ Glück gehabt: Der Streik in ${ort} fällt aus.`;
    } else if (g.typ === "sturm") {
      if (sicher) { W("kapazitaet", 0, tag, tag, g.stadt); text = `⛈️ Flüge in ${ort} heute gestrichen. Alle sind sicher.`; }
      else if (zufall(st) < 0.7) text = `⛈️ Der Sturm über ${ort} zieht vorbei. Alles gut gegangen.`;
      else { p.ruf = Math.max(0, p.ruf - 8); p.geld -= 400000; W("kapazitaet", 0.5, tag, tag, g.stadt); text = `⛈️ Schaden durch den Sturm in ${ort}: 0,4 Mio Reparatur, Ruf −8.`; }
    } else {
      if (sicher) { p.geld -= g.preis; W("kerosinFest", 0.5, tag, tag + 6); text = "⛽ Kerosinpreis für eine Woche festgemacht."; }
      else if (zufall(st) < 0.5) { W("kerosin", 0.8, tag, tag + 6); text = "⛽ Gut gepokert: Kerosin ist für dich eine Woche 20 % billiger."; }
      else { W("kerosin", 1.4, tag, tag + 6); text = "⛽ Pech: Kerosin kostet dich eine Woche 40 % mehr."; }
    }
    st.gelegenheiten = st.gelegenheiten.filter((x) => x !== g);
    melden(st, { art: "wahl", text });
    geaendert(st);
    return text;
  }

  // Alles, was jeden Tag neu passiert.
  function spannungTag(st, tag) {
    trendsTag(st, tag);
    planenTag(st, tag);
    duelleTag(st, tag);
    rennenTag(st, tag);
    aufkaufTag(st, tag);
    st.wirkungen = (st.wirkungen || []).filter((w) => w.bis >= tag);
  }

  // ---------- Speichern ----------
  function laden(json) {
    const st = typeof json === "string" ? JSON.parse(json) : json;
    if (!st || st.version !== 2) return null;
    for (const a of Object.values(st.airlines)) {
      a.grundsaetze = a.grundsaetze || { ...VORLAGEN[a.service || "standard"] };
      a.assistenten = a.assistenten || {};
      // Ältere Stände: Sitzklassen in die realistischen Grenzen bringen.
      for (const r of a.routen || []) if (r.klassen) r.klassen = { business: Math.min(KLASSEN_MAX.business, r.klassen.business || 0), first: Math.min(KLASSEN_MAX.first, r.klassen.first || 0) };
    }
    return st;
  }

  return {
    SPIELER, REGELN, SERVICE, STUFEN, SCHWIERIGKEIT, angebote, TYPEN, GRUPPEN, STAEDTE, WELT, ALLE, KONTINENTE, STADT, SAISONEN, WOCHENTAGE, RIVALEN, NAMEN, HEIMAT, STIL,
    KLASSEN, KLASSEN_START, KLASSEN_MAX, klassenVon, klassenSetzen, besteKlassen,
    neuesSpiel, laden, klonen, entfernung, tagVon, wochentag, saison, ticket, grundNachfrage, staedte,
    flugzeugeAuf, freieFlugzeuge, slotsBelegt, slotsFrei, slotPreis, slotsGenutzt, slotsUebrig, typFrei, routeVon,
    kostenFuer, kannFliegen, fliegen, abziehen, routeSchliessen, verkaufen, kaufen, preisStufe, grundsatzSetzen, vorlageSetzen, profil, GRUNDSAETZE, VORLAGEN, ANALYSTEN, PREISPROFIS, assistent, einstellen, gehaelter, umbenennen, auftragGeben, preisVorschlagUebernehmen, CONTROLLER, wochenbericht, wochenVorschlagUebernehmen, missstaende, verwaltungKosten, werbungPreis, werbung, umruestenKosten, umruesten,
    umlauf, drehkreuze, rechnung, berechnen, probe, schaetzen, vorruecken, position, anziehung,
    gelegenheitAnnehmen, gelegenheitAblehnen, uebernahmeAnnehmen, uebernahmeAblehnen, tilgen,
    firmenwert, rangliste, platz, kiTag, kiAusbauen, tagesAbschluss, zielStand, zielPruefen, ZIELE,
    trendVon, stadtTrend, vergleich, duellAntwort, bieten, drehkreuzPreis, kannAusbauen, drehkreuzAusbauen, rennenStand, wahlTreffen, wirkung, ausgebaut, KONTINENTE_PAARE: PAARE,
  };
});
