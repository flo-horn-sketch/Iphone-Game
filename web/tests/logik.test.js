// Tests der Web-Spiellogik: node --test web/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../logik.js");

const pfad = path.join(__dirname, "..", "welt.json");
const laden = () => L.welt(JSON.parse(fs.readFileSync(pfad, "utf8")));

test("welt.json ist gültig", () => {
  assert.deepEqual(L.pruefen(laden()), []);
});

test("Zufall ist wiederholbar", () => {
  assert.equal(L.einheit(L.neuerZufall(42)), L.einheit(L.neuerZufall(42)));
});

test("Reisen kostet Brot, ohne Brot kommt das Hunger-Ereignis", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 1);
  s.resources.food = 20;
  const r = L.reisen(s, "weidenau", w); // 2 Tage, 5 Leute → 2 × 3
  assert.equal(r.brot, 6);
  assert.equal(s.resources.food, 14);
  assert.equal(s.location, "weidenau");
  s.resources.food = 1;
  const r2 = L.reisen(s, "kesselgrund", w);
  assert.equal(r2.hunger, true);
  assert.equal(s.resources.food, 0);
  assert.equal(r2.event.id, "hunger");
});

test("Verletzt, nochmal getroffen: tot. Kloster heilt.", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 1);
  const lene = L.mitglied(s, "lene");
  const fieber = w.ereignis("fieber");
  let f = L.entscheiden(s, fieber.options[1], fieber, w);
  assert.equal(lene.zustand, "verletzt");
  assert.deepEqual(f.hurt, ["lene"]);
  f = L.entscheiden(s, fieber.options[1], fieber, w);
  assert.equal(lene.zustand, "tot");
  assert.deepEqual(f.deaths, ["lene"]);
  L.mitglied(s, "jorin").zustand = "verletzt";
  const r = L.reisen(s, "sankt-ilgen", w);
  assert.deepEqual(r.geheilt, ["jorin"]);
  assert.equal(L.mitglied(s, "jorin").zustand, "fit");
  assert.equal(lene.zustand, "tot");
});

test("Vorstellung: passende Nummer baut Serie auf, falsche kostet Geduld", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 7);
  L.showStarten(s, w);
  s.show.ruf = "humor";
  const n1 = L.showNummer(s, "jorin"); // Narr, Humor, Können 4
  assert.equal(n1.passt, true);
  assert.equal(n1.punkte, 4);
  assert.equal(s.show.serie, 2);
  assert.throws(() => L.showNummer(s, "berta"));
  L.showWeiter(s, w);
  s.show.ruf = "heart";
  assert.equal(L.showVorschau(s, L.mitglied(s, "berta")).punkte, 6); // 3 × Serie 2
  assert.throws(() => L.showWeiter(s, w)); // nicht erlaubt, solange offen
});

test("Vorstellung: ohne Geduld laufen die Leute davon, der halbe Hut ist weg", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 3);
  L.showStarten(s, w);
  s.show.applaus = 20;
  for (const id of ["berta", "wenzel", "jorin"]) {
    if (!s.show.offen) L.showWeiter(s, w);
    s.show.ruf = "wonder";
    L.showNummer(s, id);
  }
  assert.equal(s.show.vorbei, true);
  assert.equal(s.show.verlaufen, true);
  assert.equal(s.show.applaus, 11); // 23 − 12
  const e = L.showKassieren(s, w);
  assert.equal(e.sterne, 1);
  assert.equal(s.show, null);
});

test("Verletzte treten nicht auf, Lohn hängt vom Ort ab", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 3);
  L.mitglied(s, "lene").zustand = "verletzt";
  L.showStarten(s, w);
  assert.ok(!L.showFrei(s).some((m) => m.id === "lene"));
  assert.ok(L.lohn(20, w.ort("hollerbach")).food > L.lohn(20, w.ort("weidenau")).food);
  assert.ok(L.lohn(20, w.ort("rabenstein")).coins > L.lohn(20, w.ort("weidenau")).coins);
});

test("Markt: Bewerber anwerben kostet Gold", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 3);
  s.location = "weidenau";
  const b = L.bewerber(s, w);
  assert.ok(b && b.price > 0);
  s.resources.coins = b.price;
  L.anwerben(s, w);
  assert.equal(s.resources.coins, 0);
  assert.equal(L.mitglied(s, b.id).zustand, "fit");
  s.location = "hollerbach";
  assert.equal(L.bewerber(s, w), null);
});

test("Kapitelziel: mit genug Gold am Zielort einlösen", () => {
  const w = laden();
  const s = L.neuesSpiel(w, 3);
  const k = L.kapitel(s, w);
  s.location = k.place;
  s.resources.coins = k.coins - 1;
  assert.equal(L.zielErreichbar(s, w), false);
  s.resources.coins = k.coins + 2;
  L.zielEinloesen(s, w);
  assert.equal(s.resources.coins, 2);
  assert.equal(s.kapitel, 1);
});
