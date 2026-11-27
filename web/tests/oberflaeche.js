// Aufruf: node web/tests/oberflaeche.js [Chromium-Pfad]
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const L = require("../logik");
const w = L.welt(require("../welt.json"));
const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/grafiken/vorhanden.json") { res.setHeader("content-type", "application/json"); res.end("[]"); return; }
  const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

async function smoke() {
  await new Promise((ok, bad) => { server.on("error", bad); server.listen(0, "127.0.0.1", ok); });
  const browser = await chromium.launch(process.argv[2] ? { executablePath: process.argv[2] } : {});
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, reducedMotion: "reduce", isMobile: true, hasTouch: true });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => route.request().url().startsWith(url) ? route.continue() : route.abort());
    await page.goto(url);
    // Spielauswahl: Die Fahrenden starten, Turmwächter ist noch gesperrt.
    assert.equal(await page.locator('[data-spiel="bald"]').getAttribute("aria-disabled"), "true");
    await page.locator('[data-spiel="fahrenden"]').tap();
    await page.waitForURL(/fahrenden\.html$/);
    await page.locator('a.heim').tap();
    await page.waitForURL(u => new URL(u).pathname === "/");
    await page.locator('[data-spiel="fahrenden"]').tap();
    await page.waitForURL(/fahrenden\.html$/);
    await page.locator('[data-wagen="buehne"]').waitFor();
    assert.ok(await page.locator('[data-wagen="leicht"]').isDisabled());
    await page.locator('[data-wagen="buehne"]').tap();
    assert.equal(await page.locator(".tour-stand").textContent(), "0/6 Etappen");
    await page.locator('[data-ort="hollerbach"]').tap();
    await page.getByRole("button", { name: "Erste Vorstellung" }).tap();
    await page.locator(".hand .nummer:not([disabled])").first().tap();
    const hint = page.locator("[data-next-call]");
    await hint.waitFor();
    const next = await hint.getAttribute("data-next-call");
    await page.reload();
    assert.equal(await hint.getAttribute("data-next-call"), next);
    await page.getByRole("button", { name: /Hut rumgehen lassen/ }).tap();
    await page.reload();
    await page.locator(".ergebnis").waitFor();
    if (await page.locator("[data-perk]").count()) await page.locator("[data-perk]").first().tap();
    await page.locator(".ergebnis .hauptknopf").tap();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("diefahrenden-tour-v1")));
    const open = w.nachbarn(saved.location).find(id => L.tourWeg(saved, w.weg(saved.location, id)));
    await page.locator(`[data-ort="${open}"]`).tap();
    await page.getByRole("button", { name: "Aufbrechen" }).tap();
    await page.reload();
    for (let i = 0; i < 4; i++) {
      await page.locator(".option, .schleier .hauptknopf, .vorstellung").first().waitFor();
      if (await page.locator(".vorstellung").count()) break;
      if (await page.locator(".option").count()) await page.locator(".option").first().tap();
      else await page.locator(".schleier .hauptknopf").tap();
    }
    await page.locator(".vorstellung").waitFor();
    assert.equal(await page.locator(".tour-stand").textContent(), "1/6 Etappen");

    // Set up a fifth-leg save, then exercise the real buttons through win and unlock.
    const finale = L.neueTour(w, 9);
    finale.location = finale.tour.finale;
    finale.tour.schritte = 5;
    finale.tour.halt = { art: "ankunft", geheilt: [] };
    L.showStarten(finale, w);
    finale.show.applaus = finale.tour.ziel;
    finale.show.gespielt = ["jorin"];
    finale.show.offen = false;
    finale.show.naechsterRuf = "heart";
    await page.evaluate(s => localStorage.setItem("diefahrenden-tour-v1", JSON.stringify(s)), finale);
    await page.reload();
    await page.locator(".finale-badge").waitFor();
    await page.getByRole("button", { name: /Hut rumgehen lassen/ }).tap();
    await page.getByRole("button", { name: "Tour abschließen" }).tap();
    await page.getByRole("heading", { name: /Winterquartier ist erreicht/ }).waitFor();
    await page.getByRole("button", { name: "Neue Tour" }).tap();
    assert.equal(await page.locator('[data-wagen="leicht"]').isEnabled(), true);
    await page.locator('[data-wagen="leicht"]').tap();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("diefahrenden-tour-v1")));
    assert.equal(after.tour.wagen, "leicht");
    assert.equal(after.troupe.length, 4);
    assert.deepEqual(errors, []);
    console.log("Browser-Smoke: Start, Auftritt, Vorschau, Reload, Auszahlung, Reise, Finale und Freischaltung OK.");
  } finally {
    await browser.close();
  }
}
smoke().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => server.close());
