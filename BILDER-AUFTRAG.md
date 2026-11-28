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

> Moderne, freundliche Illustration im Stil eines hochwertigen Reiseplakats, leicht gemalt, klare Formen, sanfte Verläufe. Farben: Nachtblau, Himmelblau, warmes Gold, etwas Abendrot. Echte Flugzeugtypen, aber erfundene Airlines: keine Logos, keine Markennamen, keine echten Airline-Lackierungen. Keine Schrift, kein Text, keine Buchstaben, keine Zahlen.

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

### 3. Die zwölf Flugzeugtypen (echte Typen, Seitenansicht, schlichter Hintergrund)

Die Bilder erscheinen groß im Flugzeug-Store und klein im Linien-Editor. Flugzeug groß und mittig, von der Seite, leicht schräg, schlichter heller Himmel als Hintergrund. Der Typ soll gut erkennbar sein. Alle in derselben neutralen Lackierung: weiß mit goldenem Streifen und nachtblauem Leitwerk, ohne Logo und ohne Schrift. Die bisherigen Dateinamen bleiben.

| Datei | Größe | Prompt |
|---|---|---|
| `air-flugzeug-libelle.png` | 1024 × 1024 | Eine ATR 72-600: Turboprop-Regionalflugzeug mit hohen Flügeln, zwei Propellertriebwerken und T-Leitwerk. |
| `air-flugzeug-falke.png` | 1024 × 1024 | Eine Embraer E195-E2: schlanker Regionaljet mit zwei großen Triebwerken unter den Flügeln. |
| `air-flugzeug-kranich.png` | 1024 × 1024 | Ein Airbus A321neo: langer Schmalrumpf-Jet mit zwei Triebwerken und nach oben gebogenen Flügelspitzen (Sharklets). |
| `air-flugzeug-albatros.png` | 1024 × 1024 | Eine Boeing 787-9 Dreamliner: Großraumjet mit sehr langen, elegant nach oben gebogenen Flügeln und gezackten Triebwerksverkleidungen. |
| `air-flugzeug-dash8.png` | 1024 × 1024 | Eine De Havilland Dash 8-400: schlankes Turboprop-Flugzeug mit hohen Flügeln, zwei großen Propellern und T-Leitwerk, länger als eine ATR. |
| `air-flugzeug-crj900.png` | 1024 × 1024 | Eine Bombardier CRJ900: schmaler Regionaljet mit zwei Triebwerken hinten am Rumpf und T-Leitwerk. |
| `air-flugzeug-a220.png` | 1024 × 1024 | Ein Airbus A220-300: moderner schlanker Jet mit großen Triebwerken unter den Flügeln und auffällig großen Kabinenfenstern. |
| `air-flugzeug-b737.png` | 1024 × 1024 | Eine Boeing 737 MAX 8: Schmalrumpf-Jet mit flachen Triebwerken und gespaltenen Flügelspitzen. |
| `air-flugzeug-a320.png` | 1024 × 1024 | Ein Airbus A320neo: Schmalrumpf-Jet mit großen runden Triebwerken und Sharklets an den Flügelspitzen. |
| `air-flugzeug-a350.png` | 1024 × 1024 | Ein Airbus A350-900: Großraumjet mit geschwungenen Flügelspitzen und markanten dunklen Cockpitfenstern (wie eine Maske). |
| `air-flugzeug-b777.png` | 1024 × 1024 | Eine Boeing 777-300ER: sehr langer Großraumjet mit zwei riesigen Triebwerken und sechs Rädern pro Hauptfahrwerk. |
| `air-flugzeug-a380.png` | 1024 × 1024 | Ein Airbus A380: riesiges Doppelstock-Flugzeug mit vier Triebwerken und zwei durchgehenden Fensterreihen. |

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
| `air-assistent-jonas.png` | 1024 × 1024 | Jonas Ritter, Controller Anfang zwanzig, Praktikant, zu großes Sakko, etwas verlegenes Lächeln, Kugelschreiber hinter dem Ohr. |
| `air-assistent-lena.png` | 1024 × 1024 | Lena Vogt, Controllerin Mitte dreißig, blonder Kurzhaarschnitt, klarer freundlicher Blick, dunkelblaue Bluse, Ordner unter dem Arm. |
| `air-assistent-ines.png` | 1024 × 1024 | Ines Falk, erfahrene Controllerin um die fünfzig, graue Strähne im dunklen Haar, schmale Brille, leichtes wissendes Lächeln, Perlenohrringe. |

### 5. Ereignisse (breit)

| Datei | Größe | Prompt |
|---|---|---|
| `air-ereignis-slot.png` | 1536 × 1024 | Eine Start- und Landebahn eines großen Flughafens in der Dämmerung, eine Lücke in einer Reihe wartender Flugzeuge, ein grünes Licht leuchtet auf. |
| `air-ereignis-gebraucht.png` | 1536 × 1024 | Ein gebrauchtes Passagierflugzeug ohne Lackierung steht in einem großen Hangar, Mechaniker davor, ein Schild ohne Schrift hängt am Bugrad. |
| `air-ereignis-messe.png` | 1536 × 1024 | Eine riesige moderne Messehalle mit vielen Ständen und Geschäftsleuten mit Koffern, durch die Glasfassade sieht man ein landendes Flugzeug. |
| `air-ereignis-uebernahme.png` | 1536 × 1024 | Ein dunkler Besprechungsraum ganz oben in einem Hochhaus, ein Vertrag und ein Füller auf einem langen Tisch, draußen ein Flughafen bei Nacht. Bedrohliche, ernste Stimmung. |
| `air-ereignis-plan.png` | 1536 × 1024 | Ein Megafon auf einem Konferenztisch vor einer großen Weltkarte mit einer neu eingezeichneten, leuchtenden Fluglinie, im Hintergrund unscharf ein Flughafen. Spannung wie vor einem Wettkampf. |
| `air-ereignis-versteigerung.png` | 1536 × 1024 | Ein edler Auktionssaal, ein Auktionshammer liegt auf dem Pult, Bieter halten verdeckte Umschläge, durch hohe Fenster sieht man eine Start- und Landebahn. |
| `air-ereignis-aufkauf.png` | 1536 × 1024 | Viele abgestellte Flugzeuge ohne Lackierung in Reihen auf einem großen Vorfeld, ein Mann und eine Frau geben sich davor die Hand, Abendlicht. |
| `air-ereignis-streik.png` | 1536 × 1024 | Bodenpersonal in Warnwesten steht mit erhobenen Fäusten und Schildern ohne Schrift auf einem Vorfeld, dahinter wartende Flugzeuge. |
| `air-ereignis-sturm.png` | 1536 × 1024 | Ein Passagierflugzeug steht auf dem Vorfeld, darüber dunkle Gewitterwolken und Blitze, Regen peitscht über die Landebahn. |
| `air-ereignis-kerosin.png` | 1536 × 1024 | Ein Tankwagen betankt ein Flugzeug auf dem Vorfeld im Morgenlicht, Schläuche, Hitzeflimmern, im Vordergrund eine große Anzeige mit auf- und absteigender Kurve ohne Zahlen. |
| `air-ende.png` | 1536 × 1024 | Ein leeres, stilles Vorfeld bei Regen, ein einzelnes geparktes Flugzeug mit abgedeckten Triebwerken, melancholisch. |

### 6. Regelkarten (quadratisch, erscheinen, wenn eine neue Regel dazukommt)

| Datei | Größe | Prompt |
|---|---|---|
| `air-regel-drehkreuz.png` | 1024 × 1024 | Ein großer Flughafen von oben wie ein Stern: von der Mitte gehen viele leuchtende goldene Fluglinien in alle Richtungen zu kleineren Städten, kleine Flugzeuge bringen Reisende herein, ein großes fliegt hinaus. |
| `air-regel-rivalen.png` | 1024 × 1024 | Drei Flugzeuge in Rot, Orange und Violett fliegen nebeneinander durch Wolken um die Wette, sportliche, spannende Stimmung. |
| `air-regel-saison.png` | 1024 × 1024 | Ein Bild, das in vier Teile geteilt ist: Frühlingsblüten, Sommerstrand, Herbstlaub, verschneite Berge, durch alle vier fliegt dasselbe kleine Flugzeug. |
| `air-regel-plaene.png` | 1024 × 1024 | Ein Rivalen-Chef in einem dunklen Büro zeigt mit einem Stift auf eine Weltkarte, eine gestrichelte neue Linie leuchtet auf, geheimnisvolle Stimmung. |
| `air-regel-duell.png` | 1024 × 1024 | Zwei Passagierflugzeuge in Grün und Orange fliegen Nase an Nase auf derselben Strecke, zwischen ihnen zwei gekreuzte Säbel aus Licht. |
| `air-regel-trends.png` | 1024 × 1024 | Eine Stadt bei Nacht, über ihr steigt ein großer grüner Pfeil nach oben, eine andere Stadt am Horizont mit einem roten Pfeil nach unten, Flugzeuge dazwischen. |
| `air-regel-versteigerung.png` | 1024 × 1024 | Ein goldener Auktionshammer schwebt über einem Flughafen-Terminal, drei Umschläge in Rot, Orange und Violett liegen auf einem Pult. |
| `air-regel-wahl.png` | 1024 × 1024 | Eine Weggabelung aus zwei Landebahnen: links ruhiges Wetter und ein Schild mit Schutzschild-Symbol, rechts Gewitter und ein großer Würfel. |
| `air-regel-rennen.png` | 1024 × 1024 | Vier Flugzeuge in Grün, Rot, Orange und Violett fliegen auf eine Zielflagge zu, darüber schwebt ein goldener Pokal. |
| `air-regel-ausbau.png` | 1024 × 1024 | Ein Flughafen-Terminal wird mit Kränen und Gerüsten erweitert, neue Gates, Flugzeuge rollen schon heran, goldenes Abendlicht. |
| `air-regel-aufkauf.png` | 1024 × 1024 | Ein Schild „Sale“ ohne Schrift, nur mit Prozentzeichen, hängt an einem Flugzeug, im Hintergrund weitere abgestellte Flugzeuge, leicht melancholische Stimmung. |

### 6b. Weitere Regelkarten (quadratisch, auch im Menü unter „Spielregeln“)

| Datei | Größe | Prompt |
|---|---|---|
| `air-regel-start.png` | 1024 × 1024 | Ein einzelnes kleines Flugzeug steht im Morgenlicht auf einer leeren Startbahn, vor ihm eine leuchtende goldene Linie über eine Landkarte bis zum Horizont, Aufbruchsstimmung. |
| `air-regel-store.png` | 1024 × 1024 | Ein heller Hangar wie ein Schaufenster: nebeneinander ein kleines Propellerflugzeug, ein mittlerer Jet und ein riesiger Großraumjet, Scheinwerfer von oben. |
| `air-regel-farben.png` | 1024 × 1024 | Eine Landkarte von oben mit drei leuchtenden Fluglinien: eine grün, eine gelb, eine rot, kleine Flugzeuge darauf. |
| `air-regel-tempo.png` | 1024 × 1024 | Eine große Flughafen-Uhr, deren Zeiger sich schnell drehen, dahinter wechselt der Himmel von Tag zu Nacht, Flugzeuge als Lichtspuren. |
| `air-regel-linie.png` | 1024 × 1024 | Blick von oben in eine aufgeschnittene Flugzeugkabine: vorne wenige breite Sitze in Gold, dann Sitze in Blau, hinten viele schmale Sitze in Grün. |
| `air-regel-meine.png` | 1024 × 1024 | Ein gemütliches Chefbüro mit Fenster zum Vorfeld, auf dem Tisch ein Flugzeugmodell, ein Tablett mit Essen und ein Koffer, warmes Licht. |
| `air-regel-assistenten.png` | 1024 × 1024 | Zwei Mitarbeitende beugen sich mit Lupe und Notizblock über eine große Weltkarte voller Fluglinien, konzentrierte Stimmung. |
| `air-regel-berater.png` | 1024 × 1024 | Eine Assistentin zeigt mit einer Sprechblase auf eine leuchtende Fluglinie auf der Weltkarte, freundlich und hilfsbereit. |
| `air-regel-rangliste.png` | 1024 × 1024 | Ein Siegertreppchen auf einem Rollfeld, auf den drei Stufen stehen Flugzeugmodelle in Grün, Rot und Violett, darüber Konfetti. |
| `air-regel-verwaltung.png` | 1024 × 1024 | Ein Büro voller Aktenstapel, Telefone und Bildschirme, im Fenster dahinter ein Flughafen mit vielen Flugzeugen, leicht überfordert wirkende Stimmung mit Augenzwinkern. |
| `air-regel-ruf.png` | 1024 × 1024 | Zufriedene Reisende steigen lächelnd aus einem Flugzeug, über ihnen leuchten fünf goldene Sterne am Abendhimmel. |
| `air-regel-controlling.png` | 1024 × 1024 | Eine Controllerin zeigt auf einen großen Bildschirm mit einer Landkarte, eine Linie leuchtet orange mit einem Ausrufezeichen-Symbol, ruhige konzentrierte Stimmung. |
| `air-regel-statistik.png` | 1024 × 1024 | Ein Tablet auf einem Schreibtisch zeigt bunte Balken in Grün, Gelb und Rot, daneben eine Kaffeetasse und ein kleines Flugzeugmodell. |
| `air-regel-spaet.png` | 1024 × 1024 | Ein einzelnes großes, glänzendes Flugzeug wird in einem hellen Hangar sorgfältig poliert, statt vieler kleiner – Qualität statt Masse, goldenes Licht. |
| `air-regel-pleite.png` | 1024 × 1024 | Ein Flugzeug steht im Regen vor einem Bankgebäude, darüber ein großes Warndreieck aus Licht, ernste, aber nicht düstere Stimmung. |

### 6c. Regelkarten für die Slots (quadratisch, neu)

| Datei | Größe | Prompt |
|---|---|---|
| `air-regel-slots.png` | 1024 × 1024 | Eine große Flughafen-Abflugtafel ohne lesbare Schrift, eine Zeile leuchtet golden, davor startet ein Flugzeug in den Morgenhimmel, eine Uhr am Rand. |
| `air-regel-tafel.png` | 1024 × 1024 | Eine Wand mit vielen kleinen Fächern wie ein Stundenplan, in jedem Fach eine kleine Uhr, zwei Fächer leuchten grün, die anderen golden und blaugrau, warmes Licht. |
| `air-regel-flugzeuge.png` | 1024 × 1024 | Ein neues Flugzeug rollt aus einem hellen Hangar direkt auf eine leuchtende Fluglinie, die über eine Landkarte führt, Aufbruchsstimmung. |
| `air-regel-tagesplan.png` | 1024 × 1024 | Ein einzelnes Flugzeug, dahinter ein langer Zeitstrahl vom Sonnenaufgang bis zur Nacht mit mehreren farbigen Balken, das Flugzeug fliegt den Strahl entlang. |
| `air-regel-bieten.png` | 1024 × 1024 | Vier verschlossene Umschläge in Grün, Rot, Orange und Violett liegen auf einem Tisch, daneben ein großes goldenes Drehrad, im Fenster ein Flughafen mit einem goldenen Lichtring. |
| `air-regel-reisende.png` | 1024 × 1024 | Eine Wartehalle mit einer überschaubaren Gruppe Reisender, die sich auf drei Gates mit verschiedenfarbigen Flugzeugen verteilt, über der Halle ein halb gefüllter Balken aus Licht. |
| `air-regel-rat.png` | 1024 × 1024 | Eine Analystin mit Brille zeigt auf einen Bildschirm, auf dem eine von drei Karten mit einem goldenen Funkeln markiert ist, ruhige freundliche Stimmung. |
| `air-regel-verlieren.png` | 1024 × 1024 | Ein leeres Gate mit abgesperrtem Zugang, darüber eine große Sanduhr, deren Sand fast durchgelaufen ist, kein Flugzeug am Gate, Abendlicht. |
| `air-regel-handel.png` | 1024 × 1024 | Zwei Airline-Chefs geben sich über einem Tisch die Hand, auf dem Tisch zwei kleine Uhren in verschiedenen Farben, die getauscht werden, im Fenster ein Vorfeld. |
| `air-regel-kabine.png` | 1024 × 1024 | Ein Flugzeug in einer Werkstatt, der Rumpf ist von oben geöffnet, Mechaniker tauschen schmale blaue Sitze gegen breite goldene Sessel, helles Arbeitslicht. |
| `air-regel-rivalpleite.png` | 1024 × 1024 | Ein verlassener Schalter einer Airline mit heruntergelassenem Rollgitter, davor auf dem Vorfeld mehrere leere Gates, über denen goldene Lichtringe aufleuchten. |

### 6d. Ereignis für die Slots (breit, neu)

| Datei | Größe | Prompt |
|---|---|---|
| `air-ereignis-slotangebot.png` | 1536 × 1024 | Ein Rivalen-Chef schiebt einen Geldkoffer über einen Konferenztisch, auf dem Tisch steht eine kleine goldene Uhr, im Fenster dahinter ein Flughafen in der Dämmerung. |

### 7. App-Symbol (für den Home-Bildschirm)

Diese zwei Dateien kommen ausnahmsweise **nicht** nach `web/grafiken/`, sondern direkt nach `web/` und ersetzen die alten Dateien dort.

| Datei | Größe | Prompt |
|---|---|---|
| `web/app-icon.png` | 1024 × 1024 | App-Symbol: ein stilisiertes weißes Flugzeug mit goldenem Streifen steigt schräg nach oben vor nachtblauem Hintergrund mit einem goldenen Bogen wie eine Fluglinie. Sehr einfache, klare Form, ohne Rand, ohne Schrift. |
| `web/app-icon-180.png` | 180 × 180 | Genau dasselbe Bild, nur verkleinert auf 180 × 180. |

### 8. Symbole (klein, ersetzen alle Standard-Symbole im Spiel)

Alle Symbole im selben Stil. Diesen Satz **statt** des allgemeinen Stils vor jeden Symbol-Prompt setzen:

> Einzelnes Spiel-Symbol, flach mit leichtem Verlauf, kräftige klare Umrisse, Farben Nachtblau, Himmelblau, warmes Gold und Weiß, mittig, füllt das Bild fast ganz aus, **durchsichtiger Hintergrund**, kein Rahmen, kein Schatten nach außen, keine Schrift. Muss auch winzig klein (20 Pixel) noch erkennbar sein.

Wichtig: PNG mit **durchsichtigem Hintergrund**, quadratisch 256 × 256. Das Spiel zeigt jedes Symbol in fester Größe, auch wenn das Bild größer ist.

| Datei | Größe | Motiv |
|---|---|---|
| `ico-stift.png` | 256 × 256 | Bleistift, schräg, Linien-Editor |
| `ico-store.png` | 256 × 256 | Einkaufswagen |
| `ico-flugzeug.png` | 256 × 256 | Passagierjet von oben, schräg nach rechts oben |
| `ico-propeller.png` | 256 × 256 | kleines Propellerflugzeug von der Seite |
| `ico-start.png` | 256 × 256 | Flugzeug beim Abheben, schräg nach oben |
| `ico-landung.png` | 256 × 256 | Flugzeug beim Landen, schräg nach unten |
| `ico-duell.png` | 256 × 256 | zwei gekreuzte Säbel |
| `ico-mode.png` | 256 × 256 | kleine Flamme |
| `ico-hoch.png` | 256 × 256 | schlichtes Dreieck, Spitze nach oben, kräftiges Grün |
| `ico-runter.png` | 256 × 256 | schlichtes Dreieck, Spitze nach unten, kräftiges Rot |
| `ico-trend-hoch.png` | 256 × 256 | kleines Diagramm mit grüner Linie nach oben |
| `ico-trend-runter.png` | 256 × 256 | kleines Diagramm mit roter Linie nach unten |
| `ico-messe.png` | 256 × 256 | Messezelt mit Fähnchen |
| `ico-sonne.png` | 256 × 256 | Sonne |
| `ico-ski.png` | 256 × 256 | Skifahrer in der Abfahrt |
| `ico-palme.png` | 256 × 256 | Palme |
| `ico-regen.png` | 256 × 256 | Wolke mit Regentropfen |
| `ico-fruehling.png` | 256 × 256 | junger grüner Spross |
| `ico-herbst.png` | 256 × 256 | Herbstblatt |
| `ico-winter.png` | 256 × 256 | Schneeflocke |
| `ico-landerecht.png` | 256 × 256 | Eintrittskarte / Ticketabschnitt |
| `ico-hammer.png` | 256 × 256 | Auktionshammer |
| `ico-ankuendigung.png` | 256 × 256 | Megafon |
| `ico-versteigerung.png` | 256 × 256 | Gebäude mit Säulen |
| `ico-aufkauf.png` | 256 × 256 | Handschlag |
| `ico-streik.png` | 256 × 256 | erhobene Faust |
| `ico-sturm.png` | 256 × 256 | Gewitterwolke mit Blitz |
| `ico-kerosin.png` | 256 × 256 | Zapfsäule |
| `ico-pfeil-runter.png` | 256 × 256 | Pfeil nach unten |
| `ico-pfeil-hoch.png` | 256 × 256 | Pfeil nach oben |
| `ico-billiger.png` | 256 × 256 | Dreieck nach unten, rot |
| `ico-teurer.png` | 256 × 256 | Dreieck nach oben, grün |
| `ico-rivalen.png` | 256 × 256 | zwei Personen-Silhouetten |
| `ico-rennen.png` | 256 × 256 | Zielflagge, schwarz-weiß kariert |
| `ico-pokal.png` | 256 × 256 | goldener Pokal |
| `ico-gold.png` | 256 × 256 | Goldmedaille |
| `ico-silber.png` | 256 × 256 | Silbermedaille |
| `ico-bronze.png` | 256 × 256 | Bronzemedaille |
| `ico-sanduhr.png` | 256 × 256 | Sanduhr |
| `ico-stoppuhr.png` | 256 × 256 | Stoppuhr |
| `ico-bericht.png` | 256 × 256 | Klemmbrett mit Blatt |
| `ico-ziel.png` | 256 × 256 | Zielscheibe mit Pfeil |
| `ico-geschenk.png` | 256 × 256 | Geschenk mit Schleife |
| `ico-geschaeft.png` | 256 × 256 | Krawatte / Geschäftshemd |
| `ico-urlaub.png` | 256 × 256 | Sonnenschirm am Strand |
| `ico-ticket.png` | 256 × 256 | Flugticket |
| `ico-kosten.png` | 256 × 256 | Geldschein mit Flügeln |
| `ico-kasse.png` | 256 × 256 | Geldsack |
| `ico-preis.png` | 256 × 256 | Euro-Geldschein |
| `ico-muenze.png` | 256 × 256 | goldene Münze |
| `ico-bank.png` | 256 × 256 | Bankgebäude |
| `ico-essen.png` | 256 × 256 | Teller mit Messer und Gabel |
| `ico-premium.png` | 256 × 256 | zwei Sektgläser |
| `ico-koffer.png` | 256 × 256 | Rollkoffer |
| `ico-sitz.png` | 256 × 256 | Flugzeugsitz |
| `ico-reichweite.png` | 256 × 256 | Lineal |
| `ico-crew.png` | 256 × 256 | Pilotin mit Mütze |
| `ico-umsteiger.png` | 256 × 256 | zwei Pfeile im Kreis |
| `ico-neu.png` | 256 × 256 | kreisförmiger Aktualisieren-Pfeil |
| `ico-stern.png` | 256 × 256 | goldener Stern, gefüllt |
| `ico-stern-leer.png` | 256 × 256 | Stern nur als Umriss, blass |
| `ico-aufgeben.png` | 256 × 256 | weiße Fahne |
| `ico-ausbau.png` | 256 × 256 | Baukran |
| `ico-lupe.png` | 256 × 256 | Lupe |
| `ico-gruendlich.png` | 256 × 256 | Mikroskop |
| `ico-schnell.png` | 256 × 256 | Blitz |
| `ico-extra.png` | 256 × 256 | Pluszeichen in einem Kreis |
| `ico-sicher.png` | 256 × 256 | Schutzschild |
| `ico-risiko.png` | 256 × 256 | Spielwürfel |
| `ico-ok.png` | 256 × 256 | Häkchen in grünem Kreis |
| `ico-beste.png` | 256 × 256 | drei Funkelsterne |
| `ico-schloss.png` | 256 × 256 | Vorhängeschloss |
| `ico-warnung.png` | 256 × 256 | Warndreieck |
| `ico-welt.png` | 256 × 256 | Erdkugel |
| `ico-kalender.png` | 256 × 256 | Kalenderblatt |
| `ico-zeitung.png` | 256 × 256 | Zeitung |
| `ico-pleite.png` | 256 × 256 | Explosion / Knall |
| `ico-regeln.png` | 256 × 256 | aufgeschlagenes Buch |
| `ico-heimat.png` | 256 × 256 | kleines Haus |
| `ico-hinweis.png` | 256 × 256 | dickes Ausrufezeichen in einem orangen Kreis |
| `ico-statistik.png` | 256 × 256 | Balkendiagramm mit drei Balken |
| `ico-verwaltung.png` | 256 × 256 | Bürogebäude |
| `ico-werbung.png` | 256 × 256 | Fernseher mit Stern auf dem Bildschirm |
| `ico-teilen.png` | 256 × 256 | Teilen-Symbol wie in Safari: Quadrat mit Pfeil nach oben |
| `ico-homescreen.png` | 256 × 256 | Handy mit einem Plus-Zeichen auf dem Bildschirm |
| `ico-angebot.png` | 256 × 256 | Sprechblase mit drei Punkten |
| `ico-nein.png` | 256 × 256 | erhobene flache Hand, Stopp-Geste |
| `ico-ton-an.png` | 256 × 256 | Lautsprecher mit zwei Schallwellen |
| `ico-ton-aus.png` | 256 × 256 | Lautsprecher, daneben ein kleines Kreuz statt Schallwellen |
| `ico-musik.png` | 256 × 256 | Zwei verbundene Musiknoten |

## Kontrolle

Nach dem Hochladen die Seite https://flo-horn-sketch.github.io/Iphone-Game/ ein paar Minuten später neu laden. Fehlende Bilder zeigt das Spiel als Symbol.
