# Luftlinie

Ein Airline-Manager fürs iPhone im Querformat. Alle Airlines starten bei Null: Du legst im Linien-Editor Flüge zwischen echten Städten der ganzen Welt an und kaufst das Flugzeug gleich mit. Jeder Flug braucht einen Slot mit Uhrzeit: zu Hause von deiner eigenen Tafel, an fremden Flughäfen ersteigert oder von Rivalen gekauft. Ein Flugzeug kann mehrmals am Tag fliegen. Du bestimmst Ticketpreis und Kabine (Economy, Business, First) und kämpfst gegen drei Rivalen um Platz 1.

## Spielen

https://flo-horn-sketch.github.io/Iphone-Game/ in Safari öffnen, iPhone quer halten. Über *Teilen → Zum Home-Bildschirm* lässt sich das Spiel wie eine App ablegen. Jeder Merge auf `main` wird automatisch veröffentlicht (GitHub Pages).

## Aufbau

- `web/airline/airline-logik.js`: alle Regeln und Zahlen (Stellschrauben in `REGELN`, `SERVICE`, `TYPEN`, `KLASSEN`).
- `web/airline/airline-spiel.js`: Oberfläche (Karte, Linien-Editor, Slot-Tafel, Bieten, Ziele, Regelkarten).
- `web/airline/airline-karte.js`: Weltkarte, automatisch erzeugt aus Natural Earth (gemeinfrei).
- `web/grafiken/`: Bilder. Was dort liegt, übernimmt das Spiel automatisch. Der Auftrag für die Bilder steht in `BILDER-AUFTRAG.md`.

Logiktests: `node --test web/tests/*.test.js`.
