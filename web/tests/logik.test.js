// Tests der Web-Spiellogik: node --test web/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../logik.js");

const pfad = path.join(__dirname, "..", "welt.json");
const laden = () => L.welt(JSON.parse(fs.readFileSync(pfad, "utf8")));

test("welt.json ist gültig und gleich wie in GameCore", () => {
  const w = laden();
  assert.deepEqual(L.pruefen(w), []);
  const swift = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "GameCore/Sources/GameCore/Resources/welt.json"), "utf8"));
  assert.deepEqual(JSON.parse(fs.readFileSync(pfad, "utf8")), swift);
});

test("Zufall ist gleich wie SplitMix64 in Swift", () => {
  const r = L.neuerZufall(42);
  const a = L.einheit(r);
  const r2 = L.neuerZufall(42);
  assert.equal(L.einheit(r2), a);
  assert.ok(a >= 0 && a < 1);
});

const dorf = { id: "v", kind: "village", likes: ["humor"], banned: ["fire"] };
const m = (id, feeling, discipline = "music") => ({ id, feeling, discipline, skill: 3, health: 100, fatigue: 0, isAlive: true });

test("Stimmungskurve folgt den Regeln", () => {
  const gemocht = L.erwarteteKurve([m("a", "humor")], dorf, 60);
  const anders = L.erwarteteKurve([m("a", "wonder")], dorf, 60);
  assert.ok(gemocht[1] > anders[1]);
  const drei = L.erwarteteKurve([m("a", "wonder"), m("b", "wonder"), m("c", "wonder")], dorf, 60);
  assert.ok(drei[3] < drei[2]);
  const ruhe = L.erwarteteKurve([m("a", "heart"), m("b", "tension")], dorf, 60);
  const ohne = L.erwarteteKurve([m("a", "wonder"), m("b", "tension")], dorf, 60);
  assert.ok(ruhe[2] - ruhe[1] > ohne[2] - ohne[1]);
  assert.ok(L.wertung([20, 20, 80]) > L.wertung([20, 80, 20]));
});

test("Reise verbraucht Brot und Holz", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 1);
  const b = L.reisen(s, "weidenau", w);
  assert.equal(s.day, 3);
  assert.equal(b.foodEaten, 10);
  assert.equal(s.resources.wood, w.start.resources.wood - 2);
  assert.throws(() => L.reisen(s, "furtheim", w));
});

test("Hunger schadet und löst das Hunger-Ereignis aus", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 7);
  s.resources.food = 0;
  const b = L.reisen(s, "weidenau", w);
  assert.equal(b.hungryDays, 2);
  assert.equal(b.event.id, "hunger");
  assert.ok(L.lebende(s).every((x) => x.health <= 70));
});

test("Ereignis nimmt Mitglied auf, gesperrte Option braucht Disziplin", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 1);
  const e = w.ereignis("fluechtlinge");
  const r = L.entscheiden(s, e.options[0], e, w);
  assert.deepEqual(r.joined, ["mira"]);
  assert.equal(r.change.food, -6);
  const woelfe = w.ereignis("woelfe");
  s.troupe = s.troupe.filter((x) => x.discipline !== "music");
  assert.equal(L.optionMoeglich(s, woelfe.options[2]), false);
});

test("Vorstellung zahlt, Kloster verbietet Feuer, Handel kostet Münzen", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 5);
  const vorher = s.resources.food;
  const e = L.auftreten(s, ["jorin", "berta", "lene"], w);
  assert.equal(e.acts.length, 3);
  assert.equal(s.resources.food, Math.min(vorher + e.reward.food, Infinity));
  assert.equal(L.mitglied(s, "jorin").fatigue, 10);
  s.location = "sankt-ilgen";
  const k = L.auftreten(s, ["tamo", "berta"], w);
  assert.deepEqual(k.acts.map((a) => a.memberID), ["berta"]);
  s.resources.coins = 4;
  L.kaufen(s, "food");
  assert.equal(s.resources.coins, 1);
  assert.throws(() => L.kaufen(s, "food"));
});

test("Wünsche: passende Nummer bringt mehr, Wiederholung langweilt", () => {
  const ort = { kind: "village", likes: ["humor"], banned: [] };
  const w = L.programmBewerten([m("a", "humor"), m("b", "humor"), m("c", "heart")], ["humor", "tension", "heart"]);
  assert.equal(w[0].punkte, 3);
  assert.equal(w[1].gaehnen, true);
  assert.equal(w[1].punkte, 0);
  assert.equal(w[2].punkte, 3);
  const lueckeWertung = L.programmBewerten([m("a", "humor"), null, m("c", "humor")], ["humor", "x", "humor"]);
  assert.equal(lueckeWertung[2].gaehnen, false);
  const wuensche = L.wuenscheErzeugen(ort, L.neuerZufall(3));
  assert.equal(wuensche.length, 3);
  for (let i = 1; i < wuensche.length; i++) assert.notEqual(wuensche[i], wuensche[i - 1]);
});

test("Vorstellung mit Wünschen zahlt Applaus aus", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 11);
  const wuensche = L.wuenscheFuer(s, w);
  const vorher = s.resources.food;
  const e = L.auftretenMitWuenschen(s, ["jorin", null, "berta"], w);
  assert.equal(e.nummern.length, 2);
  assert.deepEqual(e.nummern.map((n) => n.brett), [0, 2]);
  assert.equal(e.applaus, e.nummern.reduce((a, n) => a + n.punkte, 0));
  assert.equal(s.resources.food, vorher + e.reward.food);
  assert.equal(s.wuensche, null);
  assert.equal(s.tutorial.vorstellung, true);
  assert.ok(wuensche.length === 3);
});
