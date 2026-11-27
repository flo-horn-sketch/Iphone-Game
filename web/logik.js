// Spiellogik von "Die Fahrenden" (Web-Version, vereinfacht).
// Kein Zugriff auf die Seite: alles hier lässt sich mit `node --test` prüfen.
//
// Der ganze Kern in fünf Sätzen:
// 1. Zwei Vorräte: Brot (jeder Weg kostet Brot) und Gold.
// 2. In jedem Ort gibt es eine Vorstellung: Das Publikum ruft einen Wunsch,
//    man schickt eine passende Figur, die Serie wächst. Nach jeder Nummer:
//    „Noch eine!“ wagen oder den Hut rumgehen lassen.
// 3. Figuren sind fit, verletzt oder tot. Verletzte treten nicht auf, das
//    Kloster heilt sie. Wer verletzt nochmal getroffen wird, stirbt.
// 4. Auf Märkten wirbt man mit Gold neue Künstler an.
// 5. Jedes Kapitel hat ein Ziel: mit genug Gold an einen bestimmten Ort.
(function (root) {
  "use strict";

  const MASK = (1n << 64n) - 1n;

  // Zufall mit Startwert (SplitMix64), damit Spielstände wiederholbar sind.
  function neuerZufall(seed) {
    let st = BigInt.asUintN(64, BigInt(seed));
    if (st === 0n) st = 0x9e3779b97f4a7c15n;
    return { state: st.toString() };
  }

  function naechste(rng) {
    const state = (BigInt(rng.state) + 0x9e3779b97f4a7c15n) & MASK;
    rng.state = state.toString();
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  }

  const einheit = (rng) => Number(naechste(rng) >> 11n) / 2 ** 53;
  const zufallsIndex = (rng, anzahl) => Number(naechste(rng) % BigInt(anzahl));

  // ---------- Grunddaten ----------

  const RISKANT = new Set(["acrobatics", "fire", "animals"]);
  const ORTSART = { village: "Dorf", market: "Markt", castle: "Burg", monastery: "Kloster" };
  const GEFUEHL = { tension: "Spannung", humor: "Humor", wonder: "Staunen", heart: "Herz" };
  const GEFUEHLE = Object.keys(GEFUEHL);
  const DISZIPLIN = {
    acrobatics: "Akrobatik", foolery: "Narretei", animals: "Tiere", juggling: "Gaukelei",
    music: "Musik", fire: "Feuer", story: "Erzählung",
  };
  const GEDULD = 3;
  const PANNE_RISIKO = 0.2;
  const SERIE_MAX = 5;
  const BROT_KAUF = { preis: 3, menge: 6 };

  function begrenzen(r) {
    r.food = Math.max(0, r.food);
    r.coins = Math.max(0, r.coins);
    return r;
  }

  function mitgliedAnlegen(m) {
    const kopie = JSON.parse(JSON.stringify(m));
    delete kopie.price;
    return Object.assign({ zustand: "fit" }, kopie);
  }

  const lebt = (m) => m.zustand !== "tot";
  const fit = (m) => m.zustand === "fit";

  /** Trifft eine Figur: fit → verletzt, verletzt → tot. */
  function verletzen(m) {
    if (m.zustand === "fit") m.zustand = "verletzt";
    else if (m.zustand === "verletzt") m.zustand = "tot";
    return m.zustand;
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
    for (const k of w.chapters) if (!orte.has(k.place)) probleme.push(`Kapitel ${k.title}: Ort fehlt`);
    for (const e of w.events) {
      if (e.options.length !== 2) probleme.push(`Ereignis ${e.id}: genau zwei Wahlen`);
      if (e.needsMember && !leute.has(e.needsMember)) probleme.push(`Ereignis ${e.id}: Mitglied fehlt`);
      for (const o of e.options) {
        for (const m of [o.effect.recruit, o.effect.removeMember, o.effect.hurtMember]) {
          if (m && !leute.has(m)) probleme.push(`Ereignis ${e.id}: Mitglied ${m} fehlt`);
        }
      }
    }
    return probleme;
  }

  // ---------- Spielstand ----------

  function neuesSpiel(w, seed) {
    return {
      location: w.start.place,
      resources: Object.assign({}, w.start.resources),
      troupe: w.troupe.map(mitgliedAnlegen),
      kapitel: 0,
      seenEvents: [],
      rng: neuerZufall(seed),
      show: null,
      tutorial: { karte: false, vorstellung: false },
    };
  }

  // Eine Tour benutzt dieselbe Karte, aber einen wiederholbaren Tourplan.
  const TOUR_LIMIT = 6;
  const TOUR_FINALE_AB = 5;
  const WAGEN = {
    buehne: { name: "Bühnenwagen", text: "Fünf Künstler und die volle Startbesetzung." },
    leicht: { name: "Leichter Wagen", text: "Vier Künstler brauchen weniger Brot. Wenzel bleibt zurück." },
  };
  const VERBESSERUNGEN = {
    sicher: { name: "Generalprobe", text: "Pannenrisiko bei riskanten Nummern halbiert." },
    finale: { name: "Große Nummer", text: "Ab Serie ×2: riskante Treffer bringen mehr Applaus, können aber eher schiefgehen." },
    impro: { name: "Improvisation", text: "Die sichere Improvisation bringt 4 Applaus und hält die Serie." },
  };

  const wegSchluessel = (r) => [r.from, r.to].sort().join(":");
  const tourWeg = (s, r) => !!r && (!s.tour || !s.tour.gesperrt.includes(wegSchluessel(r)));

  function distanz(w, gesperrt, start, ziel) {
    const besucht = new Set([start]);
    let ebene = [start], n = 0;
    while (ebene.length) {
      if (ebene.includes(ziel)) return n;
      const weiter = [];
      for (const ort of ebene) for (const nach of w.nachbarn(ort)) {
        if (besucht.has(nach) || gesperrt.includes(wegSchluessel(w.weg(ort, nach)))) continue;
        besucht.add(nach);
        weiter.push(nach);
      }
      ebene = weiter;
      n++;
    }
    return Infinity;
  }

  function neueTour(w, seed, wagen = "buehne") {
    if (!Object.hasOwn(WAGEN, wagen)) throw new Error("unbekannter Wagen");
    const s = neuesSpiel(w, seed);
    const plan = neuerZufall(BigInt(seed) ^ 0xfad159n);
    const finale = w.chapters[w.chapters.length - 1].place;
    const maerkte = w.places.filter((p) => p.kind === "market");
    const jahrmarkt = maerkte[zufallsIndex(plan, maerkte.length)].id;
    const strassen = w.roads.map(wegSchluessel).sort();
    const gesperrt = [];
    // Höchstens ein gesperrter Weg und keine unerreichbaren Orte.
    while (strassen.length) {
      const schluessel = strassen.splice(zufallsIndex(plan, strassen.length), 1)[0];
      if (w.places.every((o) => Number.isFinite(distanz(w, [schluessel], o.id, finale)))) {
        gesperrt.push(schluessel);
        break;
      }
    }
    const kosten = {};
    const offen = w.roads.filter((r) => !gesperrt.includes(wegSchluessel(r)));
    const abkuerzung = offen[zufallsIndex(plan, offen.length)];
    kosten[wegSchluessel(abkuerzung)] = -1;
    s.tour = { seed: String(seed), wagen, finale, ziel: 17 + zufallsIndex(plan, 3),
      jahrmarkt, gesperrt, kosten, schritte: 0, status: "unterwegs", perks: [], angebot: [],
      marktStart: zufallsIndex(plan, w.recruits.length), auszahlung: null, halt: null, freigeschaltet: false };
    if (wagen === "leicht") s.troupe = s.troupe.filter((m) => m.id !== "wenzel");
    return s;
  }

  const tourFinale = (s) => !!s.tour && s.location === s.tour.finale && s.tour.schritte >= TOUR_FINALE_AB;
  const tourRestweg = (s, w, von = s.location) => distanz(w, s.tour.gesperrt, von, s.tour.finale);
  const lebende = (s) => s.troupe.filter(lebt);
  const mitglied = (s, id) => s.troupe.find((m) => m.id === id);
  const spielVorbei = (s) => lebende(s).length === 0 || !!(s.tour && s.tour.status !== "unterwegs");
  const kapitel = (s, w) => s.tour ? null : w.chapters[s.kapitel] || null;

  function zufallsFitter(s) {
    const kandidaten = s.troupe.filter(fit);
    if (!kandidaten.length) return null;
    return kandidaten[zufallsIndex(s.rng, kandidaten.length)];
  }

  // ---------- Reisen ----------

  /** Brot für einen Weg: je Tag ein Brot pro zwei Leute. */
  function wegKosten(s, weg) {
    const rabatt = s.tour ? s.tour.kosten[wegSchluessel(weg)] || 0 : 0;
    return Math.max(1, weg.days * Math.ceil(lebende(s).length / 2) + rabatt);
  }

  function kannPassieren(s, e) {
    if (!e.repeatable && s.seenEvents.includes(e.id)) return false;
    if (e.needsMember) {
      const m = mitglied(s, e.needsMember);
      return !!(m && lebt(m));
    }
    return true;
  }

  function ereignisWaehlen(s, weg, w, hunger) {
    const offen = w.events.filter((e) => kannPassieren(s, e));
    if (hunger) return offen.find((e) => e.trigger === "hunger") || null;
    if (weg.kind === "forest" && einheit(s.rng) < 0.6) {
      const wald = offen.filter((e) => e.trigger === "forest");
      if (wald.length) return wald[zufallsIndex(s.rng, wald.length)];
    }
    if (einheit(s.rng) < 0.4) {
      const reise = offen.filter((e) => e.trigger === "travel");
      if (reise.length) return reise[zufallsIndex(s.rng, reise.length)];
    }
    return null;
  }

  function reisen(s, ziel, w) {
    const ort = w.ort(ziel);
    if (!ort) throw new Error("unbekannter Ort");
    const weg = w.weg(s.location, ziel);
    if (!tourWeg(s, weg)) throw new Error("kein offener Weg");
    if (s.tour && (s.tour.status !== "unterwegs" || s.tour.schritte >= TOUR_LIMIT || s.tour.halt || s.tour.auszahlung || s.show)) throw new Error("die Tour kann gerade nicht weiterreisen");
    if (s.tour) s.tour.schritte++;
    const kosten = wegKosten(s, weg);
    const hunger = s.resources.food < kosten;
    s.resources.food = Math.max(0, s.resources.food - kosten);
    s.location = ziel;
    s.show = null;
    const geheilt = [];
    if (ort.kind === "monastery") {
      for (const m of s.troupe) if (m.zustand === "verletzt") { m.zustand = "fit"; geheilt.push(m.id); }
    }
    const bericht = { from: weg.from, to: ziel, brot: kosten, hunger, geheilt, event: ereignisWaehlen(s, weg, w, hunger) };
    if (s.tour) s.tour.halt = { art: "ankunft", ereignis: bericht.event && bericht.event.id, geheilt };
    return bericht;
  }

  // ---------- Ereignisse ----------

  function entscheiden(s, option, ereignis, w) {
    const e = option.effect || {};
    const vorher = Object.assign({}, s.resources);
    const dazu = [], weg = [], verletzt = [], tot = [];
    s.resources.food += e.food || 0;
    s.resources.coins += e.coins || 0;
    begrenzen(s.resources);
    const treffen = (m) => {
      if (!m) return;
      if (verletzen(m) === "tot") tot.push(m.id);
      else verletzt.push(m.id);
    };
    if (e.hurt) {
      // trifft eine zufällige Figur, auch schon verletzte
      const kandidaten = lebende(s);
      if (kandidaten.length) treffen(kandidaten[zufallsIndex(s.rng, kandidaten.length)]);
    }
    if (e.hurtMember) {
      const m = mitglied(s, e.hurtMember);
      if (m && lebt(m)) treffen(m);
    }
    if (e.removeMember) {
      const i = s.troupe.findIndex((x) => x.id === e.removeMember);
      if (i >= 0) { s.troupe.splice(i, 1); weg.push(e.removeMember); }
    }
    if (e.recruit && !mitglied(s, e.recruit)) {
      const neu = w.recruits.find((m) => m.id === e.recruit);
      if (neu) { s.troupe.push(mitgliedAnlegen(neu)); dazu.push(neu.id); }
    }
    if (!s.seenEvents.includes(ereignis.id)) s.seenEvents.push(ereignis.id);
    return {
      outcome: option.outcome,
      change: { food: s.resources.food - vorher.food, coins: s.resources.coins - vorher.coins },
      joined: dazu, left: weg, hurt: verletzt, deaths: tot,
    };
  }

  // ---------- Kapitelziel ----------

  /** Ist das Kapitelziel hier und jetzt erfüllt? */
  const zielErreichbar = (s, w) => {
    const k = kapitel(s, w);
    return !!k && s.location === k.place && s.resources.coins >= k.coins;
  };

  /** Ziel einlösen: Gold wird bezahlt, das nächste Kapitel beginnt. */
  function zielEinloesen(s, w) {
    if (!zielErreichbar(s, w)) throw new Error("Ziel nicht erreicht");
    const k = kapitel(s, w);
    s.resources.coins -= k.coins;
    s.kapitel += 1;
    for (const m of s.troupe) if (m.zustand === "verletzt") m.zustand = "fit";
    return k;
  }

  // ---------- Vorstellung „Noch eine Nummer?“ ----------
  // Das Publikum ruft immer nur EINEN Wunsch. Passt die Figur, gibt es
  // Können × Serie Applaus und die Serie wächst. Passt sie nicht, gibt es
  // 1 Applaus, die Serie reißt und das Publikum verliert Geduld. Riskante
  // Nummern (Akrobatik, Feuer, Tiere) bringen mehr, können aber misslingen:
  // dann ist die Figur verletzt. Ist die Geduld weg, laufen die Leute
  // davon und der halbe Hut ist leer.

  function rufWaehlen(ort, rng, vorher) {
    const topf = ort.likes.concat(ort.likes, GEFUEHLE);
    let f = topf[zufallsIndex(rng, topf.length)];
    for (let i = 0; i < 6 && f === vorher; i++) f = topf[zufallsIndex(rng, topf.length)];
    return f;
  }

  function showStarten(s, w) {
    const ort = w.ort(s.location);
    if (s.tour) {
      if (spielVorbei(s) || s.tour.auszahlung || s.show || (!s.tour.halt && (s.tour.schritte > 0 || s.tour.startAuftritt))) throw new Error("kein neuer Auftritt möglich");
      if (!s.tour.schritte) s.tour.startAuftritt = true;
      s.tour.halt = null;
    }
    if (s.tour) s.tour.publikum = ort.likes.slice();
    s.show = { ruf: rufWaehlen(ort, s.rng, null), applaus: 0, serie: 1, geduld: GEDULD, gespielt: [], vorbei: false, verlaufen: false, verloren: 0, offen: true, naechsterRuf: null, improvisiert: false };
    return s.show;
  }

  /** Wer kann jetzt noch auftreten? */
  function showFrei(s) {
    const gespielt = new Set(s.show ? s.show.gespielt : []);
    return s.troupe.filter((m) => fit(m) && !gespielt.has(m.id));
  }

  /** Was würde diese Figur jetzt bringen? */
  function showVorschau(s, m) {
    const sh = s.show;
    const passt = m.feeling === sh.ruf;
    const riskant = RISKANT.has(m.discipline);
    const perks = s.tour ? s.tour.perks : [];
    const finale = riskant && perks.includes("finale") && sh.serie >= 2;
    const risiko = riskant ? (PANNE_RISIKO + (finale ? 0.1 : 0)) * (perks.includes("sicher") ? 0.5 : 1) : 0;
    return { passt, riskant, risiko, punkte: passt ? (m.skill + (riskant ? 1 : 0) + (finale ? 3 : 0)) * sh.serie : 1 };
  }

  function showNummer(s, id) {
    const sh = s.show;
    if (!sh || sh.vorbei || !sh.offen) throw new Error("gerade keine Nummer möglich");
    const m = showFrei(s).find((x) => x.id === id);
    if (!m) throw new Error("diese Figur kann nicht auftreten");
    const v = showVorschau(s, m);
    const panne = v.riskant && einheit(s.rng) < v.risiko;
    let punkte;
    if (panne) {
      punkte = 0;
      verletzen(m);
      sh.geduld -= 1;
      sh.serie = 1;
    } else if (v.passt) {
      punkte = v.punkte;
      sh.serie = Math.min(SERIE_MAX, sh.serie + 1);
    } else {
      punkte = 1;
      sh.geduld -= 1;
      sh.serie = 1;
    }
    sh.applaus += punkte;
    sh.gespielt.push(m.id);
    if (sh.geduld <= 0) {
      sh.vorbei = true;
      sh.verlaufen = true;
      sh.verloren = Math.ceil(sh.applaus / 2);
      sh.applaus -= sh.verloren;
    } else if (!showFrei(s).length) {
      sh.vorbei = true;
    }
    sh.offen = false;
    if (s.tour && !sh.vorbei) sh.naechsterRuf = rufWaehlen({ likes: s.tour.publikum }, s.rng, sh.ruf);
    return { memberID: m.id, ruf: sh.ruf, passt: v.passt && !panne, panne, punkte, serie: sh.serie };
  }

  /** „Noch eine!“: Das Publikum ruft den nächsten Wunsch. */
  function showWeiter(s, w) {
    const sh = s.show;
    if (!sh || sh.vorbei || sh.offen) throw new Error("gerade nicht möglich");
    sh.ruf = sh.naechsterRuf || rufWaehlen(w.ort(s.location), s.rng, sh.ruf);
    sh.naechsterRuf = null;
    sh.offen = true;
    return sh.ruf;
  }

  function improvisationsKandidat(s) {
    const sh = s.show;
    if (!s.tour || !sh || sh.vorbei || sh.improvisiert) return null;
    const ruf = sh.offen ? sh.ruf : sh.naechsterRuf;
    if (!ruf) return null;
    return showFrei(s).filter((m) => m.feeling !== ruf).sort((a, b) => a.skill - b.skill || a.id.localeCompare(b.id))[0] || null;
  }

  function showImprovisieren(s, w) {
    const m = improvisationsKandidat(s);
    if (!m) throw new Error("keine Improvisation möglich");
    const sh = s.show;
    if (!sh.offen) showWeiter(s, w);
    const geuebt = s.tour.perks.includes("impro");
    const punkte = geuebt ? 4 : 1;
    sh.improvisiert = true;
    sh.applaus += punkte;
    if (!geuebt) sh.serie = 1;
    sh.gespielt.push(m.id);
    sh.vorbei = !showFrei(s).length;
    sh.offen = false;
    if (!sh.vorbei) sh.naechsterRuf = rufWaehlen(w.ort(s.location), s.rng, sh.ruf);
    return { memberID: m.id, ruf: sh.ruf, passt: true, panne: false, punkte, serie: sh.serie };
  }

  function hutVorschau(s, w) {
    const a = s.show.applaus;
    const l = lohn(a, w.ort(s.location));
    if (s.tour && s.location === s.tour.jahrmarkt) l.coins += Math.floor(a / 6);
    return l;
  }

  /** Was bringt der Applaus an diesem Ort? Dörfer zahlen in Brot, Märkte und Burgen in Gold. */
  function lohn(applaus, ort) {
    const a = applaus;
    switch (ort.kind) {
      case "village": return { food: 2 + Math.round(a * 0.45), coins: Math.floor(a / 8) };
      case "market": return { food: Math.floor(a / 8), coins: 1 + Math.round(a * 0.3) };
      case "castle": return { food: 0, coins: 2 + Math.round(a * 0.45) };
      default: return { food: 3 + Math.round(a * 0.4), coins: 0 };
    }
  }

  const sterneFuer = (applaus, verlaufen) => (verlaufen ? 1 : Math.max(1, Math.min(5, Math.round(applaus / 7))));

  function showKassieren(s, w) {
    const sh = s.show;
    if (!sh) throw new Error("keine Vorstellung");
    if (s.tour && !sh.gespielt.length) throw new Error("zuerst eine Nummer spielen");
    const l = hutVorschau(s, w);
    s.resources.food += l.food;
    s.resources.coins += l.coins;
    begrenzen(s.resources);
    s.show = null;
    if (s.tutorial) s.tutorial.vorstellung = true;
    const result = { applaus: sh.applaus, sterne: sterneFuer(sh.applaus, sh.verlaufen), reward: l, verlaufen: sh.verlaufen, verloren: sh.verloren };
    if (s.tour) {
      const t = s.tour;
      const finale = tourFinale(s);
      const erfolg = finale && !sh.verlaufen && sh.applaus >= t.ziel;
      if (erfolg) t.status = "gewonnen";
      else if (finale || t.schritte >= TOUR_LIMIT) t.status = "gescheitert";
      const frei = Object.keys(VERBESSERUNGEN).filter((k) => !t.perks.includes(k));
      if (t.status === "unterwegs" && sh.applaus >= 4 && !sh.verlaufen && t.perks.length < 2 && frei.length >= 2) {
        const start = zufallsIndex(s.rng, frei.length);
        t.angebot = [frei[start], frei[(start + 1) % frei.length]];
      }
      t.auszahlung = Object.assign(result, { finale, erfolg });
    }
    return result;
  }

  function tourVerbessern(s, id) {
    const t = s.tour;
    if (!t || !t.auszahlung || !t.angebot.includes(id)) throw new Error("Verbesserung nicht verfügbar");
    t.perks.push(id);
    t.angebot = [];
    return VERBESSERUNGEN[id];
  }

  function tourAufbruch(s) {
    const t = s.tour;
    if (!t || !t.auszahlung || t.angebot.length) throw new Error("Auszahlung/Verbesserung noch offen");
    t.auszahlung = null;
  }

  function tourOhneAuftritt(s) {
    if (!s.tour || !s.show || showFrei(s).length || s.show.gespielt.length) throw new Error("ein Auftritt ist möglich");
    s.show = null;
    if (tourFinale(s) || s.tour.schritte >= TOUR_LIMIT) s.tour.status = "gescheitert";
  }

  // ---------- Markt: Brot kaufen, Künstler anwerben ----------

  const kannBrotKaufen = (s, ort) => ort.kind !== "castle" && ort.kind !== "monastery" && s.resources.coins >= BROT_KAUF.preis;

  function brotKaufen(s, ort) {
    if (!kannBrotKaufen(s, ort)) throw new Error("hier kein Brot");
    s.resources.coins -= BROT_KAUF.preis;
    s.resources.food += BROT_KAUF.menge;
  }

  /** Wer wartet auf diesem Markt auf Arbeit? Immer dieselbe Person pro Markt, bis sie angeworben ist. */
  function bewerber(s, w) {
    const ort = w.ort(s.location);
    if (ort.kind !== "market") return null;
    const frei = w.recruits.filter((m) => m.price && !mitglied(s, m.id));
    if (!frei.length) return null;
    let h = 0;
    for (const c of ort.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return frei[((h + s.troupe.length + (s.tour ? s.tour.marktStart : 0)) >>> 0) % frei.length];
  }

  function anwerben(s, w) {
    const b = bewerber(s, w);
    if (!b || s.resources.coins < b.price) throw new Error("kann nicht anwerben");
    s.resources.coins -= b.price;
    const neu = mitgliedAnlegen(b);
    s.troupe.push(neu);
    return neu;
  }

  const Logik = {
    neuerZufall, einheit, welt, pruefen, neuesSpiel, lebende, mitglied, spielVorbei, kapitel, lebt, fit,
    wegKosten, reisen, kannPassieren, entscheiden, zielErreichbar, zielEinloesen,
    showStarten, showFrei, showVorschau, showNummer, showWeiter, showKassieren, lohn, sterneFuer,
    kannBrotKaufen, brotKaufen, bewerber, anwerben,
    neueTour, tourWeg, tourRestweg, tourFinale, tourVerbessern, tourAufbruch, tourOhneAuftritt,
    improvisationsKandidat, showImprovisieren, hutVorschau, TOUR_LIMIT, TOUR_FINALE_AB, WAGEN, VERBESSERUNGEN,
    ORTSART, GEFUEHL, DISZIPLIN, GEDULD, BROT_KAUF, RISKANT,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Logik;
  else root.Logik = Logik;
})(typeof window !== "undefined" ? window : globalThis);
