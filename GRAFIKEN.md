# Grafiken für „Die Fahrenden“

Alle Bilder im Spiel kommen aus ChatGPT. Bis ein Bild da ist, zeigt das Spiel einen Platzhalter mit Dateiname und Größe (große Bilder) oder ein einfaches Symbol (kleine Bilder). In der Entwicklungsversion zeigt der Bilderknopf oben rechts auf der Weltkarte, welche Bilder schon da sind.

## So kommt ein Bild ins Spiel

1. In ChatGPT zuerst die **Stilvorgabe** unten einfügen, dann den Prompt für das Bild.
2. Bild als PNG herunterladen und genau so benennen wie in der Liste, zum Beispiel `karte-mittelreich.png`.
3. Datei in den Ordner `DieFahrenden/Grafiken/` legen (Unterordner sind erlaubt, jeder Name nur einmal).
4. In Xcode neu starten. Fertig, kein Code nötig.

## Größen

ChatGPT liefert Querformat meist als **1536 × 1024**, Quadrate als **1024 × 1024**. Full HD (1920 × 1080) geht genauso. Das Spiel richtet sich nach dem Seitenverhältnis des Bildes, du musst nichts zuschneiden.

| Art | Format | Größe | Hintergrund |
|---|---|---|---|
| Karten, Bühnen, Ereignistafeln | Querformat | 1536 × 1024 | gemalt, randlos |
| Porträts | Quadrat | 1024 × 1024 | gemalt |
| Ortszeichen, Wagen, Publikum, Symbole | Quadrat | 1024 × 1024 | **transparent** |

## Karten: Weltkarte plus eine Karte pro Region

Weil ein Bild nur etwa Full HD hat, gibt es eine **Weltkarte** mit allen fünf Regionen und für jede Region eine **eigene Karte**. Auf der Weltkarte tippt man eine Region an und landet auf deren Karte. Die Regionskarte ist größer als der Bildschirm, man schiebt sie mit dem Finger und zoomt mit zwei Fingern.

**Wichtig:** Orte, Wege und Namen zeichnet das Spiel selbst über das Bild. Die Karten sollen deshalb **ohne Schrift, ohne Städte und ohne Straßen** gemalt werden, nur Landschaft. Die Positionen der Orte stehen in `GameCore/Sources/GameCore/Resources/welt.json` als Anteil von Breite und Höhe (0 bis 1). Passt ein Ort nicht zur Landschaft, tippst du in der Entwicklungsversion auf die gewünschte Stelle der Karte. Das Spiel zeigt dann die passende Zeile, zum Beispiel `"position": { "x": 0.42, "y": 0.61 }`, die du in welt.json einträgst.

## Stilvorgabe (immer zuerst einfügen)

> Stil für alle Bilder dieses Spiels: handgemalte Illustration in Gouache und Tusche, wie eine Mischung aus mittelalterlicher Buchmalerei und hochwertigem Bilderbuch. Warme Erdtöne, dazu tiefes Weinrot (#7A2E22), mattes Gold (#C9963A), Nachtblau (#2F4F7A) und Pergament (#F1E4C8). Sichtbare Pinselstriche, weiche Schatten, leicht körnige Papierstruktur. Erfundene, leicht fantastische mittelalterliche Welt. Keine Schrift, keine Buchstaben, keine Zahlen, kein Rahmen, kein Wasserzeichen.

Für Bilder mit transparentem Hintergrund zusätzlich anhängen:

> Einzelnes Motiv, freigestellt auf transparentem Hintergrund, mittig, mit etwas Rand, ohne Bodenschatten. Gut erkennbar auch in sehr kleiner Größe.

Tipp: Alle Bilder einer Gruppe im selben ChatGPT-Chat erzeugen, dann bleibt der Stil einheitlich.

## Liste aller Bilder mit Prompts

### Karten (1536 × 1024, Querformat)

| Datei | Prompt |
|---|---|
| `karte-welt.png` | Gemalte Weltkarte eines erfundenen mittelalterlichen Königreichs, Draufsicht wie eine alte Pergamentkarte. Fünf Gebiete: oben in der Mitte eine kalte Fjordlandschaft mit verschneiten Bergen (Nordmark), in der Mitte grünes Ackerland mit Hügeln, Wäldern und einem Fluss (Mittelreich), unten links eine warme Küste mit Lagunen und Inseln (Lagunenstädte), rechts weites goldenes Grasland (Steppe), unten rechts eine helle Wüste mit Oasen (Weiße Wüste). Gebirge und Meer als natürliche Grenzen. Keine Städte, keine Straßen, keine Beschriftung. |
| `karte-mittelreich.png` | Gemalte Landkarte des Mittelreichs aus leicht schräger Vogelperspektive: sanfte grüne Hügel, Felder in Flicken, kleine Wälder, links ein Bach, in der Mitte ein breiter Fluss, oben ein dunkler Wald, oben rechts ein felsiger Hügel, unten rechts eine Senke mit Wiesen. Viel freie Fläche für Orte. Keine Häuser, keine Burgen, keine Straßen, keine Beschriftung. |
| `karte-nordmark.png` | Gemalte Landkarte der Nordmark: Fjorde, dunkle Nadelwälder, verschneite Pässe, Gletscher, kaltes graublaues Licht. Keine Siedlungen, keine Wege, keine Beschriftung. *(für später)* |
| `karte-lagunen.png` | Gemalte Landkarte der Lagunenstädte: warme Küste, türkisfarbene Lagunen, kleine Inseln, Zypressen, Sandbänke, Abendlicht. Keine Siedlungen, keine Wege, keine Beschriftung. *(für später)* |
| `karte-steppe.png` | Gemalte Landkarte der Steppe: endloses goldenes Grasland, wenige Flüsse, einzelne Felsen, weiter Himmel, Herden in der Ferne. Keine Siedlungen, keine Wege, keine Beschriftung. *(für später)* |
| `karte-wueste.png` | Gemalte Landkarte der Weißen Wüste: helle Dünen, Salzflächen, einzelne Oasen mit Palmen, flirrende Hitze. Keine Siedlungen, keine Wege, keine Beschriftung. *(für später)* |

### Orte und Wagen (1024 × 1024, transparent)

| Datei | Prompt |
|---|---|
| `ort-dorf.png` | Kleines mittelalterliches Dorf als Kartensymbol: drei Fachwerkhäuser mit Strohdach und ein Brunnen, schräg von oben. |
| `ort-markt.png` | Marktflecken als Kartensymbol: bunte Marktstände mit Stoffdächern vor zwei Bürgerhäusern, schräg von oben. |
| `ort-burg.png` | Kleine Burg als Kartensymbol: Bergfried mit weinroter Fahne, Mauer und Tor, schräg von oben. |
| `ort-kloster.png` | Kloster als Kartensymbol: Kirche mit Glockenturm, Kreuzgang und Klostergarten, schräg von oben. |
| `wagen.png` | Bunter Gauklerwagen mit gewölbtem weinrotem Planendach und goldenen Verzierungen, von einem Pferd gezogen, Seitenansicht nach rechts. |

### Porträts (1024 × 1024)

Gemeinsamer Zusatz für alle Porträts: *Brustbild, Blick leicht zur Seite, warmer neutraler Hintergrund, Gesicht gut erkennbar, auch klein lesbar.*

| Datei | Prompt |
|---|---|
| `portrait-berta.png` | Alte Gauklerin, wettergegerbtes Gesicht, kluge Augen, graues Haar unter einem bunten Kopftuch, viele Ketten und Glücksbringer. |
| `portrait-jorin.png` | Junger Narr mit Schellenkappe in Weinrot und Gold, frechem Grinsen und geschminkter Nase. |
| `portrait-lene.png` | Junge Seiltänzerin, schlank, zurückgebundenes Haar, enges Kostüm in Nachtblau, konzentrierter Blick. |
| `portrait-tamo.png` | Feuerschlucker mit rußigem Gesicht, kahlem Kopf, Ohrring und einer brennenden Fackel in der Hand. |
| `portrait-wenzel.png` | Älterer Spielmann mit Laute, buntem Wams, Federhut und freundlichem Lächeln. |
| `portrait-mira.png` | Junge Jongleurin, Flüchtling, abgetragene Kleider, entschlossener Blick, drei bunte Bälle in der Hand. |
| `portrait-kaspar.png` | Kräftiger Bärenführer mit Vollbart, Fellweste und einer Kette in der Hand, hinter ihm der Kopf eines zahmen Braunbären. |

### Bühnen (1536 × 1024)

Gemeinsamer Zusatz: *Blick vom Publikum auf eine leere Bühne, abends, Fackellicht, untere Bildhälfte ruhig und dunkel, damit Karten darauf gut lesbar sind.*

| Datei | Prompt |
|---|---|
| `buehne-dorf.png` | Bretterbühne auf einem Dorfplatz zwischen Fachwerkhäusern, Strohballen als Sitze. |
| `buehne-markt.png` | Große Bühne mit weinrotem Vorhang auf einem belebten Marktplatz, Stände im Hintergrund. |
| `buehne-burg.png` | Bühne im Burgsaal, Wandteppiche, Kerzenleuchter, ein Thron im Hintergrund. |
| `buehne-kloster.png` | Schlichte Bühne im Klosterhof, Kreuzgang, Kerzen, ruhige fromme Stimmung. |

### Publikum (1024 × 1024, transparent)

| Datei | Prompt |
|---|---|
| `publikum-volk.png` | Kleine sitzende Figur aus dem einfachen Volk in braunen Kleidern, Rückenansicht leicht schräg, wie eine Spielfigur. |
| `publikum-adel.png` | Kleine sitzende adlige Figur in Blau und Gold mit kleiner Krone oder Hut, Rückenansicht leicht schräg, wie eine Spielfigur. |
| `publikum-geistlichkeit.png` | Kleine sitzende Figur eines Mönchs in Schwarz mit weißem Kragen, Rückenansicht leicht schräg, wie eine Spielfigur. |

### Ereignistafeln (1536 × 1024)

Gemeinsamer Zusatz: *Dramatische Szene wie eine gemalte Bildtafel, das Wichtigste in der Bildmitte, die Gaukler als kleine Figuren erkennbar.*

| Datei | Prompt |
|---|---|
| `ereignis-woelfe.png` | Nachts im Wald umkreisen Wölfe mit leuchtenden Augen ein kleines Lager mit Gauklerwagen und Feuer. |
| `ereignis-schlamm.png` | Ein Gauklerwagen steckt im Regen bis zur Achse im Schlamm eines Waldwegs, Leute schieben. |
| `ereignis-fluechtlinge.png` | Eine erschöpfte Familie mit Bündeln steht am Wegrand und bittet die Gaukler um Hilfe, grauer Himmel. |
| `ereignis-fieber.png` | Im Inneren eines Wagens liegt eine junge Seiltänzerin mit Fieber, eine alte Frau kühlt ihre Stirn, Kerzenlicht. |
| `ereignis-baerenfuehrer.png` | Am Wegrand sitzt ein bärtiger Mann neben einem zahmen Braunbären mit Halsband und wartet. |
| `ereignis-hunger.png` | Die Truppe sitzt im Schnee um ein kleines Feuer, leere Töpfe, ein Pferd steht daneben, bedrückte Stimmung. |

### Symbole (1024 × 1024, transparent)

Gemeinsamer Zusatz: *Einfaches, kräftiges Symbol, wenig Details, klar erkennbar in 20 Pixel Größe, goldene Konturen.*

| Datei | Prompt |
|---|---|
| `symbol-brot.png` | Ein runder Brotlaib. |
| `symbol-muenze.png` | Eine goldene Münze mit Krone. |
| `symbol-holz.png` | Ein Bündel Feuerholz. |
| `symbol-moral.png` | Ein lachendes Gesicht wie eine Theatermaske. |
| `symbol-tag.png` | Eine Sonne. |
| `symbol-gefahr.png` | Ein Warndreieck aus Holz mit Ausrufezeichen-Form aus einem Dolch. |
| `symbol-wald.png` | Zwei dunkle Tannen. |
| `symbol-jubel.png` | Zwei klatschende Hände mit fliegendem Hut. |
| `symbol-panne.png` | Ein gerissenes Seil. |
| `symbol-gaehnen.png` | Ein gähnendes Gesicht. |
| `symbol-schloss.png` | Ein altes Vorhängeschloss. |
| `symbol-krank.png` | Ein grüner Fiebertropfen. |
| `symbol-tod.png` | Ein schlichtes Holzkreuz mit Blume. |
| `symbol-pflege.png` | Ein Heilkräuterbündel mit rotem Band. |
| `gefuehl-spannung.png` | Ein Blitz. |
| `gefuehl-humor.png` | Eine lachende Narrenmaske. |
| `gefuehl-staunen.png` | Ein funkelnder Stern. |
| `gefuehl-herz.png` | Ein rotes Herz. |
| `disziplin-akrobatik.png` | Ein Seiltänzer auf einem Seil. |
| `disziplin-narretei.png` | Eine Schellenkappe. |
| `disziplin-tiere.png` | Eine Bärentatze. |
| `disziplin-gaukelei.png` | Drei Jonglierbälle. |
| `disziplin-musik.png` | Eine Laute. |
| `disziplin-feuer.png` | Eine Fackel mit Flamme. |
| `disziplin-erzaehlung.png` | Ein aufgeschlagenes Buch. |

### App-Symbol (1024 × 1024)

| Datei | Prompt |
|---|---|
| App-Symbol | Gauklerwagen mit weinrotem Dach vor einem goldenen Mond, kräftige Formen, kein Text. In Xcode unter `Assets` → `AppIcon` hineinziehen. |

## Neue Bilder hinzufügen

Ein neues Porträt oder eine neue Ereignistafel braucht nur einen Eintrag in `welt.json` (Feld `portrait` oder `image`) und die passende Datei im Grafik-Ordner. Damit es auch in der Bilderübersicht erscheint, trägt man es zusätzlich in `DieFahrenden/Darstellung/GrafikListe.swift` ein.
