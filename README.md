# Die Fahrenden

Ein iPhone-Spiel im Querformat: Du führst eine mittelalterliche Gauklertruppe durch ein erfundenes Königreich. Reisen kostet Vorräte, Vorstellungen bringen Brot und Münzen, und unterwegs warten Entscheidungen ohne gute Wahl.

Dies ist der **erste spielbare Ausschnitt**: das Mittelreich mit sechs Orten, Reise auf der Karte, Vorstellungen mit Stimmungskurve und sechs Ereignisse.

## Web-Version (ohne Mac)

Im Ordner `web/` liegt derselbe Ausschnitt als Webseite, mit denselben Regeln (`web/logik.js`) und derselben `welt.json`. Sie läuft in Safari auf dem iPhone im Querformat und lässt sich über *Teilen → Zum Home-Bildschirm* wie eine App ablegen. Bilder kommen nach `web/grafiken/` und werden in `web/grafiken/vorhanden.json` eingetragen.

Tests: `node --test web/tests/logik.test.js`

## iPhone-App starten

Du brauchst einen Mac mit **Xcode 16 oder neuer**.

1. `DieFahrenden.xcodeproj` öffnen.
2. Oben ein iPhone-Simulator auswählen (oder dein iPhone per Kabel).
3. ▶︎ drücken.

Für dein eigenes iPhone einmal unter *Target DieFahrenden → Signing & Capabilities* dein Apple-Konto als *Team* wählen. Falls Xcode meckert, die *Bundle Identifier* in etwas Eigenes ändern, zum Beispiel `de.deinname.diefahrenden`.

## So spielt sich der Ausschnitt

- **Regionskarte:** Ort antippen, die Tafel zeigt Reisetage, Verbrauch, Geschmack des Publikums und Gefahren. Ein Knopf: *Aufbrechen*. Mit dem Globus oben links geht es zur Weltkarte.
- **Reise:** Der Wagen fährt, jeder Tag kostet 1 Brot pro Person und 1 Holz. Ohne Brot wird gehungert, ohne Holz gefroren, beides kostet Gesundheit (Ring um das Porträt). Bei 0 stirbt ein Mitglied.
- **Ereignis:** gemalte Tafel mit zwei oder drei Optionen, die Folgen stehen als Symbole daneben. Gesperrte Optionen zeigen, welche Disziplin fehlt.
- **Vorstellung:** Nummernkarten antippen oder auf die Bühnenbretter ziehen, der goldene Faden zeigt die erwartete Stimmung. *Vorhang auf* spielt die Nummern nacheinander, Tippen spult vor. Danach Lohn, und auf dem Markt kann man Brot und Holz kaufen.

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
