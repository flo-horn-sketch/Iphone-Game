// Spielregeln von "Clan-Viertel". Ohne Bildschirm, damit sie sich testen lassen.
//
// Zwei Clans ringen um neun Viertel der Inselstadt Sorrenhafen. Jeden Tag
// stellen beide ihre Kämpfer gleichzeitig auf, dann wird aufgedeckt.
// Es gibt keine Würfel: Wo beide stehen, gewinnt die höhere Stärke.
// Laternen zeigen, wie treu ein Viertel seinem Clan ist. Jade macht stärker.
(function (wurzel, fabrik) {
  if (typeof module === "object" && module.exports) module.exports = fabrik();
  else wurzel.ClanLogik = fabrik();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SPIELER = "p";
  const RIVALE = "r";

  // Alle Stellschrauben an einem Ort, damit das Balancing leicht fällt.
  const REGELN = {
    letzterTag: 20,
    clankriegAb: 15,      // ab hier doppelter Ertrag, Mauern fast weg
    friedenBis: 5,        // vorher: Haupthäuser tabu, niemand kann gewinnen
    siegViertel: 7,       // so viele Viertel mit vollen Laternen = Sieg
    laternen: 3,
    anwerben: 5,          // Gold
    maxJade: 3,
    verletztTage: 1,
    mauern: 6,            // Haupthaus-Bonus der Verteidiger
    mauernKrieg: 1,
    heimvorteil: 1,       // eigenes Viertel mit vollen Laternen
    waechter: 2,          // Wächter in eigenem Viertel
    unterstuetzungMax: 2,
    schuleTage: 3,        // alle 3 Tage ein Kämpfer (im Rückstand: 2)
    schuleTageRueckstand: 2,
    ereignisAlle: 4,
  };

  // Die Stadt als 3 × 3 Raster. Nachbarn sind die Viertel links, rechts, oben, unten.
  const VIERTEL = [
    { id: "klippenmine", name: "Klippenmine", art: "mine", r: 0, c: 0 },
    { id: "hohemine", name: "Hohe Mine", art: "mine", r: 0, c: 1 },
    { id: "schlotmine", name: "Schlotmine", art: "mine", r: 0, c: 2 },
    { id: "kranichhaus", name: "Kranichhaus", art: "haupthaus", r: 1, c: 0 },
    { id: "fechtschule", name: "Fechtschule", art: "schule", r: 1, c: 1 },
    { id: "natternhaus", name: "Natternhaus", art: "haupthaus", r: 1, c: 2 },
    { id: "fischmarkt", name: "Fischmarkt", art: "markt", r: 2, c: 0 },
    { id: "nachtmarkt", name: "Nachtmarkt", art: "markt", r: 2, c: 1 },
    { id: "hafen", name: "Hafen", art: "markt", r: 2, c: 2 },
  ];
  const NACH_ID = Object.fromEntries(VIERTEL.map((v) => [v.id, v]));
  const HAUPTHAUS = { [SPIELER]: "kranichhaus", [RIVALE]: "natternhaus" };

  // Was ein Viertel mit vollen Laternen jeden Abend bringt.
  const ARTEN = {
    haupthaus: { name: "Haupthaus", gold: 2 },
    mine: { name: "Jademine", jade: 1 },
    markt: { name: "Markt", gold: 2 },
    schule: { name: "Fechtschule", kaempfer: true },
  };
  const WERT = { mine: 5, schule: 5, markt: 4, haupthaus: 9 };

  const TYPEN = {
    anfuehrer: { name: "Clanführer", grund: 4, text: "Alle eigenen Kämpfer in seinem und den Nachbarvierteln +1. Fällt er, ist alles verloren." },
    waechter: { name: "Wächter", grund: 2, text: "+2, wenn er ein eigenes Viertel verteidigt." },
    laeufer: { name: "Läufer", grund: 2, text: "Kommt zwei Viertel weit." },
    spaeher: { name: "Späher", grund: 2, text: "Deckt jeden Morgen einen Zug des Rivalen auf." },
  };

  // Die drei Rivalen. Alle führen den Natter-Clan, jeder mit eigenem Stil.
  const RIVALEN = {
    stuermer: {
      name: "Varo", titel: "der Stürmer", text: "Greift an, wo du schwach stehst. Führt selbst an der Front.",
      truppe: ["waechter", "laeufer", "laeufer"], hqSorge: 0.5, marge: 1, maxAngriffe: 2, fuehrerVorn: true,
    },
    mauer: {
      name: "Hesra", titel: "die Mauer", text: "Bewacht alles und schlägt nur zu, wenn sie haushoch überlegen ist.",
      truppe: ["waechter", "waechter", "laeufer"], hqSorge: 0.6, marge: "doppelt", maxAngriffe: 1, fuehrerVorn: false,
    },
    listig: {
      name: "Sel", titel: "der Listige", text: "Seine Ansage ist eine Finte. Er greift woanders an.",
      truppe: ["laeufer", "spaeher", "waechter"], hqSorge: 0.5, marge: 2, maxAngriffe: 2, fuehrerVorn: false, finte: true,
    },
  };

  const NAMEN = {
    [SPIELER]: ["Bo", "Mei", "Tarin", "Joss", "Sela", "Fenn", "Oda", "Lio", "Wen", "Ama", "Tiko", "Rhea"],
    [RIVALE]: ["Ruk", "Kesh", "Dagur", "Yva", "Morn", "Zola", "Brakk", "Ishi", "Vex", "Nalo", "Sorn", "Tess"],
  };

  // Ereignisse an jedem vierten Tag, immer zwei Wahlen, Folgen stehen vorher fest.
  const EREIGNISSE = [
    {
      id: "haendler", titel: "Ein Jadehändler",
      text: "Ein Händler aus den Bergen bietet rohe Jade an.",
      wahlen: [
        { text: "Kaufen", kosten: { gold: 5 }, folgen: { jade: 2 } },
        { text: "Wegschicken", folgen: {} },
      ],
    },
    {
      id: "fest", titel: "Laternenfest",
      text: "Die Stadt feiert. Feiern kostet, macht aber gesund.",
      wahlen: [
        { text: "Mitfeiern", kosten: { gold: 3 }, folgen: { heilen: true } },
        { text: "Spenden sammeln", folgen: { gold: 3 } },
      ],
    },
    {
      id: "ueberlaeufer", titel: "Ein Überläufer",
      text: "Ein Kämpfer der Nattern will die Seiten wechseln.",
      wahlen: [
        { text: "Aufnehmen", kosten: { gold: 4 }, folgen: { ueberlaeufer: true } },
        { text: "Zurückschicken", folgen: { jade: 1 } },
      ],
    },
  ];

  // ---------- Grundlagen ----------

  function nachbarn(id) {
    const v = NACH_ID[id];
    return VIERTEL.filter((w) => Math.abs(w.r - v.r) + Math.abs(w.c - v.c) === 1).map((w) => w.id);
  }
  function distanz(a, b) {
    const x = NACH_ID[a], y = NACH_ID[b];
    return Math.abs(x.r - y.r) + Math.abs(x.c - y.c);
  }
  function gegner(seite) {
    return seite === SPIELER ? RIVALE : SPIELER;
  }

  function neueFigur(st, seite, typ) {
    const namen = NAMEN[seite];
    const fuehrer = typ === "anfuehrer";
    return {
      id: seite + (st.naechsteId++),
      seite, typ,
      name: fuehrer ? (seite === SPIELER ? "Ilka" : RIVALEN[st.rivale].name) : namen[st.zaehler[seite]++ % namen.length],
      jade: 0,
      verletzt: 0,
      ort: null, // null = im eigenen Haupthaus
    };
  }

  function neuesSpiel(rivale) {
    rivale = RIVALEN[rivale] ? rivale : "mauer"; // Die erste Partie gegen die Mauer: ruhiger zum Lernen
    const st = {
      rivale,
      tag: 0,
      naechsteId: 1,
      zaehler: { [SPIELER]: 0, [RIVALE]: 0 },
      besitz: {},
      laternen: {}, // so viele Laternen leuchten in der Farbe des Besitzers (0–3)
      gold: { [SPIELER]: 3, [RIVALE]: 3 },
      jade: { [SPIELER]: 1, [RIVALE]: 1 },
      schule: { [SPIELER]: 0, [RIVALE]: 0 },
      figuren: [],
      gefallen: [],
      plan: {},
      ansage: null,
      aufgedeckt: [],
      ereignis: null,
      ende: null,
    };
    for (const v of VIERTEL) { st.besitz[v.id] = null; st.laternen[v.id] = 0; }
    for (const [seite, ids] of [[SPIELER, ["kranichhaus", "klippenmine", "fischmarkt"]], [RIVALE, ["natternhaus", "schlotmine", "hafen"]]]) {
      for (const id of ids) { st.besitz[id] = seite; st.laternen[id] = REGELN.laternen; }
    }
    st.figuren.push(neueFigur(st, SPIELER, "anfuehrer"));
    for (const typ of ["waechter", "laeufer", "spaeher"]) st.figuren.push(neueFigur(st, SPIELER, typ));
    st.figuren.push(neueFigur(st, RIVALE, "anfuehrer"));
    for (const typ of RIVALEN[rivale].truppe) st.figuren.push(neueFigur(st, RIVALE, typ));
    // Zum Start steht je ein Wächter in der Mine.
    st.figuren.find((f) => f.seite === SPIELER && f.typ === "waechter").ort = "klippenmine";
    st.figuren.find((f) => f.seite === RIVALE && f.typ === "waechter").ort = "schlotmine";
    tagBeginnen(st);
    return st;
  }

  function jadeBonus(j) {
    return j > 0 ? j + 1 : 0; // erster Stein +2, jeder weitere +1
  }
  function staerke(f) {
    return TYPEN[f.typ].grund + jadeBonus(f.jade);
  }
  function figur(st, id) {
    return st.figuren.find((f) => f.id === id) || null;
  }
  function figurenVon(st, seite) {
    return st.figuren.filter((f) => f.seite === seite);
  }
  function bereit(st, seite) {
    return figurenVon(st, seite).filter((f) => f.verletzt === 0);
  }
  function ortVon(f) {
    return f.ort || HAUPTHAUS[f.seite];
  }
  function besitzt(st, seite) {
    return VIERTEL.filter((v) => st.besitz[v.id] === seite).map((v) => v.id);
  }
  function voll(st, id) {
    return st.laternen[id] >= REGELN.laternen;
  }
  function vollBesitz(st, seite) {
    return besitzt(st, seite).filter((id) => voll(st, id));
  }
  function clankrieg(st) {
    return st.tag >= REGELN.clankriegAb;
  }
  // Wer weniger Viertel hat, bekommt Zulauf.
  function imRueckstand(st, seite) {
    return besitzt(st, seite).length < besitzt(st, gegner(seite)).length;
  }

  // Wohin darf eine Figur heute? Eigene Viertel und deren Nachbarn, Läufer zwei weit.
  function erreichbar(st, seite, ziel, typ) {
    if (st.besitz[ziel] === seite) return true;
    if (ziel === HAUPTHAUS[gegner(seite)] && st.tag < REGELN.friedenBis) return false;
    const weite = typ === "laeufer" ? 2 : 1;
    return besitzt(st, seite).some((id) => distanz(id, ziel) <= weite);
  }

  // ---------- Stärke in einem Viertel ----------

  // Gibt die Stärke einer Seite in einem Viertel zurück, aufgeschlüsselt.
  function wertung(st, seite, ziel, figuren, fuehrerOrt) {
    const w = { figuren: 0, waechter: 0, fuehrer: 0, nachbarn: 0, heim: 0, summe: 0 };
    const eigen = st.besitz[ziel] === seite;
    const hq = NACH_ID[ziel].art === "haupthaus";
    // Die Mauern des eigenen Haupthauses halten auch ohne Besatzung.
    if (!figuren.length) {
      if (eigen && hq) w.heim = w.summe = clankrieg(st) ? REGELN.mauernKrieg : REGELN.mauern;
      return w;
    }
    for (const f of figuren) {
      w.figuren += staerke(f);
      if (f.typ === "waechter" && eigen) w.waechter += REGELN.waechter;
    }
    if (fuehrerOrt && (fuehrerOrt === ziel || distanz(fuehrerOrt, ziel) === 1)) {
      w.fuehrer = figuren.filter((f) => f.typ !== "anfuehrer").length;
    }
    w.nachbarn = Math.min(REGELN.unterstuetzungMax, nachbarn(ziel).filter((n) => st.besitz[n] === seite).length);
    if (eigen) {
      if (hq) w.heim = clankrieg(st) ? REGELN.mauernKrieg : REGELN.mauern;
      else if (voll(st, ziel)) w.heim = REGELN.heimvorteil;
    }
    w.summe = w.figuren + w.waechter + w.fuehrer + w.nachbarn + w.heim;
    return w;
  }

  function fuehrerOrt(st, seite, orte) {
    const f = bereit(st, seite).find((x) => x.typ === "anfuehrer");
    if (!f) return null;
    return orte ? orte[f.id] : ortVon(f);
  }

  // Stärke des Spielers, so wie er gerade aufgestellt ist (für die Vorschau).
  function spielerWertung(st, ziel) {
    const fs = bereit(st, SPIELER).filter((f) => ortVon(f) === ziel);
    return wertung(st, SPIELER, ziel, fs, fuehrerOrt(st, SPIELER));
  }

  // ---------- Morgen ----------

  function tagBeginnen(st) {
    st.tag += 1;
    for (const f of st.figuren) if (f.verletzt > 0) f.verletzt -= 1;
    rivaleWirtschaftet(st);
    const p = rivalePlant(st);
    st.plan = p.plan;
    st.ansage = p.ansage;
    st.aufgedeckt = aufdecken(st);
    st.ereignis = st.tag % REGELN.ereignisAlle === 0
      ? EREIGNISSE[(st.tag / REGELN.ereignisAlle - 1) % EREIGNISSE.length].id : null;
  }

  function rivaleWirtschaftet(st) {
    let n = 0;
    while (st.gold[RIVALE] >= REGELN.anwerben) {
      st.gold[RIVALE] -= REGELN.anwerben;
      st.figuren.push(neueFigur(st, RIVALE, (st.zaehler[RIVALE] + n++) % 2 ? "laeufer" : "waechter"));
    }
    while (st.jade[RIVALE] > 0) {
      const ziel = figurenVon(st, RIVALE).filter((f) => f.jade < REGELN.maxJade)
        .sort((a, b) => (a.jade - b.jade) || ((a.typ === "anfuehrer") - (b.typ === "anfuehrer")) || (a.id < b.id ? -1 : 1))[0];
      if (!ziel) break;
      ziel.jade += 1;
      st.jade[RIVALE] -= 1;
    }
  }

  // Der Rivale plant mit dem, was er sieht: deine Aufstellung von gestern.
  function rivalePlant(st) {
    const stil = RIVALEN[st.rivale];
    const plan = {};
    const hq = HAUPTHAUS[RIVALE];
    const alle = bereit(st, RIVALE);
    const fuehrer = alle.find((f) => f.typ === "anfuehrer");
    const frei = alle.filter((f) => f !== fuehrer).sort((a, b) => staerke(b) - staerke(a) || (a.id < b.id ? -1 : 1));
    const spielerOrt = fuehrerOrt(st, SPIELER);
    const erwartet = (id) => {
      const fs = bereit(st, SPIELER).filter((f) => ortVon(f) === id);
      return wertung(st, SPIELER, id, fs, spielerOrt).summe;
    };

    // Ziele bewerten.
    const ziele = VIERTEL.filter((v) => st.besitz[v.id] !== RIVALE && erreichbar(st, RIVALE, v.id))
      .map((v) => {
        const e = erwartet(v.id);
        const marge = stil.marge === "doppelt" ? Math.max(e, 2) : stil.marge;
        return { id: v.id, erwartet: e, noetig: e + marge, wert: WERT[v.art] };
      })
      .sort((a, b) => (b.wert * 2 - b.noetig) - (a.wert * 2 - a.noetig) || (a.id < b.id ? -1 : 1));

    // Der Führer stellt sich hinter das beste Ziel, wenn er vorn führt.
    let fOrt = hq;
    if (fuehrer && stil.fuehrerVorn && ziele.length) {
      const basis = besitzt(st, RIVALE).filter((id) => distanz(id, ziele[0].id) === 1)
        .sort((a, b) => (a === hq ? -1 : b === hq ? 1 : 0))[0];
      if (basis) fOrt = basis;
    }
    if (fuehrer) plan[fuehrer.id] = fOrt;

    // 1. Haupthaus sichern.
    if (st.tag >= REGELN.friedenBis && erreichbar(st, SPIELER, hq)) {
      const gesamtSpieler = bereit(st, SPIELER).reduce((s, f) => s + staerke(f), 0);
      const drohung = Math.ceil(gesamtSpieler * stil.hqSorge) + 2;
      const wache = () => wertung(st, RIVALE, hq, alle.filter((f) => plan[f.id] === hq), fOrt).summe;
      while (wache() <= drohung && frei.length) plan[frei.pop().id] = hq;
    }

    // 2. Angreifen, wo es sich lohnt.
    let angriffe = 0;
    const angegriffen = [];
    for (const z of ziele) {
      if (angriffe >= stil.maxAngriffe) break;
      const trupp = truppFinden(st, frei, z, fOrt);
      if (!trupp) continue;
      for (const f of trupp) { plan[f.id] = z.id; frei.splice(frei.indexOf(f), 1); }
      angegriffen.push(z.id);
      angriffe++;
    }

    // 3. Übrige Kämpfer: unsichere und bedrohte eigene Viertel bewachen.
    const bewachen = VIERTEL.filter((v) => st.besitz[v.id] === RIVALE && v.id !== hq &&
      (!voll(st, v.id) || nachbarn(v.id).some((n) => st.besitz[n] === SPIELER)))
      .sort((a, b) => (st.laternen[a.id] - st.laternen[b.id]) || (WERT[b.art] - WERT[a.art]) || (a.id < b.id ? -1 : 1));
    for (const v of bewachen) {
      if (!frei.length) break;
      const f = frei.find((x) => x.typ === "waechter") || frei[frei.length - 1];
      plan[f.id] = v.id;
      frei.splice(frei.indexOf(f), 1);
    }
    for (const f of frei) plan[f.id] = hq;

    // Die Ansage: das Hauptziel. Der Listige nennt absichtlich ein anderes.
    // Ein Angriff auf dein Haupthaus wird aber immer angesagt (Ehrenkodex der Clans).
    let ansage = angegriffen[0] || null;
    if (angegriffen.includes(HAUPTHAUS[SPIELER])) ansage = HAUPTHAUS[SPIELER];
    else if (stil.finte && angegriffen.length) {
      const andere = ziele.map((z) => z.id).filter((id) => id !== angegriffen[0]);
      ansage = angegriffen[1] || andere[0] || angegriffen[0];
    }
    return { plan, ansage };
  }

  // Kleinste Gruppe, die zusammen das Ziel schafft.
  function truppFinden(st, frei, z, fOrt) {
    const reicht = (trupp) => wertung(st, RIVALE, z.id, trupp, fOrt).summe >= Math.max(1, z.noetig);
    const kandidaten = frei.filter((f) => erreichbar(st, RIVALE, z.id, f.typ));
    for (let i = kandidaten.length - 1; i >= 0; i--) if (reicht([kandidaten[i]])) return [kandidaten[i]];
    const trupp = [];
    for (const f of kandidaten) {
      trupp.push(f);
      if (reicht(trupp)) return trupp;
    }
    return null;
  }

  // Jeder Späher deckt einen Zug des Rivalen auf (wohin und mit welcher Stärke).
  function aufdecken(st) {
    const spaeher = bereit(st, SPIELER).filter((f) => f.typ === "spaeher").length;
    if (!spaeher) return [];
    const summe = {};
    for (const [id, ziel] of Object.entries(st.plan)) {
      if (ziel === HAUPTHAUS[RIVALE]) continue;
      const f = figur(st, id);
      if (f) summe[ziel] = (summe[ziel] || 0) + staerke(f);
    }
    return Object.entries(summe)
      .sort((a, b) => (b[0] === st.ansage) - (a[0] === st.ansage) || b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, spaeher)
      .map(([ziel, s]) => ({ ziel, staerke: s }));
  }

  // ---------- Was der Spieler tun kann ----------

  function platzieren(st, figurId, ziel) {
    if (st.ende || st.ereignis) return false;
    const f = figur(st, figurId);
    if (!f || f.seite !== SPIELER || f.verletzt > 0) return false;
    if (!ziel || ziel === HAUPTHAUS[SPIELER]) { f.ort = null; return true; }
    if (!erreichbar(st, SPIELER, ziel, f.typ)) return false;
    f.ort = ziel;
    return true;
  }

  function jadeGeben(st, figurId) {
    const f = figur(st, figurId);
    if (st.ende || !f || f.seite !== SPIELER || st.jade[SPIELER] < 1 || f.jade >= REGELN.maxJade) return false;
    st.jade[SPIELER] -= 1;
    f.jade += 1;
    return true;
  }

  function anwerben(st, typ) {
    if (st.ende || !TYPEN[typ] || typ === "anfuehrer" || st.gold[SPIELER] < REGELN.anwerben) return null;
    st.gold[SPIELER] -= REGELN.anwerben;
    const f = neueFigur(st, SPIELER, typ);
    st.figuren.push(f);
    if (typ === "spaeher") st.aufgedeckt = aufdecken(st);
    return f;
  }

  function ereignisDaten(id) {
    return EREIGNISSE.find((e) => e.id === id) || null;
  }

  function wahlMoeglich(st, wahl) {
    const k = wahl.kosten || {};
    return (k.gold || 0) <= st.gold[SPIELER] && (k.jade || 0) <= st.jade[SPIELER];
  }

  function ereignisWaehlen(st, index) {
    const e = ereignisDaten(st.ereignis);
    if (!e) return false;
    const wahl = e.wahlen[index];
    if (!wahl || !wahlMoeglich(st, wahl)) return false;
    const k = wahl.kosten || {};
    st.gold[SPIELER] -= k.gold || 0;
    st.jade[SPIELER] -= k.jade || 0;
    const fo = wahl.folgen;
    if (fo.gold) st.gold[SPIELER] += fo.gold;
    if (fo.jade) st.jade[SPIELER] += fo.jade;
    if (fo.heilen) for (const f of figurenVon(st, SPIELER)) f.verletzt = 0;
    if (fo.ueberlaeufer) {
      const weg = figurenVon(st, RIVALE).filter((f) => f.typ !== "anfuehrer")
        .sort((a, b) => staerke(a) - staerke(b) || (a.id < b.id ? -1 : 1))[0];
      if (weg) {
        st.figuren.splice(st.figuren.indexOf(weg), 1);
        delete st.plan[weg.id];
        weg.seite = SPIELER; weg.ort = null; weg.verletzt = 0;
        weg.id = SPIELER + (st.naechsteId++);
        st.figuren.push(weg);
      } else st.figuren.push(neueFigur(st, SPIELER, "waechter"));
      st.aufgedeckt = aufdecken(st);
    }
    st.ereignis = null;
    return true;
  }

  // ---------- Abend: aufdecken, kämpfen, Laternen, auszahlen ----------

  function tagAufloesen(st) {
    if (st.ende || st.ereignis) return null;
    // Die geheimen Züge des Rivalen werden aufgedeckt.
    for (const f of bereit(st, RIVALE)) {
      const ziel = st.plan[f.id] || HAUPTHAUS[RIVALE];
      f.ort = ziel === HAUPTHAUS[RIVALE] ? null : ziel;
    }
    const vorher = Object.assign({}, st.besitz);
    const laternenVorher = Object.assign({}, st.laternen);
    const fOrt = { [SPIELER]: fuehrerOrt(st, SPIELER), [RIVALE]: fuehrerOrt(st, RIVALE) };
    const kaempfe = [];
    const neuerBesitz = Object.assign({}, st.besitz);

    for (const v of VIERTEL) {
      const P = bereit(st, SPIELER).filter((f) => ortVon(f) === v.id);
      const R = bereit(st, RIVALE).filter((f) => ortVon(f) === v.id);
      if (!P.length && !R.length) continue;
      const mauern = v.art === "haupthaus" && (P.length ? vorher[v.id] === RIVALE : vorher[v.id] === SPIELER);
      const wp = wertung(st, SPIELER, v.id, P, fOrt[SPIELER]);
      const wr = wertung(st, RIVALE, v.id, R, fOrt[RIVALE]);
      const k = {
        viertel: v.id, spieler: wp, rivale: wr,
        figurenSpieler: P.map((f) => f.id), figurenRivale: R.map((f) => f.id),
        sieger: null, folge: null, verluste: [], beute: 0, vorherBesitz: vorher[v.id],
      };
      if (!R.length && !(mauern && wr.summe > 0)) k.sieger = SPIELER;
      else if (!P.length && !(mauern && wp.summe > 0)) k.sieger = RIVALE;
      else if (wp.summe > wr.summe) k.sieger = SPIELER;
      else if (wr.summe > wp.summe) k.sieger = RIVALE;
      else k.sieger = vorher[v.id]; // Gleichstand: der Verteidiger hält, sonst ziehen beide ab

      if ((P.length && R.length) || mauern) {
        if (wp.summe === wr.summe) {
          // Gleichstand: Angreifer ziehen sich unverletzt zurück.
          k.folge = "gleichstand";
          for (const f of P.concat(R)) if (f.seite !== k.sieger) f.ort = null;
        } else {
          const verlierer = k.sieger === SPIELER ? R : P;
          const sw = Math.max(wp.summe, wr.summe), sv = Math.min(wp.summe, wr.summe);
          k.folge = sw >= sv * 2 ? "gefallen" : "verletzt";
          for (const f of verlierer) {
            k.verluste.push({ id: f.id, name: f.name, seite: f.seite, typ: f.typ, folge: k.folge, jade: f.jade });
            if (k.folge === "gefallen") {
              // Wer eine Figur besiegt, bekommt ihre ganze Jade ins Lager.
              st.jade[k.sieger] += f.jade;
              k.beute += f.jade;
              st.figuren.splice(st.figuren.indexOf(f), 1);
              st.gefallen.push(f);
            } else {
              f.verletzt = REGELN.verletztTage + 1; // +1, weil der Morgen gleich einen Tag abzieht
              f.ort = null;
            }
          }
        }
      }
      if (k.sieger) neuerBesitz[v.id] = k.sieger;
      k.besitzNeu = neuerBesitz[v.id];
      if (k.besitzNeu !== vorher[v.id]) st.laternen[v.id] = 0; // erobert: die Laternen hängen noch in fremder Farbe
      if ((P.length && R.length) || mauern || k.besitzNeu !== vorher[v.id]) kaempfe.push(k);
    }
    st.besitz = neuerBesitz;
    for (const f of st.figuren) if (f.ort && st.besitz[f.ort] !== f.seite) f.ort = null;

    // Laternen: bewacht oder sicher im Hinterland = eine mehr. Unbewacht an der Front = eine erlischt.
    const laternenWechsel = [];
    for (const v of VIERTEL) {
      const seite = st.besitz[v.id];
      if (!seite || v.art === "haupthaus") continue;
      if (kaempfe.some((k) => k.viertel === v.id && k.besitzNeu !== k.vorherBesitz)) continue;
      const bewacht = bereit(st, seite).some((f) => ortVon(f) === v.id);
      const front = nachbarn(v.id).some((n) => st.besitz[n] === gegner(seite));
      let d = 0;
      if (bewacht || !front) d = 1;
      else if (!imRueckstand(st, seite)) d = -1; // im Rückstand erlöschen Laternen nicht
      const neu = Math.max(-1, Math.min(REGELN.laternen, st.laternen[v.id] + d));
      if (neu < 0) {
        // Keine Laterne mehr: das Viertel fällt vom Clan ab.
        st.besitz[v.id] = null;
        st.laternen[v.id] = 0;
        laternenWechsel.push({ viertel: v.id, abgefallen: true, seite });
      } else if (neu !== st.laternen[v.id]) {
        laternenWechsel.push({ viertel: v.id, von: st.laternen[v.id], nach: neu, seite });
        st.laternen[v.id] = neu;
      }
    }
    for (const f of st.figuren) if (f.ort && st.besitz[f.ort] !== f.seite) f.ort = null;

    // Auszahlen: nur Viertel mit vollen Laternen.
    const ertrag = { [SPIELER]: { gold: 0, jade: 0, kaempfer: 0 }, [RIVALE]: { gold: 0, jade: 0, kaempfer: 0 } };
    const faktor = clankrieg(st) ? 2 : 1;
    for (const v of VIERTEL) {
      const seite = st.besitz[v.id];
      if (!seite || !voll(st, v.id)) continue;
      const a = ARTEN[v.art];
      ertrag[seite].gold += (a.gold || 0) * faktor;
      ertrag[seite].jade += (a.jade || 0) * faktor;
    }
    for (const seite of [SPIELER, RIVALE]) {
      if (st.besitz.fechtschule === seite && voll(st, "fechtschule")) {
        st.schule[seite] += 1;
        const noetig = imRueckstand(st, seite) ? REGELN.schuleTageRueckstand : REGELN.schuleTage;
        if (st.schule[seite] >= noetig) {
          st.schule[seite] = 0;
          const typ = seite === SPIELER ? "waechter" : "laeufer";
          st.figuren.push(neueFigur(st, seite, typ));
          ertrag[seite].kaempfer += 1;
        }
      }
      st.gold[seite] += ertrag[seite].gold;
      st.jade[seite] += ertrag[seite].jade;
    }

    st.ende = endePruefen(st);
    const bericht = { tag: st.tag, kaempfe, laternen: laternenWechsel, laternenVorher, ertrag, ende: st.ende, ansage: st.ansage };
    st.letzterBericht = bericht;
    if (!st.ende) tagBeginnen(st);
    return bericht;
  }

  function endePruefen(st) {
    const fuehrerLebt = (seite) => figurenVon(st, seite).some((f) => f.typ === "anfuehrer");
    if (!fuehrerLebt(SPIELER)) return { sieger: RIVALE, grund: "fuehrer" };
    if (st.besitz[HAUPTHAUS[SPIELER]] !== SPIELER) return { sieger: RIVALE, grund: "haupthaus" };
    if (!fuehrerLebt(RIVALE)) return { sieger: SPIELER, grund: "fuehrer" };
    if (st.besitz[HAUPTHAUS[RIVALE]] !== RIVALE) return { sieger: SPIELER, grund: "haupthaus" };
    if (st.tag < REGELN.friedenBis) return null;
    const p = vollBesitz(st, SPIELER).length, r = vollBesitz(st, RIVALE).length;
    if (p >= REGELN.siegViertel) return { sieger: SPIELER, grund: "viertel" };
    if (r >= REGELN.siegViertel) return { sieger: RIVALE, grund: "viertel" };
    if (st.tag >= REGELN.letzterTag) {
      const pp = besitzt(st, SPIELER).length, rr = besitzt(st, RIVALE).length;
      const sieger = p !== r ? (p > r ? SPIELER : RIVALE) : pp !== rr ? (pp > rr ? SPIELER : RIVALE) : null;
      return { sieger, grund: "zeit" };
    }
    return null;
  }

  return {
    SPIELER, RIVALE, REGELN, VIERTEL, NACH_ID, ARTEN, TYPEN, RIVALEN, HAUPTHAUS, EREIGNISSE,
    neuesSpiel, nachbarn, distanz, gegner, staerke, jadeBonus, figur, figurenVon, bereit, ortVon,
    besitzt, voll, vollBesitz, clankrieg, imRueckstand, erreichbar, wertung, spielerWertung, fuehrerOrt,
    platzieren, jadeGeben, anwerben, ereignisDaten, wahlMoeglich, ereignisWaehlen, tagAufloesen, rivalePlant,
  };
});
