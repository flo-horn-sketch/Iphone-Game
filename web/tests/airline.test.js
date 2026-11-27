// Regeln von Luftlinie: node --test web/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../airline/airline-logik.js");
const K = require("../airline/airline-karte.js");

function leer(opt) {
  // Spiel ohne Rivalen-Netze, damit Zahlen gut vergleichbar sind.
  const st = L.neuesSpiel(Object.assign({ seed: 1, basis: "frankfurt", service: "standard" }, opt));
  for (const id of ["k", "s", "a"]) Object.assign(st.airlines[id], { routen: [], flotte: [], slots: {} });
  return st;
}

test("Start: Heimat mit zwei Slots, ein freies Flugzeug, Rivalen haben schon ein Netz", () => {
  const st = L.neuesSpiel({ seed: 3, basis: "london" });
  const p = st.airlines.p;
  assert.equal(p.slots.london, 2);
  assert.equal(L.freieFlugzeuge(p).length, 1);
  assert.equal(p.geld, L.REGELN.startGeld);
  for (const id of ["k", "s", "a"]) assert.ok(st.airlines[id].routen.length >= 2, id);
  assert.equal(L.platz(st), 4);
  assert.equal(L.STAEDTE.length, 43);
  assert.equal(L.STAEDTE.filter((s) => s.k === 3).length, 6);
});

test("Rivalen weichen aus, wenn ihre Heimat schon vergeben ist", () => {
  const st = L.neuesSpiel({ seed: 3, basis: "paris" });
  assert.equal(st.airlines.k.basis, "frankfurt");
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

test("Platz 1 öffnet die Welt und den Albatros", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.ok(!L.typFrei(st, p, "albatros"));
  assert.equal(L.kannFliegen(st, "p", "london", "newyork", "albatros").grund, "gesperrt");
  p.geld = 5e8;
  L.vorruecken(st, 24 - (st.zeit % 24));
  assert.ok(st.welt && st.platz1);
  assert.ok(L.typFrei(st, p, "albatros"));
  p.slots.london = 3;
  assert.ok(L.fliegen(st, "p", "london", "newyork", "albatros").ok);
});

test("Probepartie: Rivalen bauen aus, nichts geht kaputt", () => {
  const st = L.neuesSpiel({ seed: 42, basis: "madrid", service: "billig" });
  const start = st.airlines.k.routen.length;
  for (let i = 0; i < 20; i++) L.vorruecken(st, 24);
  assert.ok(st.airlines.k.routen.length > start);
  for (const id of st.reihenfolge) assert.ok(Number.isFinite(st.airlines[id].geld));
});
