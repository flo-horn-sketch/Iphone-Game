// Oberfläche von "Clan-Viertel". Alle Regeln stehen in clan-logik.js.
(function () {
  "use strict";

  const L = window.ClanLogik;
  const SPEICHER = "clanviertel-v1";
  const SIEGE = "clanviertel-siege";
  const EINFUEHRUNG = "clanviertel-einfuehrung";
  const FELD_B = 844, FELD_H = 390;

  const feld = document.getElementById("feld");
  const rahmen = document.getElementById("rahmen");
  let skala = 1;

  function skalieren() {
    const cs = getComputedStyle(rahmen);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const w = rahmen.clientWidth - pl - pr, h = rahmen.clientHeight - pt - pb;
    skala = Math.max(0.2, Math.min(w / FELD_B, h / FELD_H));
    feld.style.left = pl + w / 2 + "px";
    feld.style.top = pt + h / 2 + "px";
    feld.style.transform = `translate(-50%, -50%) scale(${skala})`;
  }
  window.addEventListener("resize", skalieren);
  window.addEventListener("orientationchange", () => setTimeout(skalieren, 200));

  function el(tag, props, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kind of kinder.flat(Infinity)) {
      if (kind == null || kind === false) continue;
      e.append(kind.nodeType ? kind : String(kind));
    }
    return e;
  }
  const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
  function lesen(schluessel, ersatz) {
    try { const roh = localStorage.getItem(schluessel); return roh ? JSON.parse(roh) : ersatz; } catch (e) { return ersatz; }
  }
  function schreiben(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch (e) { /* ohne Speicher spielbar */ }
  }

  // ---------- Bilder ----------
  // Jedes Bild hat einen festen Namen (siehe GRAFIKEN.md, Abschnitt Clan-Viertel).
  // Liegt es in web/grafiken/, wird es gezeigt, sonst ein Platzhalter.
  const dateien = new Set();
  function bild(name) {
    return dateien.has(name + ".png") ? "../grafiken/" + name + ".png" : null;
  }
  function bildEl(name, klasse) {
    const pfad = bild(name);
    return pfad ? el("img", { class: klasse, src: pfad, alt: "" }) : null;
  }

  const ICON = { anfuehrer: "👑", waechter: "🛡️", laeufer: "🏃", spaeher: "👁️" };
  const WAPPEN = { mine: "⛏️", markt: "🪙", schule: "⚔️", haupthaus: "🏯" };
  const ERTRAG = { mine: "💎 1", markt: "🪙 2", schule: "⚔️", haupthaus: "🪙 2" };
  const PORTRAIT = { stuermer: "clan-varo", mauer: "clan-hesra", listig: "clan-sel" };
  const SPRUECHE = {
    stuermer: { ansage: (o) => `Morgen gehört <b>${o}</b> mir!`, keine: "Ich sammle meine Leute. Noch.", haus: "Heute brennt dein Haus, Ilka!",
      gewonnen: "Siehst du? Ich bin schneller.", verloren: "Das zahle ich dir heim!" },
    mauer: { ansage: (o) => `Ich nehme mir <b>${o}</b>. Ganz in Ruhe.`, keine: "Ich warte. Geduld gewinnt.", haus: "Heute fallen deine Mauern.",
      gewonnen: "Stein für Stein.", verloren: "Ein Riss. Mehr nicht." },
    listig: { ansage: (o) => `Ich will nur <b>${o}</b>. Ehrlich.`, keine: "Ich? Ich plane gar nichts.", haus: "Ehrenkodex: Ich komme in dein Haus.",
      gewonnen: "Du hast mir doch nicht geglaubt?", verloren: "Hm. Du lernst dazu." },
  };

  // ---------- Zustand ----------
  let st = null;
  const ui = { gewaehlt: null, popup: null, anzeige: null, fokus: null, abend: null, busy: false, neueLaternen: {}, tippZu: false, zieh: null };
  let einf = lesen(EINFUEHRUNG, { fertig: false, gesehen: [] });
  const freigeschaltet = (was) => einf.fertig || !st || st.tag >= ({ jade: 3, anwerben: 4 })[was];

  function speichern() { if (st && !st.ende) schreiben(SPEICHER, st); }
  function rivalName(s) { return L.RIVALEN[(s || st).rivale].name; }
  function ortName(id) { return L.NACH_ID[id].name; }

  // ---------- Bausteine ----------

  function token(f, px, extra) {
    const fuehrer = f.typ === "anfuehrer";
    const bildname = fuehrer ? (f.seite === "p" ? "clan-ilka" : PORTRAIT[st.rivale]) : "clan-" + f.typ;
    return el("div", {
      class: "token " + f.seite + (fuehrer ? " fuehrer" : "") + (f.verletzt ? " verletzt" : "") + (extra ? " " + extra : ""),
      style: { width: px + "px", height: px + "px" }, "data-fig": f.seite === "p" ? f.id : null,
    },
    bildEl(bildname) || el("span", { class: "ic", style: { fontSize: Math.round(px * 0.5) + "px" }, text: ICON[f.typ] }),
    el("span", { class: "zahl", text: L.staerke(f) }));
  }

  function jadePunkte(f) {
    return el("div", { class: "jade-punkte" }, [0, 1, 2].map((i) => el("i", { class: i < f.jade ? "an" : "" })));
  }

  function linkeLeiste(vs) {
    const figs = L.figurenVon(vs, "p").slice().sort((a, b) => (b.typ === "anfuehrer") - (a.typ === "anfuehrer") || (a.id < b.id ? -1 : 1));
    const gew = ui.gewaehlt && L.figur(st, ui.gewaehlt);
    return el("div", { class: "leiste links" },
      el("div", { class: "kopf" },
        el("a", { class: "rund", href: "../", "aria-label": "Spielauswahl" }, "⌂"),
        el("div", { class: "clan-name", text: "Kranich-Clan" }),
        el("div", { class: "tag", html: `Tag ${vs.tag}<small>von ${L.REGELN.letzterTag}</small>` })),
      el("div", { class: "schatz" },
        el("span", { title: "Gold" }, "🪙 ", vs.gold.p),
        el("span", { title: "Jade im Lager" }, "💎 ", vs.jade.p),
        el("span", { class: "lager", text: figs.length + " Kämpfer" })),
      el("div", { class: "kader" }, figs.map((f) => {
        const aus = f.verletzt > 0;
        return el("button", {
          class: "karte" + (ui.gewaehlt === f.id ? " gewaehlt" : "") + (aus ? " aus" : ""), "data-fig": f.id, "data-typ": f.typ,
          onpointerdown: aus || ui.busy ? null : (e) => ziehStart(e, f.id),
        },
        token(f, 28),
        el("div", { class: "wer" }, el("b", { text: f.name }),
          el("small", { text: aus ? "🩹 verletzt, morgen wieder da" : L.TYPEN[f.typ].name + " · " + ortName(L.ortVon(f)) })),
        jadePunkte(f),
        el("span", { class: "st", text: L.staerke(f) }));
      })),
      gew && !ui.busy ? el("div", { class: "info-zeile", text: ICON[gew.typ] + " " + L.TYPEN[gew.typ].text }) : null,
      el("div", { class: "aktion" },
        freigeschaltet("jade") ? el("button", {
          class: "knopf", "data-aktion": "jade",
          disabled: ui.busy || !gew || st.jade.p < 1 || gew.jade >= L.REGELN.maxJade,
          onclick: () => { if (L.jadeGeben(st, ui.gewaehlt)) { tippErledigt("d3"); speichern(); zeichnen(); } },
        }, "💎 Jade umhängen") : null,
        freigeschaltet("anwerben") ? el("button", {
          class: "knopf gold", "data-aktion": "anwerben", disabled: ui.busy || st.gold.p < L.REGELN.anwerben,
          onclick: () => { ui.popup = { art: "anwerben" }; zeichnen(); },
        }, "＋ Kämpfer 🪙" + L.REGELN.anwerben) : null));
  }

  function laternenEl(vs, v) {
    const besitzer = vs.besitz[v.id];
    const an = v.art === "haupthaus" ? 3 : vs.laternen[v.id];
    const neu = ui.neueLaternen[v.id];
    return el("div", { class: "laternen" }, [0, 1, 2].map((i) =>
      el("i", { class: "laterne" + (besitzer && i < an ? " " + besitzer : "") + (neu && i === an - 1 ? " neu" : "") })));
  }

  function stadt(vs) {
    const gew = ui.gewaehlt && !ui.busy ? L.figur(st, ui.gewaehlt) : null;
    const spaeher = Object.fromEntries((vs.aufgedeckt || []).map((a) => [a.ziel, a.staerke]));
    return el("div", { class: "stadt" + (gew ? " waehlen" : "") }, L.VIERTEL.map((v) => {
      const besitzer = vs.besitz[v.id];
      const pFigs = L.bereit(vs, "p").filter((f) => L.ortVon(f) === v.id);
      const rFigs = L.bereit(vs, "r").filter((f) => L.ortVon(f) === v.id);
      const erreichbar = gew && (v.id === L.HAUPTHAUS.p || L.erreichbar(st, "p", v.id, gew.typ));
      const zeigeWert = !ui.anzeige && pFigs.length;
      const mauern = v.art === "haupthaus" ? (L.clankrieg(vs) ? L.REGELN.mauernKrieg : L.REGELN.mauern) : 0;
      return el("div", {
        class: "viertel" + (besitzer ? " " + besitzer : "") + (erreichbar ? " erreichbar" : "") +
          (!ui.anzeige && vs.ansage === v.id ? " ansage" : "") + (ui.fokus === v.id ? " fokus" : ""),
        "data-viertel": v.id,
        onclick: () => viertelTippen(v.id),
      },
      bildEl("clan-viertel-" + v.id, "bildchen") || el("div", { class: "wappen", text: WAPPEN[v.art] }),
      laternenEl(vs, v),
      el("div", { class: "ertrag", text: ERTRAG[v.art] }),
      el("div", { class: "reihe-r" }, rFigs.map((f) => token(f, 22))),
      el("div", { class: "reihe-p" }, pFigs.map((f) => token(f, 24))),
      zeigeWert ? el("div", { class: "wert", title: "Deine Stärke hier", text: "⚔ " + L.spielerWertung(st, v.id).summe }) : null,
      !ui.anzeige && vs.ansage === v.id ? el("div", { class: "ziel", html: "🎯 " + rivalName(vs) + (spaeher[v.id] != null ? " · " + spaeher[v.id] : "") }) : null,
      !ui.anzeige && spaeher[v.id] != null && vs.ansage !== v.id ? el("div", { class: "ziel spaeher", text: "👁 " + spaeher[v.id] }) : null,
      v.art === "haupthaus" && vs.tag < L.REGELN.friedenBis && !ui.anzeige ? el("div", { class: "frieden", text: "🕊 Frieden bis Tag " + L.REGELN.friedenBis }) : null,
      el("div", { class: "name", text: v.name + (mauern ? "  🧱" + mauern : "") }));
    }));
  }

  function rechteLeiste(vs) {
    const stil = L.RIVALEN[vs.rivale];
    const spr = SPRUECHE[vs.rivale];
    let text = vs.ansage ? (vs.ansage === L.HAUPTHAUS.p ? spr.haus : spr.ansage(ortName(vs.ansage))) : spr.keine;
    if (ui.anzeige) text = "Aufdecken!";
    const rFigs = L.figurenVon(vs, "r");
    const pv = L.vollBesitz(vs, "p").length, rv = L.vollBesitz(vs, "r").length;
    const balken = (n, seite) => el("div", { class: "balken " + seite }, Array.from({ length: L.REGELN.siegViertel }, (_, i) => el("i", { class: i < n ? "an" : "" })));
    return el("div", { class: "leiste rechts" },
      el("div", { class: "kopf" },
        el("div", { class: "clan-name r", text: "Natter-Clan" }),
        el("div", { class: "tag", html: `${vs.gold.r} 🪙 · ${vs.jade.r} 💎<small>${rFigs.length} Kämpfer</small>` })),
      el("div", { class: "rivale" },
        el("div", { class: "portrait" }, bildEl(PORTRAIT[vs.rivale]) || "🐍"),
        el("div", { class: "sprechblase", "data-ansage": vs.ansage || "", html: `<b>${stil.name}:</b> ${text}` })),
      el("div", { class: "r-kader" }, rFigs.map((f) => token(f, 26))),
      vs.aufgedeckt && vs.aufgedeckt.length && !ui.anzeige
        ? el("div", { class: "info-zeile", text: "👁 Späher: " + vs.aufgedeckt.map((a) => ortName(a.ziel) + " " + a.staerke).join(", ") }) : null,
      L.clankrieg(vs) ? el("div", { class: "krieg", text: "🔥 Clankrieg! Doppelter Ertrag, Mauern fast weg." }) : null,
      el("div", { class: "fortschritt", title: "Viertel mit drei Laternen" },
        el("span", { text: "Du 🏮" + pv }), balken(pv, "p"),
        el("span", { text: stil.name + " 🏮" + rv }), balken(rv, "r")),
      el("div", { class: "spacer" }),
      el("button", { class: "hauptknopf", "data-aktion": "aufdecken", disabled: ui.busy || !!st.ereignis, onclick: aufdecken }, "Aufdecken"));
  }

  // ---------- Tippen und Ziehen ----------

  function viertelTippen(id) {
    if (ui.busy || ui.zieh) return;
    if (ui.gewaehlt) {
      if (L.platzieren(st, ui.gewaehlt, id)) {
        if (st.besitz[id] !== "p") tippErledigt("d1a");
        ui.gewaehlt = null;
        speichern();
      }
      zeichnen();
      return;
    }
    ui.popup = { art: "viertel", id };
    zeichnen();
  }

  function ziehStart(e, figId) {
    if (ui.busy) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let geist = null;
    const f = L.figur(st, figId);
    ui.zieh = null;
    const bewegen = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!geist && Math.hypot(dx, dy) > 8) {
        ui.zieh = figId;
        geist = token(f, 34, "zieh-geist");
        feld.append(geist);
        const karte = feld.querySelector(".stadt");
        karte.classList.add("waehlen");
        for (const t of feld.querySelectorAll(".viertel")) {
          const id = t.dataset.viertel;
          t.classList.toggle("erreichbar", id === L.HAUPTHAUS.p || L.erreichbar(st, "p", id, f.typ));
        }
      }
      if (geist) {
        const r = feld.getBoundingClientRect();
        geist.style.left = (ev.clientX - r.left) / skala + "px";
        geist.style.top = (ev.clientY - r.top) / skala + "px";
      }
    };
    const ende = (ev) => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", ende);
      window.removeEventListener("pointercancel", ende);
      if (geist) {
        geist.remove();
        const ziel = document.elementFromPoint(ev.clientX, ev.clientY);
        const t = ziel && ziel.closest(".viertel");
        if (t && L.platzieren(st, figId, t.dataset.viertel)) {
          if (st.besitz[t.dataset.viertel] !== "p") tippErledigt("d1a");
          speichern();
        }
        ui.gewaehlt = null;
        setTimeout(() => { ui.zieh = null; }, 0);
      } else {
        ui.gewaehlt = ui.gewaehlt === figId ? null : figId;
      }
      zeichnen();
    };
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", ende);
    window.addEventListener("pointercancel", ende);
  }

  // Figuren auf der Karte lassen sich ebenfalls ziehen oder antippen.
  feld.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".stadt .token[data-fig]");
    if (!t || ui.busy) return;
    e.stopPropagation();
    ziehStart(e, t.dataset.fig);
  }, true);

  // ---------- Aufdecken: der Höhepunkt jedes Tages ----------

  function tileMitte(id) {
    const v = L.NACH_ID[id];
    return { x: 214 + (v.c + 0.5) * (416 / 3), y: 6 + (v.r + 0.5) * (378 / 3) };
  }

  async function zaehlen(elem, ziel, ms) {
    const schritte = Math.max(1, Math.min(ziel, 12));
    for (let i = 1; i <= schritte; i++) {
      elem.textContent = Math.round((ziel * i) / schritte);
      await warte(ms / schritte);
    }
  }

  async function aufdecken() {
    if (ui.busy || st.ereignis || st.ende) return;
    tippErledigt("d1b");
    ui.busy = true;
    ui.gewaehlt = null;
    ui.popup = null;
    const vor = JSON.parse(JSON.stringify(st));
    for (const f of vor.figuren) {
      if (f.seite !== "r" || f.verletzt) continue;
      const ziel = vor.plan[f.id] || L.HAUPTHAUS.r;
      f.ort = ziel === L.HAUPTHAUS.r ? null : ziel;
    }
    const bericht = L.tagAufloesen(st);
    ui.anzeige = vor;
    zeichnen();
    await warte(700);

    // Einnahmen ohne Kampf zuerst, dann die Kämpfe, der größte zuletzt.
    const wichtig = (k) => (k.figurenSpieler.length && k.figurenRivale.length ? 100 : 0) + k.spieler.summe + k.rivale.summe +
      (k.viertel === bericht.ansage ? 50 : 0);
    const reihe = bericht.kaempfe.slice().sort((a, b) => wichtig(a) - wichtig(b));
    for (const k of reihe) {
      ui.fokus = k.viertel;
      zeichnen();
      const m = tileMitte(k.viertel);
      const kampf = (k.figurenSpieler.length && k.figurenRivale.length) || k.folge;
      if (kampf) {
        const zp = el("div", { class: "zahl", text: "0" }), zr = el("div", { class: "zahl", text: "0" });
        const duell = el("div", { class: "duell", style: { left: m.x + "px", top: m.y + "px" } },
          el("div", { class: "seite p" }, zp, el("div", { class: "klein", text: "Kranich" })),
          el("div", { class: "vs", text: "⚔" }),
          el("div", { class: "seite r" }, zr, el("div", { class: "klein", text: rivalName() })));
        feld.append(duell);
        await Promise.all([zaehlen(zp, k.spieler.summe, 600), zaehlen(zr, k.rivale.summe, 600)]);
        await warte(650); // kurzes Innehalten vor dem Ergebnis
        duell.remove();
      } else {
        await warte(250);
      }
      const s = stempelText(k);
      const stempel = el("div", { class: "stempel " + s.art, style: { left: m.x + "px", top: m.y + "px" } }, s.titel, s.klein ? el("small", { text: s.klein }) : null);
      // Ergebnis in die Anzeige übernehmen
      vor.besitz[k.viertel] = k.besitzNeu;
      if (k.besitzNeu !== k.vorherBesitz) vor.laternen[k.viertel] = 0;
      for (const v of k.verluste) {
        const f = vor.figuren.find((x) => x.id === v.id);
        if (!f) continue;
        if (v.folge === "gefallen") vor.figuren.splice(vor.figuren.indexOf(f), 1);
        else { f.verletzt = 1; f.ort = null; }
      }
      if (k.folge === "gleichstand") for (const f of vor.figuren) if (f.ort === k.viertel && f.seite !== k.sieger) f.ort = null;
      zeichnen();
      feld.append(stempel);
      await warte(kampf ? 1300 : 800);
      stempel.remove();
    }
    ui.fokus = null;
    ui.anzeige = null;
    ui.neueLaternen = {};
    for (const w of bericht.laternen) if (w.nach > (w.von || 0)) ui.neueLaternen[w.viertel] = true;
    ui.abend = bericht;
    ui.busy = false;
    if (st.ende) beenden();
    speichern();
    zeichnen();
  }

  function stempelText(k) {
    const meins = k.sieger === "p";
    const wechsel = k.besitzNeu !== k.vorherBesitz;
    const verluste = k.verluste.length
      ? (k.folge === "gefallen" ? "✝ " : "🩹 ") + k.verluste.map((v) => v.name).join(", ") : "";
    const beute = k.beute ? "  +💎" + k.beute : "";
    if (k.folge === "gleichstand") return { art: "neutral", titel: "Gleichstand", klein: "Der Verteidiger hält, Angreifer ziehen ab" };
    if (!k.figurenSpieler.length || !k.figurenRivale.length) {
      if (!k.folge) return meins ? { art: "gut", titel: "Eingenommen!" } : { art: "schlecht", titel: rivalName() + " nimmt es", klein: "Niemand hat es bewacht" };
    }
    if (meins) return { art: "gut", titel: wechsel ? "Erobert!" : "Gehalten!", klein: verluste + beute };
    return { art: "schlecht", titel: wechsel ? "Verloren!" : "Abgewehrt", klein: verluste + beute };
  }

  function beenden() {
    if (st.ende.sieger === "p") schreiben(SIEGE, (lesen(SIEGE, 0) || 0) + 1);
    einf.fertig = true;
    schreiben(EINFUEHRUNG, einf);
    try { localStorage.removeItem(SPEICHER); } catch (e) { /* optional */ }
  }

  // ---------- Tafeln ----------

  function schleier(...inhalt) {
    return el("div", { class: "schleier", onclick: (e) => { if (e.target === e.currentTarget && ui.popup) { ui.popup = null; zeichnen(); } } }, inhalt);
  }

  function abendTafel(b) {
    const e = b.ertrag.p;
    const heller = b.laternen.filter((w) => w.seite === "p" && w.nach > w.von).length;
    const dunkler = b.laternen.filter((w) => w.seite === "p" && (w.abgefallen || w.nach < w.von)).length;
    const gewonnen = b.kaempfe.filter((k) => k.sieger === "p" && k.besitzNeu !== k.vorherBesitz).length;
    const verloren = b.kaempfe.filter((k) => k.sieger === "r" && k.vorherBesitz === "p").length;
    const spr = SPRUECHE[st.rivale];
    return schleier(el("div", { class: "tafel" },
      el("h2", { text: "Abend · Tag " + b.tag }),
      el("div", { class: "bilanz" },
        gewonnen ? el("span", { text: "🚩 " + gewonnen + " erobert" }) : null,
        verloren ? el("span", { text: "💔 " + verloren + " verloren" }) : null,
        heller ? el("span", { text: "🏮 " + heller + " heller" }) : null,
        dunkler ? el("span", { text: "🌑 " + dunkler + " dunkler" }) : null,
        el("span", { text: "🪙 +" + e.gold }),
        el("span", { text: "💎 +" + e.jade }),
        e.kaempfer ? el("span", { text: "⚔️ neuer Kämpfer aus der Schule" }) : null),
      el("p", { html: `<b>${rivalName()}:</b> ${verloren > gewonnen ? spr.gewonnen : gewonnen > verloren ? spr.verloren : spr.keine}` }),
      st.tag === L.REGELN.clankriegAb ? el("p", { text: "🔥 Morgen beginnt der Clankrieg: doppelter Ertrag, die Mauern fallen fast ganz." }) : null,
      el("button", { class: "hauptknopf", "data-aktion": "weiter", onclick: () => { ui.abend = null; zeichnen(); } }, "Nächster Tag")));
  }

  function ereignisTafel() {
    const e = L.ereignisDaten(st.ereignis);
    const kosten = (k) => [k && k.gold ? "−" + k.gold + " 🪙" : "", k && k.jade ? "−" + k.jade + " 💎" : ""].filter(Boolean).join(" ");
    const folgen = (f) => [f.gold ? "+" + f.gold + " 🪙" : "", f.jade ? "+" + f.jade + " 💎" : "", f.heilen ? "alle gesund" : "",
      f.ueberlaeufer ? "+1 Kämpfer, " + rivalName() + " −1" : ""].filter(Boolean).join(" ");
    return schleier(el("div", { class: "tafel", "data-ereignis": e.id },
      el("div", { class: "bild-gross" }, bildEl("clan-ereignis-" + e.id) || "📜"),
      el("h2", { text: e.titel }),
      el("p", { text: e.text }),
      el("div", { class: "wahl" }, e.wahlen.map((w, i) => el("button", {
        disabled: !L.wahlMoeglich(st, w), "data-wahl": i,
        onclick: () => { L.ereignisWaehlen(st, i); speichern(); zeichnen(); },
      }, w.text, el("small", { text: [kosten(w.kosten), folgen(w.folgen)].filter(Boolean).join(" → ") || "nichts" }))))));
  }

  function anwerbenTafel() {
    return schleier(el("div", { class: "tafel" },
      el("h2", { text: "Kämpfer anwerben" }),
      el("p", { text: "Kostet " + L.REGELN.anwerben + " Gold. Jeder startet mit Stärke 2." }),
      el("div", { class: "typwahl" }, ["waechter", "laeufer", "spaeher"].map((typ) => el("button", {
        "data-typ": typ,
        onclick: () => { L.anwerben(st, typ); ui.popup = null; speichern(); zeichnen(); },
      }, el("span", { style: { fontSize: "26px" }, text: ICON[typ] }), el("b", { text: L.TYPEN[typ].name }), el("small", { text: L.TYPEN[typ].text })))),
      el("button", { class: "knopf", onclick: () => { ui.popup = null; zeichnen(); } }, "Abbrechen")));
  }

  function viertelTafel(id) {
    const v = L.NACH_ID[id];
    const besitzer = st.besitz[id];
    const w = L.spielerWertung(st, id);
    const teile = [["Figuren", w.figuren], ["🛡️ Wächter", w.waechter], ["👑 Ilka", w.fuehrer], ["Nachbarn", w.nachbarn],
      [v.art === "haupthaus" ? "🧱 Mauern" : "🏮 Heim", w.heim]].filter(([, n]) => n);
    const ertragText = { mine: "Volle Laternen: jeden Abend 1 💎 Jade.", markt: "Volle Laternen: jeden Abend 2 🪙 Gold.",
      schule: `Volle Laternen: alle ${L.REGELN.schuleTage} Tage ein neuer Kämpfer (im Rückstand alle ${L.REGELN.schuleTageRueckstand}).`,
      haupthaus: "Jeden Abend 2 🪙. Fällt es, ist die Partie verloren." }[v.art];
    return schleier(el("div", { class: "tafel" },
      el("h2", { text: WAPPEN[v.art] + " " + v.name }),
      el("p", { text: besitzer === "p" ? "Gehört dir." : besitzer === "r" ? "Gehört " + rivalName() + "." : "Gehört niemandem. Wer zuerst dort steht, nimmt es." }),
      v.art !== "haupthaus" ? el("p", { text: "🏮 " + (besitzer ? st.laternen[id] : 0) + " von 3 Laternen. Jeder bewachte Tag zündet eine an. Unbewacht an der Grenze erlischt eine." }) : null,
      el("p", { text: ertragText }),
      teile.length ? el("p", { html: "Deine Stärke hier: " + teile.map(([t, n]) => `${t} ${n}`).join(" + ") + ` = <b>${w.summe}</b>` }) : null,
      el("button", { class: "knopf", onclick: () => { ui.popup = null; zeichnen(); } }, "OK")));
  }

  function endeTafel() {
    const e = st.ende;
    const sieg = e.sieger === "p";
    const grund = {
      fuehrer: sieg ? rivalName() + " ist gefallen." : "Ilka ist gefallen.",
      haupthaus: sieg ? "Du hast das Natternhaus eingenommen." : "Das Kranichhaus ist gefallen.",
      viertel: (sieg ? "Du hältst" : rivalName() + " hält") + " sieben Viertel mit vollen Laternen.",
      zeit: "Tag " + L.REGELN.letzterTag + " ist vorbei. Es zählen die Viertel mit vollen Laternen.",
    }[e.grund];
    return schleier(el("div", { class: "tafel", "data-ende": e.sieger || "patt" },
      el("div", { class: "bild-gross" }, bildEl(sieg ? "clan-sieg" : "clan-niederlage") || (sieg ? "🏆" : e.sieger ? "🥀" : "⚖️")),
      el("h2", { text: sieg ? "Sorrenhafen gehört dir!" : e.sieger ? "Die Nattern herrschen" : "Unentschieden" }),
      el("p", { text: grund + " Tag " + st.tag + "." }),
      sieg && (lesen(SIEGE, 0) || 0) === 1 ? el("p", { text: "Neu: Ab jetzt kannst du gegen drei Rivalen mit eigenem Stil spielen." }) : null,
      el("div", { class: "wahl" },
        el("a", { class: "knopf", href: "../", style: { textDecoration: "none", padding: "9px" } }, "⌂ Spielauswahl"),
        el("button", { class: "hauptknopf", onclick: () => { st = null; zeichnen(); } }, "Neue Partie"))));
  }

  let startRivale = "mauer";
  function startSchirm() {
    const siege = lesen(SIEGE, 0) || 0;
    const gespeichert = lesen(SPEICHER, null);
    return el("div", { class: "start" },
      bildEl("clan-stadt", "bg"),
      el("a", { class: "rund", href: "../", "aria-label": "Spielauswahl", style: { position: "absolute", left: "10px", top: "8px" } }, "⌂"),
      el("h1", { text: "Clan-Viertel" }),
      el("p", { text: "Zwei Clans, neun Viertel, keine Würfel. Stell deine Kämpfer klug auf, zünde Laternen an und nimm Sorrenhafen ein." }),
      el("div", { class: "rivalwahl" }, Object.entries(L.RIVALEN).map(([id, r]) => el("button", {
        class: startRivale === id ? "an" : "", "data-rivale": id, disabled: !siege && id !== "mauer",
        onclick: () => { startRivale = id; zeichnen(); },
      }, el("div", { class: "portrait", style: { width: "46px", height: "46px", fontSize: "22px" } }, bildEl(PORTRAIT[id]) || "🐍"),
        el("b", { text: r.name + ", " + r.titel }),
        el("small", { text: !siege && id !== "mauer" ? "🔒 Nach deinem ersten Sieg" : r.text })))),
      el("div", { class: "wahl", style: { width: "420px" } },
        gespeichert && !gespeichert.ende ? el("button", { "data-aktion": "weiterspielen", onclick: () => { st = gespeichert; zeichnen(); } },
          "Weiterspielen", el("small", { text: "Tag " + gespeichert.tag + " gegen " + L.RIVALEN[gespeichert.rivale].name })) : null,
        el("button", { class: "hauptknopf", "data-aktion": "neu", onclick: () => { st = L.neuesSpiel(startRivale); speichern(); zeichnen(); } }, "Neue Partie")));
  }

  // ---------- Einführung über die ersten Tage ----------

  const TIPPS = [
    { id: "d1a", tag: 1, text: "Willkommen, <b>Ilka</b>! Freie Viertel gehören dem, der zuerst dort steht. Zieh deinen <b>Läufer</b> auf die <b>Fechtschule</b>.",
      von: '.karte[data-typ="laeufer"]', nach: '[data-viertel="fechtschule"]', handlung: true },
    { id: "d1b", tag: 1, text: "Gut so! Jetzt <b>Aufdecken</b>. Die Nattern ziehen gleichzeitig, dann wird verglichen. Höhere Stärke gewinnt, ohne Würfel.",
      ziel: '[data-aktion="aufdecken"]', handlung: true },
    { id: "d2a", tag: 2, text: "Rechts sagt die Rivalin jeden Tag an, wo sie angreift. Ihr Ziel pulsiert rot. Stell dich dort hin, wenn du es halten willst.",
      ziel: ".sprechblase" },
    { id: "d2b", tag: 2, text: "Die <b>🏮 Laternen</b> zeigen, wem ein Viertel treu ist. Jeder bewachte Tag zündet eine an. Erst mit drei bringt es Ertrag.",
      ziel: '[data-viertel="fechtschule"] .laternen' },
    { id: "d3", tag: 3, text: "Deine Mine liefert <b>💎 Jade</b>. Tipp einen Kämpfer an und dann <b>Jade umhängen</b>. Der erste Stein gibt +2.",
      ziel: '[data-aktion="jade"]' },
    { id: "d4", tag: 4, text: "Mit 5 🪙 wirbst du neue Kämpfer an: <b>Wächter</b> halten, <b>Läufer</b> kommen weit, <b>Späher</b> sehen gegnerische Züge.",
      ziel: '[data-aktion="anwerben"]' },
    { id: "d5", tag: 5, text: "Ab heute dürfen Haupthäuser angegriffen werden. Du gewinnst mit <b>7 Vierteln mit 🏮🏮🏮</b> oder mit dem Natternhaus.",
      ziel: ".fortschritt" },
  ];

  function tippErledigt(id) {
    if (!einf.gesehen.includes(id)) { einf.gesehen.push(id); schreiben(EINFUEHRUNG, einf); }
  }

  function aktuellerTipp() {
    if (einf.fertig || !st || ui.busy || ui.popup || ui.abend || st.ereignis || st.ende) return null;
    return TIPPS.find((t) => (t.handlung ? t.tag === st.tag : t.tag <= st.tag) && !einf.gesehen.includes(t.id) &&
      !(t.id === "d1b" && !einf.gesehen.includes("d1a"))) || null;
  }

  function tippZeigen(t) {
    const rect = (sel) => {
      const e = feld.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect(), f = feld.getBoundingClientRect();
      return { x: (r.left - f.left) / skala, y: (r.top - f.top) / skala, w: r.width / skala, h: r.height / skala };
    };
    const ziel = rect(t.nach || t.ziel);
    const box = el("div", { class: "tipp", "data-tipp": t.id, html: t.text },
      !t.handlung ? el("div", {}, el("button", { onclick: () => { tippErledigt(t.id); zeichnen(); } }, "Verstanden")) : null);
    // Tipp-Box rechts in der freien Fläche über dem Aufdecken-Knopf
    box.style.right = "8px";
    box.style.top = "196px";
    box.style.maxWidth = "196px";
    box.style.fontSize = "13px";
    feld.append(box);
    if (!ziel) return;
    const hand = el("div", { class: "hand", text: "👆" });
    feld.append(hand);
    if (t.von) {
      const von = rect(t.von);
      if (!von) return;
      const a = { x: von.x + 20, y: von.y + 18 }, b = { x: ziel.x + ziel.w / 2, y: ziel.y + ziel.h / 2 };
      hand.animate([
        { left: a.x + "px", top: a.y + "px", opacity: 0 },
        { left: a.x + "px", top: a.y + "px", opacity: 1, offset: 0.15 },
        { left: b.x + "px", top: b.y + "px", opacity: 1, offset: 0.75 },
        { left: b.x + "px", top: b.y + "px", opacity: 0 },
      ], { duration: 2200, iterations: Infinity });
    } else {
      hand.classList.add("tippen");
      hand.style.left = ziel.x + ziel.w / 2 - 10 + "px";
      hand.style.top = ziel.y + ziel.h - 6 + "px";
    }
  }

  // ---------- Zeichnen ----------

  function zeichnen() {
    feld.innerHTML = "";
    if (!st) { feld.append(startSchirm()); return; }
    const vs = ui.anzeige || st;
    feld.append(
      bildEl("clan-stadt", "bg") || el("span"),
      linkeLeiste(vs), stadt(vs), rechteLeiste(vs));
    if (ui.abend && !ui.busy) feld.append(abendTafel(ui.abend));
    else if (st.ende && !ui.busy) feld.append(endeTafel());
    else if (st.ereignis && !ui.busy) feld.append(ereignisTafel());
    else if (ui.popup && ui.popup.art === "anwerben") feld.append(anwerbenTafel());
    else if (ui.popup && ui.popup.art === "viertel") feld.append(viertelTafel(ui.popup.id));
    const t = aktuellerTipp();
    if (t) tippZeigen(t);
    if (!ui.busy) ui.neueLaternen = {};
  }

  // ---------- Start ----------

  async function start() {
    skalieren();
    try {
      const liste = await fetch("../grafiken/vorhanden.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : []));
      for (const d of liste) dateien.add(d);
    } catch (e) { /* ohne Bilderliste: nur Platzhalter */ }
    st = null;
    zeichnen();
  }
  start();
})();
