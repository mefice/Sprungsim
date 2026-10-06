# ZEHN METER — Vertical Slice

Spielbarer Browser-Prototyp für **ZEHN METER / Sprungsim**: ein Wassersprung als Skill-Event in fünf Phasen, plus eine leichte Karriere vom Verein in die Region. Kein Sponsoren-System, kein Unreal-Projekt. Die Note soll aus dem Input lesbar sein.

## Starten

```bash
npm install
npm run dev
```

Im Browser `http://localhost:3000` öffnen. **Referenz ansehen** spielt den gewählten Sprung einmal sauber vor, ohne die Session zu werten. Danach selbst springen. Produktion bauen mit `npm run build`, lokal prüfen mit `npm run preview`.

Die Wertung ist deterministisch getestet:

```bash
npm test
```

Die Tests spielen denselben Sprung mit sauberem Timing, mit frühem Öffnen, ohne Hand-Grab und ohne Eingabe. Sauber liegt bei Ausführung 10, daneben deutlich darunter.

## Spielbarkeit

Standard ist **Training**: die Fenster sind weiter, im grünen Kraftband läuft die Anzeige langsamer, und ein zu früher Hand-Grab wird vom besseren Moment ersetzt. **Wettkampf** ist enger. Ein sauberer Sprung bleibt in beiden Modi bei Ausführung 10, also 14 bis 20 Punkten je nach DD. Knapp daneben ist brauchbar, weit daneben nicht.

Unten im Bild steht immer die eine Aktion der aktuellen Phase, darunter ein kurzer Tipp. Wird der Ring gold, steht davor „Jetzt“.

`Esc` pausiert, `R` startet denselben Sprung neu. In der Pause kannst du weitermachen, neu starten oder den Sprung wechseln.

## Steuerung

| Taste | Phase | Was sie tut |
|---|---|---|
| **Leertaste** | Anlauf | Drücken, wenn die Markierung rechts im Ziel steht. Drei Schritte. Ein verpasster Takt zählt als Fehlschritt. |
| **Leertaste halten** | Absprung, Kraft | Im grünen Band loslassen. Einfache Sprünge brauchen weniger Kraft als Saltos. |
| **Leertaste** | Absprung, Timing | Danach erneut drücken, wenn das Brett unten im Ziel ist. |
| **S** oder **↓** | Flug | Halten hockt den Körper. Die Rotation wird schneller. Loslassen in der Flugphase öffnet noch nicht. |
| **T** | Flug / Öffnen | Nur 5132D: zweimal im Puls, wenn die Markierung im Ziel steht. |
| **S** loslassen | Öffnen | Wenn die Eintrittslinie in der Mitte steht. Links ist kurz, rechts überdreht. |
| **Leertaste** | Eintritt | Wenn die Markierung im Ziel steht: flache Hände, der Rip. |

Die Zielfarbe ist überall dieselbe: Markierung rechts im grünen Feld, gold wenn sie dort verharrt.

## Die fünf Phasen

1. **Anlauf** — drei Schritte im Takt.
2. **Absprung** — Kraft und Brett-Tiefpunkt, nacheinander, damit beide Entscheidungen lesbar bleiben.
3. **Flug** — Hocke erhöht die Drehgeschwindigkeit. Die Schraube hat einen eigenen Takt.
4. **Öffnen** — Loslassen bestimmt, ob der Körper vertikal ankommt.
5. **Eintritt** — Hand-Grab über dem Wasser. Treffer und senkrechte Linie ergeben den Rip.

Wer nichts drückt, springt trotzdem zu Ende. Die Ausführung liegt dann nahe 0.

## Karriere, light

Jeder gewertete Sprung addiert seine Punktzahl zu den Karrierepunkten. Die bleiben im Browser (`localStorage`), zusammen mit dem Highscore je Sprung. Eine Referenz zählt nicht.

| Stufe | Ab | Bedeutung |
|---|---|---|
| Verein | 0 | Start |
| Region | 48 Punkte | Kurzer Aufstieg, noch kein Kalender |

| Nr. | Sprung | DD | Frei ab |
|---|---|---|---|
| 101C | Kopfsprung vorwärts gehockt | 1,4 | Start |
| 103B | 1½ Salto vorwärts gehechtet | 1,6 | Start |
| 401C | Delphin-Kopfsprung gehockt | 1,5 | 18 Punkte |
| 5132D | 1½ Salto vorwärts mit 1 Schraube | 2,0 | 32 Punkte |
| 105C | 2½ Salto vorwärts gehockt | 2,2 | 48 Punkte |
| 107C | 3½ Salto vorwärts gehockt | 2,8 | 76 Punkte |

Im **Wettkampf** gibt es zwei Wege. **Einzelsprung** ist ein Sprung gegen einen Rivalen. **Dreikampf** sind drei Sprünge hintereinander gegen denselben Namen. Die Liste wählst du aus den freigeschalteten Sprüngen, oder du nimmst den **Vorschlag** (leicht, mittel, schwer, soweit freigeschaltet).

Nach jedem Sprung steht der Laufstand. `R` wiederholt nur den laufenden Versuch, solange die Note noch nicht steht. In der Pause beendet **Meet abbrechen** den Rest; bereits gewertete Sprünge bleiben in der Karriere. Im Training gibt es keinen Gegner und keinen Dreikampf.

## Sprünge und Wertung

```text
Punkte = Ausführung × DD
```

Die Ausführung startet bei 10 und verliert Punkte über Anlauf, Absprung, Rotation, Öffnen und Eintritt. Ein Rip gibt einen kleinen Bonus, gedeckelt bei 10. Nach dem Eintauchen stehen drei Sätze da: **Absprung**, **Rotation**, **Eintritt**, plus die Abzüge.

Dieselbe Ausführung 8,0 ist auf 101C **11,20** Punkte und auf 5132D **16,00**. Ein sauberer 101C kommt im Test auf **14,00**, derselbe Sprung mit schlechtem Timing unter **1** Punkt.

## Bezug zum GDD

Der Slice setzt die Mechanik aus dem Game Design Document um, nicht die Karriere:

- **Kapitel 5** — fünf Phasen: Anlauf, Absprung (Timing und Kraft), Flug (Hocke, Schraube), Öffnen, Eintritt mit Rip.
- **Kapitel 6** — Sprungnummern 101C, 103B und 5132D, DD in der Größenordnung der 10-m-Tabelle.
- **Kapitel 7** — Punkte als Ausführung mal Schwierigkeit. Im vollen Spiel streichen sieben Kampfrichter die Extremwerte. Hier gibt es eine offene Ausführung, damit jeder Abzug nachvollziehbar bleibt.

## Präsentation

Bild und Ton liegen über der Mechanik, die Wertung bleibt dieselbe.

- Halle mit Lichtschächten, Publikum als Silhouette, Brett mit sichtbarer Federung.
- Kamera wechselt sanft: Turmseite, Flug, Wasserkante, Unterwasser, danach eine weite Replay-Ansicht. Die Bezeichnung steht links unten.
- Wasser zeigt Spiegelung, Kaustik und eine andere Eintrittssignatur: Rip ist eng, mit Blasenschlauch und goldenem Ring. Ein schlechter Eintritt wirft eine breite Gischt.
- Der Timing-Hinweis ist ein Ring. Kraft und Eintrittslinie bleiben Balken.
- Kurzklänge ohne Audiodateien: Brettknarren, Luftrauschen, Crowd-Rauschen, trockener Rip oder breiter Platscher.

Bewusst nicht in diesem Prototyp: Kalender, Sponsoren, Kader, Unreal, filmische Fluid-Simulation.

## Danach

Der nächste sinnvolle Slice ist eine kleine Dreikampf-Historie plus eine Pflichtliste je Stufe: im Verein leichtere Nummern, in der Region höhere DD. Der Vorschlag wächst dann mit dem Aufstieg mit. Erst danach echte Drehrichtungen oder ein Kalender.

Der Code liegt in `src/sim.js` (Phasen und Physik), `src/scoring.js` (Note), `src/career.js` (Punkte und Gegner), `src/render.js` (Bild und Kamera) und `src/audio.js` (Klänge). Die Sprünge stehen in `src/dives.js`.
