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
    stufe3Wert: 100000000,   // Firmenwert für den Albatros
    gelegenheitAb: 22,       // Woche 4: Messen und Gelegenheiten
    dividende: 0.1,          // Anteil am Tagesgewinn, den Rivalen nicht wieder anlegen
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
  function profil(a) {
    const g = a.grundsaetze || VORLAGEN[a.service] || VORLAGEN.standard;
    const key = Object.keys(GRUNDSAETZE).map((k) => g[k]).join("|");
    if (profilCache.has(key)) return profilCache.get(key);
    const o = {};
    for (const k of Object.keys(GRUNDSAETZE)) o[k] = GRUNDSAETZE[k].optionen[g[k]] || Object.values(GRUNDSAETZE[k].optionen)[0];
    let K = 0;
    for (const k of Object.keys(o)) K += o[k].komfort;
    if (o.essen.kosten === 0) K -= o.essenZahlen.komfort;      // ohne Essen ist der Aufpreis egal
    const essenKosten = o.essen.kosten * (o.essenZahlen.essenAnteil ?? 1);
    const pr = {
      komfort: K,
      sitze: o.sitz.sitze,
      preis: Math.max(0.7, Math.min(1.3, 1 + 0.08 * K)),
      kosten: 2 + essenKosten,
      extra: (o.platzwahl.extra || 0) + (o.koffer.extra || 0),
      wende: o.boarding.wende + (o.sitz.wende || 0),
      betrieb: K < 0 ? 1 + 0.043 * K : 1 + 0.017 * K,
      gast: { urlaub: Math.exp(-(K < 0 ? 0.25 : 0.23) * K), geschaeft: Math.exp((K < 0 ? 0.23 : 0.135) * K) },
      umsteiger: Math.max(0.8, 1.5 - 0.2 * Math.abs(K)),
      treu: K >= 2.5,
      klassen: o.sitz.sitze > 1 ? "billig" : o.sitz.sitze < 1 ? "premium" : "standard",
    };
    pr.art = K <= -2 ? "billig" : K >= 2 ? "premium" : "standard";
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
  // anteil: welcher Teil der Geschäftsreisenden diese Klasse will.
  const KLASSEN = {
    eco: { name: "Economy", farbe: "#7FC4E8", platz: 1, preis: 1, service: 1, anteil: 0.3 },
    business: { name: "Business", farbe: "#F2C14E", platz: 2, preis: 2.6, service: 3, anteil: 0.62 },
    first: { name: "First", farbe: "#C9A0F0", platz: 3, preis: 4.5, service: 6, anteil: 0.08 },
  };
  const KLASSEN_START = { billig: { business: 0, first: 0 }, standard: { business: 0.2, first: 0 }, premium: { business: 0.3, first: 0.1 } };
  function klassenVon(r, a) { return r.klassen || KLASSEN_START[profil(a).klassen]; }

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
    kranich: { name: "Kranich 190", sitze: 190, kmh: 820, reichweite: 6200, preis: 2400000, verbrauch: 4.9, groesse: 1.35, crew: 7500, stufe: 2 },
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
    { id: "saopaulo", name: "São Paulo", lon: -46.47, lat: -23.43, g: 9, w: 0.35, k: 3 },
    { id: "rio", name: "Rio de Janeiro", lon: -43.25, lat: -22.81, g: 6, w: 0.2, k: 2, t: "sued" },
    { id: "buenosaires", name: "Buenos Aires", lon: -58.54, lat: -34.82, g: 7, w: 0.35, k: 2 },
    { id: "bogota", name: "Bogotá", lon: -74.15, lat: 4.7, g: 5, w: 0.35, k: 2 },
    { id: "lima", name: "Lima", lon: -77.11, lat: -12.02, g: 4.5, w: 0.3, k: 2 },
    { id: "santiago", name: "Santiago", lon: -70.79, lat: -33.39, g: 4.5, w: 0.35, k: 1, t: "sued" },
    { id: "kairo", name: "Kairo", lon: 31.4, lat: 30.12, g: 7, w: 0.3, k: 2, t: "sonne" },
    { id: "johannesburg", name: "Johannesburg", lon: 28.24, lat: -26.14, g: 6, w: 0.4, k: 2 },
    { id: "lagos", name: "Lagos", lon: 3.32, lat: 6.58, g: 6, w: 0.35, k: 2 },
    { id: "kapstadt", name: "Kapstadt", lon: 18.6, lat: -33.97, g: 4, w: 0.15, k: 1, t: "sued" },
    { id: "nairobi", name: "Nairobi", lon: 36.93, lat: -1.32, g: 4.5, w: 0.3, k: 1 },
    { id: "casablanca", name: "Casablanca", lon: -7.59, lat: 33.37, g: 4, w: 0.25, k: 1 },
    { id: "marrakesch", name: "Marrakesch", lon: -8.04, lat: 31.6, g: 3, w: 0.05, k: 1, t: "tropen" },
    { id: "dubai", name: "Dubai", lon: 55.36, lat: 25.25, g: 11, w: 0.45, k: 3 },
    { id: "doha", name: "Doha", lon: 51.61, lat: 25.27, g: 5, w: 0.45, k: 2 },
    { id: "telaviv", name: "Tel Aviv", lon: 34.89, lat: 32.01, g: 4.5, w: 0.45, k: 1 },
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
    { id: "sydney", name: "Sydney", lon: 151.18, lat: -33.95, g: 8, w: 0.4, k: 3, t: "sued" },
    { id: "melbourne", name: "Melbourne", lon: 144.84, lat: -37.67, g: 6, w: 0.4, k: 2 },
    { id: "perth", name: "Perth", lon: 115.97, lat: -31.94, g: 3.5, w: 0.4, k: 1, t: "sued" },
    { id: "auckland", name: "Auckland", lon: 174.79, lat: -37.01, g: 4, w: 0.35, k: 2, t: "sued" },
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
    "newyork", "losangeles", "chicago", "atlanta", "mexiko", "saopaulo", "dubai", "delhi", "mumbai", "bangkok", "singapur", "hongkong", "peking", "shanghai", "tokio", "seoul", "sydney"];

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
    const basis = REGELN.nachfrage * A.g * B.g * entfernungsFaktor(km) / (A.r !== B.r ? 1.4 : 1);
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
      if (slotsFrei(st, s) <= 0) slotFehlt = true;
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
    business = Math.max(0, Math.min(0.6, Math.round(business * 10) / 10));
    first = Math.max(0, Math.min(0.3, Math.round(first * 10) / 10));
    r.klassen = { business, first };
    geaendert(st);
    return true;
  }
  // Probiert alle Aufteilungen durch und nimmt die beste.
  function besteKlassen(st, aid, rid) {
    let best = null;
    for (let b = 0; b <= 0.6001; b += 0.1) {
      for (let f = 0; f <= 0.3001; f += 0.1) {
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
          const t = TYPEN[f.typ], u = umlauf(f.typ, km, a);
          sitze += Math.round(t.sitze * profil(a).sitze) * u.legs / 2;
          legs += u.legs;
          kerosin += u.legs * km * t.verbrauch * st.kerosin * profil(a).betrieb;
          gebuehr += u.legs * g * t.groesse * profil(a).betrieb;
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
            pax *= REGELN.umsteigerAnteil * sv.umsteiger * direkt;
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
      const g = e.lokal.geschaeft;
      const D = { first: g * KLASSEN.first.anteil * Math.min(2, 1 + e.km / 3000), business: g * KLASSEN.business.anteil, eco: e.lokal.urlaub + g * KLASSEN.eco.anteil };
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
  const ROLLEN = { analyst: ANALYSTEN, preis: PREISPROFIS };
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
      const lohn = gehaelter(a);
      if (lohn) { a.geld -= lohn; a.heute = (a.heute || 0) - lohn; }
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
    if (tag + 1 >= REGELN.rivalenAb) for (const aid of ["k", "s", "a"]) kiTag(st, aid);
    // Saisonende: Slots prüfen.
    if (tag % REGELN.saisonTage === 0 && tag >= REGELN.ersteSlotPruefung) slotsPruefen(st, tag);
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
    if (st.letzterPlatz && pl > st.letzterPlatz) melden(st, { art: "abstieg", text: `${rangliste(st)[pl - 2].name} hat dich überholt. Jetzt Platz ${pl}.`, platz: pl });
    st.letzterPlatz = pl;
    st.bestPlatz = Math.min(st.bestPlatz || 9, pl);
    // Größere Flugzeuge je nach Firmenwert, für alle Airlines gleich.
    for (const aid of st.reihenfolge) {
      const a = st.airlines[aid];
      const wert = firmenwert(st, aid);
      const stufe = wert >= REGELN.stufe3Wert ? 3 : wert >= REGELN.stufe2Wert ? 2 : 1;
      if (stufe > (a.stufe || 1)) {
        a.stufe = stufe;
        if (aid === SPIELER) {
          st.stufe = stufe;
          melden(st, { art: "stufe", text: stufe === 2 ? "Deine Airline ist gewachsen: Der Kranich 190 ist jetzt im Store, er schafft den Atlantik." : "Jetzt gibt es den Albatros 320: Er fliegt um die halbe Welt.", typ: stufe === 2 ? "kranich" : "albatros" });
        }
      }
    }
    if (pl === 1 && !st.platz1) {
      st.platz1 = true;
      melden(st, { art: "aufstieg", text: "Platz 1! Du bist die größte Airline der Welt." });
    }
  }

  // ---------- Ziele: immer genau eins, mit Belohnung ----------
  const heimRouten = (p) => p.routen.filter((r) => r.a === p.basis || r.b === p.basis).length;
  const ZIELE = [
    { id: "kaufen", text: "Kaufe dein erstes Flugzeug im Store", ist: (st, p) => p.flotte.length, soll: 1, belohnung: 0 },
    { id: "route", text: "Eröffne deine erste Linie im ✏️ Editor", ist: (st, p) => p.routen.length, soll: 1, belohnung: 0 },
    { id: "gewinn", text: "Mach einen Tag mit Gewinn", ist: (st, p) => (p.verlauf.some((v) => v > 0) ? 1 : 0), soll: 1, belohnung: 200000 },
    { id: "drehkreuz", text: "Drei Linien ab deiner Heimat: dein Drehkreuz", ist: (st, p) => heimRouten(p), soll: 3, belohnung: 500000 },
    { id: "flotte5", text: "Baue eine Flotte aus 5 Flugzeugen", ist: (st, p) => p.flotte.length, soll: 5, belohnung: 500000 },
    { id: "wert10", text: "Firmenwert 10 Mio", ist: (st) => Math.round(firmenwert(st, SPIELER) / 1e5) / 10, soll: 10, belohnung: 1000000, mio: true },
    { id: "platz3", text: "Erreiche Platz 3 der Rangliste", ist: (st) => (platz(st) <= 3 ? 1 : 0), soll: 1, belohnung: 1000000 },
    { id: "wert30", text: "Firmenwert 30 Mio: der Kranich schafft den Atlantik", ist: (st) => Math.round(firmenwert(st, SPIELER) / 1e5) / 10, soll: 30, belohnung: 2000000, mio: true },
    { id: "platz2", text: "Erreiche Platz 2 der Rangliste", ist: (st) => (platz(st) <= 2 ? 1 : 0), soll: 1, belohnung: 2000000 },
    { id: "kontinent", text: "Fliege auf einen anderen Kontinent", ist: (st, p) => p.routen.filter((r) => STADT[r.a].r !== STADT[r.b].r).length, soll: 1, belohnung: 3000000 },
    { id: "platz1", text: "Werde die Nummer 1 der Welt", ist: (st) => (platz(st) === 1 ? 1 : 0), soll: 1, belohnung: 5000000 },
    { id: "wert100", text: "Firmenwert 100 Mio: der Albatros", ist: (st) => Math.round(firmenwert(st, SPIELER) / 1e5) / 10, soll: 100, belohnung: 5000000, mio: true },
    { id: "kontinente4", text: "Fliege auf vier Kontinente", ist: (st, p) => new Set(p.routen.flatMap((r) => [STADT[r.a].r, STADT[r.b].r])).size, soll: 4, belohnung: 8000000 },
  ];
  // Danach endlos: Firmenwert verdoppeln.
  function zielAktuell(st) {
    if (st.ziel < ZIELE.length) return ZIELE[st.ziel];
    const stufe = st.ziel - ZIELE.length;
    const soll = 200 * 2 ** stufe;
    return { id: "wert" + soll, text: `Firmenwert ${soll} Mio`, ist: (s) => Math.round(firmenwert(s, SPIELER) / 1e5) / 10, soll, belohnung: soll * 50000, mio: true };
  }
  function zielStand(st) {
    const z = zielAktuell(st);
    const p = st.airlines[SPIELER];
    return { id: z.id, text: z.text, ist: Math.min(z.ist(st, p), z.soll), soll: z.soll, belohnung: z.belohnung, mio: !!z.mio, nr: st.ziel + 1 };
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
    platzhirsch: { reserve: 300000, amortisation: 36, klasse: { 1: 0.7, 2: 1, 3: 1.3 }, proTag: 3, typen: ["falke", "kranich", "albatros"] },
    billig: { reserve: 200000, amortisation: 34, klasse: { 1: 1.4, 2: 1, 3: 0.6 }, proTag: 3, typen: ["falke", "kranich", "libelle"] },
    premium: { reserve: 300000, amortisation: 34, klasse: { 1: 0.6, 2: 1.1, 3: 1.2 }, proTag: 3, typen: ["falke", "kranich", "albatros"] },
    ruhig: { reserve: 0, amortisation: 0, klasse: { 1: 1, 2: 1, 3: 1 }, proTag: 0, typen: [] },   // für Tests: tut nichts
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
    if (a.geld < reserve + 200000) return false;
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
        const p = st.airlines[SPIELER];
        if (aid !== SPIELER && !(opt && opt.start) && routeVon(p, c.x, c.y)) {
          melden(st, { art: "angriff", wer: aid, text: `${a.name} fliegt jetzt auch ${STADT[c.x].name}–${STADT[c.y].name}! „${RIVALEN[aid].sprueche.gegen}“` });
        }
        return true;
      }
    }
    return false;
  }

  // ---------- Speichern ----------
  function laden(json) {
    const st = typeof json === "string" ? JSON.parse(json) : json;
    if (!st || st.version !== 2) return null;
    for (const a of Object.values(st.airlines)) {
      a.grundsaetze = a.grundsaetze || { ...VORLAGEN[a.service || "standard"] };
      a.assistenten = a.assistenten || {};
    }
    return st;
  }

  return {
    SPIELER, REGELN, SERVICE, STUFEN, TYPEN, STAEDTE, WELT, ALLE, KONTINENTE, STADT, SAISONEN, WOCHENTAGE, RIVALEN, NAMEN, HEIMAT, STIL,
    KLASSEN, KLASSEN_START, klassenVon, klassenSetzen, besteKlassen,
    neuesSpiel, laden, klonen, entfernung, tagVon, wochentag, saison, ticket, grundNachfrage, staedte,
    flugzeugeAuf, freieFlugzeuge, slotsBelegt, slotsFrei, slotPreis, slotsGenutzt, slotsUebrig, typFrei, routeVon,
    kostenFuer, kannFliegen, fliegen, abziehen, routeSchliessen, verkaufen, kaufen, preisStufe, grundsatzSetzen, vorlageSetzen, profil, GRUNDSAETZE, VORLAGEN, ANALYSTEN, PREISPROFIS, assistent, einstellen, gehaelter, umbenennen, auftragGeben, preisVorschlagUebernehmen,
    umlauf, drehkreuze, rechnung, berechnen, probe, schaetzen, vorruecken, position,
    gelegenheitAnnehmen, gelegenheitAblehnen, uebernahmeAnnehmen, uebernahmeAblehnen, tilgen,
    firmenwert, rangliste, platz, kiTag, kiAusbauen, tagesAbschluss, zielStand, zielPruefen, ZIELE,
  };
});
