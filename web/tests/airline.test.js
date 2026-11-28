// Regeln von Luftlinie: node --test web/tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../airline/airline-logik.js");
const K = require("../airline/airline-karte.js");

function leer(opt) {
  // Spiel mit Rivalen, die nichts tun, damit Zahlen gut vergleichbar sind.
  const st = L.neuesSpiel(Object.assign({ seed: 1, basis: "frankfurt", service: "standard" }, opt));
  for (const id of ["k", "s", "a"]) st.airlines[id].stil = "ruhig";
  return st;
}
// Ein Slot-Ende für flugFinden: eine Stunde auf der eigenen Tafel oder der liegen gebliebene Slot am Flughafen.
const tafelEnde = (h) => ({ art: "tafel", h, preis: 0 });
function poolEnde(st, stadt, h) {
  const s = st.pool.find((x) => x.stadt === stadt);
  if (h != null) s.h = h;
  return { art: "pool", id: s.id, h: s.h, preis: L.slotGrundpreis(stadt, s.h) };
}
function flug(st, x, y, typ, h1, h2, opt) {
  const res = L.fliegen(st, "p", x, y, typ, Object.assign({ e1: tafelEnde(h1), e2: poolEnde(st, y, h2) }, opt));
  assert.ok(res.ok, "Flug " + x + "–" + y + ": " + res.grund);
  return res;
}

test("Start bei Null: kein Flugzeug, keine Linie, kein Slot, für alle gleich", () => {
  const st = L.neuesSpiel({ seed: 3, basis: "london" });
  for (const id of st.reihenfolge) {
    const a = st.airlines[id];
    assert.equal(a.flotte.length, 0, id);
    assert.equal(a.routen.length, 0, id);
    assert.equal(a.slots.length, 0, id);
    assert.equal(a.geschenk, 2, id);
    assert.equal(a.geld, L.REGELN.startGeld, id);
  }
  assert.equal(L.zielStand(st).id, "kaufen");
  assert.ok(L.ALLE.length > 90);
});

test("An jedem Flughafen liegt am Anfang genau ein freier Slot", () => {
  const st = L.neuesSpiel({ seed: 4, basis: "hamburg" });
  assert.equal(st.pool.length, L.ALLE.length);
  for (const c of L.ALLE) {
    const liste = L.poolIn(st, c.id);
    assert.equal(liste.length, 1, c.id);
    assert.equal(liste[0].bis, null);
    assert.ok(liste[0].h >= 5 && liste[0].h < 23.5);
  }
});

test("Rivalen sitzen in der Nähe der Heimat, jeder woanders", () => {
  for (const basis of ["paris", "athen", "helsinki"]) {
    const st = L.neuesSpiel({ seed: 3, basis });
    const orte = st.reihenfolge.map((id) => st.airlines[id].basis);
    assert.equal(new Set(orte).size, 4);
    for (const id of ["k", "s", "a"]) assert.ok(L.entfernung(basis, st.airlines[id].basis) < 3500, basis + " " + id);
  }
});

test("Heimat-Tafel: 19 Slots, zwei geschenkt, morgens und abends teurer", () => {
  const st = leer();
  const t = L.tafel(st, "p", "frankfurt");
  assert.equal(t.length, 19);
  assert.deepEqual([t[0].h, t[18].h], [5, 23]);
  assert.equal(L.zeitArt(8), "begehrt");
  assert.equal(L.zeitArt(13), "ruhig");
  assert.equal(L.zeitArt(23), "schwach");
  assert.ok(L.heimPreis("frankfurt", 8) > L.heimPreis("frankfurt", 13));
  assert.ok(L.heimPreis("frankfurt", 13) > L.heimPreis("frankfurt", 23));
  const geld = st.airlines.p.geld;
  assert.ok(L.heimSlotKaufen(st, "p", "frankfurt", 8).ok);
  assert.ok(L.heimSlotKaufen(st, "p", "frankfurt", 18).ok);
  assert.equal(st.airlines.p.geld, geld);                      // zwei geschenkt
  assert.equal(L.heimSlotKaufen(st, "p", "frankfurt", 9).preis, L.heimPreis("frankfurt", 9));
  assert.ok(!L.heimSlotKaufen(st, "p", "frankfurt", 9).ok);    // schon gekauft
  assert.ok(!L.heimSlotKaufen(st, "p", "london", 9).ok);       // nur zu Hause
  assert.ok(st.airlines.p.slots.every((s) => s.heim));
});

test("Ein Flug braucht an jedem Ende einen eigenen Slot und kauft das Flugzeug mit", () => {
  const st = leer();
  const p = st.airlines.p;
  const res = flug(st, "frankfurt", "rom", "falke", 8, 12);
  assert.equal(p.flotte.length, 1);
  assert.equal(p.routen.length, 1);
  assert.equal(p.fluege.length, 1);
  assert.equal(p.slots.length, 2);
  assert.equal(p.slots.filter((s) => s.stadt === "rom").length, 1);
  assert.equal(L.poolIn(st, "rom").length, 0);                 // der eine Slot in Rom ist weg
  assert.equal(res.kosten.flugzeug, L.TYPEN.falke.preis);
  assert.equal(p.geld, L.REGELN.startGeld - L.TYPEN.falke.preis - L.slotGrundpreis("rom", 12));
  // Ein zweiter Flug nach Rom geht nicht: kein Slot mehr da.
  assert.equal(L.flugFinden(st, "p", "frankfurt", "rom", "falke").grund, "slots");
});

test("Das Spiel rechnet Ankunft und Rückflug: 45 Minuten am Boden, sonst erst am nächsten Tag", () => {
  const st = leer();
  const p = st.airlines.p;
  const z = L.zeiten(p, "frankfurt", "rom", "falke", 8, 12);
  assert.ok(z.an > 9.3 && z.an < 10.3);                        // knapp 1.000 km, gleiche Zeitzone
  assert.equal(z.rueck, 12);
  assert.equal(z.tage, 1);
  assert.ok(z.passt);
  const knapp = L.zeiten(p, "frankfurt", "rom", "falke", 8, z.an + 0.5);
  assert.ok(knapp.rueck > 24);                                 // 30 Minuten reichen nicht
  // Zeitzonen: London liegt eine Stunde zurück.
  const lon = L.zeiten(p, "frankfurt", "london", "falke", 8, 12);
  assert.ok(lon.an < 9);
  // Langstrecke darf über Nacht und fliegt dann nur jeden zweiten Tag.
  st.stufe = 3;
  const lang = L.zeiten(p, "frankfurt", "singapur", "albatros", 10, 12);
  assert.ok(lang.passt);
  assert.equal(lang.tage, 2);
});

test("Ein Flugzeug fliegt mehrere Flüge am Tag, wenn die Zeiten passen", () => {
  const st = leer();
  const p = st.airlines.p;
  const a = flug(st, "frankfurt", "rom", "falke", 6, 9);
  const fid = a.flugzeug.id;
  // Überschneidung: 8 Uhr geht nicht mit demselben Flugzeug.
  assert.equal(L.flugFinden(st, "p", "frankfurt", "wien", "falke", { e1: tafelEnde(8), e2: poolEnde(st, "wien", 11), fid }).grund, "belegt");
  const b = flug(st, "frankfurt", "wien", "falke", 13, 15.5, { fid });
  assert.equal(b.flugzeug.id, fid);
  assert.equal(b.kosten.flugzeug, 0);
  assert.equal(p.flotte.length, 1);
  assert.equal(L.tagesplan(st, "p", fid).length, 2);
  assert.ok(L.auslastungFlugzeug(st, "p", fid) > 0.4);
  // Von selbst nimmt das Spiel das freie eigene Flugzeug.
  const c = L.flugFinden(st, "p", "frankfurt", "mailand", "falke", { e1: tafelEnde(18), e2: poolEnde(st, "mailand", 20) });
  assert.ok(c.ok && c.plan.fid === fid && c.kosten.frei);
});

test("Reichweite und Geld werden geprüft", () => {
  const st = leer();
  assert.equal(L.flugFinden(st, "p", "frankfurt", "newyork", "falke").grund, "reichweite");
  assert.equal(L.flugFinden(st, "p", "frankfurt", "rom", "albatros").grund, "gesperrt");
  st.airlines.p.geld = 100000;
  assert.equal(L.flugFinden(st, "p", "frankfurt", "rom", "falke").grund, "geld");
});

test("Flug streichen: Flugzeug bleibt, Slots bleiben bis zum Saisonende", () => {
  const st = leer();
  const p = st.airlines.p;
  const a = flug(st, "frankfurt", "rom", "falke", 8, 12);
  assert.ok(L.flugStreichen(st, "p", a.flug.id));
  assert.equal(p.routen.length, 0);
  assert.equal(p.flotte.length, 1);
  assert.equal(p.slots.length, 2);
  assert.equal(L.freieFlugzeuge(p).length, 1);
  const geld = p.geld;
  assert.ok(L.verkaufen(st, "p", p.flotte[0].id));
  assert.ok(p.geld > geld);
});

test("Nutzen oder verlieren: ungenutzter fremder Slot geht am Saisonende zurück, Heimat-Slots nie", () => {
  const st = leer();
  const p = st.airlines.p;
  const a = flug(st, "frankfurt", "rom", "falke", 8, 12);
  L.flugStreichen(st, "p", a.flug.id);
  const arten = [];
  for (let d = 1; d <= 7; d++) { L.vorruecken(st, 24); for (const m of st.meldungen.splice(0)) arten.push(m.art); }
  assert.ok(arten.includes("slotwarnung"));
  assert.ok(arten.includes("slotweg"));
  assert.equal(p.slots.filter((s) => !s.heim).length, 0);
  assert.equal(p.slots.filter((s) => s.heim).length, 1);
  const rom = L.poolIn(st, "rom");
  assert.ok(rom.some((s) => s.bis != null));                   // er wird neu ausgeschrieben
});

test("Bieten: ein Bieter zahlt den Grundpreis, sonst gewinnt das höchste Gebot", () => {
  const st = leer();
  const p = st.airlines.p, k = st.airlines.k;
  st.pool = st.pool.filter((s) => s.stadt !== "rom");
  const s = { id: "x1", stadt: "rom", h: 8, bis: st.zeit + 24, gebote: {}, ki: {} };
  st.pool.push(s);
  const gp = L.slotGrundpreis("rom", 8);
  assert.ok(L.bieten(st, "x1", gp + 200000));
  let geld = p.geld;
  L.vorruecken(st, 25);
  assert.ok(L.slotVon(p, "x1"));
  assert.equal(p.geld <= geld - gp && p.geld > geld - gp - 100000, true);   // nur der Grundpreis (plus Tagesabschluss)
  assert.equal(st.bietErgebnisse[0].preis, gp);
  // Zwei Bieter: das höhere Gebot gewinnt und wird voll bezahlt.
  const s2 = { id: "x2", stadt: "wien", h: 8, bis: st.zeit + 24, gebote: {}, ki: { k: gp + 300000 } };
  st.pool.push(s2);
  L.bieten(st, "x2", gp + 100000);
  L.vorruecken(st, 25);
  assert.ok(L.slotVon(k, "x2"));
  assert.equal(st.bietErgebnisse[1].sieger, "k");
  // Gleichstand: Wer dort weniger Slots hat, gewinnt.
  const g3 = L.slotGrundpreis("wien", 9) + 100000;
  const s3 = { id: "x3", stadt: "wien", h: 9, bis: st.zeit + 24, gebote: {}, ki: { k: g3 } };
  st.pool.push(s3);
  L.bieten(st, "x3", g3);
  L.vorruecken(st, 25);
  assert.ok(L.slotVon(p, "x3"));
});

test("Bieten geht in 10.000er-Schritten und nie unter dem Grundpreis", () => {
  const st = leer();
  const s = { id: "x1", stadt: "rom", h: 13, bis: st.zeit + 24, gebote: {}, ki: {} };
  st.pool.push(s);
  L.bieten(st, "x1", 1);
  assert.equal(s.gebote.p, L.slotGrundpreis("rom", 13));
  L.bieten(st, "x1", 234567);
  assert.equal(s.gebote.p, 230000);
  L.bieten(st, "x1", 0);
  assert.equal(s.gebote.p, undefined);
  assert.ok(!L.slotNehmen(st, "p", "x1").ok);                  // solange geboten wird, kann ihn keiner einfach nehmen
});

test("Flughäfen geben neue Slots frei, aber nie über ihre Obergrenze", () => {
  const st = leer();
  for (let d = 0; d < 30; d++) L.vorruecken(st, 24);
  for (const c of L.ALLE) assert.ok(L.slotZahl(st, c.id) <= L.REGELN.slotMax[c.k], c.id);
  // Wo der Slot weg ist, kommt ein neuer nach.
  const p = st.airlines.p;
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  let neu = false;
  for (let d = 0; d < 8 && !neu; d++) { L.vorruecken(st, 24); neu = L.poolIn(st, "rom").length > 0; }
  assert.ok(neu);
  assert.ok(p.fluege.length === 1);
});

test("Slot-Handel: Antwort kommt sofort, nach einem Nein zwei Tage Sperre", () => {
  const st = leer();
  const p = st.airlines.p, k = st.airlines.k;
  k.slots.push({ id: "h1", stadt: "rom", h: 8, seit: 0 });
  k.slots.push({ id: "h2", stadt: k.basis, h: 8, heim: true, seit: 0 });
  assert.equal(L.handelPruefen(st, "h2").grund, "heim");
  const h = L.handelPruefen(st, "h1");
  assert.ok(h.ok && h.wert > 0);
  const nein = L.handelAnbieten(st, "h1", h.wert - 20000);
  assert.equal(nein.grund, "nein");
  assert.equal(L.handelPruefen(st, "h1").grund, "sperre");
  L.vorruecken(st, 24 * 3);
  const geld = p.geld, kGeld = k.geld;
  const ja = L.handelAnbieten(st, "h1", h.wert);
  assert.ok(ja.ok);
  assert.ok(L.slotVon(p, "h1") && !L.slotVon(k, "h1"));
  assert.equal(p.geld, geld - h.wert);
  assert.equal(k.geld, kGeld + h.wert);
});

test("Slot-Handel: Tausch Slot gegen Slot zählt mit", () => {
  const st = leer();
  const p = st.airlines.p, k = st.airlines.k;
  k.slots.push({ id: "h1", stadt: "rom", h: 13, seit: 0 });
  p.slots.push({ id: "m1", stadt: "wien", h: 8, seit: 0 });
  const h = L.handelPruefen(st, "h1");
  const ja = L.handelAnbieten(st, "h1", Math.max(0, h.wert - L.slotGrundpreis("wien", 8) * 0.8), "m1");
  assert.ok(ja.ok);
  assert.ok(L.slotVon(k, "m1") && L.slotVon(p, "h1"));
});

test("Die Uhrzeit wirkt: morgens mehr Gäste als nachts", () => {
  const früh = leer(), spät = leer();
  flug(früh, "frankfurt", "rom", "falke", 8, 17);
  flug(spät, "frankfurt", "rom", "falke", 23, 5.5);
  const a = Object.values(L.rechnung(früh).routen)[0], b = Object.values(L.rechnung(spät).routen)[0];
  assert.ok(a.fluege[0].hin.dem.geschaeft > 1.8 * b.fluege[0].hin.dem.geschaeft);
  assert.ok(a.gewinn > b.gewinn);
});

test("Zwei Flüge kurz hintereinander nehmen sich Gäste weg", () => {
  const nah = leer(), fern = leer();
  for (const [st, h] of [[nah, 9], [fern, 17]]) {
    st.airlines.p.geld = 1e7;
    flug(st, "frankfurt", "rom", "falke", 8, 12);
    st.pool.push({ id: "z1", stadt: "rom", h: h + 4, bis: null, gebote: {} });
    const res = L.fliegen(st, "p", "frankfurt", "rom", "falke", { e1: tafelEnde(h), e2: { art: "pool", id: "z1", h: h + 4, preis: 0 }, neu: true });
    assert.ok(res.ok, res.grund);
  }
  const pax = (st) => Object.values(L.rechnung(st).routen)[0].fluege.reduce((s, f) => s + f.hin.dem.urlaub + f.hin.dem.geschaeft, 0);
  assert.ok(pax(fern) > pax(nah) * 1.1);
});

test("Jede Stadt hat nur so viele Reisende am Tag", () => {
  const st = leer();
  assert.ok(L.reisende(st, "london") > 3 * L.reisende(st, "venedig"));
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  const rg = L.rechnung(st);
  assert.ok(rg.staedte.rom.bedient <= rg.staedte.rom.reisende);
  assert.equal(rg.staedte.rom.faktor, 1);
  // Mit winziger Obergrenze teilen sich alle den Kuchen.
  const alt = L.REGELN.reisende;
  L.REGELN.reisende = 1;
  try {
    const eng = L.berechnen(st, L.tagVon(st));
    assert.ok(eng.staedte.rom.faktor < 1);
    assert.ok(eng.gaeste.p < rg.gaeste.p);
  } finally { L.REGELN.reisende = alt; }
});

test("Kabine gehört zum Flugzeug: Grenzen je Größe, Umbau kostet Geld und einen Tag", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.deepEqual(L.kabineGrenzen("libelle"), { business: 0, first: 0 });
  assert.ok(L.kabineGrenzen("falke").business > 0 && L.kabineGrenzen("falke").first === 0);
  assert.ok(L.kabineGrenzen("albatros").first > 0);
  const a = flug(st, "frankfurt", "london", "falke", 8, 11, { kabine: { business: 0, first: 0 } });
  const f = a.flugzeug;
  assert.deepEqual(f.kabine, { business: 0, first: 0 });
  const geld = p.geld;
  const u = L.kabineSetzen(st, "p", f.id, 0.2, 0);
  assert.ok(u.ok);
  assert.equal(p.geld, geld - L.umbauPreis("falke"));
  assert.equal(f.kabine.business, 0.2);
  L.vorruecken(st, 20);                                        // nächster Tag: Werkstatt
  assert.ok(L.inWerkstatt(st, f));
  assert.equal(Object.values(L.rechnung(st).routen)[0].fluege[0].freq, 0);
  L.vorruecken(st, 24);
  assert.ok(!L.inWerkstatt(st, f));
  assert.ok(Object.values(L.rechnung(st).routen)[0].klassen.business.sitze > 0);
});

test("Analyst empfiehlt beim Kauf Flugzeug und Kabine, ohne Analyst kein Rat", () => {
  const st = leer();
  const plan = { x: "frankfurt", y: "london", e1: tafelEnde(8), e2: poolEnde(st, "london", 11) };
  assert.equal(L.ratKauf(st, plan), null);
  L.einstellen(st, "p", "analyst", "kern");
  const rat = L.ratKauf(st, plan);
  assert.ok(L.TYPEN[rat.typ]);
  assert.ok(rat.kabine.business >= 0 && rat.kabine.business <= L.kabineGrenzen(rat.typ).business);
  assert.ok(rat.gewinn[0] <= rat.gewinn[1]);
  // Der Rat bleibt beim zweiten Blick derselbe.
  assert.deepEqual(L.ratKauf(st, plan).gewinn, rat.gewinn);
});

test("Analyst berät beim Bieten: Spanne für den Wert und wer mitbietet", () => {
  const st = leer();
  st.pool = st.pool.filter((s) => s.stadt !== "london");
  st.pool.push({ id: "x1", stadt: "london", h: 8, bis: st.zeit + 24, gebote: {}, ki: { k: 900000 } });
  assert.equal(L.ratSlot(st, "x1"), null);
  L.einstellen(st, "p", "analyst", "kern");
  const rat = L.ratSlot(st, "x1");
  assert.ok(rat.wert && rat.wert[0] <= rat.wert[1]);
  assert.ok(Array.isArray(rat.mit));
  assert.equal(rat.grundpreis, L.slotGrundpreis("london", 8));
});

test("Jede Einstellung zeigt ihre festen Tatsachen, der Analyst schätzt die Wirkung", () => {
  for (const g of Object.values(L.GRUNDSAETZE)) for (const o of Object.values(g.optionen)) assert.ok(o.fakt && o.fakt.length > 10);
  const st = leer();
  flug(st, "frankfurt", "london", "falke", 8, 11);
  assert.equal(L.ratGrundsatz(st, "essen"), null);
  L.einstellen(st, "p", "analyst", "mia");
  const rat = L.ratGrundsatz(st, "essen");
  assert.ok(rat.empfehlung);
  assert.ok(rat.optionen.keins.spanne[0] <= rat.optionen.keins.spanne[1]);
  const pr = L.ratPreis(st, st.airlines.p.routen[0].id);
  assert.ok(pr.optionen.angreifen.spanne);
});

test("Am nächsten Tag steht die echte Wirkung einer Änderung in den Meldungen", () => {
  const st = leer();
  flug(st, "frankfurt", "london", "falke", 8, 11);
  L.vorruecken(st, 24);
  st.meldungen.length = 0;
  L.grundsatzSetzen(st, "p", "koffer", "gebuehr");
  L.vorruecken(st, 24);
  const m = st.meldungen.find((x) => x.art === "wirkung");
  assert.ok(m, "Meldung fehlt");
  assert.match(m.text, /Koffer: Gebühr/);
  assert.match(m.text, /Gäste/);
});

test("Zeit: ein Tag bucht genau den Tagesgewinn", () => {
  const st = leer();
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  const p = st.airlines.p;
  L.vorruecken(st, 18);                                        // bis Mitternacht
  const geld = p.geld;
  const soll = L.rechnung(st).summe.p;
  L.vorruecken(st, 24);
  assert.ok(Math.abs(p.geld - geld - soll) < Math.abs(soll) * 0.02 + 50, `${p.geld - geld} statt ${soll}`);
});

test("Drehkreuz: Zubringer bringen Umsteiger", () => {
  const st = leer();
  st.airlines.p.geld = 2e7;
  flug(st, "frankfurt", "rom", "falke", 6, 9);
  flug(st, "frankfurt", "stockholm", "falke", 7, 11, { neu: true });
  const vorher = Object.values(L.rechnung(st).routen).reduce((s, e) => s + e.umsteigerPax, 0);
  assert.equal(vorher, 0);
  flug(st, "frankfurt", "london", "falke", 8, 11, { neu: true });
  const nachher = Object.values(L.rechnung(st).routen).reduce((s, e) => s + e.umsteigerPax, 0);
  assert.ok(nachher > 0);
});

test("Konkurrenz teilt die Gäste", () => {
  const st = leer();
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  const will = (e) => e.fluege.reduce((s, f) => s + f.hin.dem.urlaub + f.hin.dem.geschaeft, 0);
  const allein = will(Object.values(L.rechnung(st).routen)[0]);
  const k = st.airlines.k;
  k.geld = 1e7;
  k.slots.push({ id: "k1", stadt: "frankfurt", h: 8.5, seit: 0 }, { id: "k2", stadt: "rom", h: 12.5, seit: 0 });
  const res = L.fliegen(st, "k", "frankfurt", "rom", "falke", { e1: { art: "slot", id: "k1", h: 8.5, preis: 0 }, e2: { art: "slot", id: "k2", h: 12.5, preis: 0 } });
  assert.ok(res.ok, res.grund);
  const geteilt = will(L.rechnung(st).routen[st.airlines.p.routen[0].id]);
  assert.ok(geteilt < allein * 0.9);
});

test("Preisstufe ändert den Ticketpreis", () => {
  const st = leer();
  const r = flug(st, "frankfurt", "rom", "falke", 8, 12).route;
  const normal = L.rechnung(st).routen[r.id].preis;
  L.preisStufe(st, "p", r.id, "abschoepfen");
  assert.ok(L.rechnung(st).routen[r.id].preis > normal * 1.2);
  assert.equal(L.STUFEN.angreifen.kurz, "Billiger");
});

test("Jahreszeiten: Palma im Sommer gefragter als im Winter", () => {
  const st = leer();
  const sommer = L.grundNachfrage(st, "frankfurt", "palma", 8).urlaub;
  const winter = L.grundNachfrage(st, "frankfurt", "palma", 22).urlaub;
  assert.ok(sommer > winter * 1.3);
});

test("Pleite in drei Stufen: Mahnung, Kredit, Übernahme, dann Ende", () => {
  const st = leer();
  const p = st.airlines.p;
  p.geld = -100000;
  L.vorruecken(st, 24);
  assert.equal(st.pleite.stufe, 1);
  L.vorruecken(st, 48);
  assert.equal(st.pleite.stufe, 2);
  assert.ok(p.kredit > 0);
  p.geld = -100000;
  L.vorruecken(st, 24);
  assert.equal(st.pleite.stufe, 3);
  L.vorruecken(st, 24 * 4);
  assert.equal(st.ende.grund, "pleite");
});

test("Speichern und Laden ergibt denselben Stand, alte Stände beginnen neu", () => {
  const st = leer();
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  L.vorruecken(st, 30);
  const kopie = L.laden(JSON.stringify(st));
  assert.deepEqual(L.rechnung(kopie).summe, L.rechnung(st).summe);
  assert.equal(L.laden(JSON.stringify({ version: 2, airlines: {} })), null);
  assert.ok(L.istAlterStand(JSON.stringify({ version: 2, airlines: {} })));
  assert.ok(!L.istAlterStand(JSON.stringify(st)));
  assert.equal(L.laden("kaputt"), null);
});

test("Firmenwert schaltet größere Flugzeuge frei", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.ok(!L.typFrei(st, p, "a320"));
  p.geld = L.REGELN.stufe2Wert + 1;
  L.vorruecken(st, 24);
  assert.equal(st.stufe, 2);
  assert.ok(L.typFrei(st, p, "a320"));
});

test("Jeder Flugzeugtyp hat Gruppe, Stufe und echte Eckdaten", () => {
  for (const [id, t] of Object.entries(L.TYPEN)) {
    assert.ok(L.GRUPPEN[t.gruppe], id);
    assert.ok(t.stufe >= 1 && t.stufe <= 4, id);
    assert.ok(t.sitze > 0 && t.reichweite > 0 && t.kmh > 0 && t.preis > 0, id);
  }
});

test("Karte: alle Städte liegen im Bild", () => {
  for (const c of L.STAEDTE) {
    const [x, y] = K.projektion(c.lon, c.lat);
    assert.ok(x > 0 && x < K.B && y > 0 && y < K.H, c.name);
  }
  assert.ok(K.land.length > 10000);
  assert.ok(Math.abs(L.entfernung("frankfurt", "london") - 650) < 60);
});

test("Grundsatz verschlechtern kostet Ruf, verbessern nicht", () => {
  const st = leer();
  const p = st.airlines.p;
  const ruf = p.ruf;
  L.grundsatzSetzen(st, "p", "essen", "gourmet");
  assert.equal(p.ruf, ruf);
  L.grundsatzSetzen(st, "p", "essen", "keins");
  assert.ok(p.ruf < ruf);
});

test("Bei gleichem Preis gewinnt die bessere Qualität, gutes Essen kostet", () => {
  const st = leer();
  const p = st.airlines.p;
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  const r = p.routen[0];
  const vorher = L.rechnung(st).routen[r.id];
  L.grundsatzSetzen(st, "p", "essen", "gourmet");
  const nachher = L.rechnung(st).routen[r.id];
  assert.ok(nachher.service > vorher.service);
  assert.ok(L.profil(p).sterne >= 3);
});

test("Ein Assistent für alles: eine Person, drei zur Wahl, ein Gehalt", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.equal(Object.keys(L.ASSISTENTEN).length, 3);
  assert.equal(L.assistent(p), null);
  assert.ok(L.einstellen(st, "p", "mia"));
  for (const rolle of [undefined, "analyst", "preis", "controller"]) assert.equal(L.assistent(p, rolle).id, "mia");
  assert.equal(L.gehaelter(p), L.ASSISTENTEN.mia.gehalt);
  assert.ok(L.einstellen(st, "p", "kern"));                    // wechseln ersetzt, es gibt nie zwei
  assert.equal(L.gehaelter(p), L.ASSISTENTEN.kern.gehalt);
  assert.ok(!L.einstellen(st, "p", "paul"));                   // die alten Rollen gibt es nicht mehr
  assert.ok(L.einstellen(st, "p", null));
  assert.equal(L.gehaelter(p), 0);
  const g = Object.values(L.ASSISTENTEN).map((x) => x.gehalt);
  assert.ok(g[0] < g[1] && g[1] < g[2]);
});

test("Alter Spielstand mit drei Rollen: der Beste bleibt, nur ein Gehalt", () => {
  const st = leer();
  st.airlines.p.assistenten = { controller: "ines", preis: "paul", analyst: null };
  const neu = L.laden(JSON.stringify(st));
  assert.equal(L.assistent(neu.airlines.p).id, "kern");
  assert.equal(L.gehaelter(neu.airlines.p), L.ASSISTENTEN.kern.gehalt);
});

test("Rivale auf deiner Strecke startet einen Preiskampf", () => {
  const st = leer();
  st.zeit = 24 * 13 + 6;
  const s = st.airlines.s;
  const r = flug(st, "frankfurt", s.basis, "falke", 8, 12).route;
  s.geld = 1e8;
  st.pool.push({ id: "n1", stadt: s.basis, h: 15, bis: null, gebote: {} });   // der Rivale nimmt in Frankfurt den einen freien Slot
  const t = L.flugFinden(st, "s", s.basis, "frankfurt", "falke");
  assert.ok(t.ok, t.grund);
  assert.equal(t.plan.e2.art, "pool");                         // an der Heimat des Spielers hat der Rivale keine Tafel
  assert.ok(L.kiFliegen(st, "s", t.plan).ok);
  assert.equal(r.duell.gegen, "s");
  assert.equal(L.vergleich(st, r.id).length, 2);
});

test("Zweites Drehkreuz: eigene Tafel mit zehn Slots", () => {
  const st = leer();
  const p = st.airlines.p;
  p.geld = 5e7;
  flug(st, "frankfurt", "rom", "falke", 6, 9);
  for (const [ziel, h] of [["wien", 8], ["madrid", 12], ["athen", 16]]) {
    st.pool.push({ id: "r" + ziel, stadt: "rom", h, bis: null, gebote: {} });
    const res = L.fliegen(st, "p", "rom", ziel, "falke", { e1: { art: "pool", id: "r" + ziel, h, preis: 0 }, neu: true });
    assert.ok(res.ok, ziel + " " + res.grund);
  }
  assert.ok(L.kannAusbauen(st, "p", "rom"));
  assert.ok(L.drehkreuzAusbauen(st, "p", "rom").ok);
  assert.ok(L.hatTafel(p, "rom"));
  const t = L.tafel(st, "p", "rom");
  assert.equal(t.length, 10);
  assert.ok(L.heimSlotKaufen(st, "p", "rom", 11).ok);
  assert.ok(p.slots.filter((s) => s.stadt === "rom").length >= 5);   // die alten Slots bleiben
});

test("Sicher oder Risiko: sicher kostet sofort", () => {
  const st = leer();
  flug(st, "frankfurt", "rom", "falke", 8, 12);
  st.gelegenheiten.push({ id: "w1", art: "wahl", typ: "kerosin", preis: 100000, bis: st.zeit + 10, dauer: 10 });
  const geld = st.airlines.p.geld;
  assert.ok(L.wahlTreffen(st, "w1", true));
  assert.equal(st.airlines.p.geld, geld - 100000);
});

test("Rivalen kaufen Slots, bieten mit und bauen aus; es gibt keine Versteigerung und keine Gebrauchten mehr", () => {
  const st = L.neuesSpiel({ seed: 9, basis: "frankfurt" });
  st.airlines.p.stil = "bot";
  const arten = new Set(), gel = new Set();
  for (let d = 0; d < 45; d++) {
    L.kiTag(st, "p");
    L.vorruecken(st, 24);
    for (const m of st.meldungen.splice(0)) arten.add(m.art);
    for (const g of st.gelegenheiten) gel.add(g.art);
  }
  assert.ok(!st.ende);
  for (const id of st.reihenfolge) {
    const a = st.airlines[id];
    assert.ok(a.fluege.length >= 2, id + " fliegt kaum");
    for (const F of a.fluege) { assert.ok(L.slotVon(a, F.s1) && L.slotVon(a, F.s2), id); assert.ok(L.zeitenVon(a, F).passt, id); }
    // Kein Slot wird doppelt benutzt, kein Flugzeug ist zur selben Zeit zweimal unterwegs.
    const benutzt = a.fluege.flatMap((F) => [F.s1, F.s2]);
    assert.equal(new Set(benutzt).size, benutzt.length, id);
    for (const f of a.flotte) {
      const plan = L.tagesplan(st, id, f.id);
      for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) {
        const x = plan[i].z, y = plan[j].z;
        assert.ok(y.ab >= x.ab + x.dauer - 1e-6 || x.ab >= y.ab + y.dauer - 1e-6 || x.dauer > 24, id + " Überschneidung");
      }
    }
  }
  assert.ok(arten.has("saison"));
  assert.ok(arten.has("plan"));
  for (const art of ["versteigerung", "gebraucht", "aufkauf"]) assert.ok(!gel.has(art), art);
});

test("Spätes Spiel: Verwaltung, Werbung, Umrüsten, Controlling, späte Ziele", () => {
  const st = leer();
  const p = st.airlines.p;
  assert.equal(L.verwaltungKosten(p, 8), 0);
  assert.ok(L.verwaltungKosten(p, 20) > 2 * L.verwaltungKosten(p, 14));
  p.geld = 5e7;
  p.ruf = 70;
  assert.ok(L.werbung(st, "p").ok);
  assert.equal(p.ruf, 76);
  const r = flug(st, "frankfurt", "stuttgart", "libelle", 8, 10).route;
  const geldVor = p.geld;
  assert.ok(L.umruesten(st, "p", r.id, "falke").ok);
  assert.equal(L.flugzeugeAuf(p, r.id)[0].typ, "falke");
  assert.ok(p.geld < geldVor && p.flotte.length === 1);
  assert.ok(!L.umruesten(st, "p", r.id, "libelle").ok);
  p.stil = "bot";
  for (let d = 1; d <= 14; d++) { L.kiTag(st, "p"); L.vorruecken(st, 24); }
  assert.ok(!p.wochenbericht);
  L.einstellen(st, "p", "kern");
  for (let d = 1; d <= 7; d++) L.vorruecken(st, 24);
  assert.ok(p.wochenbericht && p.wochenbericht.schwach.length >= 1);
  assert.ok(Array.isArray(p.wochenbericht.neu) && p.wochenbericht.neu.length <= 2);
  assert.ok(Array.isArray(p.hinweise) && p.hinweise.length <= 3);
  st.ziel = L.ZIELE.length;
  assert.match(L.zielStand(st).text, /rote Linie/);
  st.ziel = L.ZIELE.length + 1;
  assert.match(L.zielStand(st).text, /Firmenwert/);
});

test("Start: drei Vorschläge mit fertigem Plan, Rennen zählt nur Linien im Plus", () => {
  const st = L.neuesSpiel({ seed: 5, basis: "hamburg" });
  const an = L.angebote(st, "p");
  assert.equal(an.length, 3);
  assert.equal(new Set(an.map((o) => o.ziel)).size, 3);
  for (const o of an) {
    assert.ok(o.gesamt <= st.airlines.p.geld);
    assert.ok(o.von <= o.bis);
    assert.ok(o.plan.e1 && o.plan.e2);
  }
  const res = L.flugAnlegen(st, "p", an[0].plan);
  assert.ok(res.ok);
  st.rennen = { art: "plus", soll: 1 };
  assert.equal(L.rennenStand(st, "p"), 1);
  assert.equal(L.rennenStand(st, "k"), 0);
});

test("Pleite eines Rivalen: Seine Slots werden frei, Flugzeuge gibt es nicht zu kaufen", () => {
  const st = leer();
  st.zeit = 24 * 31 + 6;
  const k = st.airlines.k;
  k.slots.push({ id: "k1", stadt: "rom", h: 8, seit: 0 }, { id: "k2", stadt: k.basis, h: 8, heim: true, seit: 0 });
  k.flotte.push({ id: "kf1", typ: "falke", ort: null, kabine: { business: 0, first: 0 } });
  k.geld = -5e6;
  st.pool = st.pool.filter((s) => s.stadt !== "rom");
  const arten = [];
  for (let d = 0; d < 6; d++) { L.vorruecken(st, 24); for (const m of st.meldungen.splice(0)) arten.push(m.art); }
  assert.ok(arten.includes("pleite"));
  assert.equal(k.flotte.length, 0);
  assert.ok(!st.gelegenheiten.some((g) => g.art === "aufkauf" || g.art === "gebraucht"));
  assert.ok(st.pool.some((s) => s.stadt === "rom") || st.reihenfolge.some((id) => st.airlines[id].slots.some((s) => s.id !== "k1" && s.stadt === "rom")));
});

test("Rivalen: drei Stufen, gleiche Regeln, spürbar verschieden", () => {
  assert.deepEqual(Object.keys(L.GEGNER), ["leicht", "mittel", "schwer"]);
  assert.equal(L.neuesSpiel({ seed: 1 }).gegner, "mittel");
  const wert = {};
  for (const gegner of ["leicht", "schwer"]) {
    wert[gegner] = 0;
    for (let i = 0; i < 4; i++) {
      const st = L.neuesSpiel({ seed: 500 + i, basis: "hamburg", gegner });
      // Gleiches Startgeld für alle, auf jeder Stufe.
      for (const id of ["k", "s", "a"]) assert.equal(st.airlines[id].geld, st.airlines.p.geld);
      for (let d = 0; d < 45; d++) L.vorruecken(st, 24);
      wert[gegner] += ["k", "s", "a"].reduce((s, id) => s + L.firmenwert(st, id), 0);
    }
  }
  assert.ok(wert.schwer > wert.leicht * 1.3, `Profis ${Math.round(wert.schwer / 1e6)} Mio, Anfänger ${Math.round(wert.leicht / 1e6)} Mio`);
});

test("Rivalen: Wer überboten wird, ärgert sich und verlangt beim Handel mehr", () => {
  const st = L.neuesSpiel({ seed: 7, basis: "hamburg", gegner: "schwer" });
  assert.equal(L.laune(st, "k").art, "normal");
  const s = st.pool.find((x) => !L.hatTafel(st.airlines.k, x.stadt) && !L.hatTafel(st.airlines.p, x.stadt));
  s.bis = st.zeit + 24; s.gebote = { p: 900000 }; s.ki = { k: 200000 };
  const w = L.poolAuswerten(st, s);
  assert.equal(w.aid, "p");
  assert.equal(L.laune(st, "k").art, "groll");
  assert.ok(st.meldungen.some((m) => /ärgert sich/.test(m.text)));
  // Der Ärger verraucht mit der Zeit.
  for (let d = 0; d < 12; d++) L.kiTag(st, "k");
  assert.notEqual(L.laune(st, "k").art, "groll");
});

test("Manager-Profil: Name, Geschlecht, Aussehen; alte Stände laufen ohne Profil weiter", () => {
  const st = L.neuesSpiel({ seed: 2, basis: "frankfurt", manager: { name: "  Florian   Horn ", geschlecht: "mann", aussehen: "mann-3" } });
  assert.deepEqual(st.manager, { name: "Florian Horn", geschlecht: "mann", aussehen: "mann-3" });
  assert.equal(L.anrede(st.manager), "Herr Horn");
  assert.equal(L.anrede({ name: "Anna Weber", geschlecht: "frau", aussehen: "frau-1" }), "Frau Weber");
  assert.equal(L.anrede({ name: "Kim Lee", geschlecht: "divers", aussehen: "frau-1" }), "Kim Lee");
  // Aussehen passt immer zum Geschlecht, ohne Namen gibt es kein Profil.
  assert.equal(L.managerPruefen({ name: "Eva", geschlecht: "frau", aussehen: "mann-2" }).aussehen, "frau-1");
  assert.equal(L.managerPruefen({ name: "  ", geschlecht: "frau" }), null);
  assert.equal(L.aussehenFuer("divers").length, L.AUSSEHEN.length);
  // Später änderbar.
  assert.ok(L.managerSetzen(st, { name: "Eva Horn", geschlecht: "frau", aussehen: "frau-4" }));
  assert.equal(L.anrede(st.manager), "Frau Horn");
  assert.equal(L.managerSetzen(st, { name: "" }), false);
  assert.equal(st.manager.name, "Eva Horn");
  // Speichern und Laden behält das Profil; ein Stand ohne Profil lädt trotzdem.
  assert.deepEqual(L.laden(JSON.stringify(st)).manager, st.manager);
  const alt = L.neuesSpiel({ seed: 2 }); delete alt.manager;
  const geladen = L.laden(JSON.stringify(alt));
  assert.ok(geladen);
  assert.equal(geladen.manager, null);
});

test("Start nur in Europa: Heimat des Spielers und der Rivalen", () => {
  assert.ok(L.HEIMAT.length >= 10);
  for (const id of L.HEIMAT) assert.equal(L.STADT[id].r, "europa", id);
  for (const basis of L.HEIMAT) {
    const st = L.neuesSpiel({ seed: 11, basis });
    for (const id of ["k", "s", "a"]) assert.equal(L.STADT[st.airlines[id].basis].r, "europa", basis + " " + id);
  }
  // Die Welt bleibt als Ziel im Spiel.
  assert.ok(L.ALLE.some((c) => c.r !== "europa"));
});

test("Echte Heimat-Airline: Spieler und Rivalen heißen wie die Airline ihres Startflughafens", () => {
  for (const id of L.HEIMAT) assert.ok(L.heimAirline(id), "Airline fehlt für " + id);
  const namen = Object.values(L.HEIM_AIRLINE).map((a) => a.name);
  assert.equal(new Set(namen).size, namen.length, "jede Airline nur einmal");
  assert.equal(L.neuesSpiel({ seed: 1, basis: "frankfurt" }).airlines.p.name, "Lufthansa");
  assert.equal(L.neuesSpiel({ seed: 1, basis: "paris" }).airlines.p.name, "Air France");
  for (const basis of L.HEIMAT) {
    const st = L.neuesSpiel({ seed: 2, basis });
    const alle = st.reihenfolge.map((id) => st.airlines[id]);
    for (const a of alle) assert.equal(a.name, L.heimAirline(a.basis).name, basis + " " + a.id);
    assert.equal(new Set(alle.map((a) => a.name)).size, 4);
  }
  // Der Name bleibt änderbar.
  const st = L.neuesSpiel({ seed: 1, basis: "wien" });
  L.umbenennen(st, "p", "Donauflug");
  assert.equal(st.airlines.p.name, "Donauflug");
});

test("Enge Sitze plus Gourmet-Essen ist kein Trick mehr: gutes Essen wirkt in enger Kabine nur halb", () => {
  const a = { grundsaetze: { ...L.VORLAGEN.standard, sitz: "eng", essen: "gourmet" } };
  const b = { grundsaetze: { ...L.VORLAGEN.standard, sitz: "normal", essen: "gourmet" } };
  assert.ok(L.profil(a).komfort < L.profil(b).komfort - 1.5);
  assert.ok(L.GRUNDSAETZE.essen.optionen.gourmet.kosten >= 25, "Gourmet kostet wie in echt");
  assert.ok(L.GRUNDSAETZE.sitz.optionen.eng.sitze <= 1.2, "eng heißt etwa 15 % mehr Sitze, nicht 30 %");
});

test("Startvorschläge: die große Chance verspricht am meisten, Zahlen pro Tag", () => {
  for (const basis of ["london", "hamburg", "wien"]) {
    const a = L.angebote(L.neuesSpiel({ seed: 1, basis }), "p");
    const mitte = (o) => (o.von + o.bis) / 2;
    const ch = a.find((o) => o.art === "chance"), dr = a.find((o) => o.art === "drehkreuz");
    assert.ok(mitte(ch) >= mitte(dr), basis);
    assert.ok(ch.bis < 200000, "pro Tag, nicht pro Woche");
  }
});

test("Rangliste zählt erst ab Woche 2, ein neues Flugzeug zählt erst voll", () => {
  const st = leer();
  flug(st, "frankfurt", "paris", "falke", 7, 11);
  const p = st.airlines.p, f = p.flotte[0];
  const neu = L.firmenwert(st, "p");
  st.zeit += 24 * 60;
  assert.ok(L.firmenwert(st, "p") < neu - L.TYPEN.falke.preis * 0.3, "Flugzeug verliert über zwei Monate an Wert");
  assert.equal(f.seit, 1);
  assert.ok(L.REGELN.rangAb >= 7);
});

test("Rivalen fliegen deine Strecken nach (Preiskampf) und können pleitegehen", () => {
  let duelle = 0, pleiten = 0;
  for (const seed of [2, 3]) {
    const st = L.neuesSpiel({ seed, basis: "london", gegner: "schwer" });
    st.airlines.p.stil = "bot";
    for (let d = 1; d <= 80; d++) {
      if (d === 1) for (let i = 0; i < 3; i++) L.kiAusbauen(st, "p", { start: true });
      else L.kiTag(st, "p");
      const m0 = st.meldungen.length;
      L.vorruecken(st, 24);
      for (const m of st.meldungen.slice(m0)) { if (m.art === "duell") duelle++; if (m.art === "pleite") pleiten++; }
    }
  }
  assert.ok(duelle >= 1, "mindestens ein Preiskampf in zwei Partien");
  assert.ok(pleiten <= 3);
});

test("Der Analyst schätzt Linien der Rivalen als Spanne", () => {
  const st = L.neuesSpiel({ seed: 2, basis: "london" });
  for (let d = 0; d < 20; d++) L.vorruecken(st, 24);
  const k = st.airlines.k;
  assert.ok(k.routen.length > 0);
  L.einstellen(st, "p", "analyst", "kern");
  const e = L.rivalenEinschaetzung(st, "k", k.routen[0].id, L.assistent(st.airlines.p, "analyst"));
  assert.ok(e.gewinn[0] <= e.gewinn[1]);
});

test("Sofortkauf: Slot zur Wunschzeit, teurer, und der Flughafen gibt seinen nächsten Slot später heraus", () => {
  const st = leer();
  const p = st.airlines.p;
  const c = L.STADT.paris;
  st.pool = st.pool.filter((s) => s.stadt !== "paris");
  st.slotUhr = { paris: 2 };
  assert.ok(L.sofortStatus(st, "p", "paris").ok);
  const preis = L.sofortPreis("paris", 13);
  assert.equal(preis, Math.round(L.slotGrundpreis("paris", 13) * L.REGELN.sofortFaktor / 10000) * 10000);
  const vorher = p.geld;
  const r = L.fliegen(st, "p", "frankfurt", "paris", "dash8", { e1: tafelEnde(7), e2: { art: "sofort", h: 13, preis } });
  assert.ok(r.ok, r.grund);
  assert.equal(vorher - p.geld, preis + L.TYPEN.dash8.preis);
  assert.ok(p.slots.some((s) => s.stadt === "paris" && s.h === 13));
  // Der reguläre Nachschub rückt einen Takt nach hinten, ein zweiter Sofortkauf geht erst später.
  assert.equal(st.slotUhr.paris, 2 + L.REGELN.slotTakt[c.k]);
  const zweit = L.sofortStatus(st, "p", "paris");
  assert.equal(zweit.ok, false);
  assert.equal(zweit.grund, "warten");
  // Läuft eine Vergabe, wird geboten statt sofort gekauft; an der eigenen Heimat gibt es die Tafel.
  const st2 = leer();
  st2.pool = st2.pool.filter((s) => s.stadt !== "wien");
  const s = { id: "x1", stadt: "wien", h: 10, bis: st2.zeit + 24, gebote: {} };
  st2.pool.push(s);
  assert.equal(L.sofortStatus(st2, "p", "wien").grund, "bieten");
  assert.equal(L.sofortStatus(st2, "p", "frankfurt").grund, "tafel");
  // Rivalen und die normale Suche sehen keinen Sofortkauf.
  assert.ok(!L.enden(st2, st2.airlines.k, "paris").some((e) => e.art === "sofort"));
});

test("Sofortkauf: nie über die Obergrenze eines Flughafens", () => {
  const st = leer();
  const c = L.STADT.paris;
  st.pool = st.pool.filter((s) => s.stadt !== "paris");
  const k = st.airlines.k;
  for (let i = 0; i < L.REGELN.slotMax[c.k]; i++) k.slots.push({ id: "v" + i, stadt: "paris", h: 5 + i * 0.9, seit: 0 });
  assert.equal(L.sofortStatus(st, "p", "paris").grund, "voll");
});
