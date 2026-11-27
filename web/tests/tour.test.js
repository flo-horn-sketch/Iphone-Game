const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../logik");

const world = () => L.welt(JSON.parse(fs.readFileSync(path.join(__dirname, "../welt.json"), "utf8")));
const setup = (s, place, step) => {
  s.location = place;
  s.tour.schritte = step;
  s.tour.halt = { art: "ankunft", geheilt: [] };
};
const result = (s, w, applause) => {
  L.showStarten(s, w);
  s.show.gespielt.push(s.troupe[0].id);
  s.show.applaus = applause;
  return L.showKassieren(s, w);
};

test("Seed und Tourplan stimmen überein; alle Orte sind erreichbar", () => {
  const w = world();
  assert.deepEqual(L.neueTour(w, 123), L.neueTour(w, 123));
  const plans = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const s = L.neueTour(w, seed);
    for (const p of w.places) assert.ok(L.tourRestweg(s, w, p.id) <= 5);
    plans.add(JSON.stringify([s.tour.gesperrt, s.tour.jahrmarkt, s.tour.kosten, s.tour.marktStart]));
    if (s.tour.gesperrt.length) assert.equal(L.tourWeg(s, w.roads.find(r => [r.from, r.to].sort().join(":") === s.tour.gesperrt[0])), false);
  }
  assert.ok(plans.size > 20);
});

test("Reise verbraucht eine Etappe, speichert die Ankunft und kann nicht doppelt ablaufen", () => {
  const w = world(), s = L.neueTour(w, 52);
  const to = w.nachbarn(s.location).find(id => L.tourWeg(s, w.weg(s.location, id)));
  const bread = s.resources.food;
  const r = L.reisen(s, to, w);
  assert.equal(s.resources.food, bread - r.brot);
  assert.equal(s.tour.schritte, 1);
  assert.equal(s.tour.halt.ereignis, r.event && r.event.id);
  assert.throws(() => L.reisen(s, w.nachbarn(to)[0], w));
});

test("Vorschau ist nach dem Neuladen stabil und der nächste Ruf wird nicht neu gewürfelt", () => {
  const w = world(), s = L.neueTour(w, 13);
  L.showStarten(s, w);
  s.show.ruf = "humor";
  L.showNummer(s, "jorin");
  const hut = L.hutVorschau(s, w);
  const next = s.show.naechsterRuf;
  assert.ok(next);
  const clone = JSON.parse(JSON.stringify(s));
  const rng = clone.rng.state;
  assert.deepEqual(L.hutVorschau(clone, w), hut);
  assert.equal(L.showWeiter(clone, w), next);
  assert.equal(clone.rng.state, rng);
});

test("Improvisation ist sicher, einmalig und kann mit einem Vorteil die Serie retten", () => {
  const w = world();
  for (const geuebt of [false, true]) {
    const s = L.neueTour(w, 32);
    if (geuebt) s.tour.perks.push("impro");
    L.showStarten(s, w);
    s.show.serie = 3;
    const r = L.showImprovisieren(s, w);
    assert.equal(r.punkte, geuebt ? 4 : 1);
    assert.equal(s.show.serie, geuebt ? 3 : 1);
    assert.equal(s.show.geduld, L.GEDULD);
    assert.throws(() => L.showImprovisieren(s, w));
  }
});

test("Auftrittsverbesserungen verändern Boni und Risiko lesbar", () => {
  const w = world(), s = L.neueTour(w, 3), lene = L.mitglied(s, "lene");
  L.showStarten(s, w);
  s.show.ruf = "tension"; s.show.serie = 3;
  const baseline = L.showVorschau(s, lene);
  assert.equal(baseline.risiko, .2);
  s.tour.perks.push("sicher");
  assert.equal(L.showVorschau(s, lene).risiko, .1);
  s.tour.perks.push("finale");
  const upgrade = L.showVorschau(s, lene);
  assert.ok(upgrade.punkte > baseline.punkte);
  assert.equal(Math.round(upgrade.risiko * 100), 15);
});

test("Nach gutem Auftritt muss genau eine Verbesserung gewählt werden; Auszahlung nur einmal", () => {
  const w = world(), s = L.neueTour(w, 1);
  const e = result(s, w, 7);
  assert.equal(s.tour.angebot.length, 2);
  assert.throws(() => L.tourAufbruch(s));
  assert.throws(() => L.showKassieren(s, w));
  assert.ok(e.reward.food > 0);
  const id = s.tour.angebot[0];
  L.tourVerbessern(s, id);
  assert.deepEqual(s.tour.perks, [id]);
  assert.throws(() => L.tourVerbessern(s, id));
  L.tourAufbruch(s);
  assert.throws(() => L.showStarten(s, w));
});

test("Winterfinale: kein Sieg zu früh, Erfolg in Etappe fünf, Ende spätestens nach sechs", () => {
  const w = world();
  const frueh = L.neueTour(w, 3);
  setup(frueh, frueh.tour.finale, 4);
  result(frueh, w, 20);
  assert.equal(frueh.tour.status, "unterwegs");
  const sieg = L.neueTour(w, 3);
  setup(sieg, sieg.tour.finale, 5);
  result(sieg, w, sieg.tour.ziel);
  assert.equal(sieg.tour.auszahlung.erfolg, true);
  assert.equal(sieg.tour.status, "gewonnen");
  const verlust = L.neueTour(w, 3);
  setup(verlust, verlust.tour.finale, 6);
  result(verlust, w, verlust.tour.ziel - 1);
  assert.equal(verlust.tour.status, "gescheitert");
  const ohne = L.neueTour(w, 3);
  setup(ohne, "weidenau", 6);
  ohne.troupe.forEach(m => { m.zustand = "verletzt"; });
  L.showStarten(ohne, w);
  L.tourOhneAuftritt(ohne);
  assert.equal(ohne.tour.status, "gescheitert");
});

test("Leichter Wagen braucht weniger Brot, hat aber einen Künstler weniger", () => {
  const w = world(), a = L.neueTour(w, 17), b = L.neueTour(w, 17, "leicht");
  const r = w.weg("hollerbach", "weidenau");
  assert.equal(b.troupe.length, a.troupe.length - 1);
  assert.ok(L.wegKosten(b, r) < L.wegKosten(a, r));
  assert.deepEqual(a.tour.gesperrt, b.tour.gesperrt);
});
