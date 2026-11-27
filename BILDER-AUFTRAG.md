# Bildauftrag für ChatGPT: Clan-Viertel

Diese Datei ist der komplette Auftrag. Bitte alles hier lesen und dann die Bilder erstellen und hochladen.

## Regeln (bitte genau einhalten)

1. **Repository:** `flo-horn-sketch/Iphone-Game`, Branch `main`.
2. **Ordner:** jedes Bild nach `web/grafiken/`.
3. **Dateiname:** exakt wie in der Tabelle, klein geschrieben, Endung `.png`. Ein anderer Name wird vom Spiel nicht gefunden.
4. **Format:** PNG, Größe wie in der Tabelle angegeben.
5. **Kein Text im Bild:** keine Schrift, keine Buchstaben, keine Zahlen, keine Wasserzeichen.
6. **Nur Bilder hochladen.** Keine anderen Dateien ändern. Die Liste `web/grafiken/vorhanden.json` wird beim Veröffentlichen automatisch erzeugt.
7. Ein Commit pro Bild oder mehrere Bilder in einem Commit sind beide in Ordnung. Commit-Text zum Beispiel: `Bild clan-hafen hinzugefügt`.
8. Ein Bild, das schon existiert, nur ersetzen, wenn ausdrücklich gewünscht.
9. Reihenfolge: von oben nach unten, die Stadtkarte zuerst. Nach jedem Bild ist es sofort im Spiel sichtbar (ein paar Minuten nach dem Hochladen). Fehlende Bilder zeigt das Spiel als Platzhalter.

## Stil (vor jeden Prompt setzen)

> Gemalte Fantasy-Illustration, warm und atmosphärisch, wie ein handgemaltes Brettspiel. Eine erfundene Hafenstadt auf einer steilen Berginsel bei Abenddämmerung, Architektur mit geschwungenen Ziegeldächern, Holzstegen und Steintreppen, eigenständig und keiner realen Kultur nachgebaut. Farben: tiefes Jadegrün, Nachtblau, warmes Laternenrot und Gold. Weiche Lichter von Papierlaternen, leichter Nebel. Klare, gut lesbare Formen, auch klein erkennbar. Keine Schrift, kein Text, keine Buchstaben.

Die beiden Clans:
- **Kranich-Clan** (Spieler): Jadegrün und Weiß, Kranich als Zeichen.
- **Natter-Clan** (Gegner): Laternenrot und Schwarz, Schlange als Zeichen.

## Die Bilder

### 0. Die Stadtkarte (das wichtigste Bild)

Die Karte ist das Spielbrett. Das Spiel legt die neun Viertel als runde Plätze genau an die unten genannten Stellen. Deshalb müssen die Orte im Bild ungefähr dort liegen.

| Datei | Größe | Prompt |
|---|---|---|
| `clan-karte.png` | 1024 × 1024 | Gemalte Landkarte einer Inselstadt, Blick schräg von oben, wie eine Brettspiel-Karte. Die Insel füllt fast das ganze Bild, ringsum dunkles Meer. Oben in der Mitte ein hoher Berggipfel, links oben und rechts oben je ein kleinerer Felshang. Unten rechts ein Hafenbecken mit Schiffen, unten links ein kleiner Fischersteg. Neun deutlich erkennbare Plätze, verbunden durch helle Wege und Treppen (genaue Lage siehe Liste darunter). Die Plätze selbst bleiben eher ruhig und leer, weil das Spiel dort Spielsteine anzeigt. Links soll die Seite des Kranich-Clans etwas grünlicher wirken, rechts die Seite des Natter-Clans etwas rötlicher, die Mitte neutral. Keine Schrift, keine Beschriftungen, keine Wappen mit Buchstaben. |

**Lage der neun Plätze** (von links nach rechts und von oben nach unten gemessen, in Prozent der Bildbreite und -höhe):

| Platz | Links | Oben | Was dort zu sehen ist |
|---|---|---|---|
| Klippenmine | 20 % | 22 % | Mineneingang am linken Felshang |
| Hohe Mine | 50 % | 16 % | Mine am Berggipfel |
| Schlotmine | 80 % | 22 % | Mine am rechten Felshang |
| Kranichhaus | 20 % | 50 % | befestigtes Anwesen mit grünen Laternen |
| Fechtschule | 50 % | 47 % | Platz mit Übungshof in der Stadtmitte |
| Natternhaus | 80 % | 50 % | befestigtes Anwesen mit roten Laternen |
| Fischmarkt | 20 % | 79 % | Markt am Fischersteg |
| Nachtmarkt | 50 % | 76 % | Markt auf einer Treppe |
| Hafen | 80 % | 81 % | Hafenkai am Hafenbecken |

**Wege** verbinden nur diese Nachbarn: jeder Platz mit dem direkt links, rechts, darüber und darunter (wie ein Gitter aus drei mal drei, aber als geschwungene Wege gemalt). Keine diagonalen Wege.

### 1. Hintergrund und Spielauswahl

| Datei | Größe | Prompt |
|---|---|---|
| `clan-stadt.png` | 1536 × 1024 | Stimmungsbild für den Startbildschirm: die Inselstadt bei Nacht von weitem, viele leuchtende Laternen in Grün und Rot, Hafen unten, Minen oben am Berg. Eher dunkel und ruhig, weil Text darüber liegt. |
| `auswahl-clanviertel.png` | 1536 × 1024 | Zwei Laternen hängen sich gegenüber über einer engen Gasse, eine jadegrün, eine rot, dahinter die nächtliche Inselstadt. Unten im Bild etwas Ruhe für den Spielnamen. |

### 2. Die neun Viertel (runde Medaillons)

Jedes Viertel als kleines Bild, das im Spiel rund ausgeschnitten und klein auf der Karte gezeigt wird. Ein klares Motiv genau in der Mitte, wenig Details am Rand, keine Personen im Vordergrund.

| Datei | Größe | Prompt |
|---|---|---|
| `clan-viertel-kranichhaus.png` | 1024 × 1024 | Das Haupthaus des Kranich-Clans: ein befestigtes Anwesen mit hoher Mauer und Tor, jadegrüne Banner mit einem Kranich, grüne Laternen. |
| `clan-viertel-natternhaus.png` | 1024 × 1024 | Das Haupthaus des Natter-Clans: ein dunkles befestigtes Anwesen mit Mauer, rote Banner mit einer Schlange, rote Laternen. |
| `clan-viertel-klippenmine.png` | 1024 × 1024 | Ein Mineneingang in einer Felsklippe über dem Meer, Holzgerüst, Loren mit grün schimmernden Jadebrocken. |
| `clan-viertel-hohemine.png` | 1024 × 1024 | Die größte Mine hoch oben am Berggipfel, Seilbahn, Schächte, viel grün leuchtende Jade im Gestein. |
| `clan-viertel-schlotmine.png` | 1024 × 1024 | Eine Mine in einem rauchenden Felsschlot, Treppen in den Berg, Jadeadern im Stein. |
| `clan-viertel-fechtschule.png` | 1024 × 1024 | Ein Innenhof einer Fechtschule mit Holzpuppen, Waffenständern und einem Übungsplatz aus Stein. |
| `clan-viertel-fischmarkt.png` | 1024 × 1024 | Ein Fischmarkt am Steg mit Ständen, Körben und Booten, Laternen über den Ständen. |
| `clan-viertel-nachtmarkt.png` | 1024 × 1024 | Ein belebter Nachtmarkt mit Garküchen, Stoffbahnen und vielen kleinen Laternen auf einer Treppe. |
| `clan-viertel-hafen.png` | 1024 × 1024 | Der Hafen mit großen Handelsschiffen, Kränen, Kisten und einem Leuchtturm. |

### 3. Figuren (Porträts, quadratisch, Kopf und Schultern mittig)

Die Bilder werden als kleine runde Spielsteine gezeigt. Gesicht groß und mittig, schlichter dunkler Hintergrund.

| Datei | Größe | Prompt |
|---|---|---|
| `clan-ilka.png` | 1024 × 1024 | Ilka, Anführerin des Kranich-Clans, Mitte dreißig, entschlossener ruhiger Blick, jadegrüner Mantel, ein Jadestein an einer Kette um den Hals. |
| `clan-hesra.png` | 1024 × 1024 | Hesra, Anführerin des Natter-Clans, ältere Frau, streng und geduldig, roter schwerer Mantel mit hohem Kragen. |
| `clan-varo.png` | 1024 × 1024 | Varo, Anführer des Natter-Clans, junger Hitzkopf mit Narbe, wildes Grinsen, rot-schwarze Kleidung, Jade an den Armreifen. |
| `clan-sel.png` | 1024 × 1024 | Sel, Anführer des Natter-Clans, schlank, schmales Lächeln, halb im Schatten, rotes Seidengewand, ein Fächer. |
| `clan-waechter.png` | 1024 × 1024 | Ein kräftiger Wächter mit Schild und Helm, ernster Blick. Neutrale Kleidung in Grau und Braun (wird für beide Clans genutzt). |
| `clan-laeufer.png` | 1024 × 1024 | Ein flinker Läufer mit Kapuze und Stirnband, leichte Kleidung, Bewegung im Haar. Neutrale Farben Grau und Braun. |
| `clan-spaeher.png` | 1024 × 1024 | Eine Späherin mit Kapuze und Fernrohr, wacher Blick. Neutrale Farben Grau und Braun. |

### 4. Ereignisse und Ende (breit)

| Datei | Größe | Prompt |
|---|---|---|
| `clan-ereignis-haendler.png` | 1536 × 1024 | Ein Händler aus den Bergen öffnet nachts eine Truhe voller roher, grün leuchtender Jade. |
| `clan-ereignis-fest.png` | 1536 × 1024 | Laternenfest: Hunderte Papierlaternen steigen über der Stadt in den Himmel, Menschen auf Brücken. |
| `clan-ereignis-ueberlaeufer.png` | 1536 × 1024 | Ein Kämpfer in rot-schwarzer Kleidung kniet im Regen vor einem Tor mit grünen Laternen und bittet um Aufnahme. |
| `clan-sieg.png` | 1536 × 1024 | Die ganze Stadt leuchtet in jadegrünen Laternen, Kranich-Banner wehen über allen Dächern, Morgendämmerung. |
| `clan-niederlage.png` | 1536 × 1024 | Die Stadt ist in rote Laternen getaucht, ein zerrissenes grünes Banner liegt auf einer nassen Treppe. |

## Kontrolle

Nach dem Hochladen: Die Seite https://flo-horn-sketch.github.io/Iphone-Game/ ein paar Minuten später neu laden. Das Bild erscheint dann im Spiel Clan-Viertel.
