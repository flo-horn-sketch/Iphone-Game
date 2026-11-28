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
    nachfrage: 9,            // Fluggäste pro Richtung und Tag = nachfrage × Größe A × Größe B
    grundpreis: 85,          // Ticket = grundpreis + proKm × Entfernung
    proKm: 0.11,
    gebuehr: { 1: 700, 2: 2200, 3: 4800 },       // pro Landung, mal Flugzeuggröße
    slotPreis: { 1: 40000, 2: 120000, 3: 300000 },        // Grundpreis eines Slots an einem fremden Flughafen (ruhige Zeit)
    zeitPreis: { begehrt: 1.5, ruhig: 1, schwach: 0.5 },   // morgens und abends teurer, nachts billiger
    heimPreis: { begehrt: 90000, ruhig: 60000, schwach: 30000 },   // Slot auf der eigenen Tafel
    heimFaktor: { 1: 1, 2: 1.5, 3: 2.5 },
    heimGeschenk: 2,         // so viele Slots auf der Heimat-Tafel sind am Anfang geschenkt
    slotMax: { 1: 8, 2: 14, 3: 20 },              // so viele Slots gibt ein Flughafen höchstens an fremde Airlines
    slotTakt: { 1: 6, 2: 4, 3: 3 },               // alle so viele Tage gibt ein Flughafen einen neuen Slot frei
    slotSchonTage: 3,        // ein frisch erworbener Slot ist so lange vor "nutzen oder verlieren" sicher
    kiBlick: 14,             // so viele fremde Städte schaut sich ein Rivale täglich neu an
    bietSchritt: 0.1,        // beim Bieten geht es in Schritten von 10 % des Grundpreises (mindestens 10.000) nach oben
    bietSekunden: 5,         // so lange haben die anderen Zeit, ein Gebot zu überbieten
    rueckgabeAnteil: 0.5,    // gibt man einen ungenutzten Slot zurück, kommt so viel vom Grundpreis zurück
    fremdBelegt: { 1: 2, 2: 6, 3: 10 },   // so viele Stunden belegen andere Airlines (nicht im Spiel), je nach Größe des Flughafens
    reisende: 220,           // Reisende pro Tag an einem Flughafen = reisende × Größe²
    daheim: 0.5,             // wie leicht ein Gast lieber gar nicht fliegt, wenn keine Zeit passt
    handelSperre: 2,         // nach einem Nein redet der Rivale so viele Tage nicht mehr über diesen Slot
    handelAb: 12,            // ab hier machen Rivalen Angebote für deine Slots
    drehkreuzAb: 3,          // ab so vielen eigenen Routen steigen in einer Stadt Leute um
    umsteigerAnteil: 0.32,
    umwegMax: 1.6,           // Umsteigen nur, wenn der Umweg nicht zu groß ist
    startGeld: 2500000,
    rufStart: 50,
    rufMax: 100,
    rufNatur: 70,            // bis hierhin wächst der Ruf von selbst; darüber nur mit Werbung, und er sinkt langsam wieder
    werbungRuf: 6, werbungAnteil: 0.02, werbungMin: 500000,   // Werbekampagne: +6 Ruf für 2 % vom Firmenwert (mind. 0,5 Mio)
    verwaltungFrei: 8, verwaltung: 3500, verwaltungExp: 1.5,  // ab der 9. Linie kostet jede Linie Verwaltung, und zwar immer mehr
    umruestenAnteil: 0.6,    // beim Umrüsten bekommt man so viel vom Preis des alten Flugzeugs zurück
    rufVerschlechtern: 4,    // so viel Ruf kostet es, wenn ein Grundsatz für die Gäste schlechter wird (pro Komfortpunkt)
    auftragStunden: 8,       // so lange braucht ein Assistent für einen Bericht
    saisonTage: 7,           // eine Jahreszeit dauert eine Woche, ein Jahr 28 Tage
    rivalenAb: 1,            // Rivalen fliegen von Anfang an (vorgestellt werden sie in Woche 2)
    verkaufAnteil: 0.6,      // ein Flugzeug bringt beim Verkauf so viel vom Neupreis
    abschreibTage: 60,       // so lange zählt ein Flugzeug im Firmenwert mehr als sein Verkaufspreis
    rangAb: 8,               // die Rangliste zählt erst ab Woche 2: am Anfang sagt sie nichts
    kreditZins: 0.012,       // pro Tag
    mahnTage: 2,
    letzteChanceTage: 3,
    stufe2Wert: 10000000,    // Firmenwert für den Kranich
    stufe3Wert: 35000000,    // Firmenwert für die Langstrecken-Jets
    stufe4Wert: 100000000,   // Firmenwert für den A380
    gelegenheitAb: 22,       // Woche 4: Messen und Gelegenheiten
    dividende: 0,            // Anteil am Tagesgewinn, den Rivalen nicht wieder anlegen
    mitteBonus: 0.45,        // Zuschlag an Gästen für eine ausgewogene, klassische Airline
    qualitaet: 0.05,         // pro Komfortpunkt mehr Anziehung: bei gleichem Preis gewinnt die bessere Airline
    planAb: 10,              // ab hier kündigen Rivalen Züge an
    planTage: 3,
    duellAb: 12,             // ab hier gibt es Preiskämpfe
    wagnis: 0.025, wagnisAb: 20, wagnisAnteil: 0.25,   // Rivalen kaufen manchmal auf Pump (bis 25 % ihres Werts): so kann einer pleitegehen
    angriffMut: 9000,        // so viel Verlust am Tag nimmt ein Rivale in Kauf, um dir eine Strecke abzunehmen (mal Stufe und Ärger)
    nachahmen: 0.3,         // so wahrscheinlich prüft ein Rivale an einem Tag eine gut laufende Strecke von dir (mal Stufe und Ärger)
    trendAb: 14,             // ab hier ändert sich die Nachfrage über die Zeit
    wahlAb: 24,              // ab hier Ereignisse mit zwei Wahlen
    rennenAb: 29,            // ab hier jede Jahreszeit ein Rennen
    rennenPreis: 1000000,
    aufkaufAb: 30,           // ab hier können Rivalen in die Krise geraten
    drehkreuzPreis: { 1: 1500000, 2: 4000000, 3: 8000000 },
    ausbauUmsteiger: 1.6,    // ein ausgebautes Drehkreuz bringt so viel mehr Umsteiger
    ausbauGaeste: 1.1,       // und Linien dort ziehen etwas mehr Gäste an
  };

  // Drei Servicelinien. Jede hat eine eigene Stärke.
  // ---------- Grundsätze der Airline ----------
  // Statt fester Service-Stufen legt man einzelne Grundsätze fest. Daraus ergibt sich, wen man anlockt.
  // komfort: mehr = Geschäftsleute zahlen mehr, weniger = Urlauber kommen wegen des Preises.
  const GRUNDSAETZE = {
    sitz: { name: "Sitzabstand", icon: "💺", optionen: {
      eng: { name: "Eng", text: "15 % mehr Sitze", fakt: "15 % mehr Sitze in jedem Flugzeug. Gäste finden es unbequem, gutes Essen hilft da nur halb.", komfort: -1, sitze: 1.15 },
      normal: { name: "Normal", text: "", fakt: "So viele Sitze, wie der Hersteller vorsieht.", komfort: 0, sitze: 1 },
      bequem: { name: "Bequem", text: "12 % weniger Sitze", fakt: "12 % weniger Sitze in jedem Flugzeug. Gäste zahlen dafür mehr.", komfort: 1, sitze: 0.88 } } },
    essen: { name: "Essen an Bord", icon: "🍽️", optionen: {
      keins: { name: "Keins", text: "spart Kosten", fakt: "Kostet dich nichts. Gäste sind weniger zufrieden.", komfort: -1, kosten: 0 },
      snack: { name: "Snack", text: "", fakt: "Kostet dich 6 € pro Gast.", komfort: 0, kosten: 6 },
      menue: { name: "Menü", text: "", fakt: "Kostet dich 16 € pro Gast. Gäste sind zufriedener.", komfort: 0.8, kosten: 16 },
      gourmet: { name: "Gourmet", text: "teuer, beeindruckt", fakt: "Kostet dich 30 € pro Gast. Geschäftsleute lieben es, in enger Kabine aber nur halb.", komfort: 1.6, kosten: 30 } } },
    essenZahlen: { name: "Essen bezahlen", icon: "💶", optionen: {
      inklusive: { name: "Im Preis", text: "", fakt: "Du zahlst das Essen für alle Gäste.", komfort: 0 },
      aufpreis: { name: "Aufpreis", text: "Gäste zahlen selbst", fakt: "Nur wer will, kauft Essen: Du sparst 80 % der Essenskosten. Gäste mögen es weniger.", komfort: -0.5, essenAnteil: 0.2 } } },
    platzwahl: { name: "Sitzplatzwahl", icon: "🎟️", optionen: {
      kostenlos: { name: "Kostenlos", text: "", fakt: "Bringt kein Geld, kostet keine Gäste.", komfort: 0 },
      gebuehr: { name: "Gebühr", text: "+5 € pro Gast", fakt: "Bringt dir 5 € pro Gast. Gäste mögen es weniger.", komfort: -0.5, extra: 5 } } },
    koffer: { name: "Koffer", icon: "🧳", optionen: {
      inklusive: { name: "Inklusive", text: "", fakt: "Bringt kein Geld, kostet keine Gäste.", komfort: 0 },
      gebuehr: { name: "Gebühr", text: "+9 € pro Gast", fakt: "Bringt dir 9 € pro Gast. Gäste mögen es weniger.", komfort: -0.7, extra: 9 } } },
    boarding: { name: "Boarding", icon: "⏱️", optionen: {
      schnell: { name: "Schnell", text: "30 Min am Boden", fakt: "Flugzeuge stehen nur 30 Minuten am Boden: Es passen mehr Flüge in den Tag. Gäste fühlen sich gehetzt.", komfort: -0.3, wende: 0.5 },
      gruendlich: { name: "Gründlich", text: "45 Min am Boden", fakt: "Flugzeuge stehen 45 Minuten am Boden.", komfort: 0, wende: 0.75 } } },
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
    if (o.sitz.sitze > 1 && o.essen.komfort > 0) K -= o.essen.komfort / 2;   // in enger Kabine wirkt gutes Essen nur halb
    const essenKosten = o.essen.kosten * (o.essenZahlen.essenAnteil ?? 1);
    const mitte = 1 + REGELN.mitteBonus * Math.exp(-K * K / 2);
    const pr = {
      komfort: K,
      sitze: o.sitz.sitze,
      preis: Math.max(0.7, Math.min(1.3, 1 + 0.08 * K)),
      kosten: 2 + essenKosten,
      extra: (o.platzwahl.extra || 0) + (o.koffer.extra || 0),
      wende: o.boarding.wende,
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
    business: { name: "Business", farbe: "#F2C14E", platz: 2, preis: 3.2, service: 3, anteil: 0.25 },
    first: { name: "First", farbe: "#C9A0F0", platz: 3, preis: 6, service: 6, anteil: 0.03 },
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
    const kurz = Math.max(0.2, Math.min(1, (e.km - 400) / 3600));   // auf Kurzstrecke bucht kaum jemand Business
    const first = g * KLASSEN.first.anteil * lang * gross * vorne;
    const business = (g * KLASSEN.business.anteil * kurz + u * 0.02) * vorne;
    return { first, business, eco: u + g - first - business };
  }

  // Preis pro Route: angreifen, normal, abschöpfen.
  const STUFEN = {
    angreifen: { name: "Angreifen", kurz: "Billiger", icon: "⬇", preis: 0.82, urlaub: 1.4, geschaeft: 1.12 },
    normal: { name: "Normal", kurz: "Normal", icon: "●", preis: 1.0, urlaub: 1.0, geschaeft: 1.0 },
    abschoepfen: { name: "Abschöpfen", kurz: "Teurer", icon: "⬆", preis: 1.25, urlaub: 0.55, geschaeft: 0.82, geschaeftTreu: 0.98 },
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
      sprueche: { gross: "Die guten Slots? Gehören bald alle mir.", gegen: "Junge Airlines kommen und gehen.", verliert: "Hm. Sie sind hartnäckiger als gedacht." },
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
  // ---------- Manager ----------
  // Du bist der Manager deiner Airline: Name, Geschlecht und Aussehen legst du beim Start fest (später in "Meine Airline" änderbar).
  // Jedes Aussehen ist ein Porträt (mgr-*.png, malt ChatGPT, siehe BILDER-AUFTRAG.md 4c). "farbe" ist nur der Platzhalter, bis das Bild da ist.
  const GESCHLECHTER = { frau: { name: "Frau", anrede: "Frau" }, mann: { name: "Mann", anrede: "Herr" }, divers: { name: "Divers", anrede: "" } };
  const AUSSEHEN = [
    { id: "frau-1", geschlecht: "frau", farbe: "#C98B5E" }, { id: "frau-2", geschlecht: "frau", farbe: "#E8C39E" }, { id: "frau-3", geschlecht: "frau", farbe: "#8D5A3B" },
    { id: "frau-4", geschlecht: "frau", farbe: "#F0D2B6" }, { id: "frau-5", geschlecht: "frau", farbe: "#B07850" }, { id: "frau-6", geschlecht: "frau", farbe: "#D9A77C" },
    { id: "mann-1", geschlecht: "mann", farbe: "#D9A77C" }, { id: "mann-2", geschlecht: "mann", farbe: "#8D5A3B" }, { id: "mann-3", geschlecht: "mann", farbe: "#F0D2B6" },
    { id: "mann-4", geschlecht: "mann", farbe: "#B07850" }, { id: "mann-5", geschlecht: "mann", farbe: "#E8C39E" }, { id: "mann-6", geschlecht: "mann", farbe: "#C98B5E" },
  ];
  const aussehenFuer = (g) => AUSSEHEN.filter((a) => g === "divers" || a.geschlecht === g);
  // Prüft ein Profil und macht es sauber; ohne Namen gibt es kein Profil.
  function managerPruefen(m) {
    if (!m || typeof m !== "object") return null;
    const name = String(m.name || "").replace(/\s+/g, " ").trim().slice(0, 24);
    if (!name) return null;
    const geschlecht = GESCHLECHTER[m.geschlecht] ? m.geschlecht : "divers";
    const passend = aussehenFuer(geschlecht);
    const aussehen = passend.some((a) => a.id === m.aussehen) ? m.aussehen : passend[0].id;
    return { name, geschlecht, aussehen };
  }
  function managerSetzen(st, m) { const neu = managerPruefen(m); if (neu) st.manager = neu; return !!neu; }
  // So sprechen dich Assistenten und Rivalen an: "Frau Horn", "Herr Horn", bei Divers mit ganzem Namen.
  function anrede(m) {
    if (!m) return null;
    const g = GESCHLECHTER[m.geschlecht];
    const teile = m.name.split(" ");
    return g && g.anrede && teile.length > 1 ? g.anrede + " " + teile[teile.length - 1] : g && g.anrede ? g.anrede + " " + m.name : m.name;
  }

  // Wer an einem Flughafen startet, führt die Airline, die dort in echt zu Hause ist (Florian, 2026-11-28).
  // Berlin und Hamburg haben kein echtes Drehkreuz: Dort steht die Airline mit der größten Basis.
  const HEIM_AIRLINE = {
    london: { name: "British Airways", kurz: "BA" }, paris: { name: "Air France", kurz: "AF" }, frankfurt: { name: "Lufthansa", kurz: "LH" },
    amsterdam: { name: "KLM", kurz: "KL" }, madrid: { name: "Iberia", kurz: "IB" }, istanbul: { name: "Turkish Airlines", kurz: "TK" },
    muenchen: { name: "Air Dolomiti", kurz: "EN" }, rom: { name: "ITA Airways", kurz: "AZ" }, barcelona: { name: "Vueling", kurz: "VY" },
    zuerich: { name: "Swiss", kurz: "LX" }, wien: { name: "Austrian", kurz: "OS" }, kopenhagen: { name: "SAS", kurz: "SK" },
    dublin: { name: "Aer Lingus", kurz: "EI" }, lissabon: { name: "TAP Air Portugal", kurz: "TP" }, mailand: { name: "Neos", kurz: "NO" },
    bruessel: { name: "Brussels Airlines", kurz: "SN" }, stockholm: { name: "BRA", kurz: "TF" }, athen: { name: "Aegean", kurz: "A3" },
    berlin: { name: "easyJet", kurz: "U2" }, warschau: { name: "LOT", kurz: "LO" }, oslo: { name: "Norwegian", kurz: "DY" },
    hamburg: { name: "Eurowings", kurz: "EW" }, helsinki: { name: "Finnair", kurz: "AY" },
  };
  const heimAirline = (stadt) => HEIM_AIRLINE[stadt] || null;
  // Gestartet wird nur in Europa (Florian, 2026-11-28). Der Rest der Welt ist Ziel, nicht Heimat.
  const HEIMAT = ["london", "paris", "frankfurt", "amsterdam", "madrid", "istanbul", "muenchen", "berlin", "rom", "wien",
    "dublin", "lissabon", "kopenhagen", "athen", "helsinki", "warschau", "hamburg"];

  // Wie leicht der Start ist: gemessen in Probepartien (2026-11-28, nach dem Slot-Umbau: 12 Partien je Stadt über 80 Tage,
  // alle drei Rivalen-Stufen, sortiert nach dem mittleren Platz am Ende). Neu messen, wenn sich Städte oder Regeln ändern.
  const SCHWIERIGKEIT = {
    wien: "leicht", berlin: "leicht", istanbul: "leicht", muenchen: "leicht", london: "leicht", amsterdam: "leicht",
    rom: "mittel", kopenhagen: "mittel", madrid: "mittel", warschau: "mittel", paris: "mittel", frankfurt: "mittel",
    dublin: "schwer", athen: "schwer", helsinki: "schwer", hamburg: "schwer", lissabon: "schwer",
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
      ruf: REGELN.rufStart, geld: d.geld, kredit: 0, slots: [], fluege: [], geschenk: REGELN.heimGeschenk, flotte: [], routen: [], naechste: 1,
      wechselBis: 0, verlauf: [],
    };
  }

  function neuesSpiel(opt) {
    opt = opt || {};
    const st = {
      version: 3, zeit: 6, rng: (opt.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
      kerosin: 1, kerosinBis: 0, messen: [], gelegenheiten: [], meldungen: [], naechsteGel: 1,
      welt: false, platz1: false, stufe: 1, pleite: { stufe: 0, tage: 0 }, ende: null,
      airlines: {}, reihenfolge: [SPIELER, "k", "s", "a"], letzterTag: null, stand: 0,
      pool: [], naechsterSlot: 1, slotUhr: {},
      gegner: GEGNER[opt.gegner] ? opt.gegner : "mittel",
    };
    st.saat = st.rng;
    st.manager = managerPruefen(opt.manager);
    const basis = opt.basis || "frankfurt";
    const echt = heimAirline(basis);
    const name = opt.name || { name: echt ? echt.name : NAMEN[0].name, farbe: NAMEN[0].farbe };
    // Alle starten bei Null: kein Flugzeug, keine Linie, nur Startgeld und zwei geschenkte Slots auf der eigenen Tafel.
    const p = neueAirline(SPIELER, { name: name.name, farbe: name.farbe, service: opt.service || "standard", basis, geld: REGELN.startGeld });
    if (echt && !opt.name) p.kurz = echt.kurz;
    st.airlines[SPIELER] = p;
    // Auch die Rivalen starten in Europa und sitzen in der Nähe: der Platzhirsch im nächsten Weltdrehkreuz, die anderen in Großstädten.
    const vergeben = new Set([basis]);
    const nah = (filter) => ALLE.filter((c) => !vergeben.has(c.id) && c.r === "europa" && filter(c)).sort((x, y) => entfernung(basis, x.id) - entfernung(basis, y.id))[0].id;
    const WAHL = { k: (c) => c.k === 3, s: (c) => c.k === 2, a: (c) => c.k >= 2 && c.w >= 0.45 };
    for (const [id, r] of Object.entries(RIVALEN)) {
      const b = nah(WAHL[id]);
      vergeben.add(b);
      // Auch die Rivalen heißen wie die echte Airline ihres Flughafens. Chef, Stil und Sprüche bleiben erfunden.
      const e = heimAirline(b);
      const a = neueAirline(id, { name: e ? e.name : r.name, farbe: r.farbe, service: r.service, basis: b, stil: r.stil, geld: REGELN.startGeld });
      if (e) a.kurz = e.kurz;
      st.airlines[id] = a;
    }
    // Alle Flughäfen bieten alle ihre Slots an. Wer einen bucht, bietet direkt, die anderen können sofort dagegenhalten.
    st.ziel = 0;
    geaendert(st);
    return st;
  }

  // ---------- Uhrzeiten und Slots ----------
  // Ein Slot ist ein Abflug pro Tag zu einer festen Uhrzeit (Ortszeit des Flughafens).
  // Heimat und ausgebaute Drehkreuze haben eine eigene Tafel, die nur der Airline gehört.
  // An allen anderen Flughäfen gibt es wenige Slots für alle zusammen: Wer einen will, bietet.
  const GAESTE = ["urlaub", "geschaeft"];
  const zone = (s) => Math.round(STADT[s].lon / 15);
  const uhr24 = (h) => ((h % 24) + 24) % 24;
  function uhrText(h) { const m = Math.round(uhr24(h) * 60) % 1440; return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }
  function zeitArt(h) { h = uhr24(h); return (h >= 6 && h < 10) || (h >= 17 && h < 21) ? "begehrt" : h < 6 || h >= 22 ? "schwach" : "ruhig"; }
  const runde10k = (x) => Math.round(x / 10000) * 10000;
  function slotGrundpreis(stadt, h) { return runde10k(REGELN.slotPreis[STADT[stadt].k] * REGELN.zeitPreis[zeitArt(h)]); }
  function heimPreis(stadt, h) { return runde10k(REGELN.heimPreis[zeitArt(h)] * REGELN.heimFaktor[STADT[stadt].k]); }
  const HEIM_STUNDEN = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const HUB_STUNDEN = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  const hatTafel = (a, stadt) => stadt === a.basis || ausgebaut(a, stadt);
  const tafelStunden = (a, stadt) => (stadt === a.basis ? HEIM_STUNDEN : ausgebaut(a, stadt) ? HUB_STUNDEN : []);

  // Wann wollen die Leute fliegen? Geschäftsreisende morgens und abends, Urlauber eher tagsüber, nachts fast niemand.
  const norm = (xs) => { const s = xs.reduce((p, q) => p + q, 0); return xs.map((x) => x / s); };
  const TAGESGANG = {
    geschaeft: norm([0.1, 0.1, 0.1, 0.1, 0.1, 0.6, 1.6, 2.2, 2.0, 1.4, 0.7, 0.6, 0.6, 0.6, 0.6, 0.7, 1.0, 1.8, 2.0, 1.6, 1.0, 0.5, 0.25, 0.15]),
    urlaub: norm([0.1, 0.1, 0.1, 0.1, 0.15, 0.4, 0.8, 1.1, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.2, 1.1, 0.9, 0.7, 0.5, 0.35, 0.2, 0.1]),
  };
  const NAEHE = { geschaeft: 1.5, urlaub: 3 };     // so viele Stunden weicht ein Gast gern von seiner Wunschzeit ab
  const kernCache = new Map();
  function kern(h) {
    const u = uhr24(h), key = Math.round(u * 6);
    let k = kernCache.get(key);
    if (!k) {
      k = {};
      for (const g of GAESTE) {
        k[g] = [];
        for (let t = 0; t < 24; t++) { let d = Math.abs(t + 0.5 - u); d = Math.min(d, 24 - d); k[g].push(Math.exp(-d / NAEHE[g])); }
      }
      kernCache.set(key, k);
    }
    return k;
  }
  // Verteilt die Reisenden einer Richtung auf die Flüge dieser Richtung. Jeder Gast nimmt den Flug,
  // der zu seiner Wunschzeit passt, oder bleibt daheim. Zwei Flüge kurz hintereinander nehmen sich Gäste weg.
  function verteilen(n, liste) {
    for (const o of liste) o.k = kern(o.h);
    for (const gast of GAESTE) {
      const P = TAGESGANG[gast];
      for (let t = 0; t < 24; t++) {
        let summe = REGELN.daheim;
        for (const o of liste) summe += o.att[gast] * o.k[gast][t];
        const menge = n[gast] * P[t] / summe;
        for (const o of liste) o.out.dem[gast] += menge * o.att[gast] * o.k[gast][t];
      }
    }
  }
  // Wie gut ist eine Abflugzeit? 1 = so gut wie die beste Stunde des Tages.
  const gueteCache = new Map();
  const GUETE_MAX = {};
  for (const gast of GAESTE) { let m = 0; for (let h = 5; h <= 23; h += 0.5) { const k = kern(h)[gast]; let s2 = 0; for (let t = 0; t < 24; t++) s2 += TAGESGANG[gast][t] * k[t]; m = Math.max(m, s2); } GUETE_MAX[gast] = m; }
  function zeitGuete(h, w) {
    const key = Math.round(uhr24(h) * 6);
    let g = gueteCache.get(key);
    if (!g) {
      const k = kern(h); g = {};
      for (const gast of GAESTE) { let s = 0; for (let t = 0; t < 24; t++) s += TAGESGANG[gast][t] * k[gast][t]; g[gast] = s; }
      gueteCache.set(key, g);
    }
    return w * g.geschaeft / GUETE_MAX.geschaeft + (1 - w) * g.urlaub / GUETE_MAX.urlaub;
  }

  // ---------- Flotte, Slots, Linien, Flüge ----------
  // Sitzaufteilung gehört zum Flugzeug: Propeller und kleine Jets nur Economy, Mittelstrecke etwas Business, große Jets auch First.
  function kabineGrenzen(typ) {
    const sitze = TYPEN[typ].sitze;
    if (sitze < 100) return { business: 0, first: 0 };
    if (sitze < 250) return { business: 0.2, first: 0 };
    if (sitze < 500) return { business: 0.4, first: 0.1 };
    return { business: KLASSEN_MAX.business, first: KLASSEN_MAX.first };
  }
  function kabineStandard(typ, a) {
    const g = kabineGrenzen(typ), art = a ? profil(a).klassen : "standard";
    const b = art === "billig" ? 0 : art === "premium" ? g.business : Math.min(g.business, g.business >= 0.4 ? 0.2 : 0.1);
    return { business: b, first: art === "premium" ? Math.min(g.first, 0.1) : 0 };
  }
  function flugzeugHinzu(a, typ, kabine) {
    const g = kabineGrenzen(typ), k = kabine || kabineStandard(typ, a);
    const f = { id: a.id + "f" + a.naechste++, typ, ort: null, kabine: { business: Math.min(g.business, k.business || 0), first: Math.min(g.first, k.first || 0) } };
    a.flotte.push(f);
    return f;
  }
  const fluegeVon = (a, fid) => a.fluege.filter((x) => x.f === fid);
  const fluegeAuf = (a, rid) => a.fluege.filter((x) => x.route === rid);
  function flugzeugeAuf(a, rid) {
    const ids = new Set(fluegeAuf(a, rid).map((x) => x.f));
    return a.flotte.filter((f) => ids.has(f.id));
  }
  function freieFlugzeuge(a) {
    const ids = new Set(a.fluege.map((x) => x.f));
    return a.flotte.filter((f) => !ids.has(f.id));
  }
  const slotVon = (a, id) => a.slots.find((s) => s.id === id) || null;
  const slotsIn = (a, stadt) => a.slots.filter((s) => s.stadt === stadt);
  const slotFlug = (a, sid) => a.fluege.find((x) => x.s1 === sid || x.s2 === sid) || null;
  function benutzteSlots(a) { const b = new Set(); for (const x of a.fluege) { b.add(x.s1); b.add(x.s2); } return b; }
  function slotsFreiVon(a, stadt) { const b = benutzteSlots(a); return a.slots.filter((s) => s.stadt === stadt && !b.has(s.id)); }
  // Wie viele Slots gibt es an einem Flughafen für alle zusammen (ohne die eigenen Tafeln)?
  function slotZahl(st, stadt) {
    let n = 0;
    for (const s of st.pool) if (s.stadt === stadt) n++;
    for (const id of st.reihenfolge) for (const s of st.airlines[id].slots) if (s.stadt === stadt && !s.heim) n++;
    return n;
  }
  const poolIn = (st, stadt) => st.pool.filter((s) => s.stadt === stadt);
  // Ein neuer Slot kommt in den Topf. Mit Frist wird einen Tag lang verdeckt geboten, ohne Frist ist er sofort zu haben.
  // "tags": Der erste Slot jedes Flughafens liegt zwischen 9 und 17 Uhr, damit ein Flugzeug am selben Tag hin und zurück kommt.
  function poolNeu(st, stadt, bieten, h, tags) {
    if (h == null) {
      const belegt = new Set();
      for (const s of st.pool) if (s.stadt === stadt) belegt.add(Math.round(s.h * 6));
      for (const id of st.reihenfolge) for (const s of st.airlines[id].slots) if (s.stadt === stadt) belegt.add(Math.round(s.h * 6));
      let n = 0, versuche = 0;
      do { n = tags ? 54 + Math.floor(zufall(st) * 49) : 30 + Math.floor(zufall(st) * 109); versuche++; } while (belegt.has(n) && versuche < 40);
      h = n / 6;
    }
    const s = { id: "s" + st.naechsterSlot++, stadt, h, bis: bieten ? st.zeit + 24 : null, gebote: {} };
    st.pool.push(s);
    if (bieten) s.ki = kiGebote(st, s);
    return s;
  }
  // Die Tafel der Heimat oder eines Drehkreuzes: jede Stunde ein Slot, den nur die Airline kaufen kann.
  function tafel(st, aid, stadt) {
    const a = st.airlines[aid];
    const b = benutzteSlots(a);
    return tafelStunden(a, stadt).map((h) => {
      const slot = a.slots.find((s) => s.heim && s.stadt === stadt && s.h === h) || null;
      return { h, art: zeitArt(h), preis: a.geschenk > 0 ? 0 : heimPreis(stadt, h), listenpreis: heimPreis(stadt, h), slot, frei: !!slot && !b.has(slot.id), flug: slot ? slotFlug(a, slot.id) : null };
    });
  }
  function heimSlotKaufen(st, aid, stadt, h) {
    const a = st.airlines[aid];
    if (!tafelStunden(a, stadt).includes(h) || a.slots.some((s) => s.heim && s.stadt === stadt && s.h === h)) return { ok: false };
    const preis = a.geschenk > 0 ? 0 : heimPreis(stadt, h);
    if (a.geld < preis) return { ok: false, grund: "geld" };
    a.geld -= preis;
    if (a.geschenk > 0) a.geschenk--;
    const s = { id: "s" + st.naechsterSlot++, stadt, h, heim: true, seit: tagVon(st) };
    a.slots.push(s);
    geaendert(st);
    return { ok: true, slot: s, preis };
  }
  // Einen liegen gebliebenen Slot nimmt, wer zuerst kommt, zum Grundpreis.
  function slotNehmen(st, aid, sid) {
    const a = st.airlines[aid];
    const s = st.pool.find((x) => x.id === sid);
    if (!s || s.bis != null) return { ok: false };
    const preis = slotGrundpreis(s.stadt, s.h);
    if (a.geld < preis) return { ok: false, grund: "geld" };
    a.geld -= preis;
    st.pool = st.pool.filter((x) => x !== s);
    const neu = { id: s.id, stadt: s.stadt, h: s.h, seit: tagVon(st) };
    a.slots.push(neu);
    geaendert(st);
    return { ok: true, slot: neu, preis };
  }
  // Freie Slots an einem fremden Flughafen: jede volle Stunde von 5 bis 23 Uhr, die noch keine fremde Airline hat,
  // solange der Flughafen seine Obergrenze nicht erreicht hat. (Die Tafeln der Heimat-Airlines zählen extra.)
  // Große Flughäfen sind voller: Dort fliegen schon viele andere Airlines (nicht im Spiel), und zwar am liebsten
  // zu den begehrten Zeiten. Diese Stunden sind weg, für alle. Fest für die ganze Partie.
  function fremdeStunden(st, stadt) {
    const c = STADT[stadt];
    if (!c) return [];
    const n = REGELN.fremdBelegt[c.k] || 0;
    if (!n) return [];
    const hash = (t) => { let h = (st.saat | 0) ^ 0x9e3779b9; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const gewicht = { begehrt: 2.2, ruhig: 1, schwach: 0.35 };
    return HEIM_STUNDEN.map((h) => ({ h, w: hash("fremd" + stadt + h) * gewicht[zeitArt(h)] })).sort((x, y) => y.w - x.w).slice(0, n).map((x) => x.h).sort((x, y) => x - y);
  }
  function freieStunden(st, stadt) {
    const c = STADT[stadt];
    const fremd = fremdeStunden(st, stadt);
    if (!c || slotZahl(st, stadt) + fremd.length >= REGELN.slotMax[c.k]) return [];
    const belegt = fremd.slice();
    for (const id of st.reihenfolge) for (const s of st.airlines[id].slots) if (s.stadt === stadt && !s.heim) belegt.push(s.h);
    return HEIM_STUNDEN.filter((h) => !belegt.some((b) => Math.abs(b - h) < 0.5));
  }
  // Einen Slot buchen heißt bieten, offen wie bei einer Versteigerung (Florian, 2026-11-28):
  // Wer bucht, bietet den Grundpreis. Dann können die anderen in festen Schritten darübergehen, jeweils 5 Sekunden lang,
  // bis keiner mehr bietet. Das letzte Gebot gewinnt und wird bezahlt.
  // Die Rivalen haben ein Limit (was ihnen der Slot wert ist); sie bieten, solange das nächste Gebot darunter liegt.
  const bietSchritt = (gp) => Math.max(10000, runde10k(gp * REGELN.bietSchritt));
  let spielerFragen = false;                 // nur im echten Spiel (Oberfläche): Rivalen-Buchungen in deinem Netz fragen dich
  function fragenAn(an) { spielerFragen = !!an; }
  function auktionStart(st, aid, stadt, h, warte) {
    const a = st.airlines[aid];
    if (st.auktion) return { ok: false, grund: "laeuft" };
    if (hatTafel(a, stadt)) return { ok: false, grund: "tafel" };
    if (!freieStunden(st, stadt).includes(h)) return { ok: false, grund: "belegt" };
    const gp = slotGrundpreis(stadt, h);
    if (a.geld < gp) return { ok: false, grund: "geld" };
    // Was ist der Slot den Rivalen wert? Wer selbst bucht, geht mindestens etwas über den Grundpreis mit.
    const limits = st.probe ? {} : kiGebote(st, { id: "?", stadt, h }, aid === SPIELER ? SPIELER : null);
    if (aid !== SPIELER && !st.probe) limits[aid] = Math.max(limits[aid] || 0, runde10k(gp * 1.3));
    st.auktion = { stadt, h, gp, schritt: bietSchritt(gp), stand: gp, fuehrt: aid, starter: aid, limits, gebote: [{ aid, betrag: gp }], warte: warte || null, tag: tagVon(st) };
    return { ok: true, auktion: st.auktion };
  }
  // Ein Schritt höher. Wer schon vorne liegt, kann sich nicht selbst überbieten.
  function auktionBieten(st, aid) {
    const A = st.auktion;
    if (!A || A.fuehrt === aid) return false;
    const n = A.stand + A.schritt;
    if (st.airlines[aid].geld < n) return false;
    A.stand = n; A.fuehrt = aid; A.gebote.push({ aid, betrag: n });
    return true;
  }
  // Will ein Rivale höher gehen? Der mit dem höchsten Limit zuerst. Gibt zurück, wer geboten hat.
  // Menschlich: Kurz vor seiner Grenze steigt mancher früher aus (Anfänger öfter), und wen du gerade überboten hast,
  // der legt mit Ärger im Bauch auch mal einen Schritt drauf ("jetzt erst recht"), einmal pro Versteigerung.
  function auktionKi(st) {
    const A = st.auktion;
    if (!A) return null;
    const n = A.stand + A.schritt;
    A.raus = A.raus || {}; A.trotz = A.trotz || {};
    const letzte = A.gebote[A.gebote.length - 1], vorletzte = A.gebote[A.gebote.length - 2];
    if (letzte && vorletzte && letzte.aid === SPIELER && vorletzte.aid !== SPIELER && !A.trotz[vorletzte.aid] && A.limits[vorletzte.aid] != null && !st.probe) {
      const k = vorletzte.aid, K = koennen(st, k), kf = kopf(st.airlines[k]);
      A.trotz[k] = true;
      if (zufall(st) < K.reagiert * 0.3 + Math.min(2, kf.groll) * 0.15) A.limits[k] += A.schritt;
    }
    const wer = Object.entries(A.limits).filter(([k, l]) => k !== A.fuehrt && !A.raus[k] && l >= n && st.airlines[k].geld >= n).sort((x, y) => y[1] - x[1])[0];
    if (!wer) return null;
    const K = koennen(st, wer[0]);
    if (!st.probe && n > wer[1] * 0.8 && zufall(st) < (1 - K.bietLust) * 0.35) { A.raus[wer[0]] = true; return auktionKi(st); }
    auktionBieten(st, wer[0]);
    return wer[0];
  }
  // Keiner bietet mehr: Wer vorne liegt, zahlt sein Gebot und bekommt den Slot.
  function auktionEnde(st) {
    const A = st.auktion;
    if (!A) return null;
    st.auktion = null;
    const sieger = st.airlines[A.fuehrt];
    const preis = A.stand;
    sieger.geld -= preis;
    const slot = { id: "s" + st.naechsterSlot++, stadt: A.stadt, h: A.h, seit: tagVon(st) };
    sieger.slots.push(slot);
    const mit = [...new Set(A.gebote.map((g) => g.aid))];
    if (mit.length > 1) sieger.geboten = (sieger.geboten || 0) + 1;
    // Zählt mit, wie oft gebucht und wie oft wirklich geboten wurde (für die Statistik und zum Abstimmen).
    const zs = st.auktionsZahl || (st.auktionsZahl = { gebucht: 0, umkaempft: 0, aufschlag: 0 });
    zs.gebucht++; if (mit.length > 1) { zs.umkaempft++; zs.aufschlag += preis / A.gp - 1; }
    if (st.auktionsLog) st.auktionsLog.push({ stadt: A.stadt, h: A.h, k: STADT[A.stadt].k, art: zeitArt(A.h), starter: A.starter, sieger: A.fuehrt, mit, gp: A.gp, preis, tag: tagVon(st) });
    if (mit.includes(SPIELER) && mit.length > 1) {
      if (A.fuehrt === SPIELER) for (const k of mit) if (k !== SPIELER) aergern(st, k, 1, `${st.airlines[k].name} ärgert sich: Du hast den Slot in ${STADT[A.stadt].name} weggeschnappt.`);
    }
    // Ein Rivale hatte einen Flug vor: Gewinnt er, fliegt er ihn jetzt.
    if (A.frage && A.warte && A.warte.plan && A.fuehrt === A.starter && A.starter !== SPIELER) {
      const plan = Object.assign({}, A.warte.plan, { [A.warte.ende]: { art: "slot", id: slot.id, h: slot.h, preis: 0 } });
      kiFliegen(st, A.starter, plan);
    }
    geaendert(st);
    return { sieger: A.fuehrt, preis, slot, gebote: A.gebote, starter: A.starter, stadt: A.stadt, h: A.h };
  }
  // Ohne dich: Die Rivalen bieten untereinander, bis keiner mehr will.
  function auktionAuto(st) { let n = 0; while (auktionKi(st) && n++ < 500); return auktionEnde(st); }
  // Wird der Spieler gefragt, wenn ein Rivale hier einen Slot will? Nur in seinem Netz, nur mit genug Geld, höchstens einmal am Tag.
  function spielerGefragt(st, stadt, h) {
    if (!spielerFragen || st.probe) return false;
    const p = st.airlines[SPIELER];
    if (p.konkurs || hatTafel(p, stadt) || st.gefragtAm === tagVon(st)) return false;
    if (!p.slots.some((s) => s.stadt === stadt) && !p.routen.some((r) => r.a === stadt || r.b === stadt)) return false;
    const gp = slotGrundpreis(stadt, h);
    return p.geld >= gp + bietSchritt(gp);
  }
  // Buchen ohne Oberfläche (Rivalen, Tests): Versteigerung starten und gleich auswerten.
  // Will ein Rivale einen Slot in deinem Netz, bleibt die Versteigerung offen, und das Spiel fragt dich.
  function slotBuchen(st, aid, stadt, h, warte) {
    const r = auktionStart(st, aid, stadt, h, warte);
    if (!r.ok) return r;
    if (aid !== SPIELER && spielerGefragt(st, stadt, h)) {
      st.auktion.frage = true;             // offen lassen: Die Oberfläche fragt dich, ob du mitbietest
      st.gefragtAm = tagVon(st);
      return { ok: false, grund: "auktion" };
    }
    const e = auktionAuto(st);
    if (e.sieger !== aid) return { ok: false, grund: "ueberboten", sieger: e.sieger, betrag: e.preis, slot: e.slot };
    return { ok: true, slot: e.slot, preis: e.preis, gebote: e.gebote };
  }
  function typFrei(st, a, typ) {
    const t = TYPEN[typ];
    if (a.id !== SPIELER) return t.stufe <= (a.stufe || 1);
    return t.stufe <= st.stufe;
  }
  function routeVon(a, x, y) { return a.routen.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x)); }

  // Ein Umlauf: ab x um h1 (Ortszeit x), zurück ab y um h2 (Ortszeit y). Das Spiel rechnet Flugzeit und Zeitzonen.
  const flugdauer = (typ, km) => km / TYPEN[typ].kmh + 0.35;       // mit Start, Landung, Rollen
  function zeiten(a, x, y, typ, h1, h2) {
    const km = entfernung(x, y), d = flugdauer(typ, km);
    const w = profil(a).wende + (km > 4000 ? 0.75 : 0);          // Langstrecke: tanken und putzen dauert länger
    const dz = zone(y) - zone(x);
    const an = h1 + d + dz;                                       // Ankunft in y, Ortszeit y
    let rueck = h2;
    while (rueck < an + w - 1e-6) rueck += 24;                    // sonst erst am nächsten Tag
    const heim = rueck + d - dz;                                  // wieder in x, Ortszeit x
    const dauer = heim + w - h1;                                  // so lange ist das Flugzeug gebunden
    const tage = Math.max(1, Math.ceil((dauer - 1e-6) / 24));
    // Kurze Strecken müssen am selben Tag zurück. Langstrecken dürfen über Nacht, dann fliegt das Flugzeug nur jeden zweiten Tag.
    const passt = dauer <= 24 + 1e-6 || (d >= 4.5 && dauer <= 48 + 1e-6);
    return { km, flug: d, wende: w, ab: h1, an, rueck, heim, dauer, tage, passt, warte: rueck - an };
  }
  function zeitenVon(a, F) {
    const f = a.flotte.find((z) => z.id === F.f), s1 = slotVon(a, F.s1), s2 = slotVon(a, F.s2);
    if (!f || !s1 || !s2) return null;
    return zeiten(a, F.von, F.nach, f.typ, s1.h, s2.h);
  }
  // Der Tagesplan eines Flugzeugs: wann es wohin unterwegs ist.
  function tagesplan(st, aid, fid) {
    const a = st.airlines[aid];
    return fluegeVon(a, fid).map((F) => ({ flug: F, z: zeitenVon(a, F) })).filter((x) => x.z).sort((p, q) => p.z.ab - q.z.ab);
  }
  const ueberlappt = (s1, d1, s2, d2) => uhr24(s2 - s1) < d1 - 1e-6 || uhr24(s1 - s2) < d2 - 1e-6;
  function flugzeugFrei(a, f, x, ab, dauer, ohne) {
    const fl = fluegeVon(a, f.id).filter((F) => F.id !== ohne);
    if (!fl.length) return true;
    if (f.ort && f.ort !== x) return false;                       // ein Flugzeug startet alle Flüge am selben Flughafen
    if (dauer > 24) return false;
    for (const F of fl) {
      const z = zeitenVon(a, F);
      if (!z || z.dauer > 24 || ueberlappt(z.ab, z.dauer, ab, dauer)) return false;
    }
    return true;
  }
  // Wie viele Stunden des Tages (5 bis 23 Uhr) ist das Flugzeug in der Luft oder am Boden beschäftigt?
  function auslastungFlugzeug(st, aid, fid) {
    let s = 0;
    for (const x of tagesplan(st, aid, fid)) s += Math.min(24, x.z.dauer);
    return Math.min(1, s / 18);
  }

  // Welche Slots kann die Airline an diesem Flughafen für einen neuen Flug nehmen?
  function slotIndex(st, a) {
    const idx = { benutzt: benutzteSlots(a), eigene: {}, frei: {}, geschenk: a.geschenk || 0 };
    for (const s of a.slots) if (!idx.benutzt.has(s.id)) (idx.eigene[s.stadt] = idx.eigene[s.stadt] || []).push(s);
    return idx;
  }
  function enden(st, a, stadt, idx) {
    idx = idx || slotIndex(st, a);
    const liste = [];
    for (const s of idx.eigene[stadt] || []) liste.push({ art: "slot", id: s.id, h: s.h, preis: 0 });
    if (hatTafel(a, stadt)) {
      for (const h of tafelStunden(a, stadt)) if (!a.slots.some((s) => s.heim && s.stadt === stadt && s.h === h)) liste.push({ art: "tafel", h, preis: idx.geschenk > 0 ? 0 : heimPreis(stadt, h) });
    } else {
      if (!idx.frei[stadt]) idx.frei[stadt] = freieStunden(st, stadt);
      for (const h of idx.frei[stadt]) liste.push({ art: "frei", h, preis: slotGrundpreis(stadt, h) });
    }
    return liste;
  }

  // Sucht den besten Flug x→y→x mit diesem Flugzeugtyp: passende Slots an beiden Enden und ein Flugzeug, das Zeit hat.
  // opt.e1 / opt.e2: ein bestimmter Slot; opt.fid: ein bestimmtes Flugzeug; opt.neu: auf jeden Fall ein neues kaufen;
  // opt.nurFrei: nur mit einem Flugzeug, das schon da ist.
  function flugFinden(st, aid, x, y, typ, opt) {
    opt = opt || {};
    const a = st.airlines[aid];
    if (x === y) return { ok: false, grund: "gleich" };
    if (!TYPEN[typ] || !typFrei(st, a, typ)) return { ok: false, grund: "gesperrt" };
    const km = entfernung(x, y);
    if (km > TYPEN[typ].reichweite) return { ok: false, grund: "reichweite" };
    const idx = opt.idx || slotIndex(st, a);
    const e1 = opt.e1 ? [opt.e1] : enden(st, a, x, idx), e2 = opt.e2 ? [opt.e2] : enden(st, a, y, idx);
    if (!e1.length || !e2.length) return { ok: false, grund: "slots", fehlt: !e1.length ? x : y };
    const eigene = opt.neu ? [] : a.flotte.filter((f) => (opt.fid ? f.id === opt.fid : f.typ === typ));
    const w = (STADT[x].w + STADT[y].w) / 2;
    let best = null, zeitPasst = false, belegt = false;
    for (const s1 of e1) for (const s2 of e2) {
      const z = zeiten(a, x, y, typ, s1.h, s2.h);
      if (!z.passt) continue;
      zeitPasst = true;
      const f = eigene.find((k) => flugzeugFrei(a, k, x, z.ab, z.dauer)) || null;
      if (!f && (opt.fid || opt.nurFrei)) { belegt = true; continue; }
      const flugzeug = f ? 0 : TYPEN[typ].preis;
      let slots = s1.preis + s2.preis;
      if (s1.art === "tafel" && s2.art === "tafel" && idx.geschenk === 1) slots = Math.max(s1.preis, s2.preis) || heimPreis(y, s2.h);
      const guete = (zeitGuete(s1.h, w) + zeitGuete(s2.h, w)) / z.tage - z.dauer * 0.01 - (flugzeug + slots) / 2e7;
      if (!best || guete > best.guete) best = { guete, s1, s2, z, f, flugzeug, slots };
    }
    if (!best) return { ok: false, grund: !zeitPasst ? "zeit" : opt.nurFrei && !opt.fid ? "keinFlugzeug" : belegt ? "belegt" : "zeit" };
    const kosten = { flugzeug: best.flugzeug, slots: best.slots, gesamt: best.flugzeug + best.slots, frei: !!best.f };
    const plan = { x, y, typ, fid: best.f ? best.f.id : null, e1: best.s1, e2: best.s2, stufe: opt.stufe || null, kabine: opt.kabine || null };
    if (kosten.gesamt > a.geld && !opt.schulden) return { ok: false, grund: "geld", kosten, plan, zeiten: best.z };
    return { ok: true, kosten, plan, zeiten: best.z };
  }
  const kostenFuer = (st, aid, x, y, typ) => { const t = flugFinden(st, aid, x, y, typ); return t.kosten ? Object.assign({ slotFehlt: false }, t.kosten) : { flugzeug: TYPEN[typ].preis, slots: 0, gesamt: TYPEN[typ].preis, slotFehlt: t.grund === "slots" || t.grund === "zeit", frei: false }; };
  function kannFliegen(st, aid, x, y, typ, opt) { return flugFinden(st, aid, x, y, typ, opt); }

  // Nimmt einen Slot für einen Flug in Besitz (kauft ihn, wenn nötig).
  function endeNehmen(st, a, stadt, e, warte) {
    if (e.art === "slot") return slotVon(a, e.id);
    if (e.art === "tafel") { const r = heimSlotKaufen(st, a.id, stadt, e.h); return r.ok ? r.slot : null; }
    const r = slotBuchen(st, a.id, stadt, e.h, warte);
    if (!r.ok) st.letzteBuchung = r;
    return r.ok ? r.slot : null;
  }
  // Legt einen Flug an: kauft fehlende Slots und (wenn nötig) das Flugzeug, eröffnet die Linie, wenn es sie noch nicht gibt.
  function flugAnlegen(st, aid, plan) {
    const a = st.airlines[aid];
    const test = flugFinden(st, aid, plan.x, plan.y, plan.typ, { e1: plan.e1, e2: plan.e2, fid: plan.fid, neu: !plan.fid, schulden: plan.schulden });
    if (!test.ok) return test;
    // Erst das Ende buchen, um das geboten wird (meist das Ziel). Geht es verloren, bleibt das andere unberührt.
    st.letzteBuchung = null;
    const s2 = endeNehmen(st, a, plan.y, plan.e2, { plan, ende: "e2" });
    const s1 = s2 ? endeNehmen(st, a, plan.x, plan.e1, { plan: Object.assign({}, plan, { e2: { art: "slot", id: s2.id, h: s2.h, preis: 0 } }), ende: "e1" }) : null;
    if (!s1 || !s2) { const b = st.letzteBuchung; st.letzteBuchung = null; return Object.assign({ ok: false, grund: "slots" }, b && b.grund === "ueberboten" ? { grund: "ueberboten", sieger: b.sieger, betrag: b.betrag, stadt: b.slot.stadt, h: b.slot.h } : {}); }
    let f = plan.fid ? a.flotte.find((z) => z.id === plan.fid) : null;
    if (!f) { a.geld -= TYPEN[plan.typ].preis; f = flugzeugHinzu(a, plan.typ, plan.kabine); f.seit = tagVon(st); }
    f.ort = plan.x;
    let r = routeVon(a, plan.x, plan.y);
    if (!r) {
      r = { id: a.id + "r" + a.naechste++, a: plan.x, b: plan.y, stufe: plan.stufe || "normal", seit: tagVon(st), auslastung: null, minus: 0 };
      a.routen.push(r);
    }
    else if (aid === SPIELER) r.alt = true;
    // Du fliegst jetzt eine Strecke, die schon ein Rivale fliegt: Das nimmt er persönlich.
    if (aid === SPIELER && !r.alt) for (const rid of ["k", "s", "a"]) if (st.airlines[rid] && routeVon(st.airlines[rid], plan.x, plan.y)) aergern(st, rid, 1, `${st.airlines[rid].name} ärgert sich: Du fliegst jetzt auch ${STADT[plan.x].name}–${STADT[plan.y].name}.`);
    const F = { id: a.id + "u" + a.naechste++, route: r.id, f: f.id, von: plan.x, nach: plan.y, s1: s1.id, s2: s2.id, seit: tagVon(st) };
    a.fluege.push(F);
    geaendert(st);
    return { ok: true, route: r, flugzeug: f, flug: F, kosten: test.kosten, zeiten: test.zeiten };
  }
  // Kurzform: den besten Flug suchen und anlegen.
  function fliegen(st, aid, x, y, typ, opt) {
    const test = flugFinden(st, aid, x, y, typ, opt);
    if (!test.ok) return test;
    if (opt && opt.stufe) test.plan.stufe = opt.stufe;
    return flugAnlegen(st, aid, test.plan);
  }

  // Streicht einen Flug. Die Slots bleiben bis zum Saisonende, das Flugzeug bleibt in der Flotte.
  function flugStreichen(st, aid, flugId) {
    const a = st.airlines[aid];
    const F = a.fluege.find((x) => x.id === flugId);
    if (!F) return false;
    a.fluege = a.fluege.filter((x) => x !== F);
    if (!a.fluege.some((x) => x.route === F.route)) a.routen = a.routen.filter((r) => r.id !== F.route);
    const f = a.flotte.find((z) => z.id === F.f);
    if (f && !a.fluege.some((x) => x.f === f.id)) f.ort = null;
    geaendert(st);
    return true;
  }
  // Nimmt den letzten Flug von der Linie. Der letzte schließt sie.
  function abziehen(st, aid, rid) {
    const fl = fluegeAuf(st.airlines[aid], rid);
    return fl.length ? flugStreichen(st, aid, fl[fl.length - 1].id) : false;
  }
  function routeSchliessen(st, aid, rid) {
    while (abziehen(st, aid, rid));
  }
  function verkaufen(st, aid, fid) {
    const a = st.airlines[aid];
    const f = a.flotte.find((z) => z.id === fid);
    if (!f || a.fluege.some((x) => x.f === fid)) return false;
    a.flotte = a.flotte.filter((z) => z !== f);
    a.geld += Math.round(TYPEN[f.typ].preis * REGELN.verkaufAnteil);
    geaendert(st);
    return true;
  }
  function preisStufe(st, aid, rid, stufe) {
    const r = st.airlines[aid].routen.find((x) => x.id === rid);
    if (!r || !STUFEN[stufe] || r.stufe === stufe) return false;
    vermerken(st, aid, { art: "preis", rid, alt: r.stufe, text: "Preis " + STADT[r.a].name + "–" + STADT[r.b].name + ": " + STUFEN[stufe].kurz });
    r.stufe = stufe;
    geaendert(st);
    return true;
  }
  // Kabine umbauen: kostet Geld, und das Flugzeug steht einen Tag in der Werkstatt.
  function umbauPreis(typ) { return Math.max(50000, runde10k(TYPEN[typ].preis * 0.04)); }
  function kabineSetzen(st, aid, fid, business, first, gratis) {
    const a = st.airlines[aid];
    const f = a.flotte.find((z) => z.id === fid);
    if (!f) return { ok: false };
    const g = kabineGrenzen(f.typ);
    business = Math.max(0, Math.min(g.business, Math.round(business * 20) / 20));
    first = Math.max(0, Math.min(g.first, Math.round(first * 20) / 20));
    if (f.kabine.business === business && f.kabine.first === first) return { ok: false };
    const preis = gratis ? 0 : umbauPreis(f.typ);
    if (a.geld < preis) return { ok: false, grund: "geld" };
    a.geld -= preis;
    if (!gratis) {
      vermerken(st, aid, { art: "kabine", fid, alt: { ...f.kabine }, text: "Kabine " + TYPEN[f.typ].kurz + " umgebaut" });
      f.werkstattTag = tagVon(st) + 1;
    }
    f.kabine = { business, first };
    geaendert(st);
    return { ok: true, preis };
  }
  const inWerkstatt = (st, f) => !!f.werkstattTag && f.werkstattTag >= tagVon(st);
  // Probiert alle Aufteilungen durch und nimmt die beste (für den Rat des Analysten und die Rivalen).
  function besteKabine(st, aid, fid) {
    const f = st.airlines[aid].flotte.find((z) => z.id === fid);
    if (!f) return null;
    const gr = kabineGrenzen(f.typ);
    let best = null;
    const k = klonen(st);
    const kf = k.airlines[aid].flotte.find((z) => z.id === fid);
    delete kf.werkstattTag;
    for (let b = 0; b <= gr.business + 0.0001; b += 0.1) {
      for (let fi = 0; fi <= gr.first + 0.0001; fi += 0.1) {
        kf.kabine = { business: Math.round(b * 10) / 10, first: Math.round(fi * 10) / 10 };
        const g = berechnen(k, tagVon(k)).summe[aid];
        if (!best || g > best.g + 1) best = { g, business: kf.kabine.business, first: kf.kabine.first };
      }
    }
    return best;
  }
  // Für die Anzeige: die Sitzaufteilung einer Linie ist der Schnitt ihrer Flugzeuge.
  function klassenVon(r, a) {
    const fs = flugzeugeAuf(a, r.id);
    if (!fs.length) return { business: 0, first: 0 };
    let s = 0, b = 0, f = 0;
    for (const z of fs) { const n = TYPEN[z.typ].sitze; s += n; b += n * z.kabine.business; f += n * z.kabine.first; }
    return { business: b / s, first: f / s };
  }

  // Einen Grundsatz ändern. Wird es für die Gäste schlechter, leidet der Ruf ein wenig.
  function grundsatzSetzen(st, aid, k, wert) {
    const a = st.airlines[aid];
    if (!GRUNDSAETZE[k] || !GRUNDSAETZE[k].optionen[wert]) return false;
    a.grundsaetze = a.grundsaetze || { ...VORLAGEN[a.service || "standard"] };
    if (a.grundsaetze[k] === wert) return false;
    const vorher = profil(a).komfort;
    vermerken(st, aid, { art: "grundsatz", k, alt: a.grundsaetze[k], text: GRUNDSAETZE[k].name + ": " + GRUNDSAETZE[k].optionen[wert].name });
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
  // Merkt sich eine Änderung des Spielers, damit er am nächsten Tag sieht, was sie wirklich gebracht hat.
  function vermerken(st, aid, v) {
    if (aid !== SPIELER || st.probe) return;
    const a = st.airlines[aid];
    a.vermerke = (a.vermerke || []).filter((x) => !(x.art === v.art && x.k === v.k && x.rid === v.rid && x.fid === v.fid));
    a.vermerke.push(Object.assign({ tag: tagVon(st) }, v));
  }

  // ---------- Flugbetrieb ----------

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

  // Reisende pro Tag, die an einem Flughafen überhaupt abfliegen wollen. Alle Linien und Airlines teilen sich diese Menge.
  function reisende(st, stadt) {
    const t = st.trend && st.trend[stadt];
    return Math.round(REGELN.reisende * STADT[stadt].g ** 2 * (t ? t.f : 1) / 10) * 10;
  }

  function berechnen(st, tag, nurAirline) {
    const richtungen = {};     // "x>y" → Flüge dieser Richtung
    const routen = {};         // Routen-ID → Ergebnis
    const nd = {};
    const nachfrage = (x, y) => nd[paar(x, y)] || (nd[paar(x, y)] = grundNachfrage(st, x, y, tag));
    const angebote = {};
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      if (!a.fluege.length) continue;
      const sv = profil(a);
      const anzahl = {};
      for (const F of a.fluege) anzahl[F.f] = (anzahl[F.f] || 0) + 1;
      const flotte = {}, slots = {};
      for (const f of a.flotte) flotte[f.id] = f;
      for (const s of a.slots) slots[s.id] = s;
      const proRoute = {};
      for (const F of a.fluege) (proRoute[F.route] = proRoute[F.route] || []).push(F);
      for (const r of a.routen) {
        const fl = proRoute[r.id];
        if (!fl) continue;
        const km = entfernung(r.a, r.b);
        const gA = REGELN.gebuehr[STADT[r.a].k], gB = REGELN.gebuehr[STADT[r.b].k];
        const fk = wirkung(st, aid, "kapazitaet", tag, r.a, r.b);   // Streik, Sturm: weniger Flüge
        const ker = (wirkung(st, aid, "kerosinFest", tag) < 1 ? 1 : st.kerosin) * wirkung(st, aid, "kerosin", tag);
        const bonus = ausgebaut(a, r.a) || ausgebaut(a, r.b) ? REGELN.ausbauGaeste : 1;
        const att0 = { urlaub: anziehung(a, r.stufe, "urlaub") * bonus, geschaeft: anziehung(a, r.stufe, "geschaeft") * bonus };
        const e = {
          id: r.id, airline: aid, a: r.a, b: r.b, km, flugzeuge: 0, legs: 0, sitze: 0, ueber: 0,
          lokal: { urlaub: 0, geschaeft: 0 }, umsteiger: [], kerosin: 0, gebuehr: 0, crew: 0, fluege: [], kab: { business: 0, first: 0 },
        };
        const maschinen = new Set();
        for (const F of fl) {
          const f = flotte[F.f], s1 = slots[F.s1], s2 = slots[F.s2];
          if (!f || !s1 || !s2) continue;
          const t = TYPEN[f.typ];
          const z = zeiten(a, F.von, F.nach, f.typ, s1.h, s2.h);
          const ruht = f.werkstattTag === tag;      // in der Werkstatt: der Flug fällt aus
          const freq = ruht ? 0 : fk / z.tage;
          const sitze = Math.round(t.sitze * sv.sitze) * freq;
          maschinen.add(f.id);
          e.sitze += sitze; e.legs += 2 * freq;
          e.kerosin += 2 * freq * km * t.verbrauch * ker * sv.betrieb;
          e.gebuehr += freq * (gA + gB) * t.groesse * sv.betrieb;
          e.crew += t.crew / anzahl[f.id];
          e.kab.business += sitze * f.kabine.business; e.kab.first += sitze * f.kabine.first;
          const att = { urlaub: att0.urlaub * freq, geschaeft: att0.geschaeft * freq };
          const hin = { dem: { urlaub: 0, geschaeft: 0 }, sitze, h: z.ab }, zur = { dem: { urlaub: 0, geschaeft: 0 }, sitze, h: z.rueck };
          e.fluege.push({ id: F.id, f: f.id, typ: f.typ, von: F.von, nach: F.nach, z, ruht, freq, hin, zur });
          if (!freq) continue;
          (richtungen[F.von + ">" + F.nach] = richtungen[F.von + ">" + F.nach] || []).push({ att, h: z.ab, out: hin });
          (richtungen[F.nach + ">" + F.von] = richtungen[F.nach + ">" + F.von] || []).push({ att, h: z.rueck, out: zur });
        }
        if (!e.fluege.length) continue;
        e.flugzeuge = maschinen.size;
        routen[r.id] = e;
        (angebote[paar(r.a, r.b)] = angebote[paar(r.a, r.b)] || []).push({ a, r, e });
      }
    }
    // Direkte Fluggäste: jede Richtung für sich, nach Uhrzeit verteilt.
    for (const [k, liste] of Object.entries(richtungen)) {
      const [x, y] = k.split(">");
      verteilen(nachfrage(x, y), liste);
    }
    // Mehr als Plätze passen nicht in einen Flug.
    const bedient = {};
    for (const e of Object.values(routen)) {
      for (const fl of e.fluege) {
        for (const d of [fl.hin, fl.zur]) {
          const will = d.dem.urlaub + d.dem.geschaeft;
          const c = will > 0 ? Math.min(1, d.sitze / will) : 0;
          d.last = d.sitze > 0 ? will / d.sitze : 0;
          d.pax = will * c;
          e.lokal.urlaub += d.dem.urlaub * c / 2;
          e.lokal.geschaeft += d.dem.geschaeft * c / 2;
          e.ueber += will * (1 - c) / 2;
        }
      }
      const n = e.lokal.urlaub + e.lokal.geschaeft;
      bedient[e.a] = (bedient[e.a] || 0) + n;
      bedient[e.b] = (bedient[e.b] || 0) + n;
    }
    // Jede Stadt hat nur so viele Reisende am Tag. Sind es mehr Plätze als Leute, teilen sich alle den Kuchen.
    const staedteStand = {};
    for (const c of Object.keys(bedient)) {
      const R = reisende(st, c);
      staedteStand[c] = { reisende: R, bedient: Math.min(R, bedient[c]), faktor: bedient[c] > R ? R / bedient[c] : 1 };
    }
    for (const e of Object.values(routen)) {
      const f = Math.min(staedteStand[e.a].faktor, staedteStand[e.b].faktor);
      if (f < 1) {
        e.lokal.urlaub *= f; e.lokal.geschaeft *= f;
        for (const fl of e.fluege) { fl.hin.pax *= f; fl.zur.pax *= f; }
      }
      if (e.sitze > 0) { e.kab.business /= e.sitze; e.kab.first /= e.sitze; }
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
            for (const gast of GAESTE) pax += n[gast] * anziehung(a, "normal", gast) * 0.6;
            // Umsteigen klappt nur, wenn auf beiden Linien oft genug geflogen wird.
            const takt = Math.min(1, Math.min(routen[r1.id].legs, routen[r2.id].legs) / 4);
            pax *= REGELN.umsteigerAnteil * sv.umsteiger * direkt * (ausgebaut(a, h) ? REGELN.ausbauUmsteiger : 1) * (0.5 + 0.5 * takt);
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
      const kl = e.kab;
      const S = { first: e.sitze * kl.first / KLASSEN.first.platz, business: e.sitze * kl.business / KLASSEN.business.platz };
      S.eco = e.sitze * (1 - kl.first - kl.business);
      const D = klassenNachfrage(e, profil(a));
      const f = Math.min(D.first, S.first);
      D.business += (D.first - f) * 0.6;
      const b = Math.min(D.business, S.business);
      D.eco += (D.business - b) * 0.5;
      const umst = e.umsteiger.reduce((s, u) => s + u.pax, 0);
      e.bedarf = D.first + D.business + D.eco + umst + e.ueber;
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
    const summe = {}, gaeste = {};
    for (const aid of st.reihenfolge) { summe[aid] = 0; gaeste[aid] = 0; }
    for (const e of Object.values(routen)) { summe[e.airline] += e.gewinn; gaeste[e.airline] += e.pax; }
    for (const aid of st.reihenfolge) summe[aid] -= verwaltungKosten(st.airlines[aid]);
    return { routen, summe, gaeste, staedte: staedteStand, tag };
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
    kopie.probe = true;
    const res = aenderung(kopie);
    if (res && res.ok === false) return null;
    const nachher = berechnen(kopie, tagVon(kopie)).summe[aid];
    return { delta: nachher - vorher, kopie, res };
  }
  function klonen(st) { return JSON.parse(JSON.stringify(st)); }

  // Schätzung für einen zusätzlichen Flug x→y→x (ab x um h1, zurück ab y um h2): Was bringt er der Airline am Tag?
  // Rechnet mit den Uhrzeiten und allen Flügen, die es auf der Strecke schon gibt (auch den eigenen).
  function schaetzen(st, aid, x, y, typ, h1, h2, neuesFlugzeug) {
    const a = st.airlines[aid];
    const tag = tagVon(st);
    const km = entfernung(x, y);
    const n = grundNachfrage(st, x, y, tag);
    const sv = profil(a), t = TYPEN[typ];
    if (h1 == null) h1 = 8;
    if (h2 == null) h2 = uhr24(Math.ceil(h1 + flugdauer(typ, km) + zone(y) - zone(x) + 1));
    const z = zeiten(a, x, y, typ, h1, h2);
    const freq = 1 / z.tage;
    const sitze = Math.round(t.sitze * sv.sitze) * freq;
    const basisListen = () => {
      const hin = [], zur = [];
      for (const bid of st.reihenfolge) {
        const b = st.airlines[bid];
        const r = routeVon(b, x, y);
        if (!r) continue;
        const au = anziehung(b, r.stufe, "urlaub"), ag = anziehung(b, r.stufe, "geschaeft"), bs = profil(b).sitze;
        for (const F of b.fluege) {
          if (F.route !== r.id) continue;
          const zz = zeitenVon(b, F);
          if (!zz) continue;
          const f = b.flotte.find((k) => k.id === F.f);
          const s = Math.round(TYPEN[f.typ].sitze * bs) / zz.tage;
          const att = { urlaub: au / zz.tage, geschaeft: ag / zz.tage };
          const o1 = { att, h: zz.ab, out: { dem: { urlaub: 0, geschaeft: 0 } }, sitze: s, eigen: bid === aid };
          const o2 = { att, h: zz.rueck, out: { dem: { urlaub: 0, geschaeft: 0 } }, sitze: s, eigen: bid === aid };
          (F.von === x ? hin : zur).push(o1); (F.von === x ? zur : hin).push(o2);
        }
      }
      return [hin, zur];
    };
    const eigenPax = (listen) => { let s = 0; for (const l of listen) for (const o of l) if (o.eigen) s += Math.min(o.sitze, o.out.dem.urlaub + o.out.dem.geschaeft); return s; };
    let vorher = 0;
    const alt = basisListen();
    if (alt[0].some((o) => o.eigen) || alt[1].some((o) => o.eigen)) { verteilen(n, alt[0]); verteilen(n, alt[1]); vorher = eigenPax(alt); }
    const neu = alt[0].length || alt[1].length ? basisListen() : alt;
    const att = { urlaub: anziehung(a, "normal", "urlaub") * freq, geschaeft: anziehung(a, "normal", "geschaeft") * freq };
    const n1 = { att, h: z.ab, out: { dem: { urlaub: 0, geschaeft: 0 } }, sitze, eigen: true };
    const n2 = { att, h: z.rueck, out: { dem: { urlaub: 0, geschaeft: 0 } }, sitze, eigen: true };
    neu[0].push(n1); neu[1].push(n2);
    verteilen(n, neu[0]); verteilen(n, neu[1]);
    let flieg = Math.max(0, eigenPax(neu) - vorher);
    const imFlug = Math.min(sitze, n1.out.dem.urlaub + n1.out.dem.geschaeft) + Math.min(sitze, n2.out.dem.urlaub + n2.out.dem.geschaeft);
    // Umsteiger grob: über eigene Routen an x und y.
    let umst = 0;
    for (const [h, zl] of [[x, y], [y, x]]) {
      const speichen = a.routen.filter((r) => r.a === h || r.b === h);
      if (speichen.length + 1 < REGELN.drehkreuzAb) continue;
      for (const r of speichen) {
        const o = r.a === h ? r.b : r.a;
        if (o === zl) continue;
        const dd = entfernung(o, zl);
        if (dd < 300 || entfernung(o, h) + km > REGELN.umwegMax * dd) continue;
        const m = grundNachfrage(st, o, zl, tag);
        umst += (m.urlaub + m.geschaeft) * 0.6 * REGELN.umsteigerAnteil * sv.umsteiger * 0.35;
      }
    }
    flieg += Math.max(0, Math.min(2 * umst * freq, 2 * sitze - imFlug));
    const preis = ticket(km) * sv.preis + sv.extra;
    const g = REGELN.gebuehr[STADT[x].k] + REGELN.gebuehr[STADT[y].k];
    const kosten = freq * (2 * km * t.verbrauch * st.kerosin + g * t.groesse) * sv.betrieb + (neuesFlugzeug === false ? 0 : t.crew) + flieg * sv.kosten;
    return { gewinn: flieg * preis - kosten, auslastung: sitze > 0 ? Math.min(1, (imFlug + Math.min(2 * umst * freq, 2 * sitze - imFlug)) / (2 * sitze)) : 0, pax: flieg, zeiten: z };
  }

  // Drei Vorschläge für die erste Linie: günstig, gut fürs Drehkreuz, große Chance.
  function angebote(st, aid) {
    const a = st.airlines[aid];
    const x = a.basis;
    const kand = [];
    const idx = slotIndex(st, a);
    const pruefen = (ziel, typ) => {
      const t = flugFinden(st, aid, x, ziel, typ, { idx });
      if (!t.ok) return null;
      const g = schaetzen(st, aid, x, ziel, typ, t.zeiten.ab, t.zeiten.rueck, !t.kosten.frei).gewinn;
      return g > 0 ? { ziel, typ, gesamt: t.kosten.gesamt, gewinn: g, k: STADT[ziel].k, plan: t.plan } : null;
    };
    for (const c of ALLE) {
      if (c.id === x || routeVon(a, x, c.id)) continue;
      let best = null;
      for (const typ of Object.keys(TYPEN)) {
        const o = pruefen(c.id, typ);
        if (o && (!best || o.gewinn / Math.sqrt(o.gesamt) > best.gewinn / Math.sqrt(best.gesamt))) best = o;
      }
      if (best) kand.push(best);
    }
    if (!kand.length) return [];
    const raus = new Set();
    const nimm = (liste, art, grund) => {
      const o = liste.find((v) => !raus.has(v.ziel));
      if (!o) return null;
      raus.add(o.ziel);
      const w = o.gewinn;          // pro Tag, wie überall im Spiel
      const streu = art === "chance" ? 0.45 : 0.25;
      return Object.assign({}, o, { art, grund: grund(o), von: Math.round(w * (1 - streu) / 1e3) * 1e3, bis: Math.round(w * (1 + streu) / 1e3) * 1e3 });
    };
    // Reihenfolge der Auswahl: erst der günstige Einstieg, dann die große Chance (das höchste Ergebnis, das drin ist),
    // dann das Drehkreuz aus dem, was übrig bleibt. So zeigt die Chance immer am meisten Gewinn.
    const guenstig = nimm([...kand].sort((p, q) => p.gesamt - q.gesamt || q.gewinn - p.gewinn), "guenstig",
      (o) => "Wenig Geld nötig, viel Reserve.");
    const stark = [];
    for (const o of kand) {
      let b = o;
      for (const typ of Object.keys(TYPEN)) {
        const p = pruefen(o.ziel, typ);
        if (p && p.gewinn > b.gewinn) b = p;
      }
      stark.push(b);
    }
    const chance = nimm(stark.sort((p, q) => q.gewinn - p.gewinn), "chance",
      (o) => "Am meisten Gewinn, braucht aber " + Math.round(o.gesamt / Math.max(1, a.geld) * 100) + " % deines Geldes.");
    const dreh = nimm(kand.filter((o) => o.k >= 2).sort((p, q) => STADT[q.ziel].k - STADT[p.ziel].k || q.gewinn - p.gewinn), "drehkreuz",
      (o) => "Große Stadt: später viele Umsteiger.");
    const erg = [guenstig, dreh, chance];
    return erg.filter(Boolean);
  }

  // ---------- Assistent ----------
  // Ein einziger Assistent macht alles: Rat bei jeder Entscheidung, Tipps auf der Karte, ❗ an Linien, Wochenbericht.
  // Er ist nie ganz genau: Er nennt Spannen und hat eine Macke. Mehr Sterne = genauer, übersieht weniger, teurer.
  const ASSISTENTEN = {
    tim: { name: "Tim Brandt", bild: "air-assistent-tim", sterne: 1, gehalt: 3000, macke: 1.3, mackeText: "übertreibt gern", streuung: 0.45 },
    mia: { name: "Mia Kaya", bild: "air-assistent-mia", sterne: 2, gehalt: 8000, macke: 1.0, mackeText: "solide", streuung: 0.25 },
    kern: { name: "Dr. Helga Kern", bild: "air-assistent-kern", sterne: 3, gehalt: 18000, macke: 0.85, mackeText: "eher vorsichtig", streuung: 0.12 },
  };
  // Ältere Spielstände hatten drei Rollen mit sieben Leuten: Wer dort eingestellt war, wird auf einen der drei umgerechnet.
  const ALTE_LEUTE = { tim: "tim", mia: "mia", kern: "kern", paul: "mia", jonas: "tim", lena: "mia", ines: "kern" };
  function assistentId(a) {
    const x = a.assistenten || {};
    if (x.analyst && ASSISTENTEN[x.analyst]) return x.analyst;
    // Alter Stand: den mit den meisten Sternen behalten.
    let best = null;
    for (const id of Object.values(x)) { const n = ALTE_LEUTE[id]; if (n && (!best || ASSISTENTEN[n].sterne > ASSISTENTEN[best].sterne)) best = n; }
    return best;
  }
  // rolle wird nicht mehr gebraucht (es gibt nur noch einen), bleibt aber erlaubt, damit alte Aufrufe weiter gehen.
  function assistent(a, rolle) {
    const id = assistentId(a);
    return id ? Object.assign({ id }, ASSISTENTEN[id]) : null;
  }
  // einstellen(st, aid, id) – id null entlässt. Die alte Form einstellen(st, aid, rolle, id) geht auch noch.
  function einstellen(st, aid, a3, a4) {
    const a = st.airlines[aid];
    const id = a4 !== undefined ? a4 : ASSISTENTEN[a3] || a3 == null ? a3 : undefined;
    if (id === undefined || (id && !ASSISTENTEN[id])) return false;
    a.assistenten = id ? { analyst: id } : {};
    a.auftraege = {};
    return true;
  }
  function gehaelter(a) {
    const x = assistent(a);
    return x ? x.gehalt : 0;
  }
  function umbenennen(st, aid, name, farbe) {
    const a = st.airlines[aid];
    const n = String(name || "").trim().slice(0, 18);
    if (n) a.name = n;       // das Kürzel bleibt: Daran hängt die Lackierung der Flugzeuge
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
    const idx = slotIndex(st, a);
    const kandidaten = [];
    for (const c of ALLE) {
      if (c.id === stadt || routeVon(a, stadt, c.id)) continue;
      let best = null;
      for (const typ of typen) {
        if (entfernung(stadt, c.id) > TYPEN[typ].reichweite) continue;
        const t = flugFinden(st, aid, stadt, c.id, typ, { idx });
        if (!t.zeiten) continue;                        // dort ist gerade kein Slot zu haben
        const s = schaetzen(st, aid, stadt, c.id, typ, t.zeiten.ab, t.zeiten.rueck, !t.kosten.frei);
        if (!best || s.gewinn > best.gewinn) best = { ...s, typ, ab: t.zeiten.ab };
      }
      if (best && best.gewinn > 0) kandidaten.push({ ziel: c.id, ...best });
    }
    kandidaten.sort((x, y) => y.gewinn - x.gewinn);
    // Der Analyst schaut sich die besten an, aber er sieht sie durch seine eigene Brille.
    const gesehen = kandidaten.slice(0, 8).map((k) => ({ ...k, schaetzung: k.gewinn * wer.macke * rauschen(st, wer.streuung) }));
    gesehen.sort((x, y) => y.schaetzung - x.schaetzung);
    return gesehen.slice(0, 3).map((k) => {
      const n = grundNachfrage(st, stadt, k.ziel, tag);
      const gaeste = k.pax * wer.macke * rauschen(st, wer.streuung);
      const geschaeft = Math.round(n.geschaeft / Math.max(1, n.urlaub + n.geschaeft) * 10) * 10;
      const konkurrenz = st.reihenfolge.filter((b) => b !== aid && routeVon(st.airlines[b], stadt, k.ziel)).length;
      let preis = konkurrenz >= 2 ? "angreifen" : geschaeft >= 50 && !konkurrenz ? "abschoepfen" : "normal";
      if (zufall(st) < wer.streuung * 0.6) preis = ["angreifen", "normal", "abschoepfen"][Math.floor(zufall(st) * 3)];
      return { start: stadt, ziel: k.ziel, typ: k.typ, ab: k.ab, km: Math.round(entfernung(stadt, k.ziel)), gewinn: spanne(k.schaetzung, wer.streuung), gaeste: spanne(gaeste, wer.streuung), geschaeft, konkurrenz, preis };
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
      if (flugzeugeAuf(a, r.id).length > 1) ideen.push({ art: "abziehen", f: (k) => abziehen(k, aid, r.id) });
      else if (wert < 0) ideen.push({ art: "schliessen", f: (k) => routeSchliessen(k, aid, r.id) });
      let best = null;
      for (const idee of ideen) {
        const pr = probe(st, aid, idee.f);
        if (!pr) continue;
        const schaetzung = pr.delta * wer.macke + (rauschen(st, wer.streuung) - 1) * Math.max(5000, Math.abs(e.gewinn) * 0.3);
        if (!best || schaetzung > best.schaetzung) best = { ...idee, schaetzung };
      }
      const aktion = best && best.schaetzung > 2000 ? { art: best.art, stufe: best.stufe } : null;
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
    else if (k.art === "abziehen") { if (flugzeugeAuf(a, x.id).length < 2) return false; abziehen(st, SPIELER, x.id); }   // nie die Linie nebenbei schließen
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

  // Ortszeit eines Flughafens → Uhr des Spiels (die Uhr zeigt die Zeit an der Heimat des Spielers).
  const spielUhr = (st, stadt, h) => h - zone(stadt) + zone(st.airlines[SPIELER].basis);

  function buchen(st, t0, t1, landungen) {
    const rg = rechnung(st);
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      for (const r of a.routen) {
        const e = rg.routen[r.id];
        if (!e || !e.legs) continue;
        const proLeg = e.gewinn / e.legs;
        for (const fl of e.fluege) {
          if (!fl.freq) continue;
          for (const [t, ziel] of [[spielUhr(st, fl.nach, fl.z.an), fl.nach], [spielUhr(st, fl.von, fl.z.heim), fl.von]]) {
            const n = Math.floor((t1 - t) / 24) - Math.floor((t0 - t) / 24);
            if (n <= 0) continue;
            const betrag = proLeg * fl.freq * n;
            a.geld += betrag;
            a.heute = (a.heute || 0) + betrag;
            if (aid === SPIELER && landungen.length < 60) landungen.push({ route: r.id, stadt: ziel, betrag });
          }
        }
      }
    }
  }

  // Lage eines Flugzeugs für die Anzeige: 0..1 entlang der Linie (von r.a nach r.b) und Richtung.
  function position(st, aid, f) {
    const a = st.airlines[aid];
    let boden = null;
    for (const F of a.fluege) {
      if (F.f !== f.id) continue;
      const z = zeitenVon(a, F);
      const r = a.routen.find((x) => x.id === F.route);
      if (!z || !r) continue;
      const vorn = F.von === r.a;                       // fliegt der Hinflug in Richtung a→b?
      const g1 = spielUhr(st, F.von, z.ab), g2 = spielUhr(st, F.nach, z.rueck);
      const p1 = uhr24(st.zeit - g1), p2 = uhr24(st.zeit - g2);
      if (p1 < z.flug) { const p = p1 / z.flug; return { r, anteil: vorn ? p : 1 - p, hin: vorn, amBoden: false, flug: F }; }
      if (p2 < z.flug) { const p = p2 / z.flug; return { r, anteil: vorn ? 1 - p : p, hin: !vorn, amBoden: false, flug: F }; }
      if (p1 >= z.flug && p1 < uhr24(g2 - g1)) boden = { r, anteil: vorn ? 1 : 0, hin: vorn, amBoden: true, flug: F };
      else if (!boden) boden = { r, anteil: vorn ? 0 : 1, hin: !vorn, amBoden: true, flug: F };
    }
    return boden;
  }

  function ablaufen(st) {
    const vorher = st.gelegenheiten.length;
    for (const g of st.gelegenheiten) {
      if (g.bis <= st.zeit && g.art === "wahl") { g.bis = st.zeit + 1; wahlTreffen(st, g.id, false); }   // nichts gewählt: es kommt, wie es kommt
    }
    st.gelegenheiten = st.gelegenheiten.filter((g) => g.bis > st.zeit);
    if (st.gelegenheiten.length !== vorher) geaendert(st);
    // Gebotsfristen: Wer bekommt den Slot?
    for (const s of st.pool.slice()) if (s.bis != null && s.bis <= st.zeit) poolAuswerten(st, s);
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
    // Der Assistent: täglich ein Blick auf Missstände, sonntags der Wochenbericht.
    const ctrl = assistent(p);
    if (ctrl) {
      p.hinweise = missstaende(st, SPIELER, ctrl.sterne);
      // Keine eigene Meldung mehr: Die ❗ an den Linien reichen, Vorschläge kommen als Tipp (beraterTag), damit es nicht zu viel wird.
    } else p.hinweise = [];
    if (ctrl && tag % REGELN.saisonTage === 0 && p.routen.length) {
      p.wochenbericht = wochenbericht(st, SPIELER, ctrl);
      // Dazu zwei Ideen für neue Strecken ab der Heimat (früher ein eigener Auftrag an den Analysten).
      p.wochenbericht.neu = routenBericht(st, SPIELER, p.basis, ctrl).slice(0, 2);
      melden(st, { art: "bericht", text: "📋 " + ctrl.name + ": Dein Wochenbericht ist da!", rolle: "controller" });
    }
    // Pleite-Stufen.
    pleitePruefen(st);
    if (st.ende) return;
    // Rivalen planen.
    if (tag + 1 >= REGELN.rivalenAb) for (const aid of ["k", "s", "a"]) if (!st.airlines[aid].konkurs) { zielRivale(st, aid); kiTag(st, aid); }
    spannungTag(st, tag + 1);
    // Saisonende: Slots prüfen.
    if (tag % REGELN.saisonTage === 0) slotsPruefen(st, tag);
    else if (tageBisSaisonende(tag) === 2) slotsWarnen(st, tag);
    wirkungMelden(st, tag);
    // Kerosin, Messen, Gelegenheiten.
    neuerTag(st, tag + 1);
    rangPruefen(st);
    zielPruefen(st);
    beraterTag(st);
    geaendert(st);
  }

  // Am Morgen danach: Was hat die Änderung von gestern wirklich gebracht? Gerechnet wird gegen "alles wie vorher".
  function wirkungMelden(st, tag) {
    const p = st.airlines[SPIELER];
    const liste = (p.vermerke || []).filter((v) => v.tag <= tag);
    p.vermerke = (p.vermerke || []).filter((v) => v.tag > tag);
    if (!liste.length || !p.fluege.length) return;
    const jetzt = berechnen(st, tag);
    st.wirkungenGestern = [];
    for (const v of liste.slice(-3)) {
      const k = klonen(st);
      const kp = k.airlines[SPIELER];
      if (v.art === "preis") { const r = kp.routen.find((x) => x.id === v.rid); if (!r) continue; r.stufe = v.alt; }
      else if (v.art === "grundsatz") kp.grundsaetze = { ...kp.grundsaetze, [v.k]: v.alt };
      else if (v.art === "kabine") { const f = kp.flotte.find((x) => x.id === v.fid); if (!f) continue; f.kabine = v.alt; }
      else continue;
      const alt = berechnen(k, tag);
      const dG = Math.round((jetzt.summe[SPIELER] - alt.summe[SPIELER]) / 100) * 100;
      const dP = Math.round(jetzt.gaeste[SPIELER] - alt.gaeste[SPIELER]);
      const w = { text: v.text, gewinn: dG, gaeste: dP };
      st.wirkungenGestern.push(w);
      melden(st, { art: "wirkung", gut: dG >= 0, text: `${v.text}: ${dP >= 0 ? dP + " Gäste mehr" : -dP + " Gäste weniger"} am Tag, Gewinn ${dG >= 0 ? "+" : "−"}${Math.abs(dG).toLocaleString("de-DE")} €.` });
    }
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
      melden(st, { art: "uebernahme", text: st.airlines[k].name + " will dich übernehmen.", von: k });
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


  // ---------- Neuer Tag: Kerosin, Messen, Slots, Gelegenheiten ----------
  function neuerTag(st, tag) {
    if (st.kerosinBis && tag > st.kerosinBis) { st.kerosin = 1; st.kerosinBis = 0; melden(st, { art: "kerosin", text: "Kerosin kostet wieder normal." }); }
    st.messen = st.messen.filter((m) => m.bis >= tag);
    slotsNachschub(st, tag);
    slotAngebot(st, tag);
    if (tag < REGELN.gelegenheitAb) return;
    const offen = st.gelegenheiten.filter((g) => ["messe", "kerosin", "wahl"].includes(g.art)).length;
    if (offen < 2 && zufall(st) < 0.6) {
      if (tag >= REGELN.wahlAb && !st.gelegenheiten.some((g) => g.art === "wahl") && zufall(st) < 0.3) wahlAnlegen(st, tag);
      else gelegenheitErzeugen(st, tag);
    }
  }

  function gelegenheitErzeugen(st, tag) {
    const arten = ["messe", "messe"].concat(st.kerosinBis ? [] : ["kerosin"]);
    const art = waehle(st, arten);
    const id = "g" + st.naechsteGel++;
    if (art === "messe") {
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
    if (g.art === "slotangebot") { if (!slotAngebotAnnehmen(st, g)) return { ok: false }; }
    else return { ok: false };
    st.gelegenheiten = st.gelegenheiten.filter((x) => x !== g);
    geaendert(st);
    return { ok: true, g };
  }
  function gelegenheitAblehnen(st, gid) {
    const g = st.gelegenheiten.find((x) => x.id === gid);
    if (!g) return false;
    st.gelegenheiten = st.gelegenheiten.filter((x) => x !== g);
    geaendert(st);
    return true;
  }

  // ---------- Rangliste ----------
  // Ein neues Flugzeug zählt erst voll und verliert dann über zwei Monate an Wert, bis auf den Verkaufspreis.
  // So steht nicht vorn, wer anfangs am wenigsten kauft.
  function flottenWert(a, tag) {
    return a.flotte.reduce((s, f) => {
      const alter = f.seit == null || tag == null ? REGELN.abschreibTage : Math.max(0, tag - f.seit);
      const anteil = Math.max(REGELN.verkaufAnteil, 1 - (1 - REGELN.verkaufAnteil) * alter / REGELN.abschreibTage);
      return s + TYPEN[f.typ].preis * anteil;
    }, 0);
  }
  function slotWert(a) {
    let s = 0;
    for (const x of a.slots) s += (x.heim ? heimPreis(x.stadt, x.h) : slotGrundpreis(x.stadt, x.h)) * 0.5;
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
  // Geht nur, wenn das neue alle Flüge des alten zeitlich schafft.
  function umruestenKosten(st, aid, rid, typ) {
    const a = st.airlines[aid];
    const fs = flugzeugeAuf(a, rid);
    if (!fs.length) return null;
    const alt = fs.slice().sort((x, y) => TYPEN[x.typ].sitze - TYPEN[y.typ].sitze)[0];
    return { alt, preis: Math.max(0, TYPEN[typ].preis - Math.round(TYPEN[alt.typ].preis * REGELN.umruestenAnteil)) };
  }
  function umruestenGeht(st, aid, f, typ) {
    const a = st.airlines[aid];
    const plan = [];
    for (const F of fluegeVon(a, f.id)) {
      if (entfernung(F.von, F.nach) > TYPEN[typ].reichweite) return false;
      const z = zeiten(a, F.von, F.nach, typ, slotVon(a, F.s1).h, slotVon(a, F.s2).h);
      if (!z.passt) return false;
      plan.push(z);
    }
    if (plan.length > 1 && plan.some((z) => z.dauer > 24)) return false;
    for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) if (ueberlappt(plan[i].ab, plan[i].dauer, plan[j].ab, plan[j].dauer)) return false;
    return true;
  }
  function umruesten(st, aid, rid, typ) {
    const a = st.airlines[aid];
    const r = a.routen.find((x) => x.id === rid);
    if (!r || !TYPEN[typ] || !typFrei(st, a, typ)) return { ok: false };
    const k = umruestenKosten(st, aid, rid, typ);
    if (!k || TYPEN[typ].sitze <= TYPEN[k.alt.typ].sitze || a.geld < k.preis) return { ok: false };
    if (!umruestenGeht(st, aid, k.alt, typ)) return { ok: false, grund: "zeit" };
    a.geld -= k.preis;
    k.alt.typ = typ;
    k.alt.seit = tagVon(st);
    const g = kabineGrenzen(typ);
    k.alt.kabine = { business: Math.min(g.business, k.alt.kabine.business), first: Math.min(g.first, k.alt.kabine.first) };
    geaendert(st);
    return { ok: true, preis: k.preis };
  }
  function firmenwert(st, aid) {
    const a = st.airlines[aid];
    const verlauf = a.verlauf.slice(-7);
    const schnitt = verlauf.length ? verlauf.reduce((s, v) => s + v, 0) / verlauf.length : 0;
    return Math.round(a.geld - a.kredit + flottenWert(a, tagVon(st)) + slotWert(a) + Math.max(0, schnitt) * 10);
  }
  function rangliste(st) {
    return st.reihenfolge.map((id) => ({ id, name: st.airlines[id].name, farbe: st.airlines[id].farbe, wert: firmenwert(st, id), routen: st.airlines[id].routen.length, flugzeuge: st.airlines[id].flotte.length }))
      .sort((x, y) => y.wert - x.wert || (x.id === SPIELER) - (y.id === SPIELER));   // bei Gleichstand liegt der Rivale vorn
  }
  function platzVon(st, aid) { return rangliste(st).findIndex((x) => x.id === aid) + 1; }
  function platz(st) { return platzVon(st, SPIELER); }
  function staerksterRivale(st) { return rangliste(st).find((x) => x.id !== SPIELER).id; }

  function rangPruefen(st) {
    const pl = platz(st);
    if (tagVon(st) < REGELN.rangAb) { st.letzterPlatz = null; }
    else if (st.letzterPlatz && pl < st.letzterPlatz) melden(st, { art: "aufstieg", text: `Du bist auf Platz ${pl} aufgestiegen!`, platz: pl });
    if (st.letzterPlatz && pl > st.letzterPlatz) melden(st, { art: "abstieg", text: `${rangliste(st)[pl - 2].name} hat dich überholt. Jetzt Platz ${pl}.`, platz: pl });
    st.letzterPlatz = pl;
    if (tagVon(st) >= REGELN.rangAb) st.bestPlatz = Math.min(st.bestPlatz || 9, pl);
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
          melden(st, { art: "stufe", text: "Neue Flugzeuge: " + neu.map((t) => TYPEN[t].name).join(", ") + (stufe === 2 ? ". Damit geht es über den Atlantik!" : stufe === 3 ? ". Damit fliegst du um die halbe Welt!" : "."), typ: neu[0] });
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
    { id: "route", text: "Eröffne deine erste Linie", ist: (st, p) => p.routen.length, soll: 1, belohnung: 0 },
    { id: "gewinn", text: "Mach einen Tag mit Gewinn", ist: (st, p) => (p.verlauf.some((v) => v > 0) ? 1 : 0), soll: 1, belohnung: 100000 },
    { id: "zweiterFlug", text: "Lass ein Flugzeug zweimal am Tag fliegen", ist: (st, p) => Math.max(0, ...p.flotte.map((f) => fluegeVon(p, f.id).length)), soll: 2, belohnung: 200000 },
    { id: "drehkreuz", text: "Drei Linien ab deiner Heimat: dein Drehkreuz", ist: (st, p) => heimRouten(p), soll: 3, belohnung: 200000 },
    { id: "bieten", text: "Gewinne einen Slot beim Bieten", ist: (st, p) => (p.geboten ? 1 : 0), soll: 1, belohnung: 200000 },
    { id: "flotte5", text: "Baue eine Flotte aus 5 Flugzeugen", ist: (st, p) => p.flotte.length, soll: 5, belohnung: 400000 },
    { id: "wert5", text: "Firmenwert 5 Mio", ist: (st, p) => Math.round(firmenwert(st, p.id) / 1e5) / 10, soll: 5, belohnung: 400000, mio: true },
    { id: "platz3", text: "Erreiche Platz 3 der Rangliste", ist: (st, p) => (tagVon(st) >= REGELN.rangAb && platzVon(st, p.id) <= 3 ? 1 : 0), soll: 1, belohnung: 400000 },
    { id: "wert10", text: "Firmenwert 10 Mio: der A321neo schafft den Atlantik", ist: (st, p) => Math.round(firmenwert(st, p.id) / 1e5) / 10, soll: 10, belohnung: 800000, mio: true },
    { id: "platz2", text: "Erreiche Platz 2 der Rangliste", ist: (st, p) => (tagVon(st) >= REGELN.rangAb && platzVon(st, p.id) <= 2 ? 1 : 0), soll: 1, belohnung: 800000 },
    { id: "kontinent", text: "Fliege auf einen anderen Kontinent", ist: (st, p) => p.routen.filter((r) => STADT[r.a].r !== STADT[r.b].r).length, soll: 1, belohnung: 1200000 },
    { id: "platz1", text: "Werde die Nummer 1 der Welt", ist: (st, p) => (tagVon(st) >= REGELN.rangAb && platzVon(st, p.id) === 1 ? 1 : 0), soll: 1, belohnung: 2000000 },
    { id: "wert35", text: "Firmenwert 35 Mio: die Boeing 787", ist: (st, p) => Math.round(firmenwert(st, p.id) / 1e5) / 10, soll: 35, belohnung: 2000000, mio: true },
    { id: "kontinente4", text: "Fliege auf vier Kontinente", ist: (st, p) => new Set(p.routen.flatMap((r) => [STADT[r.a].r, STADT[r.b].r])).size, soll: 4, belohnung: 3000000 },
  ];
  // Danach endlos: Firmenwert verdoppeln.
  function zielAktuell(st) {
    if (st.ziel < ZIELE.length) return ZIELE[st.ziel];
    const i = st.ziel - ZIELE.length;
    // Im späten Spiel wechseln sich Firmenwert und Optimier-Ziele ab: lieber gut als viel.
    if (i % 2 === 0) return spaetesZiel(i / 2);
    const stufe = (i - 1) / 2;
    const soll = 70 * 2 ** stufe;
    return { id: "wert" + soll, text: `Firmenwert ${soll} Mio`, ist: (s) => Math.round(firmenwert(s, SPIELER) / 1e5) / 10, soll, belohnung: soll * 50000, mio: true };
  }
  function linienWerte(st, p) {
    const rg = rechnung(st);
    return p.routen.map((r) => rg.routen[r.id]).filter(Boolean);
  }
  function spaetesZiel(j) {
    const stufe = Math.floor(j / 4);
    const art = j % 4;
    if (art === 0) return { id: "rot" + j, text: "Keine rote Linie mehr: alle Linien im Plus", ist: (st, p) => (p.routen.length && linienWerte(st, p).every((e) => e.wert > 0) ? 1 : 0), soll: 1, belohnung: 1500000 * (stufe + 1) };
    if (art === 1) { const soll = Math.min(95, 80 + 5 * stufe); return { id: "auslastung" + j, text: `Volle Flieger: im Schnitt ${soll} % Auslastung`, ist: (st, p) => { const w = linienWerte(st, p); return w.length ? Math.round(w.reduce((s2, e) => s2 + Math.min(1, e.auslastung), 0) / w.length * 100) : 0; }, soll, belohnung: 2000000 * (stufe + 1), einheit: "%" }; }
    if (art === 2) { const soll = Math.min(100, 80 + 5 * stufe); return { id: "ruf" + j, text: `Bester Ruf: ⭐ ${soll} erreichen`, ist: (st, p) => Math.round(p.ruf), soll, belohnung: 2000000 * (stufe + 1) }; }
    const soll = 50 * 2 ** stufe;
    return { id: "proLinie" + j, text: `Starke Linien: im Schnitt ${soll} Tsd Gewinn pro Linie am Tag`, ist: (st, p) => { const w = linienWerte(st, p); return w.length ? Math.round(w.reduce((s2, e) => s2 + e.wert, 0) / w.length / 1000) : 0; }, soll, belohnung: 2500000 * (stufe + 1) };
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
      melden(st, { art: "ziel", text: "Ziel geschafft: " + z.text + (z.belohnung ? " · Prämie " + (z.belohnung >= 1e6 ? String(Math.round(z.belohnung / 1e5) / 10).replace(".", ",") + " Mio" : Math.round(z.belohnung / 1000) + " Tsd") : ""), ziel: z.id, belohnung: z.belohnung });
      st.ziel++;
    }
  }

  // Gleiche Regeln für alle: Auch die Rivalen bekommen die Prämien der Ziele, wenn sie sie erreichen.
  function zielRivale(st, aid) {
    const a = st.airlines[aid];
    a.ziel = a.ziel || 0;
    let n = 0;
    while (a.ziel < ZIELE.length && n++ < 5) {
      const z = ZIELE[a.ziel];
      if (z.ist(st, a) < z.soll) break;
      a.geld += z.belohnung;
      a.ziel++;
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

  // Wie gut die Rivalen spielen. Alle drei Stufen spielen nach denselben Regeln und mit demselben Startgeld wie du.
  // Der Unterschied liegt nur im Kopf: wie oft sie handeln, wie gut sie rechnen, wie lange sie an Fehlern festhalten
  // und wie sehr sie auf dich achten.
  //   takt: Chance pro Tag, dass sie überhaupt etwas unternehmen · proTag: Züge an so einem Tag
  //   irrtum: wie weit ihre Einschätzung danebenliegt · pruefen: so viele Ideen rechnen sie genau durch
  //   zaeh: so viele Verlusttage halten sie an einer Linie fest · pause: Ruhetage nach einem Flugzeugkauf
  //   sorgfalt: wie oft sie an größere Flugzeuge denken · bietLust: wie oft sie bei einem Slot mitbieten
  //   wahl: aus so vielen guten Ideen greifen sie eine heraus (1 = immer die beste) · vorsicht: wie viel Geld sie liegen lassen
  //   preise: wie oft sie den Preis einer Linie nachstellen · kabine: wie oft sie die Sitze eines neuen Flugzeugs durchrechnen
  //   reagiert: wie stark sie auf deine Züge antworten
  const GEGNER = {
    leicht: { name: "Anfänger", text: "Zögern oft, verschätzen sich und achten kaum auf dich.", takt: 0.4, proTag: 1, irrtum: 0.8, pruefen: 1, wahl: 4, vorsicht: 3, zaeh: 7, pause: 3, sorgfalt: 0.25, preise: 0, kabine: 0, bietLust: 0.4, reagiert: 0.2 },
    mittel: { name: "Erfahrene", text: "Spielen solide, machen aber Fehler und brauchen Zeit.", takt: 0.8, proTag: 2, irrtum: 0.25, pruefen: 2, wahl: 2, vorsicht: 1.3, zaeh: 5, pause: 1, sorgfalt: 0.7, preise: 0.6, kabine: 0.7, bietLust: 0.6, reagiert: 0.6 },
    schwer: { name: "Profis", text: "Rechnen genau, handeln schnell und antworten auf jeden deiner Züge.", takt: 1, proTag: 3, irrtum: 0.08, pruefen: 3, wahl: 1, vorsicht: 1, zaeh: 3, pause: 0, sorgfalt: 1, preise: 1, kabine: 1, bietLust: 0.8, reagiert: 1 },
  };
  const GENAU = { takt: 1, proTag: 3, irrtum: 0, pruefen: 3, wahl: 1, vorsicht: 1, preise: 1, kabine: 1, zaeh: 3, pause: 0, sorgfalt: 1, bietLust: 0.75, reagiert: 0 };   // Bot für Probepartien und Ratgeber
  const koennen = (st, aid) => (aid === SPIELER ? GENAU : GEGNER[st.gegner] || GEGNER.mittel);
  // Was im Kopf eines Rivalen vorgeht: Ärger über dich (groll), Respekt nach einer Niederlage (scheu), Ruhetage (ruhe).
  const kopf = (a) => a.kopf || (a.kopf = { groll: 0, scheu: 0, ruhe: 0 });
  function aergern(st, aid, menge, text) {
    const a = st.airlines[aid];
    if (!a || aid === SPIELER || a.konkurs || st.probe) return;
    const k = kopf(a);
    const vorher = k.groll;
    k.groll = Math.max(0, Math.min(3, k.groll + menge));
    if (text && menge > 0 && vorher < 1 && k.groll >= 1 && koennen(st, aid).reagiert >= 0.5) melden(st, { art: "rivale", wer: aid, text });
  }
  // Eine Airline hält eine Woche lang an ihrer Meinung über eine Strecke fest, auch wenn sie falsch ist.
  function glaube(st, aid, text) {
    const irr = koennen(st, aid).irrtum;
    if (!irr) return 1;
    let h = (st.saat | 0) ^ (Math.floor(tagVon(st) / 7) * 2654435761);
    text = aid + text;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    const z = () => { h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    return Math.exp((z() + z() + z() - 1.5) * irr * 1.6);
  }
  // Ein Satz dazu, wie ein Rivale gerade zu dir steht (für die Rangliste).
  function laune(st, aid) {
    const a = st.airlines[aid];
    if (!a || aid === SPIELER) return null;
    const k = kopf(a);
    if (a.geld < 0) return { art: "not", text: "Hat Geldsorgen" };
    if (k.scheu > 0) return { art: "scheu", text: "Geht dir aus dem Weg" };
    if (k.groll >= 2) return { art: "wut", text: "Ist wütend auf dich" };
    if (k.groll >= 1) return { art: "groll", text: "Ärgert sich über dich" };
    if (k.ruhe > 0) return { art: "ruhe", text: "Ordnet gerade die eigene Flotte" };
    return { art: "normal", text: "Kümmert sich um sich selbst" };
  }

  function kiTag(st, aid) {
    const a = st.airlines[aid];
    const K = koennen(st, aid);
    const k = aid === SPIELER ? { groll: 0, scheu: 0, ruhe: 0 } : kopf(a);
    k.groll = Math.max(0, k.groll - 0.12);     // Ärger verraucht in ein paar Wochen
    if (k.scheu > 0) k.scheu--;
    // Verlustrouten aufgeben. Wer schlechter spielt, hält länger daran fest.
    for (const r of a.routen.slice()) {
      if (r.minus >= K.zaeh) {
        const jung = tagVon(st) - (r.seit || 0) <= 14;
        const gegenDich = aid !== SPIELER && routeVon(st.airlines[SPIELER], r.a, r.b);
        abziehen(st, aid, r.id);
        if (gegenDich && !routeVon(a, r.a, r.b)) { k.scheu = 10; k.groll = 0; }    // gegen dich verloren: erst einmal Abstand
        if (aid !== SPIELER && zufall(st) < 0.5) melden(st, { art: "rivale", text: jung ? `${a.name} hat sich verschätzt und gibt ${STADT[r.a].name}–${STADT[r.b].name} wieder auf.` : `${a.name} streicht einen Flug ${STADT[r.a].name}–${STADT[r.b].name}.`, wer: aid });
      }
    }
    // Flugzeuge ohne Flug kosten nur Geld: nach ein paar Tagen weg damit.
    for (const f of freieFlugzeuge(a)) {
      f.leer = (f.leer || 0) + 1;
      if (a.geld < 0 || f.leer > 6) verkaufen(st, aid, f.id);
    }
    for (const f of a.flotte) if (a.fluege.some((x) => x.f === f.id)) f.leer = 0;
    if (a.geld < 0) return;
    // Nicht jeden Tag wird entschieden: Nach einem großen Kauf wird erst einmal geordnet, und manche zögern.
    if (k.ruhe > 0) { k.ruhe--; return; }
    if (K.takt < 1 && zufall(st) > K.takt) return;
    // Ab und zu ein zweites Drehkreuz.
    if (tagVon(st) >= REGELN.aufkaufAb && zufall(st) < 0.08 * K.sorgfalt) {
      const h = drehkreuze(a).find((c) => kannAusbauen(st, aid, c) && a.geld > 3 * drehkreuzPreis(st, aid, c));
      if (h) drehkreuzAusbauen(st, aid, h);
    }
    const stil = STIL[a.stil] || STIL.bot;
    const vorher = a.flotte.length;
    // Wer sich gern verschätzt oder wütend ist, geht eher ein Wagnis ein.
    if (aid !== SPIELER && tagVon(st) >= REGELN.wagnisAb && a.geld > 300000 && zufall(st) < REGELN.wagnis * (0.3 + 0.4 * K.irrtum + 0.3 * k.groll)) kiAusbauen(st, aid, { wagnis: true });
    for (let i = 0; i < Math.min(stil.proTag, K.proTag); i++) if (!kiAusbauen(st, aid)) break;
    if (a.flotte.length > vorher) k.ruhe = K.pause;
    if (stil.proTag && (K.sorgfalt >= 1 || zufall(st) < K.sorgfalt)) kiAufruesten(st, aid);
    if (stil.proTag && K.preise && (K.preise >= 1 || zufall(st) < K.preise)) kiPreise(st, aid);
  }
  // Jeden Tag eine Linie ansehen: Wäre billiger oder teurer besser?
  function kiPreise(st, aid) {
    const a = st.airlines[aid];
    if (!a.routen.length) return false;
    const r = a.routen[tagVon(st) % a.routen.length];
    const p = st.airlines[SPIELER];
    if (aid !== SPIELER && p.routen.some((x) => x.duell && x.duell.gegen === aid && routeVon(a, x.a, x.b) === r)) return false;   // im Preiskampf gelten andere Regeln
    let best = null;
    for (const stufe of Object.keys(STUFEN)) {
      if (stufe === r.stufe) continue;
      const pr = probe(st, aid, (kopie) => { kopie.airlines[aid].routen.find((x) => x.id === r.id).stufe = stufe; geaendert(kopie); return { ok: true }; });
      if (pr && pr.delta > 1500 && (!best || pr.delta > best.delta)) best = { stufe, delta: pr.delta };
    }
    if (!best) return false;
    r.stufe = best.stufe;
    geaendert(st);
    return true;
  }

  // Slots sind knapp: Wo mehr Gäste als Plätze da sind, kommt ein größeres Flugzeug auf die Linie.
  function kiAufruesten(st, aid) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const rg = rechnung(st);
    let best = null;
    for (const r of a.routen) {
      const e = rg.routen[r.id];
      if (!e || e.bedarf < e.sitzePlaetze * 1.2) continue;
      for (const typ of stil.typen) {
        if (!typFrei(st, a, typ)) continue;
        const k = umruestenKosten(st, aid, r.id, typ);
        if (!k || TYPEN[typ].sitze <= TYPEN[k.alt.typ].sitze || k.preis > a.geld - stil.reserve) continue;
        const pr = probe(st, aid, (kopie) => umruesten(kopie, aid, r.id, typ));
        if (!pr || pr.delta <= 0 || k.preis / pr.delta > stil.amortisation) continue;
        if (!best || pr.delta / (k.preis + 1) > best.wert) best = { rid: r.id, typ, wert: pr.delta / (k.preis + 1) };
      }
    }
    if (best) umruesten(st, aid, best.rid, best.typ);
    return !!best;
  }

  function kiAusbauen(st, aid, opt) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const K = koennen(st, aid);
    // Wagnis: Manchmal kauft ein Rivale auf Pump mehr, als er hat. Geht die Rechnung nicht auf, droht die Pleite.
    const wagnis = opt && opt.wagnis ? Math.round(firmenwert(st, aid) * REGELN.wagnisAnteil) : 0;
    const reserve = opt && opt.start ? 0 : wagnis ? -wagnis : stil.reserve * K.vorsicht;
    if (a.geld < reserve + 100000) return false;
    const kandidaten = kiKandidaten(st, aid, reserve, !!wagnis).filter((c) => !wagnis || (c.kosten > a.geld * 0.8 && c.kosten <= a.geld + wagnis));
    if (wagnis) for (const c of kandidaten) c.plan.schulden = true;
    // Nicht jeder greift zur besten Idee: Manche nehmen, was ihnen gerade gefällt.
    if (K.wahl > 1 && kandidaten.length > 1) { const i = Math.floor(zufall(st) * Math.min(K.wahl, kandidaten.length)); kandidaten.unshift(...kandidaten.splice(i, 1)); }
    // Die besten Ideen genau prüfen. Wer sich verschätzt, sieht in der Rechnung mehr oder weniger, als wirklich drin ist.
    for (const c of kandidaten.slice(0, K.pruefen)) {
      const pr = probe(st, aid, (kopie) => flugAnlegen(kopie, aid, c.plan));
      if (!pr) continue;
      const geglaubt = pr.delta + (c.mut || 0) + (c.glaube - 1) * Math.max(Math.abs(pr.delta), c.sch.gewinn, 3000);
      if (geglaubt > 0 && (c.kosten / (geglaubt * c.umlaeufe)) <= stil.amortisation) {
        const res = kiFliegen(st, aid, c.plan, opt);
        // Wer sorgfältig ist, rechnet die Sitze des neuen Flugzeugs durch, bevor es abhebt.
        if (res.ok && !c.plan.fid && K.kabine && (K.kabine >= 1 || zufall(st) < K.kabine)) {
          const b = besteKabine(st, aid, res.flugzeug.id);
          if (b) kabineSetzen(st, aid, res.flugzeug.id, b.business, b.first, true);
        }
        return true;
      }
    }
    return false;
  }
  // Fliegt los und reagiert, wenn das eine Strecke des Spielers ist: Preiskampf.
  function kiFliegen(st, aid, plan, opt) {
    const a = st.airlines[aid];
    const x = plan.x, y = plan.y;
    const neu = !routeVon(a, x, y);
    const res = flugAnlegen(st, aid, plan);
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
  // Welche Flüge kämen in Frage? Nur dorthin, wo die Airline einen Slot hat oder sofort einen bekommt.
  function kiKandidaten(st, aid, reserve, ohneGeld) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const kandidaten = [];
    const typen = stil.typen.filter((t) => typFrei(st, a, t));
    const idx = slotIndex(st, a);
    const budget = ohneGeld ? Infinity : a.geld - reserve;
    const maxWeite = Math.max(0, ...typen.map((t) => TYPEN[t].reichweite));
    const verwZusatz = verwaltungKosten(a, a.routen.length + 1) - verwaltungKosten(a);   // eine neue Linie kostet auch Verwaltung
    // Alle Slots sind offen. Damit die Airline nicht jeden Tag die ganze Welt durchrechnet, schaut sie sich
    // neben ihren eigenen Orten täglich eine wechselnde Handvoll Städte an (wie eine echte Netzplanung).
    const ziele = new Set([...Object.keys(idx.eigene), a.basis, ...(a.ausgebaut || [])]);
    { const tag = tagVon(st), liste = ALLE.filter((c) => !ziele.has(c.id) && entfernung(a.basis, c.id) <= maxWeite);
      const n = Math.min(liste.length, REGELN.kiBlick);
      for (let i = 0; i < n; i++) ziele.add(liste[Math.floor(fest(st, aid + "blick" + tag + "-" + i) * liste.length)].id); }
    const K = koennen(st, aid);
    const kf = aid === SPIELER ? null : kopf(a);
    const spieler = st.airlines[SPIELER];
    // Welche Strecken prüft die Airline? Alle ab ihren Drehkreuzen, und (wie echte Airlines) die gut laufenden Strecken der anderen:
    // Wo du Geld verdienst, wollen die Rivalen auch hin. Wer sich über dich ärgert, schaut noch genauer hin.
    const paare = [];
    for (const x of new Set([a.basis, ...(a.ausgebaut || [])])) for (const y of ziele) if (y !== x) paare.push([x, y]);
    if (kf && tagVon(st) >= REGELN.duellAb && kf.scheu <= 0) {
      const lust = REGELN.nachahmen * (K.reagiert + kf.groll * 0.5);
      for (const r of spieler.routen) if ((r.auslastung || 0) >= 0.7 && !routeVon(a, r.a, r.b) && fest(st, aid + r.id) < lust) paare.push([r.a, r.b]);
    }
    for (const [x, y] of paare) {
      {
        const km = entfernung(x, y);
        if (km > maxWeite) continue;
        for (const typ of typen) {
          if (km > TYPEN[typ].reichweite) continue;
          const t = flugFinden(st, aid, x, y, typ, { idx });
          if (!t.plan || (!t.ok && !(ohneGeld && t.grund === "geld"))) continue;
          if (t.kosten.gesamt > budget) continue;
          const sch = schaetzen(st, aid, x, y, typ, t.zeiten.ab, t.zeiten.rueck, !t.kosten.frei);
          if (verwZusatz && !routeVon(a, x, y)) sch.gewinn -= verwZusatz;
          const g = glaube(st, aid, [x, y].sort().join("-"));
          // Wer sich verschätzt, hält auch eine schwache Strecke für gut (oder eine gute für schwach).
          // Auf deinen Strecken kämpfen sie auch mit wenig Gewinn: Sie wollen dir den Markt abnehmen.
          const mut = kf && routeVon(spieler, x, y) && !routeVon(a, x, y) ? REGELN.angriffMut * (K.reagiert + kf.groll * 0.5) : 0;
          sch.gewinn += mut;
          if (sch.gewinn + (g - 1) * 8000 <= 0 || sch.auslastung * g < 0.4) continue;
          const vorliebe = stil.klasse[STADT[y].k] * (a.stil === "premium" ? 0.6 + (STADT[x].w + STADT[y].w) : 1) * (x === a.basis ? 1.15 : 1);
          // Ein neues Flugzeug schafft später mehrere Flüge am Tag: Das rechnet die Airline beim Kauf mit ein.
          const umlaeufe = t.kosten.frei ? 1 : Math.max(1, Math.min(3, Math.floor(18 / t.zeiten.dauer)));
          const tage = (t.kosten.gesamt + 1) / (Math.max(1, sch.gewinn + (g - 1) * 8000) * umlaeufe);
          if (tage > stil.amortisation * 1.5) continue;
          t.plan.kabine = kabineStandard(typ, a);
          // Wer sich über dich ärgert, fliegt dir nach. Wer gerade gegen dich verloren hat, meidet deine Strecken.
          let gegen = 1;
          if (kf && !routeVon(a, x, y) && routeVon(spieler, x, y)) gegen = kf.scheu > 0 ? 0.25 : 1 + 0.4 * kf.groll * K.reagiert;
          kandidaten.push({ x, y, typ, plan: t.plan, kosten: t.kosten.gesamt, umlaeufe, glaube: g, mut, wert: (sch.gewinn * umlaeufe * vorliebe * g * gegen) / Math.max(t.kosten.gesamt, 150000), tage, sch });
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
        const t = flugFinden(st, pl.aid, pl.x, pl.y, pl.typ);
        const res = t.ok ? kiFliegen(st, pl.aid, Object.assign(t.plan, { kabine: kabineStandard(pl.typ, a) })) : t;
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

  // ---------- Slots: bieten, verlieren, handeln ----------
  const fremdeSlots = (a, stadt) => a.slots.filter((s) => s.stadt === stadt && !s.heim).length;
  // Von wo aus könnte die Airline einen Slot in dieser Stadt nutzen? Heimat, Drehkreuze und Orte mit einem freien eigenen Slot.
  function startorte(st, a) {
    const orte = new Set([a.basis, ...(a.ausgebaut || [])]);
    const b = benutzteSlots(a);
    for (const s of a.slots) if (!s.heim && !b.has(s.id)) orte.add(s.stadt);
    return [...orte];
  }
  // Was bringt dieser Slot der Airline am Tag, wenn sie den besten Flug darauf legt?
  function slotNutzen(st, aid, stadt, h, sid) {
    const a = st.airlines[aid];
    const stil = STIL[a.stil] || STIL.bot;
    const typen = (aid === SPIELER ? Object.keys(TYPEN) : stil.typen).filter((t) => typFrei(st, a, t));
    const e2 = { art: "pool", id: sid || "?", h, preis: 0 };
    let best = null;
    for (const x of startorte(st, a)) {
      if (x === stadt) continue;
      const km = entfernung(x, stadt);
      for (const typ of typen) {
        if (km > TYPEN[typ].reichweite) continue;
        const t = flugFinden(st, aid, x, stadt, typ, { e2 });
        if (!t.zeiten) continue;
        const g = schaetzen(st, aid, x, stadt, typ, t.zeiten.ab, t.zeiten.rueck, !(t.kosten && t.kosten.frei)).gewinn - (t.kosten && !t.kosten.frei ? TYPEN[typ].preis / 60 : 0);
        if (!best || g > best.gewinn) best = { gewinn: g, von: x, typ };
      }
    }
    return best;
  }
  // Die Rivalen legen ihr Gebot fest, sobald der Slot ausgeschrieben wird.
  function kiGebote(st, s, ohne) {
    const gebote = {};
    const gp = slotGrundpreis(s.stadt, s.h);
    for (const aid of ["k", "s", "a"]) {
      if (aid === ohne) continue;
      const a = st.airlines[aid];
      if (a && a.stil === "ruhig") continue;      // ruhige Rivalen (für Tests) tun nichts
      if (!a || a.konkurs || hatTafel(a, s.stadt) || a.geld < gp * 2 || slotsFreiVon(a, s.stadt).length) continue;
      { const b = benutzteSlots(a); if (a.slots.filter((x) => !x.heim && !b.has(x.id)).length >= 2) continue; }     // erst nutzen, was man hat
      const K = koennen(st, aid), kf = kopf(a);
      const n = slotNutzen(st, aid, s.stadt, s.h, s.id);
      if (!n) continue;
      // Was die Airline glaubt, dass der Slot wert ist. Begehrte Zeiten und große Flughäfen schätzt sie höher ein:
      // Dort kommt man später kaum noch hin (andere Airlines belegen viel), also lieber jetzt zugreifen.
      const knapp = (zeitArt(s.h) === "begehrt" ? 1.35 : 1) * (1 + 0.15 * (STADT[s.stadt].k - 1));
      const wert = n.gewinn * 25 * knapp * glaube(st, aid, "slot" + s.stadt);
      if (wert < gp || zufall(st) > K.bietLust) continue;
      // Morgens und abends will jeder fliegen: Um diese Zeiten streiten sich alle (Florian: gute Zeiten klar wertvoller).
      const lust = (a.stil === "platzhirsch" && STADT[s.stadt].k >= 2 ? 1.3 : a.stil === "billig" && STADT[s.stadt].k === 1 ? 1.2 : 1) * (zeitArt(s.h) === "begehrt" ? 1.3 : 1);
      // Wo du schon sitzt, will dich ein aufmerksamer Rivale nicht noch stärker werden lassen. Mit Ärger im Bauch erst recht.
      // Läuft eine deiner Linien dort gut, hält er noch mehr dagegen: Er will dir den Markt nicht überlassen.
      const sp = st.airlines[SPIELER];
      const duDort = sp.slots.some((x) => x.stadt === s.stadt) ? 1 : 0;
      const duGut = sp.routen.some((r) => (r.a === s.stadt || r.b === s.stadt) && (r.auslastung || 0) >= 0.7) ? 1 : 0;
      const trotz = 1 + K.reagiert * (0.15 * duDort + 0.2 * duGut + 0.2 * Math.min(2, kf.groll));
      gebote[aid] = Math.max(gp, runde10k(Math.min(wert, gp * (1 + zufall(st) * 0.9) * lust * trotz, a.geld * 0.3)));
    }
    return gebote;
  }
  function bieten(st, sid, betrag) {
    const s = st.pool.find((x) => x.id === sid);
    if (!s || s.bis == null) return false;
    const gp = slotGrundpreis(s.stadt, s.h);
    if (!betrag) delete s.gebote[SPIELER];
    else s.gebote[SPIELER] = Math.max(gp, runde10k(betrag));
    geaendert(st);
    return true;
  }
  // Frist vorbei: Ein Bieter zahlt den Grundpreis, bei mehreren gewinnt das höchste Gebot, bei Gleichstand der Neuling.
  function poolAuswerten(st, s) {
    const gp = slotGrundpreis(s.stadt, s.h);
    const gebote = [];
    const mein = s.gebote[SPIELER] || 0;
    const zuWenig = mein > 0 && st.airlines[SPIELER].geld < mein;
    if (mein && !zuWenig) gebote.push({ aid: SPIELER, betrag: mein });
    for (const [aid, betrag] of Object.entries(s.ki || {})) {
      const a = st.airlines[aid];
      if (a && !a.konkurs && a.geld >= betrag) gebote.push({ aid, betrag });
    }
    if (!gebote.length) { s.bis = null; s.gebote = {}; s.ki = null; geaendert(st); return null; }    // bleibt liegen: wer zuerst kommt, bekommt ihn
    gebote.sort((x, y) => y.betrag - x.betrag || fremdeSlots(st.airlines[x.aid], s.stadt) - fremdeSlots(st.airlines[y.aid], s.stadt) || (y.aid === SPIELER) - (x.aid === SPIELER));
    const w = gebote[0], a = st.airlines[w.aid];
    const preis = gebote.length === 1 ? gp : w.betrag;
    a.geld -= preis;
    st.pool = st.pool.filter((x) => x !== s);
    a.slots.push({ id: s.id, stadt: s.stadt, h: s.h, seit: tagVon(st) });
    a.geboten = (a.geboten || 0) + 1;
    if (w.aid === SPIELER) {
      // Wer überboten wurde, merkt sich das.
      for (const g of gebote) if (g.aid !== SPIELER) aergern(st, g.aid, 1, `${st.airlines[g.aid].name} ärgert sich: Du hast den Slot in ${STADT[s.stadt].name} weggeschnappt.`);
    }
    if (mein) {
      st.bietErgebnisse = st.bietErgebnisse || [];
      st.bietErgebnisse.push({ slot: s.id, stadt: s.stadt, h: s.h, gebote: gebote.map((x) => ({ aid: x.aid, betrag: x.betrag })), sieger: w.aid, preis, zuWenig, meinGebot: mein });
      melden(st, { art: w.aid === SPIELER ? "slotsieg" : "slotweg", stadt: s.stadt,
        text: w.aid === SPIELER ? `🎟 Gewonnen! Der Slot ${STADT[s.stadt].name} ${uhrText(s.h)} Uhr gehört dir.` : `🎟 ${a.name} bekommt den Slot ${STADT[s.stadt].name} ${uhrText(s.h)} Uhr.` });
    }
    geaendert(st);
    return w;
  }

  // Nutzen oder verlieren: Am Saisonende gehen ungenutzte Slots an fremden Flughäfen zurück in den Topf.
  function slotInGefahr(st, a, s, b) {
    return !s.heim && !(b || benutzteSlots(a)).has(s.id) && tagVon(st) - (s.seit || 0) >= REGELN.slotSchonTage;
  }
  function tageBisSaisonende(tag) { return (REGELN.saisonTage - (tag % REGELN.saisonTage)) % REGELN.saisonTage; }
  function slotsPruefen(st, tag) {
    melden(st, { art: "saison", text: "Saisonende. Neue Jahreszeit: " + saison(tag + 1).name });
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const b = benutzteSlots(a);
      const weg = a.slots.filter((s) => !s.heim && !b.has(s.id) && tag - (s.seit || 0) >= REGELN.slotSchonTage);
      if (!weg.length) continue;
      a.slots = a.slots.filter((s) => !weg.includes(s));
      if (aid === SPIELER) melden(st, { art: "slotweg", text: `🎟 ${weg.length === 1 ? "Ein ungenutzter Slot geht" : weg.length + " ungenutzte Slots gehen"} zurück: ${weg.map((s) => STADT[s.stadt].name + " " + uhrText(s.h)).join(", ")}.` });
    }
  }
  function slotsWarnen(st, tag) {
    const p = st.airlines[SPIELER];
    const b = benutzteSlots(p);
    const gefahr = p.slots.filter((s) => !s.heim && !b.has(s.id) && tag + 2 - (s.seit || 0) >= REGELN.slotSchonTage);
    if (gefahr.length) melden(st, { art: "slotwarnung", stadt: gefahr[0].stadt, text: `⚠️ In zwei Tagen ist Saisonende. ${gefahr.length === 1 ? "Ein Slot ist" : gefahr.length + " Slots sind"} ungenutzt und ${gefahr.length === 1 ? "geht" : "gehen"} dann zurück: ${gefahr.map((s) => STADT[s.stadt].name + " " + uhrText(s.h)).join(", ")}.` });
  }
  // Früher gaben Flughäfen Slots nach und nach frei. Jetzt sind alle Slots von Anfang an zu haben (Florian, 2026-11-28).
  function slotsNachschub() {}

  // Einen ungenutzten Slot an einem fremden Flughafen zurückgeben: Die Hälfte des Grundpreises kommt zurück.
  function slotZurueckgeben(st, aid, sid) {
    const a = st.airlines[aid];
    const s = slotVon(a, sid);
    if (!s || s.heim || slotFlug(a, sid)) return { ok: false };
    const geld = runde10k(slotGrundpreis(s.stadt, s.h) * REGELN.rueckgabeAnteil);
    a.slots = a.slots.filter((x) => x !== s);
    a.geld += geld;
    geaendert(st);
    return { ok: true, geld };
  }
  // Was ist ein Slot seinem Besitzer wert? Ungenutzt wenig, mit einer guten Linie darauf viel.
  function slotWertFuer(st, aid, s) {
    const a = st.airlines[aid];
    const gp = slotGrundpreis(s.stadt, s.h);
    const F = slotFlug(a, s.id);
    if (!F) return runde10k(gp * 0.8);
    const e = rechnung(st).routen[F.route];
    const teil = e && e.fluege.length ? Math.max(0, e.wert) / e.fluege.length : 0;
    return runde10k(gp * 1.2 + teil * 30);
  }
  const slotBesitzer = (st, sid) => st.reihenfolge.find((id) => st.airlines[id].slots.some((s) => s.id === sid)) || null;
  // Der Slot wechselt den Besitzer. Ein Flug, der ihn braucht, wird gestrichen.
  function slotUebergeben(st, vonAid, anAid, sid) {
    const von = st.airlines[vonAid], an = st.airlines[anAid];
    const s = slotVon(von, sid);
    if (!s || s.heim) return false;
    const F = slotFlug(von, sid);
    if (F) flugStreichen(st, vonAid, F.id);
    von.slots = von.slots.filter((x) => x !== s);
    an.slots.push({ id: s.id, stadt: s.stadt, h: s.h, seit: tagVon(st) });
    return true;
  }
  // Angebot an einen Rivalen: Geld und (wenn gewünscht) ein eigener Slot im Tausch. Die Antwort kommt sofort.
  function handelPruefen(st, sid) {
    const aid = slotBesitzer(st, sid);
    if (!aid || aid === SPIELER) return { ok: false, grund: "keiner" };
    const s = slotVon(st.airlines[aid], sid);
    if (s.heim) return { ok: false, grund: "heim" };
    if (s.sperre && s.sperre >= tagVon(st)) return { ok: false, grund: "sperre", bis: s.sperre };
    // Wer sich über dich ärgert, verkauft dir nur mit Aufschlag.
    const groll = Math.min(2, kopf(st.airlines[aid]).groll) * koennen(st, aid).reagiert;
    return { ok: true, aid, slot: s, wert: runde10k(slotWertFuer(st, aid, s) * (1 + 0.2 * groll)), grundpreis: slotGrundpreis(s.stadt, s.h), groll };
  }
  function handelAnbieten(st, sid, betrag, tauschId) {
    const h = handelPruefen(st, sid);
    if (!h.ok) return h;
    const p = st.airlines[SPIELER], a = st.airlines[h.aid];
    betrag = Math.max(0, runde10k(betrag || 0));
    const tausch = tauschId ? slotVon(p, tauschId) : null;
    if (tauschId && (!tausch || tausch.heim)) return { ok: false, grund: "tausch" };
    if (p.geld < betrag) return { ok: false, grund: "geld" };
    const gegenwert = betrag + (tausch ? slotGrundpreis(tausch.stadt, tausch.h) * 0.8 : 0);
    if (gegenwert < h.wert) {
      h.slot.sperre = tagVon(st) + REGELN.handelSperre;
      geaendert(st);
      return { ok: false, grund: "nein", aid: h.aid };
    }
    p.geld -= betrag; a.geld += betrag;
    slotUebergeben(st, h.aid, SPIELER, sid);
    if (tausch) slotUebergeben(st, SPIELER, h.aid, tausch.id);
    melden(st, { art: "handel", wer: h.aid, stadt: h.slot.stadt, text: `🤝 ${a.name} überlässt dir den Slot ${STADT[h.slot.stadt].name} ${uhrText(h.slot.h)} Uhr.` });
    geaendert(st);
    return { ok: true, aid: h.aid, betrag };
  }
  // Ab und zu will ein Rivale einen deiner Slots kaufen.
  function slotAngebot(st, tag) {
    if (tag < REGELN.handelAb || st.gelegenheiten.some((g) => g.art === "slotangebot") || zufall(st) > 0.18) return;
    const p = st.airlines[SPIELER];
    const kand = p.slots.filter((s) => !s.heim && STADT[s.stadt].k >= 2);
    if (!kand.length) return;
    const s = waehle(st, kand);
    const aid = waehle(st, ["k", "s", "a"]);
    const a = st.airlines[aid];
    if (a.konkurs || hatTafel(a, s.stadt)) return;
    const wert = slotWertFuer(st, SPIELER, s);
    const preis = runde10k(wert * (0.8 + zufall(st) * 0.7));
    if (a.geld < preis * 1.5) return;
    neueGel(st, { art: "slotangebot", aid, slot: s.id, stadt: s.stadt, h: s.h, preis, bis: st.zeit + 24, dauer: 24 });
    melden(st, { art: "slotangebot", wer: aid, stadt: s.stadt, text: `💬 ${a.name} will deinen Slot ${STADT[s.stadt].name} ${uhrText(s.h)} Uhr kaufen.` });
  }
  function slotAngebotAnnehmen(st, g) {
    const p = st.airlines[SPIELER], a = st.airlines[g.aid];
    if (!slotVon(p, g.slot) || a.geld < g.preis) return false;
    slotUebergeben(st, SPIELER, g.aid, g.slot);
    a.geld -= g.preis; p.geld += g.preis;
    aergern(st, g.aid, -1);          // ein gutes Geschäft glättet die Wogen
    return true;
  }

  // ---------- Rat des Analysten ----------
  // Er rechnet ehrlich, sieht die Welt aber durch seine Brille: Die Spanne ist je nach Können enger oder weiter.
  function fest(st, text) {         // feste Zufallszahl 0..1 für einen Text und den heutigen Tag (ändert sich nicht bei jedem Blick)
    let h = (st.saat | 0) ^ (tagVon(st) * 2654435761);
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function brille(st, wer, wert, text) {
    const u = fest(st, text + "a") + fest(st, text + "b") + fest(st, text + "c") - 1.5;
    return wert * wer.macke * Math.exp(u * wer.streuung * 1.4);
  }
  function ratSlot(st, sid) {
    const wer = assistent(st.airlines[SPIELER], "analyst");
    const s = st.pool.find((x) => x.id === sid);
    if (!wer || !s) return null;
    const n = slotNutzen(st, SPIELER, s.stadt, s.h, s.id);
    const gp = slotGrundpreis(s.stadt, s.h);
    const wert = n && n.gewinn > 0 ? brille(st, wer, n.gewinn * 30, "slot" + sid) : 0;
    // Wer bietet mit? Ein guter Analyst weiß es fast immer, ein schwacher rät öfter falsch.
    const echte = Object.keys(s.ki || {});
    const irrtum = fest(st, "wer" + sid) < wer.streuung;
    const mit = irrtum ? (echte.length ? [] : [waehleFest(st, ["k", "s", "a"], "x" + sid)]) : echte;
    return { wer, wert: wert > 0 ? spanne(wert, wer.streuung).map((v) => Math.max(0, runde10k(v))) : null, lohnt: wert >= gp, mit: mit.filter((id) => !st.airlines[id].konkurs), von: n ? n.von : null, typ: n ? n.typ : null, grundpreis: gp };
  }
  // Beim Buchen: Wer hält wohl dagegen, und was ist der Slot wert? Ein guter Analyst liegt meist richtig.
  function ratBuchung(st, stadt, h) {
    const wer = assistent(st.airlines[SPIELER], "analyst");
    if (!wer) return null;
    const kopie = klonen(st);
    const echte = kiGebote(kopie, { id: "?", stadt, h }, SPIELER);
    const key = stadt + Math.round(h) + "-" + tagVon(st);
    const irrtum = fest(st, "wer" + key) < wer.streuung;
    const mit = (irrtum ? (Object.keys(echte).length ? [] : [waehleFest(st, ["k", "s", "a"], "x" + key)]) : Object.keys(echte)).filter((id) => st.airlines[id] && !st.airlines[id].konkurs);
    const hoch = Math.max(0, ...Object.values(echte));
    const gp = slotGrundpreis(stadt, h);
    // Was reicht wohl zum Gewinnen? Bei Gegnern etwas über ihrem Gebot, geschätzt mit der Brille des Analysten.
    // Wie weit gehen sie wohl? Der Analyst schätzt das höchste Limit, mit seiner Brille.
    const bis = mit.length ? runde10k(Math.max(gp, brille(st, wer, hoch || gp * 1.4, "reicht" + key))) : gp;
    return { wer, mit, bis, grundpreis: gp };
  }
  const waehleFest = (st, liste, text) => liste[Math.floor(fest(st, text) * liste.length)];
  function ratHandel(st, sid) {
    const wer = assistent(st.airlines[SPIELER], "analyst");
    const h = handelPruefen(st, sid);
    if (!wer || !h.ok) return null;
    const n = slotNutzen(st, SPIELER, h.slot.stadt, h.slot.h, sid);
    return { wer, noetig: spanne(brille(st, wer, h.wert, "handel" + sid), wer.streuung).map((v) => Math.max(0, runde10k(v))), wert: n && n.gewinn > 0 ? spanne(brille(st, wer, n.gewinn * 30, "hw" + sid), wer.streuung).map((v) => Math.max(0, runde10k(v))) : null };
  }
  // Was würde eine Einstellung am Tag bringen? Für jede Wahlmöglichkeit eine Spanne, die beste ist die Empfehlung.
  function ratWahl(st, key, optionen) {
    const wer = assistent(st.airlines[SPIELER], "analyst");
    if (!wer) return null;
    const erg = {};
    let best = null;
    for (const [id, aenderung] of Object.entries(optionen)) {
      let delta = 0;
      if (aenderung) { const pr = probe(st, SPIELER, aenderung); if (!pr) continue; delta = pr.delta; }
      const gesehen = aenderung ? delta + (brille(st, wer, 1, key + id) - 1) * Math.max(3000, Math.abs(delta)) : 0;
      erg[id] = { gesehen, spanne: aenderung ? spanne(gesehen, wer.streuung).map((v) => Math.round(v / 100) * 100) : null };
      if (!best || gesehen > erg[best].gesehen + 500) best = id;
    }
    return { wer, optionen: erg, empfehlung: best };
  }
  function ratGrundsatz(st, k) {
    const a = st.airlines[SPIELER];
    const jetzt = (a.grundsaetze || {})[k];
    const o = {};
    for (const id of Object.keys(GRUNDSAETZE[k].optionen)) o[id] = id === jetzt ? null : (kopie) => { grundsatzSetzen(kopie, SPIELER, k, id); };
    return ratWahl(st, "g" + k, o);
  }
  function ratPreis(st, rid) {
    const r = st.airlines[SPIELER].routen.find((x) => x.id === rid);
    if (!r) return null;
    const o = {};
    for (const id of Object.keys(STUFEN)) o[id] = id === r.stufe ? null : (kopie) => { preisStufe(kopie, SPIELER, rid, id); };
    return ratWahl(st, "p" + rid, o);
  }
  // Vorschau für einen geplanten Flug: Was bringt er dem ganzen Netz, und wie voll werden Hin- und Rückflug?
  function flugVorschau(st, plan) {
    const pr = probe(st, SPIELER, (kopie) => flugAnlegen(kopie, SPIELER, plan));
    if (!pr || !pr.res || !pr.res.ok) return null;
    const rg = berechnen(pr.kopie, tagVon(pr.kopie));
    const e = rg.routen[pr.res.route.id];
    const fl = e && e.fluege.find((x) => x.id === pr.res.flug.id);
    return { delta: pr.delta, kopie: pr.kopie, flug: fl, route: e, fid: pr.res.flugzeug.id, kosten: pr.res.kosten };
  }
  // Empfehlung beim Kauf: welches Flugzeug und welche Kabine für diesen Flug? (plan ohne typ und fid)
  function ratKauf(st, plan) {
    const p = st.airlines[SPIELER];
    const wer = assistent(p, "analyst");
    if (!wer) return null;
    const km = entfernung(plan.x, plan.y);
    let best = null;
    for (const typ of Object.keys(TYPEN)) {
      if (!typFrei(st, p, typ) || km > TYPEN[typ].reichweite) continue;
      const pl = Object.assign({}, plan, { typ, fid: null, kabine: kabineStandard(typ, p) });
      const z = zeiten(p, plan.x, plan.y, typ, plan.e1.h, plan.e2.h);
      if (!z.passt) continue;
      const s = schaetzen(st, SPIELER, plan.x, plan.y, typ, plan.e1.h, plan.e2.h, true);
      const gesehen = brille(st, wer, s.gewinn, "kauf" + plan.x + plan.y + typ) - TYPEN[typ].preis / 45;
      if (!best || gesehen > best.gesehen) best = { typ, gesehen, plan: pl, gewinn: s.gewinn };
    }
    if (!best) return null;
    // Die Kabine dazu: auf einer Kopie ausprobieren.
    let kabine = kabineStandard(best.typ, p);
    const v = flugVorschau(st, Object.assign({}, best.plan, { kabine: { business: 0, first: 0 } }));
    if (v) {
      const bk = besteKabine(v.kopie, SPIELER, v.fid);
      if (bk) {
        const g = kabineGrenzen(best.typ);
        // Ein schwacher Analyst verschätzt sich auch bei der Aufteilung.
        const schief = Math.round((fest(st, "kab" + plan.x + plan.y) - 0.5) * wer.streuung * 4) / 10;
        kabine = { business: Math.max(0, Math.min(g.business, Math.round((bk.business + schief) * 10) / 10)), first: bk.first };
      }
    }
    return { wer, typ: best.typ, kabine, gewinn: spanne(brille(st, wer, best.gewinn, "kg" + plan.x + plan.y + best.typ), wer.streuung).map((v2) => Math.round(v2 / 100) * 100) };
  }
  // Was bringt ein geplanter Flug am Tag? Der Analyst nennt eine Spanne.
  function ratFlug(st, plan, delta) {
    const wer = assistent(st.airlines[SPIELER], "analyst");
    if (!wer) return null;
    const gesehen = delta + (brille(st, wer, 1, "flug" + plan.x + plan.y + plan.typ + plan.e1.h + "-" + plan.e2.h) - 1) * Math.max(4000, Math.abs(delta));
    return { wer, gewinn: spanne(gesehen, wer.streuung).map((v) => Math.round(v / 100) * 100) };
  }
  // Passt die Kabine noch zu den Flügen? Der Analyst meldet sich, wenn ein Umbau lohnt.
  function ratKabine(st, fid) {
    const p = st.airlines[SPIELER];
    const wer = assistent(p, "analyst");
    const f = p.flotte.find((z) => z.id === fid);
    if (!wer || !f || !p.fluege.some((x) => x.f === fid)) return null;
    const bk = besteKabine(st, SPIELER, fid);
    if (!bk) return null;
    const jetzt = rechnung(st).summe[SPIELER];
    const plus = bk.g - jetzt;
    return { wer, business: bk.business, first: bk.first, lohnt: plus * 20 > umbauPreis(f.typ) && (bk.business !== f.kabine.business || bk.first !== f.kabine.first), plus: spanne(brille(st, wer, plus, "umbau" + fid), wer.streuung).map((v) => Math.round(v / 100) * 100) };
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

  // Rivalen können pleitegehen. Dann werden ihre Slots frei, und sie fangen mit neuem Geld von vorn an.
  function rivalNeustart(st, aid) {
    const a = st.airlines[aid];
    a.routen = []; a.fluege = []; a.flotte = []; a.slots = []; a.geschenk = REGELN.heimGeschenk;
    a.geld = REGELN.startGeld; a.kredit = 0; a.ziel = ZIELE.length; a.kopf = null; a.konkurs = false; a.minusTage = 0; a.ausgebaut = []; a.verlauf = [];
    st.plaene = (st.plaene || []).filter((x) => x.aid !== aid);
    for (const r of st.airlines[SPIELER].routen) if (r.duell && r.duell.gegen === aid) delete r.duell;
    geaendert(st);
  }
  function aufkaufTag(st, tag) {
    if (tag < REGELN.aufkaufAb) return;
    for (const aid of ["k", "s", "a"]) {
      const a = st.airlines[aid];
      a.minusTage = a.geld < 0 ? (a.minusTage || 0) + 1 : 0;
      if (a.minusTage >= 4 && (a.flotte.length || a.slots.length)) {
        const n = a.slots.filter((s) => !s.heim).length;
        melden(st, { art: "pleite", wer: aid, text: `💥 ${a.name} ist pleite! ${n} Slots werden frei: Biete mit. Die Airline fängt mit neuem Geld von vorn an.` });
        rivalNeustart(st, aid);
        st.rivalPleite = true;
        return;
      }
    }
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

  // ---------- Berater: die Assistenten melden sich von selbst ----------
  // Immer nur ein Tipp gleichzeitig, dazwischen Pausen, nichts doppelt. Jeder Vorschlag ist vorher
  // durchgerechnet (probe) und bringt wirklich etwas. Ungenau ist nur die Zahl, die der Assistent nennt.
  const BERATER = { pauseTage: 3, haltbarStunden: 36, sperrTage: 6, minPlus: 4000, maxLinien: 6 };
  function beraterStand(p) {
    if (!p.berater) p.berater = { tipp: null, letzter: -99, gesperrt: {} };
    return p.berater;
  }
  function gesperrt(b, key, tag) { return (b.gesperrt[key] || 0) > tag; }
  // Lohnt es sich wirklich? Mindestens 4.000 am Tag und ein spürbarer Teil des Liniengewinns.
  function lohnt(delta, basis) { return delta >= Math.max(BERATER.minPlus, Math.abs(basis || 0) * 0.06); }

  // Controlling: Kapazität und Sitze der Linien.
  function controllerIdeen(st, p, wer) {
    const rg = rechnung(st);
    const tag = tagVon(st);
    const ideen = [];
    // Die auffälligsten Linien zuerst: übervoll, halb leer, im Minus. Ein schwacher Controller übersieht manches.
    const linien = p.routen.map((r) => ({ r, e: rg.routen[r.id] })).filter((x) => x.e && tag - (x.r.seit || 0) >= 2 && zufall(st) > wer.streuung * 0.5);
    const auffaellig = (x) => Math.max(x.e.bedarf / Math.max(1, x.e.sitzePlaetze) - 1, 0.6 - x.e.auslastung, x.e.gewinn < 0 ? 1 : 0);
    linien.sort((x, y) => auffaellig(y) - auffaellig(x));
    for (const { r, e } of linien.slice(0, BERATER.maxLinien)) {
      const n = flugzeugeAuf(p, r.id).length;
      const voll = e.bedarf > e.sitzePlaetze * 1.12;
      if (voll) {
        // Erst ein weiterer Flug (am liebsten mit einem Flugzeug, das Zeit hat), sonst ein größeres Flugzeug.
        let gemacht = false;
        for (const typ of [...new Set(p.flotte.map((f) => f.typ))].filter((t) => TYPEN[t].reichweite >= e.km)) {
          const t = flugFinden(st, SPIELER, r.a, r.b, typ);
          if (!t.ok || !t.kosten.frei || t.kosten.gesamt > p.geld * 0.5) continue;
          const pr = probe(st, SPIELER, (k) => flugAnlegen(k, SPIELER, t.plan));
          if (pr && lohnt(pr.delta - t.kosten.gesamt / 40, e.gewinn)) { ideen.push({ art: "dazu", route: r.id, typ, preis: t.kosten.gesamt, delta: pr.delta - t.kosten.gesamt / 40, echt: pr.delta, basis: e.gewinn }); gemacht = true; break; }
        }
        if (!gemacht) {
          const kleinster = flugzeugeAuf(p, r.id).sort((x, y) => TYPEN[x.typ].sitze - TYPEN[y.typ].sitze)[0];
          const groesser = Object.keys(TYPEN).filter((t) => typFrei(st, p, t) && TYPEN[t].sitze > TYPEN[kleinster.typ].sitze && TYPEN[t].reichweite >= e.km)
            .sort((x, y) => TYPEN[x].sitze - TYPEN[y].sitze).slice(0, 2);
          for (const typ of groesser) {
            const kosten = umruestenKosten(st, SPIELER, r.id, typ);
            if (!kosten || kosten.preis > p.geld * 0.7) continue;
            const pr = probe(st, SPIELER, (k) => umruesten(k, SPIELER, r.id, typ));
            // Muss sich in etwa vier Wochen bezahlt machen.
            if (pr && lohnt(pr.delta - kosten.preis / 28, e.gewinn)) ideen.push({ art: "umruesten", route: r.id, typ, preis: kosten.preis, delta: pr.delta - kosten.preis / 28, echt: pr.delta, basis: e.gewinn });
          }
        }
      }
      if (e.auslastung < 0.55 && n > 1) {
        const pr = probe(st, SPIELER, (k) => abziehen(k, SPIELER, r.id));
        if (pr && lohnt(pr.delta, e.gewinn)) ideen.push({ art: "abziehen", route: r.id, delta: pr.delta, basis: e.gewinn });
      }
      // Kabine: Passt die Aufteilung des größten Flugzeugs dieser Linie noch? Der Umbau muss sich in vier Wochen bezahlt machen.
      const fz = flugzeugeAuf(p, r.id).filter((f) => kabineGrenzen(f.typ).business > 0 && !inWerkstatt(st, f)).sort((x, y) => TYPEN[y.typ].sitze - TYPEN[x.typ].sitze)[0];
      if (fz && ideen.length < 3) {
        const bk = besteKabine(st, SPIELER, fz.id);
        if (bk && (bk.business !== fz.kabine.business || bk.first !== fz.kabine.first)) {
          const preis = umbauPreis(fz.typ), plus = bk.g - rg.summe[SPIELER];
          if (preis <= p.geld * 0.5 && lohnt(plus - preis / 28, e.gewinn)) ideen.push({ art: "kabine", route: r.id, fid: fz.id, typ: fz.typ, business: bk.business, first: bk.first, preis, delta: plus - preis / 28, echt: plus, basis: e.gewinn });
        }
      }
      // Schließen nur, wenn die Linie schon länger Geld verliert und sonst nichts hilft.
      if ((r.minus || 0) >= 4 && n === 1 && !ideen.some((i) => i.route === r.id)) {
        const pr = probe(st, SPIELER, (kk) => routeSchliessen(kk, SPIELER, r.id));
        if (pr && lohnt(pr.delta, e.gewinn)) ideen.push({ art: "schliessen", route: r.id, delta: pr.delta, tage: r.minus, basis: e.gewinn });
      }
    }
    return ideen;
  }
  // Preisprofi: Preisstufe der Linien, die am ehesten falsch liegen.
  function preisIdeen(st, p, wer) {
    const rg = rechnung(st);
    const tag = tagVon(st);
    const linien = p.routen.map((r) => ({ r, e: rg.routen[r.id] })).filter((x) => x.e && tag - (x.r.seit || 0) >= 2);
    const daneben = (x) => Math.abs(x.e.bedarf / Math.max(1, x.e.sitzePlaetze) - 1);
    linien.sort((x, y) => daneben(y) - daneben(x));
    const ideen = [];
    for (const { r, e } of linien.slice(0, BERATER.maxLinien)) {
      // Übervoll: teurer probieren. Halb leer: billiger probieren.
      const stufen = e.bedarf > e.sitzePlaetze ? ["abschoepfen", "normal"] : ["angreifen", "normal"];
      for (const stufe of stufen) {
        if (stufe === r.stufe) continue;
        const pr = probe(st, SPIELER, (k) => preisStufe(k, SPIELER, r.id, stufe));
        if (pr && lohnt(pr.delta, e.gewinn)) ideen.push({ art: "preis", route: r.id, stufe, delta: pr.delta, basis: e.gewinn });
      }
    }
    return ideen;
  }
  // Was kostet eine neue Linie, und lohnt sie sich nach Abzug des Flugzeugs (in etwa 40 Tagen bezahlt)?
  function neueLinieProbe(st, p, x, y, typ) {
    const test = flugFinden(st, SPIELER, x, y, typ);
    if (!test.ok || test.kosten.gesamt > p.geld * 0.75) return null;
    const pr = probe(st, SPIELER, (k) => flugAnlegen(k, SPIELER, test.plan));
    if (!pr) return null;
    const netto = pr.delta - test.kosten.gesamt / 40;
    return netto > 0 ? { delta: netto, echt: pr.delta, kosten: test.kosten.gesamt } : null;
  }
  // Analyst: neue Strecken ab Heimat und Drehkreuzen.
  function analystIdeen(st, p, wer) {
    const ideen = [];
    const typen = Object.keys(TYPEN).filter((t) => typFrei(st, p, t));
    const starts = [...new Set([p.basis, ...drehkreuze(p)])];
    const kandidaten = [];
    const idx = slotIndex(st, p);
    const eigene = [...new Set(p.flotte.map((f) => f.typ))];
    for (const s of starts) {
      if (!enden(st, p, s, idx).length) continue;
      for (const c of staedte(st)) {
        if (c.id === s || routeVon(p, s, c.id) || !enden(st, p, c.id, idx).length) continue;
        const km = entfernung(s, c.id);
        const passend = typen.filter((t) => TYPEN[t].reichweite >= km);
        for (const typ of new Set([...eigene.filter((t) => passend.includes(t)), ...passend.slice(0, 2)])) {
          const t = flugFinden(st, SPIELER, s, c.id, typ, { idx });
          if (!t.ok) continue;
          const g = schaetzen(st, SPIELER, s, c.id, typ, t.plan.e1.h, t.plan.e2.h, !t.kosten.frei).gewinn - t.kosten.gesamt / 40;
          if (g > 0) kandidaten.push({ start: s, ziel: c.id, typ, g: g * wer.macke * rauschen(st, wer.streuung) });
        }
      }
    }
    kandidaten.sort((x, y) => y.g - x.g);
    for (const k of kandidaten.slice(0, 3)) {
      const pr = neueLinieProbe(st, p, k.start, k.ziel, k.typ);
      if (pr && lohnt(pr.delta, 0)) ideen.push({ art: "neu", start: k.start, ziel: k.ziel, typ: k.typ, delta: pr.delta, echt: pr.echt, kosten: pr.kosten, basis: 0 });
    }
    ideen.push(...rivalenIdeen(st, p, wer, typen));
    return ideen;
  }
  // Der Analyst schaut auch auf die Rivalen: Welche ihrer Linien laufen gut, und könnten wir dort mitfliegen?
  // Wie gut die fremde Linie läuft, nennt er als Spanne (je nach Sternen genauer). Mitfliegen heißt Preiskampf.
  function rivalenEinschaetzung(st, aid, rid, wer) {
    const e = rechnung(st).routen[rid];
    if (!e || !wer) return null;
    const w = e.gewinn * wer.macke * rauschen(st, wer.streuung);
    return { auslastung: e.auslastung, gewinn: spanne(w, wer.streuung).map((x) => Math.round(x / 1000) * 1000) };
  }
  // Für die Rangliste: die beste Linie eines Rivalen, so wie dein Analyst sie sieht (ohne Analyst: nichts).
  function besteRivalenLinie(st, aid) {
    const wer = assistent(st.airlines[SPIELER], "analyst");
    const a = st.airlines[aid];
    if (!wer || !a) return null;
    const rg = rechnung(st);
    const r = a.routen.filter((x) => rg.routen[x.id]).sort((x, y) => rg.routen[y.id].gewinn - rg.routen[x.id].gewinn)[0];
    if (!r) return null;
    return Object.assign({ a: r.a, b: r.b, wer, duFliegst: !!routeVon(st.airlines[SPIELER], r.a, r.b) }, rivalenEinschaetzung(st, aid, r.id, wer));
  }
  function rivalenIdeen(st, p, wer, typen) {
    if (tagVon(st) < REGELN.duellAb) return [];
    const rg = rechnung(st);
    const liste = [];
    for (const aid of ["k", "s", "a"]) {
      const a = st.airlines[aid];
      if (!a || a.konkurs) continue;
      for (const r of a.routen) {
        const e = rg.routen[r.id];
        if (!e || e.gewinn < 8000 || routeVon(p, r.a, r.b)) continue;
        liste.push({ aid, r, e });
      }
    }
    liste.sort((x, y) => y.e.gewinn - x.e.gewinn);
    const ideen = [];
    for (const { aid, r, e } of liste.slice(0, 4)) {
      const km = entfernung(r.a, r.b);
      for (const typ of typen.filter((t) => TYPEN[t].reichweite >= km).slice(0, 2)) {
        const pr = neueLinieProbe(st, p, r.a, r.b, typ);
        if (!pr || !lohnt(pr.delta, 0)) continue;
        const sch = rivalenEinschaetzung(st, aid, r.id, wer);
        ideen.push({ art: "mitfliegen", start: r.a, ziel: r.b, typ, wer2: aid, rivale: sch.gewinn, delta: pr.delta, echt: pr.echt, kosten: pr.kosten, basis: 0 });
        break;
      }
      if (ideen.length) break;
    }
    return ideen;
  }
  // Ereignisse: Ein Rivale kündigt eine Strecke an, oder eine Versteigerung beginnt.
  function ereignisIdeen(st, p, wer, mitSlots) {
    const ideen = [];
    const typen = Object.keys(TYPEN).filter((t) => typFrei(st, p, t));
    for (const g of st.gelegenheiten) {
      if (g.art === "plan" && !routeVon(p, g.von, g.stadt)) {
        // Lohnt es sich, zuerst zu fliegen? Mit dem passendsten Flugzeug.
        let best = null;
        for (const typ of typen) {
          if (entfernung(g.von, g.stadt) > TYPEN[typ].reichweite) continue;
          const pr = neueLinieProbe(st, p, g.von, g.stadt, typ);
          if (pr && (!best || pr.delta > best.delta)) best = { typ, ...pr };
        }
        if (best && lohnt(best.delta, 0)) ideen.push({ art: "plan", gel: g.id, wer: g.aid, start: g.von, ziel: g.stadt, typ: best.typ, kosten: best.kosten, delta: best.delta, echt: best.echt, basis: 0, ereignis: true });
      }
    }
    // Wird gerade ein Slot vergeben, den wir gut brauchen können?
    let bester = null;
    for (const sl of st.pool) {
      if (sl.bis == null || sl.gebote[SPIELER] || hatTafel(p, sl.stadt)) continue;
      const gp = slotGrundpreis(sl.stadt, sl.h);
      if (p.geld < gp * 2.5) continue;
      const n = slotNutzen(st, SPIELER, sl.stadt, sl.h, sl.id);
      if (!n || n.gewinn * 30 < gp) continue;
      if (!bester || n.gewinn > bester.n.gewinn) bester = { sl, n, gp };
    }
    if (bester && mitSlots) {
      const betrag = Math.max(bester.gp, Math.min(runde10k(bester.gp * 1.5), runde10k(bester.n.gewinn * 20 * wer.macke), runde10k(p.geld * 0.3)));
      ideen.push({ art: "bieten", slot: bester.sl.id, stadt: bester.sl.stadt, h: bester.sl.h, betrag, von: bester.n.von, delta: bester.n.gewinn, basis: 0 });
    }
    return ideen;
  }
  // Einmal am Tag: ist ein neuer Tipp fällig?
  function beraterTag(st) {
    const p = st.airlines[SPIELER];
    const b = beraterStand(p);
    const tag = tagVon(st);
    if (b.tipp && (b.tipp.bis <= st.zeit || !tippGueltig(st, b.tipp))) { b.gesperrt[b.tipp.key] = tag + BERATER.sperrTage; b.tipp = null; }
    if (b.tipp) return;
    const rollen = { controller: assistent(p, "controller"), preis: assistent(p, "preis"), analyst: assistent(p, "analyst") };
    if (!rollen.controller && !rollen.preis && !rollen.analyst) return;
    const alle = [];
    const mit = (rolle, liste) => { for (const i of liste) alle.push({ ...i, rolle }); };
    const wichtigWer = rollen.analyst ? "analyst" : rollen.controller ? "controller" : "preis";
    const pause = tag - b.letzter >= BERATER.pauseTage;
    mit(wichtigWer, ereignisIdeen(st, p, rollen[wichtigWer], pause));
    if (pause) {
      if (rollen.controller) mit("controller", controllerIdeen(st, p, rollen.controller));
      if (rollen.preis) mit("preis", preisIdeen(st, p, rollen.preis));
      if (rollen.analyst && p.routen.length) mit("analyst", analystIdeen(st, p, rollen.analyst));
    }
    for (const i of alle) i.key = [i.art, i.route || "", i.start || "", i.ziel || "", i.gel || "", i.slot || "", i.stufe || "", i.typ || ""].join("|");
    const frei = alle.filter((i) => !gesperrt(b, i.key, tag));
    if (!frei.length) return;
    // Ereignisse zuerst, sonst das, was der Assistent für das Beste hält.
    for (const i of frei) { const wer = rollen[i.rolle]; i.faktor = i.ereignis ? 1 : wer.macke * rauschen(st, wer.streuung); i.schaetzung = i.delta * i.faktor; }
    frei.sort((x, y) => (y.ereignis ? 1 : 0) - (x.ereignis ? 1 : 0) || y.schaetzung - x.schaetzung);
    const t = frei[0], wer = rollen[t.rolle];
    // Genannt wird der Mehrgewinn pro Tag (bei Käufen ohne den Kaufpreis, der steht extra da).
    if (t.art !== "bieten") t.plus = spanne((t.echt ?? t.delta) * t.faktor, wer.streuung).map((x) => Math.max(1000, Math.round(x / 1000) * 1000));
    t.wer = wer.id; t.tag = tag; t.bis = st.zeit + BERATER.haltbarStunden;
    delete t.schaetzung; delete t.delta; delete t.echt; delete t.faktor;
    b.tipp = t;
    b.letzter = tag;
  }
  // Passt der Tipp noch zur Lage? (Linie weg, Versteigerung vorbei, schon erledigt ...)
  function tippGueltig(st, t) {
    const p = st.airlines[SPIELER];
    if (t.route && !p.routen.some((r) => r.id === t.route)) return false;
    if (t.gel && !st.gelegenheiten.some((g) => g.id === t.gel)) return false;
    if ((t.art === "neu" || t.art === "plan" || t.art === "mitfliegen") && routeVon(p, t.start, t.ziel)) return false;
    if (t.art === "dazu") { const r = p.routen.find((x) => x.id === t.route); if (!flugFinden(st, SPIELER, r.a, r.b, t.typ).ok) return false; }
    if (t.art === "kabine") { const f = p.flotte.find((x) => x.id === t.fid); if (!f || (f.kabine.business === t.business && f.kabine.first === t.first)) return false; }
    if (t.art === "abziehen" && flugzeugeAuf(p, t.route).length < 2) return false;
    if (t.art === "preis" && (p.routen.find((r) => r.id === t.route) || {}).stufe === t.stufe) return false;
    if (t.art === "bieten") { const sl = st.pool.find((x) => x.id === t.slot); if (!sl || sl.bis == null || sl.gebote[SPIELER]) return false; }
    return true;
  }
  function tipp(st) {
    const p = st.airlines[SPIELER];
    const t = p.berater && p.berater.tipp;
    if (t && !tippGueltig(st, t)) { p.berater.tipp = null; return null; }
    return t || null;
  }
  // Knopf am Tipp: direkt umsetzen. "neu" und "plan" öffnen nur den Editor (das macht die Oberfläche).
  function tippAusfuehren(st) {
    const p = st.airlines[SPIELER];
    const t = tipp(st);
    if (!t) return { ok: false };
    let res = { ok: true };
    if (t.art === "preis") preisStufe(st, SPIELER, t.route, t.stufe);
    else if (t.art === "kabine") res = kabineSetzen(st, SPIELER, t.fid, t.business, t.first);
    else if (t.art === "dazu") { const r = p.routen.find((x) => x.id === t.route); const f = flugFinden(st, SPIELER, r.a, r.b, t.typ); res = f.ok ? flugAnlegen(st, SPIELER, f.plan) : { ok: false }; }
    else if (t.art === "abziehen") { if (flugzeugeAuf(p, t.route).length > 1) abziehen(st, SPIELER, t.route); }
    else if (t.art === "umruesten") res = umruesten(st, SPIELER, t.route, t.typ);
    else if (t.art === "schliessen") routeSchliessen(st, SPIELER, t.route);
    else if (t.art === "bieten") res = { ok: bieten(st, t.slot, t.betrag) };
    p.berater.tipp = null;
    p.berater.gesperrt[t.key] = tagVon(st) + BERATER.sperrTage;
    geaendert(st);
    return res;
  }
  function tippWeg(st) {
    const p = st.airlines[SPIELER];
    const b = beraterStand(p);
    if (b.tipp) b.gesperrt[b.tipp.key] = tagVon(st) + BERATER.sperrTage * 2;
    b.tipp = null;
  }

  // ---------- Speichern ----------
  function laden(json) {
    let st;
    try { st = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { return null; }
    // Ältere Stände (ohne Slots mit Uhrzeit) lassen sich nicht umrechnen: Dann beginnt ein neues Spiel.
    if (!st || st.version !== 3) return null;
    st.manager = managerPruefen(st.manager);
    // Seit 2026-11-28 gibt es keinen Topf und keine Versteigerungen mehr: Alle Slots sind offen und werden beim Buchen entschieden.
    st.pool = [];
    for (const a of Object.values(st.airlines)) {
      a.grundsaetze = a.grundsaetze || { ...VORLAGEN[a.service || "standard"] };
      a.assistenten = a.assistenten || {};
    }
    return st;
  }
  const istAlterStand = (json) => { try { const st = typeof json === "string" ? JSON.parse(json) : json; return !!st && st.version !== 3; } catch (e) { return false; } };

  return {
    SPIELER, REGELN, SERVICE, STUFEN, SCHWIERIGKEIT, angebote, TYPEN, GRUPPEN, STAEDTE, WELT, ALLE, KONTINENTE, STADT, SAISONEN, WOCHENTAGE, RIVALEN, NAMEN, HEIMAT, HEIM_AIRLINE, heimAirline, STIL,
    KLASSEN, KLASSEN_MAX, klassenVon, kabineGrenzen, kabineStandard, kabineSetzen, umbauPreis, inWerkstatt, besteKabine,
    GESCHLECHTER, AUSSEHEN, aussehenFuer, managerPruefen, managerSetzen, anrede,
    neuesSpiel, laden, istAlterStand, klonen, entfernung, tagVon, wochentag, saison, ticket, grundNachfrage, staedte,
    HEIM_STUNDEN, HUB_STUNDEN, TAGESGANG, zone, uhrText, zeitArt, zeitGuete, spielUhr, slotGrundpreis, heimPreis, hatTafel, tafel, heimSlotKaufen, slotNehmen, freieStunden, slotBuchen, ratBuchung, slotZurueckgeben, auktionStart, auktionBieten, auktionKi, auktionEnde, auktionAuto, fragenAn, bietSchritt,
    slotVon, slotsIn, slotFlug, slotsFreiVon, slotZahl, fremdeStunden, poolIn, enden, zeiten, zeitenVon, tagesplan, flugzeugFrei, auslastungFlugzeug,
    flugzeugeAuf, freieFlugzeuge, fluegeVon, fluegeAuf, typFrei, routeVon, flugFinden, flugAnlegen, flugStreichen,
    kostenFuer, kannFliegen, fliegen, abziehen, routeSchliessen, verkaufen, preisStufe, grundsatzSetzen, vorlageSetzen, profil, GRUNDSAETZE, VORLAGEN, ASSISTENTEN, ANALYSTEN: ASSISTENTEN, assistent, einstellen, gehaelter, umbenennen, auftragGeben, preisVorschlagUebernehmen, wochenbericht, wochenVorschlagUebernehmen, missstaende, verwaltungKosten, werbungPreis, werbung, umruestenKosten, umruestenGeht, umruesten,
    drehkreuze, rechnung, berechnen, reisende, probe, schaetzen, vorruecken, position, anziehung,
    BERATER, beraterTag, tipp, tippAusfuehren, tippWeg,
    gelegenheitAnnehmen, gelegenheitAblehnen, uebernahmeAnnehmen, uebernahmeAblehnen, tilgen,
    GEGNER, laune, firmenwert, rangliste, platz, kiTag, kiAusbauen, kiFliegen, kiKandidaten, tagesAbschluss, zielStand, zielPruefen, ZIELE,
    bieten, poolAuswerten, slotInGefahr, tageBisSaisonende, slotNutzen, slotWertFuer, slotBesitzer, handelPruefen, handelAnbieten,
    rivalenEinschaetzung, besteRivalenLinie, ratSlot, ratHandel, ratGrundsatz, ratPreis, ratKauf, ratKabine, ratFlug, flugVorschau,
    trendVon, stadtTrend, vergleich, duellAntwort, drehkreuzPreis, kannAusbauen, drehkreuzAusbauen, rennenStand, wahlTreffen, wirkung, ausgebaut, KONTINENTE_PAARE: PAARE,
  };
});
