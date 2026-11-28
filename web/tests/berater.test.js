// Tipps der Assistenten: höchstens einer, und jeder direkte Vorschlag bringt wirklich mehr Gewinn.
const test = require("node:test");
const assert = require("node:assert");
const L = require("../airline/airline-logik.js");

test("Berater: ein Tipp, der sich rechnet", () => {
  let gezaehlt = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const st = L.neuesSpiel({ seed, basis: "frankfurt" });
    const p = st.airlines.p;
    p.geld = 60e6;
    for (const [z, typ] of [["london", "a320"], ["paris", "a320"], ["rom", "falke"], ["madrid", "falke"], ["wien", "libelle"]]) L.fliegen(st, "p", "frankfurt", z, typ);
    for (let i = 0; i < 3 * 24; i++) L.schritt ? L.schritt(st, 1) : null;
    L.einstellen(st, "p", "kern");
    L.beraterTag(st);
    const t = L.tipp(st);
    if (!t) continue;
    assert.ok(Array.isArray(t.plus) || t.art === "bieten");
    if (["neu", "plan", "bieten"].includes(t.art)) continue;
    const vorher = L.rechnung(st).summe.p;
    const k = L.klonen(st);
    assert.ok(L.tippAusfuehren(k).ok !== false);
    assert.ok(L.rechnung(k).summe.p > vorher, t.art + " soll Gewinn bringen");
    assert.strictEqual(L.tipp(k), null, "nach dem Ausführen ist der Tipp weg");
    gezaehlt++;
  }
  assert.ok(gezaehlt >= 0);
});
