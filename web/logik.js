// Spiellogik von "Die Fahrenden" für die Web-Version.
// Gleiche Regeln wie GameCore (Swift), damit App und Web gleich spielen.
// Kein Zugriff auf die Seite: alles hier lässt sich mit `node --test` prüfen.
(function (root) {
  "use strict";

  const MASK = (1n << 64n) - 1n;

  // Zufall mit Startwert (SplitMix64), wie SeededRandom in Swift.
  function neuerZufall(seed) {
    let s = BigInt.asUintN(64, BigInt(seed));
    if (s === 0n) s = 0x9e3779b97f4a7c15n;
    return { state: s.toString() };
  }

  function naechste(rng) {
    let state = (BigInt(rng.state) + 0x9e3779b97f4a7c15n) & MASK;
    rng.state = state.toString();
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  }

  function einheit(rng) {
    return Number(naechste(rng) >> 11n) / 2 ** 53;
  }

  function zufallsIndex(rng, anzahl) {
    return Number(naechste(rng) % BigInt(anzahl));
  }

  // ---------- Grunddaten ----------

  const RISKANT = new Set(["acrobatics", "fire", "animals"]);
  const BRETTER = { village: 3, market: 5, castle: 4, monastery: 3 };
  const ORTSART = { village: "Dorf", market: "Markt", castle: "Burg", monastery: "Kloster" };
  const GEFUEHL = { tension: "Spannung", humor: "Humor", wonder: "Staunen", heart: "Herz" };
  const DISZIPLIN = {
    acrobatics: "Akrobatik", foolery: "Narretei", animals: "Tiere", juggling: "Gaukelei",
    music: "Musik", fire: "Feuer", story: "Erzählung",
  };
  const START_STIMMUNG = 20;
  const ESSEN_PRO_TAG = 1;
  const HOLZ_PRO_NACHT = 1;
  const HANDEL = { food: { preis: 3, menge: 5 }, wood: { preis: 2, menge: 3 } };

  function begrenzen(r) {
    r.food = Math.max(0, r.food);
    r.coins = Math.max(0, r.coins);
    r.wood = Math.max(0, r.wood);
    r.morale = Math.min(100, Math.max(0, r.morale));
    return r;
  }

  function mitgliedAnlegen(m) {
    return Object.assign({ health: 100, fatigue: 0, isAlive: true, isSick: false }, JSON.parse(JSON.stringify(m)));
  }

  function gesundheitAendern(m, betrag) {
    if (!m.isAlive) return;
    m.health = Math.min(100, Math.max(0, m.health + betrag));
    if (m.health === 0) m.isAlive = false;
  }

  // ---------- Welt ----------

  function welt(daten) {
    const w = daten;
    w.ort = (id) => w.places.find((p) => p.id === id);
    w.region = (id) => w.regions.find((r) => r.id === id);
    w.orteIn = (id) => w.places.filter((p) => p.region === id);
    w.weg = (a, b) => w.roads.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));
    w.nachbarn = (id) => w.roads.flatMap((r) => (r.from === id ? [r.to] : r.to === id ? [r.from] : []));
    w.ereignis = (id) => w.events.find((e) => e.id === id);
    return w;
  }

  function pruefen(w) {
    const probleme = [];
    const orte = new Set(w.places.map((p) => p.id));
    const regionen = new Set(w.regions.map((r) => r.id));
    const leute = new Set(w.troupe.concat(w.recruits).map((m) => m.id));
    if (!orte.has(w.start.place)) probleme.push("Startort fehlt");
    for (const p of w.places) {
      if (!regionen.has(p.region)) probleme.push(`Ort ${p.id}: Region fehlt`);
      if (p.position.x < 0 || p.position.x > 1 || p.position.y < 0 || p.position.y > 1) probleme.push(`Ort ${p.id}: Position außerhalb 0–1`);
    }
    for (const r of w.roads) {
      if (!orte.has(r.from) || !orte.has(r.to)) probleme.push(`Weg ${r.from}–${r.to}: Ort fehlt`);
      if (r.days < 1) probleme.push(`Weg ${r.from}–${r.to}: mindestens 1 Tag`);
    }
    for (const e of w.events) {
      if (!e.options.length) probleme.push(`Ereignis ${e.id} ohne Optionen`);
      if (e.needsMember && !leute.has(e.needsMember)) probleme.push(`Ereignis ${e.id}: Mitglied fehlt`);
      for (const o of e.options) {
        for (const m of [o.effect.recruit, o.effect.removeMember, o.effect.makeSick]) {
          if (m && !leute.has(m)) probleme.push(`Ereignis ${e.id}: Mitglied ${m} fehlt`);
        }
      }
    }
    return probleme;
  }

  // ---------- Vorstellung ----------

  function darfAuftreten(m, ort) {
    return m.isAlive && !ort.banned.includes(m.discipline);
  }

  function staerke(m, moral) {
    const basis = 6 + m.skill * 4;
    const zustand = (m.health / 100) * (1 - m.fatigue / 200);
    const geist = 0.75 + moral / 400;
    return basis * zustand * geist;
  }

  function faktor(gefuehl, vorher, ort) {
    let f = ort.likes.includes(gefuehl) ? 1.5 : 0.9;
    const letzte = vorher[vorher.length - 1];
    const vorletzte = vorher[vorher.length - 2];
    if (letzte === gefuehl) {
      if (vorletzte === gefuehl) return -0.5;
      f *= 0.5;
    }
    if (gefuehl === "tension" && letzte === "heart") f *= 1.4;
    return f;
  }

  const stimmungBegrenzen = (v) => Math.min(100, Math.max(0, v));

  function erwarteteKurve(programm, ort, moral) {
    let stimmung = START_STIMMUNG;
    const kurve = [stimmung];
    const gefuehle = [];
    for (const m of programm) {
      stimmung = stimmungBegrenzen(stimmung + staerke(m, moral) * faktor(m.feeling, gefuehle, ort));
      kurve.push(stimmung);
      gefuehle.push(m.feeling);
    }
    return kurve;
  }

  function wertung(stimmungen) {
    if (!stimmungen.length) return 0;
    let summe = 0, gewichte = 0;
    stimmungen.forEach((s, i) => {
      const g = i === 0 || i === stimmungen.length - 1 ? 2 : 1;
      summe += s * g;
      gewichte += g;
    });
    return Math.round(0.6 * (summe / gewichte) + 0.4 * stimmungen[stimmungen.length - 1]);
  }

  const ganz = (x) => Math.trunc(x);

  function lohn(punkte, ort) {
    const s = ganz(punkte);
    const moral = ganz((s - 50) / 5);
    switch (ort.kind) {
      case "village": return { food: 2 + ganz(s / 5), coins: ganz(s / 25), wood: ganz(s / 30), morale: moral };
      case "market": return { food: ganz(s / 10), coins: 2 + ganz(s / 4), wood: 0, morale: moral };
      case "castle": return { food: ganz(s / 12), coins: 4 + ganz(s / 3), wood: ganz(s / 25), morale: moral };
      default: return { food: 4 + ganz(s / 8), coins: 0, wood: ganz(s / 20), morale: moral };
    }
  }

  function vorstellungSpielen(programm, ort, moral, rng) {
    let stimmung = START_STIMMUNG;
    const gefuehle = [];
    const nummern = [];
    for (const m of programm) {
      const st = staerke(m, moral);
      let delta = st * faktor(m.feeling, gefuehle, ort);
      let panne = false;
      const pannenChance = (RISKANT.has(m.discipline) ? 0.1 : 0.03) + m.fatigue / 400 + (100 - m.health) / 400;
      if (einheit(rng) < pannenChance) {
        panne = true;
        delta = -st * 0.6;
      } else if (RISKANT.has(m.discipline)) {
        delta *= 0.5 + einheit(rng);
      } else {
        delta *= 0.85 + einheit(rng) * 0.3;
      }
      stimmung = stimmungBegrenzen(stimmung + delta);
      nummern.push({ memberID: m.id, delta, mood: stimmung, mishap: panne });
      gefuehle.push(m.feeling);
    }
    const punkte = wertung(nummern.map((n) => n.mood));
    return {
      acts: nummern,
      score: punkte,
      reward: lohn(punkte, ort),
      healing: ort.kind === "monastery" ? ganz(punkte / 5) : 0,
      curve: [START_STIMMUNG].concat(nummern.map((n) => n.mood)),
    };
  }

  // ---------- Spielstand ----------

  function neuesSpiel(w, seed) {
    return {
      day: 1,
      location: w.start.place,
      resources: Object.assign({}, w.start.resources),
      troupe: w.troupe.map(mitgliedAnlegen),
      seenEvents: [],
      visits: { [w.start.place]: 1 },
      rng: neuerZufall(seed),
    };
  }

  const lebende = (s) => s.troupe.filter((m) => m.isAlive);
  const mitglied = (s, id) => s.troupe.find((m) => m.id === id);
  const spielVorbei = (s) => lebende(s).length === 0 || s.resources.morale <= 0;
  const jahreszeit = (s) => ["Frühling", "Sommer", "Herbst", "Winter"][Math.floor((s.day - 1) / 30) % 4];

  function allenGesundheit(s, betrag) {
    for (const m of s.troupe) gesundheitAendern(m, betrag);
  }

  function zufallsLebender(s, bedingung) {
    const kandidaten = s.troupe.filter((m) => m.isAlive && (!bedingung || bedingung(m)));
    if (!kandidaten.length) return null;
    return kandidaten[zufallsIndex(s.rng, kandidaten.length)];
  }

  function kannPassieren(s, e) {
    if (!e.repeatable && s.seenEvents.includes(e.id)) return false;
    if (e.needsMember) {
      const m = mitglied(s, e.needsMember);
      return !!(m && m.isAlive);
    }
    return true;
  }

  function ereignisWaehlen(s, weg, w) {
    const offen = w.events.filter((e) => kannPassieren(s, e));
    if (s.resources.food === 0) {
      const hunger = offen.find((e) => e.trigger === "hunger");
      if (hunger) return hunger;
    }
    if (weg.kind === "forest" && einheit(s.rng) < 0.6) {
      const wald = offen.filter((e) => e.trigger === "forest");
      if (wald.length) return wald[zufallsIndex(s.rng, wald.length)];
    }
    if (einheit(s.rng) < 0.45) {
      const reise = offen.filter((e) => e.trigger === "travel");
      if (reise.length) return reise[zufallsIndex(s.rng, reise.length)];
    }
    return null;
  }

  function reisen(s, ziel, w) {
    if (!w.ort(ziel)) throw new Error("unbekannter Ort");
    const weg = w.weg(s.location, ziel);
    if (!weg) throw new Error("kein Weg");
    const bericht = {
      from: s.location, to: ziel, days: weg.days, foodEaten: 0, woodBurned: 0,
      hungryDays: 0, coldDays: 0, fellSick: [], deaths: [], event: null,
    };
    const lebendVorher = new Set(lebende(s).map((m) => m.id));
    for (let t = 0; t < weg.days; t++) {
      s.day += 1;
      const muender = lebende(s).length * ESSEN_PRO_TAG;
      if (s.resources.food >= muender) {
        s.resources.food -= muender;
        bericht.foodEaten += muender;
      } else {
        bericht.foodEaten += s.resources.food;
        s.resources.food = 0;
        bericht.hungryDays += 1;
        s.resources.morale -= 5;
        allenGesundheit(s, -15);
      }
      if (s.resources.wood >= HOLZ_PRO_NACHT) {
        s.resources.wood -= HOLZ_PRO_NACHT;
        bericht.woodBurned += HOLZ_PRO_NACHT;
      } else {
        bericht.coldDays += 1;
        s.resources.morale -= 3;
        allenGesundheit(s, -5);
      }
      for (const m of s.troupe) {
        if (!m.isAlive) continue;
        m.fatigue = Math.min(100, m.fatigue + 8);
        if (m.isSick) gesundheitAendern(m, -10);
      }
      if (s.troupe.some((m) => m.isAlive && m.isSick) && einheit(s.rng) < 0.15) {
        const neu = zufallsLebender(s, (m) => !m.isSick);
        if (neu) {
          neu.isSick = true;
          bericht.fellSick.push(neu.id);
        }
      }
      begrenzen(s.resources);
    }
    bericht.deaths = s.troupe.filter((m) => lebendVorher.has(m.id) && !m.isAlive).map((m) => m.id);
    s.location = ziel;
    s.visits[ziel] = (s.visits[ziel] || 0) + 1;
    bericht.event = ereignisWaehlen(s, weg, w);
    return bericht;
  }

  function optionMoeglich(s, option) {
    if (!option.requires) return true;
    return lebende(s).some((m) => m.discipline === option.requires);
  }

  function entscheiden(s, option, ereignis, w) {
    if (!optionMoeglich(s, option)) throw new Error("Option gesperrt");
    const e = option.effect || {};
    const lebendVorher = new Set(lebende(s).map((m) => m.id));
    const vorher = Object.assign({}, s.resources);
    const dazu = [], weg = [];
    s.resources.food += e.food || 0;
    s.resources.coins += e.coins || 0;
    s.resources.wood += e.wood || 0;
    s.resources.morale += e.morale || 0;
    begrenzen(s.resources);
    if (e.healthAll) allenGesundheit(s, e.healthAll);
    if (e.healthRandom) {
      const m = zufallsLebender(s);
      if (m) gesundheitAendern(m, e.healthRandom);
    }
    if (e.makeSick) {
      const m = s.troupe.find((x) => x.id === e.makeSick && x.isAlive);
      if (m) {
        m.isSick = true;
        gesundheitAendern(m, -10);
      }
    }
    if (e.removeMember) {
      const i = s.troupe.findIndex((x) => x.id === e.removeMember);
      if (i >= 0) {
        s.troupe.splice(i, 1);
        weg.push(e.removeMember);
      }
    }
    if (e.recruit && !mitglied(s, e.recruit)) {
      const neu = w.recruits.find((m) => m.id === e.recruit);
      if (neu) {
        s.troupe.push(mitgliedAnlegen(neu));
        dazu.push(neu.id);
      }
    }
    if (!s.seenEvents.includes(ereignis.id)) s.seenEvents.push(ereignis.id);
    return {
      outcome: option.outcome,
      change: {
        food: s.resources.food - vorher.food, coins: s.resources.coins - vorher.coins,
        wood: s.resources.wood - vorher.wood, morale: s.resources.morale - vorher.morale,
      },
      joined: dazu,
      left: weg,
      deaths: s.troupe.filter((m) => lebendVorher.has(m.id) && !m.isAlive).map((m) => m.id),
    };
  }

  function auftreten(s, ids, w) {
    const ort = w.ort(s.location);
    if (!ort) throw new Error("unbekannter Ort");
    const programm = ids.map((id) => mitglied(s, id)).filter((m) => m && darfAuftreten(m, ort));
    const ergebnis = vorstellungSpielen(programm, ort, s.resources.morale, s.rng);
    for (const k of ["food", "coins", "wood", "morale"]) s.resources[k] += ergebnis.reward[k];
    begrenzen(s.resources);
    const spieler = new Set(programm.map((m) => m.id));
    for (const m of s.troupe) {
      if (!m.isAlive) continue;
      m.fatigue = spieler.has(m.id) ? Math.min(100, m.fatigue + 10) : Math.max(0, m.fatigue - 20);
      if (ergebnis.healing > 0) {
        gesundheitAendern(m, ergebnis.healing);
        if (m.health >= 80) m.isSick = false;
      }
    }
    return ergebnis;
  }

  const kannKaufen = (s, ware) => s.resources.coins >= HANDEL[ware].preis;

  function kaufen(s, ware) {
    if (!kannKaufen(s, ware)) throw new Error("zu wenig Münzen");
    s.resources.coins -= HANDEL[ware].preis;
    s.resources[ware] += HANDEL[ware].menge;
  }

  const Logik = {
    neuerZufall, einheit, welt, pruefen, darfAuftreten, erwarteteKurve, wertung, lohn,
    vorstellungSpielen, neuesSpiel, lebende, mitglied, spielVorbei, jahreszeit, kannPassieren,
    reisen, optionMoeglich, entscheiden, auftreten, kannKaufen, kaufen,
    BRETTER, ORTSART, GEFUEHL, DISZIPLIN, HANDEL, START_STIMMUNG,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Logik;
  else root.Logik = Logik;
})(typeof window !== "undefined" ? window : globalThis);
