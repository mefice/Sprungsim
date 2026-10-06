# ZEHN METER — Vertical Slice

Spielbarer Browser-Prototyp für **ZEHN METER / Sprungsim**: ein Wassersprung als Skill-Event in fünf Phasen, plus eine leichte Karriere vom Verein in die Region. Kein Sponsoren-System, kein Unreal-Projekt. Die Note soll aus dem Input lesbar sein.

## Starten

```bash
npm install
npm run dev
```

Im Browser `http://localhost:3000` öffnen. **Referenz ansehen** spielt den gewählten Sprung einmal sauber vor, ohne die Session zu werten. Danach selbst springen. Produktion bauen mit `npm run build`, lokal prüfen mit `npm run preview`.

Die 3D-Dateien liegen in `public/assets/` (`athlete.glb`, `indoor_pool_1k.hdr`, `tiles_diff.jpg`, `tiles_nor.jpg`, `tiles_rough.jpg`). Geladen wird `import.meta.env.BASE_URL` plus `assets/…`, damit `base: './'` in Dev und Preview stimmt. Fehlt eine Datei, bleibt eine gezeichnete Figur auf dem Turm und ein blaues Becken.

Die Wertung ist deterministisch getestet:

```bash
npm test
```

Die Tests spielen denselben Sprung mit sauberem Timing, mit frühem Öffnen, ohne Hand-Grab und ohne Eingabe. Sauber liegt bei Ausführung 10, daneben deutlich darunter.

## Spielbarkeit

Standard ist **Training**: die Marker laufen langsamer, „Jetzt“ gilt für das ganze grüne Feld, und ein Druck knapp nach dem Scheitel zählt noch. Der Kopfsprung 101C vergibt dafür schon eine hohe Note. **Wettkampf** bleibt enger. Ein sauberer Sprung liegt weiter bei Ausführung 10, also 14 bis 20 Punkten je nach DD.

Unten im Bild steht immer die eine Aktion der aktuellen Phase, darunter ein kurzer Tipp. Der Anlauf beginnt mit „Bereit“, damit der erste Schritt nicht überrascht. Liegt der Marker im grünen Feld, erscheint groß **JETZT**. Im Flug füllt ein dicker goldener Ring an der Figur jede halbe Drehung und blitzt, wenn sie voll ist. In der Weitansicht bleibt er lesbar. Oben steht „Halbe 2 von 3“. Die Nadel zum Öffnen kommt erst danach. Beim Eintritt liegt ein Ring auf der Wasserlinie und geht auf, wenn die Hände greifen sollen. Nach dem Greifen bleibt er auf dieser Öffnung stehen und färbt sich wie die Hand-Grab-Note: grün, gold oder rot. Ein verpasster Griff bleibt als roter Ring. Zum Öffnen steht eine dicke gestrichelte Linie im Wasser: senkrecht und gold, wenn die Nadel in der Mitte ist, geneigt, wenn sie nach links oder rechts wandert. Der Greif-Ring ist in der Weitansicht groß, der innere Ring geht auf. Nach dem Loslassen bleibt sie auf diesem Winkel stehen und färbt sich wie die Öffnen-Note: grün, gold oder rot.

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

Im **Wettkampf** gibt es zwei Wege. **Einzelsprung** ist ein Sprung gegen einen Rivalen. **Dreikampf** sind drei Sprünge hintereinander gegen denselben Namen. Die Liste wählst du aus den freigeschalteten Sprüngen, oder du nimmst den **Vorschlag**.

Der Vorschlag folgt der **Pflichtliste** der Stufe. Im Verein sind das die leichteren Nummern `101C · 401C · 103B`. In der Region wird es schwerer: `103B · 5132D · 105C · 107C`, jeweils nur was schon frei ist. Ein abgeschlossener Dreikampf bleibt unter **Letzte Dreikämpfe** (die letzten fünf, lokal).

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

Bild und Ton liegen über der Mechanik, die Wertung bleibt dieselbe. Die Halle ist eine Three.js-Szene: gefliestes Becken, Licht und ein rigged Körpermodell. Timing, Phasen und Note sind unverändert.

- Athlet aus einem CC0-glTF. In der Hocke sind Knie und Arme angezogen. Ein dicker Ring um die Figur füllt jede halbe Drehung. Nach dem Öffnen gehen die Arme über den Kopf.
- Becken mit CC0-Fliesen und dem HDRI `indoor_pool`. Die Kamera ist eine feste weite Seitenansicht von Turm bis Becken.
- Öffnen-Linie und Greif-Ring sind in der Weitansicht dicke Marken vor dem Wasser. Die Linie kippt mit der Nadel, der innere Ring geht auf, wenn gegriffen werden soll. Die Farben bleiben an der Note.
- Der Timing-Hinweis in der Leiste bleibt. Kurzklänge ohne Audiodateien.

Lizenzen der mitgelieferten Dateien stehen in `ASSETS.md`.

Bewusst nicht in diesem Prototyp: Kalender, Sponsoren, Kader, Unreal, filmische Fluid-Simulation.

## Danach

Der nächste sinnvolle Slice: den Eintrittsspritzer in derselben Weitansicht größer machen, damit Rip und Platscher aus der Distanz auseinanderzuhalten sind.

Der Code liegt in `src/sim.js` (Phasen und Physik), `src/scoring.js` (Note), `src/career.js` (Punkte und Gegner), `src/view3d.js` (Three.js-Halle und Athlet) und `src/audio.js` (Klänge). Die Sprünge stehen in `src/dives.js`.
