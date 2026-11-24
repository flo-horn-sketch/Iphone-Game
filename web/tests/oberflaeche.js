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
  const karten = await seite.$$(".hand .nummer:not(.gesperrt)");
  await karten[0].click();
  await seite.waitForTimeout(100);
  const zweite = (await seite.$$(".hand .nummer:not(.gesperrt)"))[0];
  const a = await zweite.boundingBox();
  const z = await (await seite.$('[data-brett="2"]')).boundingBox();
  await seite.mouse.move(a.x + 30, a.y + 30);
  await seite.mouse.down();
  await seite.mouse.move(a.x + 60, a.y - 20, { steps: 5 });
  await seite.mouse.move(z.x + 40, z.y + 50, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(150);
  await foto("5-programm");
  await seite.click("text=Vorhang auf");
  await seite.waitForTimeout(1500);
  await foto("6-spielt");
  await seite.waitForTimeout(4500);
  await foto("7-ergebnis");
  await seite.click(".ergebnis .hauptknopf");
  await seite.waitForTimeout(300);
  await seite.click('[aria-label="Weltkarte"]');
  await seite.waitForTimeout(300);
  await foto("8-welt");
  console.log(fehler.join("\n") || "keine Fehler");
  await browser.close();
})();
