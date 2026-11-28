// Regeln von Luftlinie: node --test web/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../airline/airline-logik.js");
const K = require("../airline/airline-karte.js");

function leer(opt) {
  // Spiel ohne Rivalen-Netze, damit Zahlen gut vergleichbar sind.
  const st = L.neuesSpiel(Object.assign({ seed: 1, basis: "frankfurt", service: "standard" }, opt));
  for (const id of ["k", "s", "a"]) Object.assign(st.airlines[id], { routen: [], flotte: [], slots: {}, stil: "ruhig" });
  L.kaufen(st, "p", "falke");
  return st;
}

test("Start bei Null: kein Flugzeug, keine Linie, für alle gleich", () => {
  const st = L.neuesSpiel({ seed: 3, basis: "london" });
  for (const id of st.reihenfolge) {
    const a = st.airlines[id];
    assert.equal(a.flotte.length, 0, id);
    assert.equal(a.routen.length, 0, id);
    assert.equal(a.geld, L.REGELN.startGeld, id);
    assert.equal(a.slots[a.basis], L.REGELN.startSlots, id);
  }
  assert.equal(L.zielStand(st).id, "kaufen");
  assert.ok(L.ALLE.length > 90);
});

test("Rivalen sitzen in der Nähe der Heimat, jeder woanders", () => {
  for (const basis of ["paris", "tokio", "newyork"]) {
    const st = L.neuesSpiel({ seed: 3, basis });
    const orte = st.reihenfolge.map((id) => st.airlines[id].basis);
    assert.equal(new Set(orte).size, 4, basis);
    for (const o of orte) assert.ok(L.entfernung(basis, o) < 2500, basis + " " + o);
  }
});

test("Ziele: kaufen, Linie, Prämien", () => {
  const st = L.neuesSpiel({ seed: 3, basis: "frankfurt" });
  L.kaufen(st, "p", "falke");
  L.zielPruefen(st);
  assert.equal(L.zielStand(st).id, "route");
  L.fliegen(st, "p", "frankfurt", "rom", "falke", { nurFrei: true });
  L.zielPruefen(st);
  assert.equal(L.zielStand(st).id, "gewinn");
});

test("Ohne freies Flugzeug keine Linie im Editor", () => {
  const st = L.neuesSpiel({ seed: 3, basis: "frankfurt" });
  assert.equal(L.kannFliegen(st, "p", "frankfurt", "rom", "falke", { nurFrei: true }).grund, "keinFlugzeug");
});

test("Sitzklassen: Business bringt auf Geschäftsstrecken mehr", () => {
  const st = leer();
  const r = L.fliegen(st, "p", "frankfurt", "london", "falke");
  L.klassenSetzen(st, "p", r.route.id, 0, 0);
  const nurEco = L.rechnung(st).routen[r.route.id];
  L.klassenSetzen(st, "p", r.route.id, 0.3, 0);
  const mitBusiness = L.rechnung(st).routen[r.route.id];
  assert.ok(mitBusiness.klassen.business.pax > 0);
  assert.ok(mitBusiness.sitzePlaetze < nurEco.sitzePlaetze, "Business braucht mehr Platz");
  const beste = L.besteKlassen(st, "p", r.route.id);
  assert.ok(beste.g >= mitBusiness.gewinn - 1);
});

test("Karte: alle Städte liegen im Bild", () => {
  for (const s of L.STAEDTE) {
    const [x, y] = K.projektion(s.lon, s.lat);
    assert.ok(x > 0 && x < K.B && y > 0 && y < K.H, s.name);
  }
  assert.ok(K.land.length > 10000);
});

test("Entfernung stimmt ungefähr", () => {
  const d = L.entfernung("london", "paris");
  assert.ok(d > 320 && d < 380, String(d));
  assert.equal(L.entfernung("paris", "london"), d);
});

test("Route eröffnen: Slots werden gekauft, freies Flugzeug genutzt, Rechnung positiv", () => {
  const st = leer();
  const p = st.airlines.p;
  const vorher = p.geld, preis = L.slotPreis(st, "rom");
  const r = L.fliegen(st, "p", "frankfurt", "rom", "falke");
  assert.ok(r.ok);
  assert.equal(p.slots.rom, 1);
  assert.equal(p.geld, vorher - preis);
  const e = L.rechnung(st).routen[r.route.id];
  assert.ok(e.gewinn > 0, "Frankfurt–Rom muss sich lohnen");
  assert.ok(e.auslastung > 0.5 && e.auslastung <= 1);
});

test("Reichweite und Geld werden geprüft", () => {
  const st = leer();
  assert.equal(L.kannFliegen(st, "p", "lissabon", "helsinki", "libelle").grund, "reichweite");
  st.airlines.p.geld = 0;
  st.airlines.p.flotte = [];
  assert.equal(L.kannFliegen(st, "p", "frankfurt", "rom", "falke").grund, "geld");
});

test("Volle Weltdrehkreuze: ohne freien Slot keine Route", () => {
  const st = leer();
  st.airlines.k.slots.london = L.REGELN.slotPlaetze[3];
  assert.equal(L.kannFliegen(st, "p", "frankfurt", "london", "falke").grund, "slots");
});

test("Zeit: ein Tag bucht genau den Tagesgewinn", () => {
  const st = leer();
  const r = L.fliegen(st, "p", "frankfurt", "rom", "falke");
  const p = st.airlines.p;
  L.vorruecken(st, 24 - (st.zeit % 24));      // bis Mitternacht
  const g0 = p.geld;
  const tagesGewinn = L.rechnung(st).routen[r.route.id].gewinn;
  L.vorruecken(st, 24);
  assert.ok(Math.abs(p.geld - g0 - tagesGewinn) < Math.abs(tagesGewinn) * 0.35 + 1, `${p.geld - g0} vs ${tagesGewinn}`);
});

test("Drehkreuz: Zubringer bringen Umsteiger und Zubringer-Wert", () => {
  const st = leer();
  st.airlines.p.geld = 1e9;
  L.fliegen(st, "p", "frankfurt", "lissabon", "falke");
  L.fliegen(st, "p", "frankfurt", "krakau", "libelle");
  L.fliegen(st, "p", "frankfurt", "budapest", "libelle");
  assert.deepEqual(L.drehkreuze(st.airlines.p), ["frankfurt"]);
  const rg = L.rechnung(st);
  const krakau = Object.values(rg.routen).find((e) => e.b === "krakau");
  assert.ok(krakau.umsteigerPax > 0);
  assert.ok(krakau.zubringer > 0, "Zubringer bringt etwas auf der Anschlussstrecke");
});

test("Konkurrenz teilt die Gäste", () => {
  const st = leer();
  st.airlines.p.geld = 1e9;
  const r = L.fliegen(st, "p", "frankfurt", "rom", "falke");
  const allein = L.rechnung(st).routen[r.route.id].bedarf;
  st.airlines.k.geld = 1e9;
  L.fliegen(st, "k", "frankfurt", "rom", "falke");
  const geteilt = L.rechnung(st).routen[r.route.id].bedarf;
  assert.ok(geteilt < allein * 0.9);
});

test("Servicelinien: Billig füllt mehr Sitze, Premium nimmt mehr pro Ticket", () => {
  const ergebnis = {};
  for (const service of ["billig", "standard", "premium"]) {
    const st = leer({ service });
    const r = L.fliegen(st, "p", "frankfurt", "palma", "falke");
    ergebnis[service] = L.rechnung(st).routen[r.route.id];
  }
  assert.ok(ergebnis.billig.sitze > ergebnis.standard.sitze && ergebnis.standard.sitze > ergebnis.premium.sitze);
  assert.ok(ergebnis.premium.preis > ergebnis.standard.preis && ergebnis.standard.preis > ergebnis.billig.preis);
  assert.ok(ergebnis.billig.legs >= ergebnis.standard.legs);
});

test("Preisstufe ändert den Ticketpreis", () => {
  const st = leer();
  const r = L.fliegen(st, "p", "frankfurt", "rom", "falke");
  const normal = L.rechnung(st).routen[r.route.id].preis;
  L.preisStufe(st, "p", r.route.id, "abschoepfen");
  assert.ok(L.rechnung(st).routen[r.route.id].preis > normal);
});

test("Jahreszeiten: Palma im Sommer gefragter als im Winter", () => {
  const st = leer();
  const sommer = L.grundNachfrage(st, "frankfurt", "palma", 8).urlaub;
  const winter = L.grundNachfrage(st, "frankfurt", "palma", 22).urlaub;
  assert.ok(sommer > winter * 2);
  const skiWinter = L.grundNachfrage(st, "london", "innsbruck", 22).urlaub;
  const skiSommer = L.grundNachfrage(st, "london", "innsbruck", 8).urlaub;
  assert.ok(skiWinter > skiSommer * 1.5);
});

test("Pleite in drei Stufen: Mahnung, Kredit, Übernahme, dann Ende", () => {
  const st = leer();
  const p = st.airlines.p;
  p.geld = -100;
  L.vorruecken(st, 24 - (st.zeit % 24));
  assert.equal(st.pleite.stufe, 1);
  for (let i = 0; i < L.REGELN.mahnTage; i++) { p.geld = Math.min(p.geld, -100); L.vorruecken(st, 24); }
  assert.equal(st.pleite.stufe, 2);
  assert.ok(p.kredit > 0 && p.geld > 0);
  p.geld = -100;
  L.vorruecken(st, 24);
  assert.equal(st.pleite.stufe, 3);
  assert.ok(st.uebernahme);
  L.uebernahmeAblehnen(st);
  for (let i = 0; i < L.REGELN.letzteChanceTage + 1 && !st.ende; i++) { p.geld = -100; L.vorruecken(st, 24); }
  assert.equal(st.ende.grund, "pleite");
});

test("Übernahme annehmen beendet das Spiel", () => {
  const st = leer();
  st.pleite = { stufe: 3, tage: 0 };
  st.uebernahme = { von: "k", preis: 1 };
  assert.ok(L.uebernahmeAnnehmen(st));
  assert.equal(st.ende.grund, "verkauft");
});

test("Saisonende: ungenutzte Slots verfallen, leere Routen kommen in die Versteigerung", () => {
  const st = leer();
  const p = st.airlines.p;
  p.geld = 1e9;
  p.slots.london = 3;            // nie genutzt
  const r = L.fliegen(st, "p", "frankfurt", "athen", "falke");
  r.route.auslastung = -2; r.route.seit = -10;       // künstlich leer
  st.zeit = 24 * (L.REGELN.ersteSlotPruefung - 1) + 23.9;
  L.vorruecken(st, 0.2);
  assert.ok(!p.slots.london, "ungenutzte Slots weg");
  const auktion = st.gelegenheiten.find((g) => g.art === "auktion");
  assert.ok(auktion, "Versteigerung angeboten");
  L.gelegenheitAblehnen(st, auktion.id);
  assert.ok(!p.routen.some((x) => x.id === r.route.id), "Route ohne Slot ist weg");
  assert.equal(L.freieFlugzeuge(p).length, 1);
});

test("Gelegenheit: gebrauchtes Flugzeug landet frei in der Flotte", () => {
  const st = leer();
  st.gelegenheiten.push({ id: "gx", art: "gebraucht", typ: "libelle", preis: 100000, bis: st.zeit + 5, dauer: 5 });
  const n = st.airlines.p.flotte.length;
  assert.ok(L.gelegenheitAnnehmen(st, "gx").ok);
  assert.equal(st.airlines.p.flotte.length, n + 1);
  assert.equal(st.gelegenheiten.length, 0);
});

test("Speichern und Laden ergibt denselben Stand", () => {
  const st = L.neuesSpiel({ seed: 9 });
  L.fliegen(st, "p", "frankfurt", "rom", "falke");
  L.vorruecken(st, 30);
  const kopie = L.laden(JSON.stringify(st));
  assert.deepEqual(kopie, JSON.parse(JSON.stringify(st)));
  L.vorruecken(st, 24); L.vorruecken(kopie, 24);
  assert.equal(Math.round(kopie.airlines.p.geld), Math.round(st.airlines.p.geld));
});

test("Großer Firmenwert schaltet Kranich und Albatros frei, dann geht es um die Welt", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.ok(!L.typFrei(st, p, "albatros"));
  assert.equal(L.kannFliegen(st, "p", "london", "tokio", "albatros").grund, "gesperrt");
  p.geld = 2e8;
  L.vorruecken(st, 24 - (st.zeit % 24));
  assert.equal(st.stufe, 3);
  assert.ok(!L.typFrei(st, p, "a380"), "A380 erst später");
  assert.ok(L.typFrei(st, p, "albatros"));
  p.slots.london = 3;
  assert.ok(L.fliegen(st, "p", "london", "tokio", "albatros").ok);
  assert.ok(L.fliegen(st, "p", "london", "newyork", "kranich").ok, "A321neo schafft den Atlantik");
  p.geld = 6e8;
  L.vorruecken(st, 24);
  assert.equal(st.stufe, 4);
  assert.ok(L.typFrei(st, p, "a380"));
});

test("Jeder Flugzeugtyp hat Gruppe, Stufe und echte Eckdaten", () => {
  for (const [id, t] of Object.entries(L.TYPEN)) {
    assert.ok(L.GRUPPEN[t.gruppe], id);
    assert.ok(t.stufe >= 1 && t.stufe <= 4, id);
    assert.ok(t.sitze >= 50 && t.reichweite >= 1000 && t.preis > 0, id);
  }
  assert.ok(Object.keys(L.TYPEN).length >= 10);
});

test("Probepartie: Rivalen bauen aus, nichts geht kaputt", () => {
  const st = L.neuesSpiel({ seed: 42, basis: "madrid", service: "billig" });
  const start = st.airlines.k.routen.length;
  for (let i = 0; i < 20; i++) L.vorruecken(st, 24);
  assert.ok(st.airlines.k.routen.length > start);
  for (const id of st.reihenfolge) assert.ok(Number.isFinite(st.airlines[id].geld));
});

test("Grundsätze: Vorlagen ergeben die alten Service-Profile", () => {
  const st = leer();
  const p = st.airlines.p;
  const std = L.profil(p);
  assert.equal(std.art, "standard");
  assert.ok(Math.abs(std.preis - 1) < 1e-9 && std.extra === 0);
  L.vorlageSetzen(st, "p", "billig");
  const b = L.profil(p);
  assert.equal(b.art, "billig");
  assert.ok(b.sitze > 1.2 && b.preis < 0.8 && b.extra > 0 && b.gast.urlaub > 2);
  L.vorlageSetzen(st, "p", "premium");
  const pr = L.profil(p);
  assert.equal(pr.art, "premium");
  assert.ok(pr.preis > 1.2 && pr.gast.geschaeft > 1.3 && pr.treu);
});

test("Grundsatz verschlechtern kostet Ruf, verbessern nicht", () => {
  const st = leer();
  const p = st.airlines.p;
  const ruf = p.ruf;
  assert.ok(L.grundsatzSetzen(st, "p", "koffer", "gebuehr"));
  assert.ok(p.ruf < ruf);
  const r2 = p.ruf;
  assert.ok(L.grundsatzSetzen(st, "p", "essen", "gourmet"));
  assert.equal(p.ruf, r2);
  assert.equal(L.grundsatzSetzen(st, "p", "essen", "gourmet"), false);
});

test("Gebühren bringen Zusatzerlöse pro Gast", () => {
  const st = leer();
  const r = L.fliegen(st, "p", "frankfurt", "rom", "falke", { nurFrei: true });
  assert.ok(r.ok);
  const vor = L.rechnung(st).routen[r.route.id];
  assert.equal(vor.extras, 0);
  L.grundsatzSetzen(st, "p", "platzwahl", "gebuehr");
  const nach = L.rechnung(st).routen[r.route.id];
  assert.ok(nach.extras > 0);
});

test("Analystin liefert nach einiger Zeit drei Vorschläge mit Spannen", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.equal(L.auftragGeben(st, "p", "analyst", "frankfurt"), false);
  L.einstellen(st, "p", "analyst", "mia");
  assert.ok(L.auftragGeben(st, "p", "analyst", "frankfurt"));
  L.vorruecken(st, 4);
  assert.ok(!p.auftraege.analyst.bericht);
  L.vorruecken(st, 5);
  const b = p.auftraege.analyst.bericht;
  assert.equal(b.length, 3);
  for (const v of b) {
    assert.ok(v.gewinn[0] < v.gewinn[1], "Spanne statt genauer Zahl");
    assert.ok(L.STADT[v.ziel] && L.TYPEN[v.typ]);
  }
  assert.ok(st.meldungen.some((m) => m.art === "bericht"));
});

test("Gründlicher Auftrag dauert länger, Gehalt wird täglich abgezogen", () => {
  const st = leer();
  const p = st.airlines.p;
  L.einstellen(st, "p", "analyst", "kern");
  L.auftragGeben(st, "p", "analyst", "frankfurt", true);
  L.vorruecken(st, 10);
  assert.ok(!p.auftraege.analyst.bericht);
  L.vorruecken(st, 16);
  assert.ok(p.auftraege.analyst.bericht);
  assert.ok(p.verlauf[0] <= -L.ANALYSTEN.kern.gehalt);
});

test("Preisprofi schlägt Preise vor, Vorschlag lässt sich übernehmen", () => {
  const st = leer();
  const p = st.airlines.p;
  const r = L.fliegen(st, "p", "frankfurt", "rom", "falke", { nurFrei: true });
  L.einstellen(st, "p", "preis", "paul");
  L.auftragGeben(st, "p", "preis");
  L.vorruecken(st, 9);
  const b = p.auftraege.preis.bericht;
  assert.equal(b.length, 1);
  assert.ok(b[0].lage);
  if (b[0].stufe !== r.route.stufe) {
    assert.ok(L.preisVorschlagUebernehmen(st, r.route.id));
    assert.equal(p.routen[0].stufe, b[0].stufe);
  }
});

test("Umbenennen", () => {
  const st = leer();
  L.umbenennen(st, "p", "  Himmelsrand  ", "#F2C14E");
  assert.equal(st.airlines.p.name, "Himmelsrand");
  assert.equal(st.airlines.p.farbe, "#F2C14E");
});

test("Kein Platz 1 am Anfang, wenn alle bei Null stehen", () => {
  const st = L.neuesSpiel({ seed: 7, basis: "frankfurt" });
  for (let d = 0; d < 3; d++) L.vorruecken(st, 24);
  assert.equal(st.platz1, false);
});

// ---------- Spannung ----------
test("Bei gleichem Preis gewinnt die bessere Qualität, gutes Essen kostet", () => {
  const st = leer();
  const gut = st.airlines.s;
  L.vorlageSetzen(st, "s", "standard");
  L.grundsatzSetzen(st, "s", "essen", "gourmet");
  const p = st.airlines.p;
  p.ruf = gut.ruf;
  // Qualität wirkt zusätzlich zum Preis: ohne den Qualitätsfaktor wäre die Gourmet-Airline weniger attraktiv.
  const mit = L.anziehung(gut, "normal", "urlaub");
  const q = L.REGELN.qualitaet; L.REGELN.qualitaet = 0;
  const ohne = L.anziehung(gut, "normal", "urlaub");
  L.REGELN.qualitaet = q;
  assert.ok(mit > ohne);
  assert.ok(L.profil(gut).sterne > L.profil(p).sterne);
  assert.ok(L.profil(gut).essenKosten > L.profil(p).essenKosten, "gutes Essen kostet");
  // Der Vergleich zeigt beide Linien nebeneinander.
  gut.geld = 1e8;
  L.fliegen(st, "p", "frankfurt", "rom", "falke");
  L.kaufen(st, "s", "falke");
  L.fliegen(st, "s", "frankfurt", "rom", "falke");
  const v = L.vergleich(st, p.routen[0].id);
  assert.equal(v.length, 2);
  assert.ok(v[1].sterne > v[0].sterne);
});

test("Rivale auf deiner Strecke startet einen Preiskampf", () => {
  const st = leer();
  st.zeit = 24 * (L.REGELN.duellAb + 1);
  L.fliegen(st, "p", "frankfurt", "rom", "falke");
  const s = st.airlines.s;
  s.geld = 1e8; s.stil = "billig";
  s.slots.frankfurt = 2; s.slots.rom = 2;
  L.kaufen(st, "s", "falke");
  L.kiTag; // nur zur Sicherheit vorhanden
  const r = st.airlines.p.routen[0];
  // Spatzflug fliegt dieselbe Strecke über den normalen Weg der Rivalen.
  const res = L.fliegen(st, "s", "frankfurt", "rom", "falke");
  assert.ok(res.ok);
  L.duellAntwort(st, r.id, "unterbieten");
  assert.equal(r.stufe, "angreifen");
  L.duellAntwort(st, r.id, "aufgeben");
  assert.equal(st.airlines.p.routen.length, 0);
});

test("Drehkreuz ausbauen bringt mehr Umsteiger", () => {
  const st = leer();
  st.airlines.p.geld = 1e8;
  for (const z of ["rom", "madrid", "wien"]) L.fliegen(st, "p", "muenchen", z, "falke");
  L.fliegen(st, "p", "frankfurt", "muenchen", "falke");
  assert.ok(L.kannAusbauen(st, "p", "muenchen"));
  const bedarf = () => Object.values(L.rechnung(st).routen).filter((e) => e.airline === "p").reduce((s, e) => s + e.bedarf, 0);
  const vorher = bedarf();
  const res = L.drehkreuzAusbauen(st, "p", "muenchen");
  assert.ok(res.ok);
  assert.ok(bedarf() > vorher);
  assert.ok(!L.kannAusbauen(st, "p", "muenchen"), "nur einmal");
});

test("Sicher oder Risiko: sicher kostet sofort", () => {
  const st = leer();
  L.fliegen(st, "p", "frankfurt", "rom", "falke");
  st.gelegenheiten.push({ id: "gx", art: "wahl", typ: "streik", stadt: "frankfurt", preis: 200000, bis: st.zeit + 10, dauer: 10 });
  const geld = st.airlines.p.geld;
  assert.ok(L.wahlTreffen(st, "gx", true));
  assert.equal(st.airlines.p.geld, geld - 200000);
  assert.equal(st.gelegenheiten.length, 0);
});

test("Versteigerung: das höchste Gebot bekommt die Landerechte", () => {
  const st = leer();
  st.airlines.p.geld = 1e8;
  for (const id of ["k", "s", "a"]) st.airlines[id].geld = 0;
  st.gelegenheiten.push({ id: "gv", art: "versteigerung", stadt: "muenchen", stufe: 300000, gebot: 0, bis: st.zeit + 1, dauer: 1 });
  L.bieten(st, "gv", 2);
  L.vorruecken(st, 2);
  assert.equal(st.airlines.p.slots.muenchen, L.REGELN.versteigerungStueck);
});

test("Nachfrage ändert sich über die Zeit und zeigt Pfeile", () => {
  const st = leer();
  const tag = L.tagVon(st);
  const vorher = L.grundNachfrage(st, "frankfurt", "rom", tag).urlaub;
  st.trend = { rom: { f: 1.3, d: 0.03, bis: tag + 5 } };
  assert.ok(L.grundNachfrage(st, "frankfurt", "rom", tag).urlaub > vorher * 1.25);
  assert.equal(L.trendVon(st, "frankfurt", "rom"), 1);
  assert.equal(L.stadtTrend(st, "rom"), 1);
});

test("Lange Partie mit allen neuen Ereignissen läuft ohne Fehler", () => {
  const st = L.neuesSpiel({ seed: 9, basis: "frankfurt" });
  st.airlines.p.stil = "bot";
  const arten = new Set();
  for (let d = 0; d < 45; d++) {
    L.kiTag(st, "p");
    for (const g of st.gelegenheiten.slice()) if (g.art === "versteigerung") L.bieten(st, g.id, 1);
    L.vorruecken(st, 24);
    for (const m of st.meldungen.splice(0)) arten.add(m.art);
  }
  for (const a of ["versteigerung", "rennen", "plan"]) assert.ok(arten.has(a), a);
  assert.ok(!st.ende);
});

test("Spätes Spiel: Verwaltung, Werbung, Umrüsten, Controlling, späte Ziele", () => {
  const st = L.neuesSpiel({ seed: 5, basis: "frankfurt" });
  const p = st.airlines.p;
  assert.equal(L.verwaltungKosten(p, 8), 0);
  assert.ok(L.verwaltungKosten(p, 20) > 2 * L.verwaltungKosten(p, 14));   // wächst schneller als die Zahl der Linien
  p.geld = 5e7;
  p.ruf = 70;
  assert.ok(L.werbung(st, "p").ok);
  assert.equal(p.ruf, 76);
  // Umrüsten: ATR auf einer Linie wird zu einem größeren Typ
  L.kaufen(st, "p", "libelle");
  const r = L.fliegen(st, "p", "frankfurt", "stuttgart", "libelle", { nurFrei: true }).route;
  const geldVor = p.geld;
  assert.ok(L.umruesten(st, "p", r.id, "falke").ok);
  assert.equal(L.flugzeugeAuf(p, r.id)[0].typ, "falke");
  assert.ok(p.geld < geldVor && p.flotte.length === 1);
  assert.ok(!L.umruesten(st, "p", r.id, "libelle").ok);       // kleiner geht nicht
  // Controlling: Bericht nur mit Assistent
  p.stil = "bot";
  for (let d = 1; d <= 14; d++) { L.kiTag(st, "p"); L.vorruecken(st, 24); }
  assert.ok(!p.wochenbericht);
  L.einstellen(st, "p", "controller", "ines");
  for (let d = 1; d <= 7; d++) L.vorruecken(st, 24);
  assert.ok(p.wochenbericht && p.wochenbericht.schwach.length >= 1);
  assert.ok(Array.isArray(p.hinweise) && p.hinweise.length <= 3);
  // Späte Ziele wechseln sich mit Firmenwert ab
  st.ziel = L.ZIELE.length;
  assert.match(L.zielStand(st).text, /rote Linie/);
  st.ziel = L.ZIELE.length + 1;
  assert.match(L.zielStand(st).text, /Firmenwert/);
  st.ziel = L.ZIELE.length + 2;
  assert.equal(L.zielStand(st).einheit, "%");
});
