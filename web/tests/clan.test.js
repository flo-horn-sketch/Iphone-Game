// Regeln von Clan-Viertel: node --test web/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../clanviertel/clan-logik.js");

function leer(st) {
  // Alle Figuren nach Hause, nichts angreifen.
  for (const f of L.figurenVon(st, "p")) L.platzieren(st, f.id, null);
}

test("Start: je drei Viertel mit vollen Laternen, drei frei", () => {
  const st = L.neuesSpiel();
  assert.equal(L.vollBesitz(st, "p").length, 3);
  assert.equal(L.vollBesitz(st, "r").length, 3);
  assert.deepEqual(L.VIERTEL.filter((v) => !st.besitz[v.id]).map((v) => v.id), ["hohemine", "fechtschule", "nachtmarkt"]);
  assert.equal(st.tag, 1);
  assert.ok(st.ansage === null || L.NACH_ID[st.ansage]);
});

test("Jade wirkt abnehmend: +2, +3, +4, höchstens drei", () => {
  assert.deepEqual([0, 1, 2, 3].map(L.jadeBonus), [0, 2, 3, 4]);
  const st = L.neuesSpiel();
  const f = L.figurenVon(st, "p").find((x) => x.typ === "laeufer");
  st.jade.p = 5;
  for (let i = 0; i < 4; i++) L.jadeGeben(st, f.id);
  assert.equal(f.jade, 3);
  assert.equal(L.staerke(f), 6);
  assert.equal(st.jade.p, 2);
});

test("Erreichbar: Nachbarn, Läufer zwei weit, Haupthaus erst ab Tag 5 und nur mit Belagerung", () => {
  const st = L.neuesSpiel();
  assert.ok(L.erreichbar(st, "p", "fechtschule", "waechter"));
  assert.ok(!L.erreichbar(st, "p", "schlotmine", "waechter"));
  assert.ok(L.erreichbar(st, "p", "schlotmine", "laeufer"));
  assert.ok(!L.erreichbar(st, "p", "natternhaus", "laeufer"));
  st.tag = 5; st.besitz.fechtschule = "p"; st.laternen.fechtschule = 0;
  assert.ok(!L.erreichbar(st, "p", "natternhaus", "waechter"), "Belagerung braucht volle Laternen");
  st.laternen.fechtschule = 3;
  assert.ok(L.erreichbar(st, "p", "natternhaus", "waechter"));
});

test("Stärke ohne Würfel: Figuren, Wächter, Führer, Nachbarn, Heimvorteil", () => {
  const st = L.neuesSpiel();
  const w = L.figurenVon(st, "p").find((x) => x.typ === "waechter");
  const ilka = L.figurenVon(st, "p").find((x) => x.typ === "anfuehrer");
  L.platzieren(st, w.id, "klippenmine");
  L.platzieren(st, ilka.id, null); // Kranichhaus ist Nachbar
  const ws = L.spielerWertung(st, "klippenmine");
  assert.equal(ws.figuren, 2);
  assert.equal(ws.waechter, 2);
  assert.equal(ws.fuehrer, 1);
  assert.equal(ws.nachbarn, 1);
  assert.equal(ws.heim, 1);
  assert.equal(ws.summe, 7);
  // Leeres Haupthaus: die Mauern halten trotzdem
  for (const f of L.figurenVon(st, "p")) L.platzieren(st, f.id, "klippenmine");
  assert.equal(L.spielerWertung(st, "kranichhaus").summe, L.REGELN.mauern);
});

test("Kampf: Verteidiger gewinnt, Verlierer wird verletzt", () => {
  const st = L.neuesSpiel();
  leer(st);
  // Rivale greift den Fischmarkt mit Plan an
  const r = L.bereit(st, "r").filter((f) => f.typ !== "anfuehrer");
  st.plan = {};
  for (const f of L.bereit(st, "r")) st.plan[f.id] = "natternhaus";
  st.plan[r[0].id] = "fischmarkt";
  r[0].jade = 2; // Stärke 5
  // Spieler: Wächter verteidigt (2 + Wächter 2 + Nachbarn 2 + Heim 1 + Führer 1 = 8)
  const w = L.figurenVon(st, "p").find((x) => x.typ === "waechter");
  L.platzieren(st, w.id, "fischmarkt");
  const b = L.tagAufloesen(st);
  const k = b.kaempfe.find((x) => x.viertel === "fischmarkt");
  assert.equal(k.sieger, "p");
  assert.equal(st.besitz.fischmarkt, "p");
  // 8 gegen 5 + Nachbar 0 = 5: kein doppelter Sieg, also verletzt
  assert.equal(k.folge, "verletzt");
});

test("Eroberung: Laternen starten bei null und wachsen pro Tag", () => {
  const st = L.neuesSpiel();
  leer(st);
  st.plan = {};
  for (const f of L.bereit(st, "r")) st.plan[f.id] = "natternhaus";
  const l = L.figurenVon(st, "p").find((x) => x.typ === "laeufer");
  L.platzieren(st, l.id, "fechtschule");
  L.tagAufloesen(st);
  assert.equal(st.besitz.fechtschule, "p");
  assert.equal(st.laternen.fechtschule, 0);
  st.plan = {};
  for (const f of L.bereit(st, "r")) st.plan[f.id] = "natternhaus";
  st.ereignis = null;
  L.platzieren(st, l.id, "fechtschule");
  L.tagAufloesen(st);
  assert.equal(st.laternen.fechtschule, 1);
});

test("Ein Angriff aufs Haupthaus wird immer angesagt", () => {
  for (const riv of Object.keys(L.RIVALEN)) {
    const st = L.neuesSpiel(riv);
    st.tag = 6;
    st.besitz.fechtschule = "r"; st.besitz.klippenmine = "r"; st.besitz.fischmarkt = "r";
    for (const f of L.figurenVon(st, "p")) L.platzieren(st, f.id, null);
    for (const f of L.figurenVon(st, "r")) f.jade = 3;
    const p = L.rivalePlant(st);
    if (Object.values(p.plan).includes("kranichhaus")) assert.equal(p.ansage, "kranichhaus", riv);
  }
});

test("Ganze Partien enden spätestens an Tag 20 und laufen ohne Fehler", () => {
  for (const riv of Object.keys(L.RIVALEN)) {
    const st = L.neuesSpiel(riv);
    let n = 0;
    while (!st.ende && n++ < 30) {
      if (st.ereignis) L.ereignisWaehlen(st, 1);
      L.tagAufloesen(st);
    }
    assert.ok(st.ende, riv);
    assert.ok(st.tag <= L.REGELN.letzterTag);
    assert.ok(st.tag >= L.REGELN.friedenBis, "nicht vor Tag 5 entschieden");
  }
});

test("Doppelte Stärke: Verlierer fällt, Sieger erbeutet seine Jade", () => {
  const st = L.neuesSpiel();
  for (const f of L.figurenVon(st, "p")) L.platzieren(st, f.id, null);
  st.plan = {};
  for (const f of L.bereit(st, "r")) st.plan[f.id] = "natternhaus";
  const opfer = L.bereit(st, "r").find((f) => f.typ === "laeufer");
  opfer.jade = 1; // Stärke 4
  st.plan[opfer.id] = "hohemine";
  for (const f of L.figurenVon(st, "p").filter((f) => f.typ !== "anfuehrer")) { f.jade = 1; L.platzieren(st, f.id, "hohemine"); }
  const vorher = st.jade.p;
  const b = L.tagAufloesen(st);
  const k = b.kaempfe.find((x) => x.viertel === "hohemine");
  assert.equal(k.sieger, "p");
  assert.equal(k.folge, "gefallen");
  assert.equal(k.beute, 1);
  assert.ok(!L.figur(st, opfer.id));
  assert.ok(st.jade.p >= vorher + 1);
});

test("Gleichstand auf eigenem Boden: Verteidiger hält, niemand verletzt", () => {
  const st = L.neuesSpiel();
  for (const f of L.figurenVon(st, "p")) L.platzieren(st, f.id, null);
  st.plan = {};
  for (const f of L.bereit(st, "r")) st.plan[f.id] = "natternhaus";
  const w = L.figurenVon(st, "p").find((f) => f.typ === "waechter");
  L.platzieren(st, w.id, "fischmarkt"); // 2 + Wächter 2 + Nachbar 1 + Heim 1 + Ilka 1 = 7
  const angreifer = L.bereit(st, "r").filter((f) => f.typ !== "anfuehrer");
  angreifer[0].jade = 2; angreifer[1].jade = 0; // 5 + 2 = 7
  st.plan[angreifer[0].id] = "fischmarkt"; st.plan[angreifer[1].id] = "fischmarkt";
  const b = L.tagAufloesen(st);
  const k = b.kaempfe.find((x) => x.viertel === "fischmarkt");
  assert.equal(k.spieler.summe, k.rivale.summe);
  assert.equal(k.folge, "gleichstand");
  assert.equal(st.besitz.fischmarkt, "p");
  assert.equal(k.verluste.length, 0);
});

test("Wer nichts tut, verliert gegen jeden Rivalen", () => {
  // Wer gar nichts tut, verliert gegen jeden Rivalen.
  for (const riv of Object.keys(L.RIVALEN)) {
    const st = L.neuesSpiel(riv);
    while (!st.ende) {
      if (st.ereignis) L.ereignisWaehlen(st, 1);
      L.tagAufloesen(st);
    }
    assert.ok(st.ende.sieger === "r", "Wer nichts tut, verliert (" + riv + ")");
  }
});
