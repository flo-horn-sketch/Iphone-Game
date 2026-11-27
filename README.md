# Die Fahrenden

Ein iPhone-Spiel im Querformat: Du führst eine mittelalterliche Gauklertruppe durch ein erfundenes Königreich. Reisen kostet Vorräte, Vorstellungen bringen Brot und Münzen, und unterwegs warten Entscheidungen ohne gute Wahl.

Dies ist ein **spielbarer Ausschnitt**: das Mittelreich mit sechs Orten und acht Reiseereignissen. In der Web-Version ziehst du auf eine kurze Wintertour. Brot und Gold bleiben die einzigen Vorräte. Figuren können sich verletzen, und jede Zugabe in „Noch eine Nummer?“ ist ein Wagnis.

## Web-Version (ohne Mac)

Im Ordner `web/` liegt der Web-Prototyp (`web/logik.js`, `web/welt.json`). Sie wird bei jedem Merge auf main unter https://flo-horn-sketch.github.io/Iphone-Game/ veröffentlicht (GitHub Pages), läuft in Safari auf dem iPhone im Querformat und lässt sich über *Teilen → Zum Home-Bildschirm* wie eine App ablegen. Bilder kommen nach `web/grafiken/` und werden in `web/grafiken/vorhanden.json` eingetragen.

### Wintertour (Roguelite-Prototyp)

- Pro Tour wechseln gesperrter Weg, Abkürzung, Jahrmarkt, Marktbesetzung und Reiseereignisse. Eine Tour hat höchstens sechs Reiseetappen.
- Ab Etappe fünf ist der Auftritt in St. Ilgen das Finale. Verdienst du dort den geforderten Applaus, habt ihr das Winterquartier erreicht. Andernfalls endet die Tour.
- Zwischen Nummern siehst du die aktuelle Auszahlung und den nächsten Wunsch. Einmal pro Show kannst du sicher improvisieren. Zwei gewählte Verbesserungen können pro Tour die Truppe prägen.
- Nach der ersten gewonnenen Tour ist der leichtere Wagen als alternative Startbesetzung verfügbar. Touren haben einen eigenen lokalen Spielstand; ältere Kapitel-Spielstände werden nicht überschrieben.

Logiktests: `node --test web/tests/*.test.js`. Browser-Smoke mit Playwright: `node web/tests/oberflaeche.js` (optional Pfad zu Chromium als Argument).

## iPhone-App starten

> Die SwiftUI-App ruht vorerst und hat die Vereinfachung noch nicht bekommen. Gespielt wird die Web-Version.

Du brauchst einen Mac mit **Xcode 16 oder neuer**.

1. `DieFahrenden.xcodeproj` öffnen.
2. Oben ein iPhone-Simulator auswählen (oder dein iPhone per Kabel).
3. ▶︎ drücken.

Für dein eigenes iPhone einmal unter *Target DieFahrenden → Signing & Capabilities* dein Apple-Konto als *Team* wählen. Falls Xcode meckert, die *Bundle Identifier* in etwas Eigenes ändern, zum Beispiel `de.deinname.diefahrenden`.

## So spielt sich der Ausschnitt

- **Ziel:** Jedes Kapitel nennt einen Ort und eine Summe Gold (Fähnchen auf der Karte, Balken oben). Wer mit genug Gold dort ankommt, schafft das Kapitel. Nach drei Kapiteln geht es frei weiter.
- **Karte:** Ort antippen, die Tafel zeigt, was das Publikum mag, was der Ort zahlt (Dorf und Kloster Brot, Markt und Burg Gold) und wie viel Brot der Weg kostet. Ein Knopf: *Aufbrechen*. Waldwege sind gefährlicher.
- **Ereignis:** gemalte Tafel mit genau zwei Wahlen, die Folgen stehen als Symbole daneben.
- **Vorstellung:** Das Publikum ruft einen Wunsch (⚡ Spannung, 🎭 Humor, ✨ Staunen, ❤️ Herz). Passende Figur antippen: Applaus = Können × Serie, die Serie wächst bis ×5. Passt die Figur nicht, wird das Publikum ungeduldig (😠). Riskante Nummern (Akrobatik, Feuer, Tiere) bringen mehr, können aber misslingen, dann ist die Figur verletzt. Nach jeder Nummer: *Noch eine!* oder *Hut rumgehen lassen*. Bei drei 😠 laufen die Leute weg und der halbe Hut ist leer.
- **Figuren:** fit, verletzt (🩹, tritt nicht auf) oder tot. Wer verletzt nochmal getroffen wird, stirbt. Das Kloster heilt alle.
- **Markt:** Nach der Vorstellung Brot kaufen und einen neuen Künstler anwerben.

Der Spielstand wird automatisch gespeichert.

## Grafiken

Alle Bilder kommen aus ChatGPT. Liste, Größen und fertige Prompts stehen in **[GRAFIKEN.md](GRAFIKEN.md)**. Fehlt ein Bild, zeigt das Spiel einen Platzhalter mit Name und Größe.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `GameCore/` | Spiellogik als eigenes Swift-Paket, ohne Oberfläche, mit Tests |
| `GameCore/Sources/GameCore/Resources/welt.json` | Regionen, Orte mit Kartenpositionen, Wege, Truppe, Ereignisse. Hier ändert man Inhalte ohne Code |
| `DieFahrenden/` | Die App (SwiftUI) |
| `DieFahrenden/Grafiken/` | Hier kommen die Bilder hinein |
| `DieFahrenden/Darstellung/GrafikListe.swift` | Liste aller Bildnamen mit Größen |

Tests der Spiellogik: `swift test --package-path GameCore` (läuft auch auf GitHub bei jedem Push, zusammen mit einem Build der App).
