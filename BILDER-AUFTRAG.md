# Bildauftrag für ChatGPT: Luftlinie (Airline-Manager)

Diese Datei ist der komplette Auftrag. Bitte alles hier lesen und dann die Bilder erstellen und hochladen. Die Weltkarte zeichnet das Spiel selbst aus echten Landkarten-Daten, dafür ist **kein** Bild nötig.

## Regeln (bitte genau einhalten)

1. **Repository:** `flo-horn-sketch/Iphone-Game`, Branch `main`.
2. **Ordner:** jedes Bild nach `web/grafiken/`.
3. **Dateiname:** exakt wie in der Tabelle, klein geschrieben, Endung `.png`. Ein anderer Name wird vom Spiel nicht gefunden.
4. **Format:** PNG, Größe wie in der Tabelle angegeben.
5. **Kein Text im Bild:** keine Schrift, keine Buchstaben, keine Zahlen, keine Wasserzeichen.
6. **Nur Bilder hochladen.** Keine anderen Dateien ändern. Die Liste `web/grafiken/vorhanden.json` wird beim Veröffentlichen automatisch erzeugt.
7. Ein Commit pro Bild oder mehrere Bilder in einem Commit sind beide in Ordnung. Commit-Text zum Beispiel: `Bild air-start hinzugefügt`.
8. Ein Bild, das schon existiert, nur ersetzen, wenn ausdrücklich gewünscht.
9. Reihenfolge: von oben nach unten. Nach jedem Bild ist es sofort im Spiel sichtbar (ein paar Minuten nach dem Hochladen). Fehlende Bilder zeigt das Spiel als Platzhalter.

## Stil (vor jeden Prompt setzen)

> Moderne, freundliche Illustration im Stil eines hochwertigen Reiseplakats, leicht gemalt, klare Formen, sanfte Verläufe. Farben: Nachtblau, Himmelblau, warmes Gold, etwas Abendrot. Erfundene Flugzeuge und erfundene Airlines, keine echten Logos, keine echten Flugzeugmodelle nachgebaut, keine Markennamen. Keine Schrift, kein Text, keine Buchstaben, keine Zahlen.

## Die Bilder (in dieser Reihenfolge)

### 1. Startbild

| Datei | Größe | Prompt |
|---|---|---|
| `air-start.png` | 1536 × 1024 | Blick aus einem großen Terminalfenster auf ein Vorfeld bei Nacht: mehrere Flugzeuge an Gates, Lichter, ein Tower, in der Ferne startet ein Flugzeug. Eher dunkel und ruhig, weil Text darüber liegt. |

### 2. Die drei Airline-Arten (erscheinen in „Meine Airline“, je nach Grundsätzen)

| Datei | Größe | Prompt |
|---|---|---|
| `air-service-billig.png` | 1536 × 1024 | Flugzeugkabine einer Billig-Airline: enge, bunte Sitzreihen, fröhliche Urlauber mit Rucksäcken und Sonnenhüten, alles voll, helle freundliche Farben. |
| `air-service-standard.png` | 1536 × 1024 | Gepflegte Flugzeugkabine einer normalen Linien-Airline: bequeme blaue Sitze, eine Flugbegleiterin reicht Getränke, Geschäftsleute und Familien gemischt. |
| `air-service-premium.png` | 1536 × 1024 | Luxuriöse Premium-Kabine: breite Ledersessel, die sich zum Bett ausklappen, Champagnerglas, warmes Licht, Holz und Gold, ruhige Eleganz. |

### 3. Die vier Flugzeugtypen (Seitenansicht, schlichter Hintergrund)

Die Bilder erscheinen groß im Flugzeug-Store und klein im Linien-Editor. Flugzeug groß und mittig, von der Seite, leicht schräg, schlichter heller Himmel als Hintergrund. Alle in derselben Lackierung: weiß mit goldenem Streifen und nachtblauem Leitwerk, ohne Logo und ohne Schrift.

| Datei | Größe | Prompt |
|---|---|---|
| `air-flugzeug-libelle.png` | 1024 × 1024 | Kleines Regionalflugzeug mit zwei Propellern und hohen Flügeln, etwa 50 Sitze, wirkt flink und leicht. |
| `air-flugzeug-falke.png` | 1024 × 1024 | Mittelgroßes Kurzstrecken-Düsenflugzeug mit zwei Triebwerken unter den Flügeln, schlank, etwa 130 Sitze. |
| `air-flugzeug-kranich.png` | 1024 × 1024 | Größeres Mittelstrecken-Düsenflugzeug, langer Rumpf, zwei große Triebwerke, nach oben gebogene Flügelspitzen, etwa 190 Sitze. |
| `air-flugzeug-albatros.png` | 1024 × 1024 | Großes Langstrecken-Großraumflugzeug mit zwei riesigen Triebwerken und sehr langen Flügeln, majestätisch, etwa 320 Sitze. |

### 4. Die Chefs der drei Rivalen (Porträts, quadratisch)

Werden klein und rund gezeigt. Gesicht groß und mittig, schlichter dunkler Hintergrund in der Farbe der Airline. Erfundene Personen.

| Datei | Größe | Prompt |
|---|---|---|
| `air-chef-kontinentia.png` | 1024 × 1024 | Harald Brenner, Chef einer alten großen Airline, um die sechzig, graue Haare, strenger selbstsicherer Blick, dunkler Anzug mit roter Krawatte, Hintergrund dunkelrot. |
| `air-chef-spatzflug.png` | 1024 × 1024 | Bruno Kiesel, Chef einer Billig-Airline, Mitte vierzig, breites Verkäufergrinsen, offenes orangefarbenes Hemd, Daumen hoch, Hintergrund orange. |
| `air-chef-aurelia.png` | 1024 × 1024 | Valérie Morand, Chefin einer Luxus-Airline, Anfang fünfzig, elegant, kühles Lächeln, Perlenohrringe, violetter Blazer, Hintergrund violett. |

### 4b. Die Assistenten (Porträts, quadratisch)

Werden klein und rund im Menü „Meine Airline“ gezeigt. Gesicht groß und mittig, freundlich, schlichter nachtblauer Hintergrund. Erfundene Personen.

| Datei | Größe | Prompt |
|---|---|---|
| `air-assistent-tim.png` | 1024 × 1024 | Tim Brandt, junger Analyst Mitte zwanzig, wuschelige Haare, begeistertes Lächeln, Kopfhörer um den Hals, Kapuzenpulli, hält ein Tablet. |
| `air-assistent-mia.png` | 1024 × 1024 | Mia Kaya, Analystin Anfang dreißig, Brille, dunkle Haare im Zopf, ruhiger aufmerksamer Blick, Blazer über T-Shirt. |
| `air-assistent-kern.png` | 1024 × 1024 | Dr. Helga Kern, erfahrene Analystin um die sechzig, kurze graue Haare, Lesebrille auf der Nase, skeptisch hochgezogene Augenbraue, eleganter Rollkragen. |
| `air-assistent-paul.png` | 1024 × 1024 | Paul Wendt, Preis-Experte um die vierzig, Bart, Hemd mit hochgekrempelten Ärmeln, verschmitztes Lächeln, Taschenrechner in der Brusttasche. |

### 5. Ereignisse (breit)

| Datei | Größe | Prompt |
|---|---|---|
| `air-ereignis-slot.png` | 1536 × 1024 | Eine Start- und Landebahn eines großen Flughafens in der Dämmerung, eine Lücke in einer Reihe wartender Flugzeuge, ein grünes Licht leuchtet auf. |
| `air-ereignis-gebraucht.png` | 1536 × 1024 | Ein gebrauchtes Passagierflugzeug ohne Lackierung steht in einem großen Hangar, Mechaniker davor, ein Schild ohne Schrift hängt am Bugrad. |
| `air-ereignis-messe.png` | 1536 × 1024 | Eine riesige moderne Messehalle mit vielen Ständen und Geschäftsleuten mit Koffern, durch die Glasfassade sieht man ein landendes Flugzeug. |
| `air-ereignis-kerosin.png` | 1536 × 1024 | Ein Tankwagen betankt ein Flugzeug auf dem Vorfeld im Morgenlicht, Schläuche, Hitzeflimmern. |
| `air-ereignis-uebernahme.png` | 1536 × 1024 | Ein dunkler Besprechungsraum ganz oben in einem Hochhaus, ein Vertrag und ein Füller auf einem langen Tisch, draußen ein Flughafen bei Nacht. Bedrohliche, ernste Stimmung. |
| `air-ende.png` | 1536 × 1024 | Ein leeres, stilles Vorfeld bei Regen, ein einzelnes geparktes Flugzeug mit abgedeckten Triebwerken, melancholisch. |

### 6. Regelkarten (quadratisch, erscheinen, wenn eine neue Regel dazukommt)

| Datei | Größe | Prompt |
|---|---|---|
| `air-regel-drehkreuz.png` | 1024 × 1024 | Ein großer Flughafen von oben wie ein Stern: von der Mitte gehen viele leuchtende goldene Fluglinien in alle Richtungen zu kleineren Städten, kleine Flugzeuge bringen Reisende herein, ein großes fliegt hinaus. |
| `air-regel-rivalen.png` | 1024 × 1024 | Drei Flugzeuge in Rot, Orange und Violett fliegen nebeneinander durch Wolken um die Wette, sportliche, spannende Stimmung. |
| `air-regel-saison.png` | 1024 × 1024 | Ein Bild, das in vier Teile geteilt ist: Frühlingsblüten, Sommerstrand, Herbstlaub, verschneite Berge, durch alle vier fliegt dasselbe kleine Flugzeug. |

### 7. App-Symbol (für den Home-Bildschirm)

Diese zwei Dateien kommen ausnahmsweise **nicht** nach `web/grafiken/`, sondern direkt nach `web/` und ersetzen die alten Dateien dort.

| Datei | Größe | Prompt |
|---|---|---|
| `web/app-icon.png` | 1024 × 1024 | App-Symbol: ein stilisiertes weißes Flugzeug mit goldenem Streifen steigt schräg nach oben vor nachtblauem Hintergrund mit einem goldenen Bogen wie eine Fluglinie. Sehr einfache, klare Form, ohne Rand, ohne Schrift. |
| `web/app-icon-180.png` | 180 × 180 | Genau dasselbe Bild, nur verkleinert auf 180 × 180. |

## Kontrolle

Nach dem Hochladen die Seite https://flo-horn-sketch.github.io/Iphone-Game/ ein paar Minuten später neu laden. Fehlende Bilder zeigt das Spiel als Symbol.
