// Töne und ruhiger Hintergrundklang für "Luftlinie".
//
// Alles wird direkt im Browser erzeugt (Web Audio), es gibt keine Tondateien.
// Die Datei hängt sich fast nur von außen an: Sie hört auf Knopfdrücke und sieht nach,
// welche Meldungen und Fenster im Spielfeld erscheinen. Im Spiel selbst gibt es nur
// wenige direkte Aufrufe (Kauf, neue Linie) und den Schalter in der Kopfleiste.
//
// iPhone: Safari spielt Ton erst nach der ersten Berührung. Der Ton läuft als "ambient":
// Er mischt sich mit Musik aus anderen Apps und schweigt, wenn der Stummschalter am iPhone an ist.
(function () {
  "use strict";

  const SPEICHER = "luftlinie-ton";
  const lesen = () => { try { return Object.assign({ an: true, musik: false }, JSON.parse(localStorage.getItem(SPEICHER)) || {}); } catch (e) { return { an: true, musik: false }; } };
  const einst = lesen();
  const merken = () => { try { localStorage.setItem(SPEICHER, JSON.stringify(einst)); } catch (e) { /* egal */ } };

  // Mischt sich mit anderer Musik und hält sich an den Stummschalter (Safari ab iOS 17).
  try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) { /* älteres iOS */ }

  let ctx = null, haupt = null, toene = null, musikBus = null, hall = null;
  const zuletzt = {};          // wann ein Ton zuletzt lief, damit nichts rattert
  const verlauf = [];          // die letzten Töne, für Tests

  function aufbauen() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    haupt = ctx.createGain(); haupt.gain.value = einst.an ? 1 : 0;
    const bremse = ctx.createDynamicsCompressor();      // nichts wird plötzlich laut
    bremse.threshold.value = -18; bremse.ratio.value = 4;
    haupt.connect(bremse).connect(ctx.destination);
    toene = ctx.createGain(); toene.gain.value = 0.32; toene.connect(haupt);
    // Ein kleines Echo macht die Töne weicher.
    hall = ctx.createDelay(0.5); hall.delayTime.value = 0.16;
    const rueck = ctx.createGain(); rueck.gain.value = 0.28;
    const hallPegel = ctx.createGain(); hallPegel.gain.value = 0.22;
    const hallFilter = ctx.createBiquadFilter(); hallFilter.type = "lowpass"; hallFilter.frequency.value = 2600;
    hall.connect(hallFilter).connect(rueck).connect(hall);
    hallFilter.connect(hallPegel).connect(haupt);
    toene.connect(hall);
    musikBus = ctx.createGain(); musikBus.gain.value = 0; musikBus.connect(haupt); musikBus.connect(hall);
    return ctx;
  }

  // Bei jeder Berührung: Ton freischalten (iPhone) und nach dem Zurückkehren wieder anwerfen.
  function wecken() {
    if (!aufbauen()) return;
    if (ctx.state !== "running") {
      ctx.resume().catch(() => {});
      // Ein stiller Mini-Ton schaltet den Lautsprecher auf älteren iPhones frei.
      const b = ctx.createBuffer(1, 1, 22050), q = ctx.createBufferSource();
      q.buffer = b; q.connect(ctx.destination); q.start(0);
    }
    if (einst.an && einst.musik) musikStarten();
  }
  for (const art of ["touchend", "pointerup", "click", "keydown"]) document.addEventListener(art, wecken, true);
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (einst.an) ctx.resume().catch(() => {});
  });

  // ---------- Bausteine ----------
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);     // MIDI-Nummer in Hertz

  // Ein einzelner weicher Ton: kurzer Anschlag, sanftes Ausklingen.
  function ton(frequenz, start, dauer, opt) {
    const o = opt || {};
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.form || "sine";
    osc.frequency.setValueAtTime(frequenz, t0);
    if (o.bis) osc.frequency.exponentialRampToValueAtTime(o.bis, t0 + dauer);
    const laut = o.laut == null ? 0.5 : o.laut;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(laut, t0 + (o.an || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
    osc.connect(g).connect(o.ziel || toene);
    osc.start(t0); osc.stop(t0 + dauer + 0.05);
    // Glockenartiger Oberton für helle Klänge.
    if (o.glocke) ton(frequenz * 2.76, start, dauer * 0.45, { laut: laut * 0.18, ziel: o.ziel });
  }

  // Rauschen, z. B. für das Abheben eines Flugzeugs.
  let rauschPuffer = null;
  function rauschen(start, dauer, vonHz, bisHz, laut) {
    if (!rauschPuffer) {
      rauschPuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = rauschPuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + start;
    const q = ctx.createBufferSource(); q.buffer = rauschPuffer;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(vonHz, t0); f.frequency.exponentialRampToValueAtTime(bisHz, t0 + dauer);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(laut, t0 + dauer * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
    q.connect(f).connect(g).connect(toene);
    q.start(t0); q.stop(t0 + dauer + 0.05);
  }

  // ---------- Die Töne ----------
  // Jeder Ton hat eine Mindestpause, damit nichts nervt.
  const TOENE = {
    // Knöpfe: ganz kurzes, leises Klicken.
    tipp: [0.06, () => ton(1500, 0, 0.05, { laut: 0.11, bis: 1100 })],
    haupt: [0.06, () => { ton(880, 0, 0.07, { laut: 0.14 }); ton(1320, 0.045, 0.09, { laut: 0.12 }); }],
    zu: [0.06, () => ton(900, 0, 0.06, { laut: 0.09, bis: 600 })],
    // Flughafen-Gong für eine neue Meldung.
    meldung: [2.5, () => { ton(NOTE(76), 0, 0.9, { laut: 0.2, glocke: true }); ton(NOTE(72), 0.28, 1.2, { laut: 0.18, glocke: true }); }],
    // Etwas Gutes ist passiert.
    erfolg: [2.5, () => [72, 76, 79].forEach((n, i) => ton(NOTE(n), i * 0.09, 0.7, { laut: 0.2, glocke: true }))],
    // Ziel erreicht: kleine Fanfare.
    ziel: [3, () => { [67, 72, 76, 79].forEach((n, i) => ton(NOTE(n), i * 0.11, 0.5, { laut: 0.22, form: "triangle" })); ton(NOTE(84), 0.46, 1.4, { laut: 0.2, glocke: true }); }],
    // Rivale kündigt etwas an oder greift an: zwei tiefe, ernste Töne.
    rivale: [2.5, () => { ton(NOTE(57), 0, 0.5, { laut: 0.22, form: "triangle" }); ton(NOTE(56), 0.22, 0.8, { laut: 0.2, form: "triangle" }); }],
    // Warnung (Konto im Minus usw.): zwei gedämpfte Pulse.
    warnung: [3, () => { ton(NOTE(62), 0, 0.22, { laut: 0.2, form: "square", bis: NOTE(60) }); ton(NOTE(62), 0.3, 0.3, { laut: 0.18, form: "square", bis: NOTE(58) }); }],
    // Kasse: Flugzeug gekauft.
    kauf: [0.5, () => { rauschen(0, 0.06, 4000, 3000, 0.12); ton(NOTE(88), 0.03, 0.25, { laut: 0.18, glocke: true }); ton(NOTE(93), 0.11, 0.6, { laut: 0.2, glocke: true }); }],
    // Neue Linie: Flugzeug hebt ab, dazu ein aufsteigender Dreiklang.
    linie: [1, () => { rauschen(0, 1.3, 300, 2200, 0.16); [69, 73, 76, 81].forEach((n, i) => ton(NOTE(n), 0.15 + i * 0.1, 0.8, { laut: 0.17, glocke: true })); }],
    // Landung mit Gewinn: ein winziges, leises Pling (höchstens alle zwei Sekunden).
    landung: [2.2, () => ton(NOTE(96), 0, 0.18, { laut: 0.05 })],
    // Tagesabschluss: Münzen klimpern, oder ein leiser Abwärtston bei Verlust.
    tagPlus: [2, () => [0, 0.07, 0.13, 0.22, 0.3].forEach((t, i) => ton(NOTE(91 + (i % 3) * 2), t, 0.2, { laut: 0.1, glocke: true }))],
    tagMinus: [2, () => { ton(NOTE(67), 0, 0.35, { laut: 0.14, form: "triangle" }); ton(NOTE(63), 0.18, 0.6, { laut: 0.12, form: "triangle" }); }],
    // Versteigerung: ein neues Gebot (kurzes Holz-Klopfen), dann Sieg oder Niederlage.
    gebot: [0.25, () => { rauschen(0, 0.03, 1800, 900, 0.14); ton(NOTE(81), 0, 0.12, { laut: 0.15, form: "triangle" }); }],
    sieg: [2, () => { [60, 64, 67, 72].forEach((n, i) => ton(NOTE(n), i * 0.12, 0.45, { laut: 0.2, form: "triangle" })); [72, 76, 79].forEach((n) => ton(NOTE(n), 0.5, 1.6, { laut: 0.13, glocke: true })); }],
    verloren: [2, () => { ton(NOTE(67), 0, 0.4, { laut: 0.16, form: "triangle" }); ton(NOTE(65), 0.25, 0.4, { laut: 0.15, form: "triangle" }); ton(NOTE(62), 0.5, 1, { laut: 0.14, form: "triangle" }); }],
    // Ein Tipp der Einführung oder eine Entscheidung erscheint.
    hinweis: [1, () => ton(NOTE(84), 0, 0.8, { laut: 0.14, glocke: true })],
    entscheidung: [1.5, () => { ton(NOTE(79), 0, 0.6, { laut: 0.17, glocke: true }); ton(NOTE(84), 0.14, 1, { laut: 0.16, glocke: true }); }],
    // Pleite oder verkauft.
    ende: [3, () => [64, 60, 57, 52].forEach((n, i) => ton(NOTE(n), i * 0.32, 1.2, { laut: 0.16, form: "triangle" }))],
  };

  function spielen(name) {
    if (!einst.an || !ctx || ctx.state !== "running" || document.hidden) return;
    const t = TOENE[name];
    if (!t) return;
    const jetzt = ctx.currentTime;
    if (zuletzt[name] != null && jetzt - zuletzt[name] < t[0]) return;
    zuletzt[name] = jetzt;
    verlauf.push(name); if (verlauf.length > 40) verlauf.shift();
    try { t[1](); } catch (e) { verlauf.push("fehler:" + name); }   // Ton ist nie wichtiger als das Spiel
  }

  // ---------- Ruhiger Hintergrundklang ----------
  // Weiche Akkorde, die langsam ineinander übergehen, dazu ein leises Kabinenrauschen.
  const AKKORDE = [[50, 57, 62, 66, 69], [47, 54, 62, 66, 71], [43, 55, 62, 66, 71], [45, 52, 61, 64, 69]];
  let musikTimer = null, akkordNr = 0, brummen = null;
  function akkordSpielen() {
    const ak = AKKORDE[akkordNr++ % AKKORDE.length];
    const t0 = ctx.currentTime, dauer = 11;
    for (const n of ak) {
      const osc = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      osc.type = n < 52 ? "sine" : "triangle";
      osc.frequency.value = NOTE(n);
      osc.detune.value = (Math.random() - 0.5) * 8;
      f.type = "lowpass"; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(n < 52 ? 0.05 : 0.025, t0 + 3.5);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dauer);
      osc.connect(f).connect(g).connect(musikBus);
      osc.start(t0); osc.stop(t0 + dauer + 0.1);
    }
    // Ab und zu ein einzelner heller Ton darüber.
    if (Math.random() < 0.6) ton(NOTE(ak[2 + Math.floor(Math.random() * 3)] + 12), 2 + Math.random() * 4, 2.5, { laut: 0.03, an: 0.4, glocke: true, ziel: musikBus });
  }
  function musikStarten() {
    if (!ctx || musikTimer) return;
    musikBus.gain.cancelScheduledValues(ctx.currentTime);
    musikBus.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    if (!brummen) {
      // Leises, tiefes Rauschen wie in einer Kabine.
      const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      let letzt = 0;
      for (let i = 0; i < len; i++) { letzt = (letzt + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = letzt * 3.5; }
      const q = ctx.createBufferSource(); q.buffer = b; q.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 380;
      const g = ctx.createGain(); g.gain.value = 0.05;
      q.connect(f).connect(g).connect(musikBus); q.start();
      brummen = q;
    }
    akkordSpielen();
    musikTimer = setInterval(() => { if (ctx.state === "running") akkordSpielen(); }, 8000);
  }
  function musikStoppen() {
    if (!ctx) return;
    clearInterval(musikTimer); musikTimer = null;
    musikBus.gain.cancelScheduledValues(ctx.currentTime);
    musikBus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
    if (brummen) { const b = brummen; brummen = null; setTimeout(() => { try { b.stop(); } catch (e) {} }, 3000); }
  }

  // ---------- Schalter ----------
  function anSetzen(an) {
    einst.an = an; merken();
    if (ctx) haupt.gain.setTargetAtTime(an ? 1 : 0, ctx.currentTime, 0.05);
    if (an) { wecken(); setTimeout(() => spielen("haupt"), 30); }
    else musikStoppen();
  }
  function musikSetzen(an) {
    einst.musik = an; merken();
    if (an && einst.an) { wecken(); musikStarten(); } else musikStoppen();
  }

  // ---------- Von außen anhängen ----------
  // Knöpfe klicken leise. Der Ton-Schalter selbst bleibt still (der spielt beim Einschalten selbst).
  document.addEventListener("click", (e) => {
    const k = e.target.closest && e.target.closest("button");
    if (!k || k.disabled || k.classList.contains("tonknopf")) return;
    if (k.classList.contains("hauptknopf")) spielen("haupt");
    else if (k.classList.contains("zu")) spielen("zu");
    else spielen("tipp");
  }, true);

  // Was im Spielfeld neu erscheint, bekommt seinen Ton.
  const GUT = new Set(["ziel", "aufstieg", "gerettet", "duellsieg", "versteigerungsieg", "rennensieg", "stufe", "welt", "plus"]);
  const SCHLECHT = new Set(["mahnung", "kredit", "pleite", "krise", "abstieg", "slotverloren", "slotweg", "uebernahme", "verlust"]);
  const RIVALE = new Set(["rivale", "plan", "angriff", "duell", "aufkauf"]);
  function neuesElement(n) {
    const c = n.classList;
    if (!c) return;
    if (c.contains("meldung")) {
      const art = n.dataset.art;
      spielen(c.contains("ziel") || art === "ziel" ? "ziel" : GUT.has(art) ? "erfolg" : SCHLECHT.has(art) ? "warnung" : RIVALE.has(art) ? "rivale" : "meldung");
    } else if (c.contains("abschluss")) {
      const s = window.luftlinie && window.luftlinie.st, lt = s && s.letzterTag;
      if (lt && lt.gewinn) spielen(lt.gewinn < 0 ? "tagMinus" : "tagPlus");
    } else if (c.contains("ergebnis-seite")) {
      const k = n.querySelector(".ergebnis-karte");
      spielen(k && k.classList.contains("sieg") ? "sieg" : "verloren");
    } else if (c.contains("warnung") || c.contains("uebernahme")) spielen("warnung");
    else if (c.contains("tipp")) spielen("hinweis");
    else if (c.contains("landung") && !c.contains("minus")) spielen("landung");
    else if (c.contains("seite") && !c.contains("ergebnis-seite") && window.luftlinie && window.luftlinie.st && window.luftlinie.st.ende) spielen("ende");
  }
  function beobachten() {
    const feld = document.getElementById("feld");
    if (!feld || !window.MutationObserver) return;
    new MutationObserver((liste) => {
      if (!einst.an || !ctx) return;
      for (const m of liste) for (const n of m.addedNodes) if (n.nodeType === 1) neuesElement(n);
    }).observe(feld, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", beobachten); else beobachten();

  window.Ton = {
    spielen, verlauf,
    get zustand() { return ctx ? ctx.state : "aus"; },
    get an() { return einst.an; },
    get musik() { return einst.musik; },
    anSetzen, musikSetzen,
    umschalten() { anSetzen(!einst.an); return einst.an; },
  };
})();
