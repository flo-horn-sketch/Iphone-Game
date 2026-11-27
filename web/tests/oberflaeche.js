// Klickt einmal durch die Web-Version und macht Bildschirmfotos.
// Aufruf: node web/tests/oberflaeche.js <url> <ordner>
const { chromium } = require("playwright");

(async () => {
  const [url, ordner] = process.argv.slice(2);
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push("Seitenfehler: " + e.message));
  seite.on("console", (m) => { if (m.type() === "error") fehler.push("Konsole: " + m.text()); });
  const foto = (n) => seite.screenshot({ path: `${ordner}/${n}.png` });

  await seite.goto(url);
  await seite.waitForTimeout(800);
  await foto("0-kapitel");
  await seite.click("text=Los geht");
  await seite.waitForTimeout(200);
  await foto("1-region");
  await seite.click('[data-ort="weidenau"]');
  await seite.waitForTimeout(200);
  await foto("2-tafel");
  await seite.click("text=Aufbrechen");
  await seite.waitForTimeout(2700);
  await foto("3-ankunft");
  for (let i = 0; i < 4; i++) {
    const option = await seite.$(".option:not([disabled])");
    if (option) { await option.click(); await seite.waitForTimeout(200); await foto("3b-folge"); continue; }
    const weiter = await seite.$(".schleier .hauptknopf");
    if (weiter) { await weiter.click(); await seite.waitForTimeout(200); }
  }
  await foto("4-vorstellung");
  for (let runde = 0; runde < 3; runde++) {
    const karte = (await seite.$(".hand .nummer.passt")) || (await seite.$(".hand .nummer:not([disabled])"));
    if (!karte) break;
    await karte.click();
    await seite.waitForTimeout(400);
    await foto("5-nummer-" + runde);
    const nochEine = await seite.$(".wagen-knopf");
    if (!nochEine || runde === 2) break;
    await nochEine.click({ force: true });
    await seite.waitForTimeout(300);
  }
  await seite.click("text=Hut rumgehen lassen", { force: true });
  await seite.waitForTimeout(400);
  await foto("7-ergebnis");
  await seite.click(".ergebnis .hauptknopf");
  await seite.waitForTimeout(300);
  await seite.click('[aria-label="Weltkarte"]');
  await seite.waitForTimeout(300);
  await foto("8-welt");
  console.log(fehler.join("\n") || "keine Fehler");
  await browser.close();
})();
