# ZEHN METER - Vertical Slice Prototype

Ein spielbarer Web-Prototyp für das Wasserspringen-Karrierespiel **ZEHN METER** (Arbeitstitel: Sprungsim).

## Was ist das?

Dieser Prototyp demonstriert die Kern-Spielmechanik des Turmspringens: eine **5-Phasen Skill-Loop**, bei der Timing und Präzision über die Wertung entscheiden.

**Die 5 Phasen eines Sprungs:**
1. **Anlauf** - Rhythmisches Timing für den Anlauf zum Brett
2. **Absprung** - Kraft dosieren und im optimalen Moment loslassen
3. **Flug** - Position halten für Rotation, bei Schrauben zusätzliche Inputs
4. **Öffnen (Kick-out)** - Rechtzeitig aus der Hocke strecken
5. **Eintritt** - Hand-Grab für den perfekten "Rip" (spritzerfreien Eintritt)

## Starten

```bash
# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev
```

Dann im Browser öffnen: `http://localhost:3000`

## Steuerung

| Taste | Funktion |
|-------|----------|
| **Leertaste** | Haupt-Input: Timing im Anlauf, Kraft beim Absprung, Hocke im Flug, Öffnen, Eintritt |
| **T** | Schraube (Twist) - nur bei Schraubensprüngen, mehrfach drücken |

## Verfügbare Sprünge

| Nr. | Name | DD | Schwierigkeit |
|-----|------|-----|---------------|
| 101C | Kopfsprung vorwärts gehockt | 1.4 | Anfänger |
| 103B | 1½ Salto vorwärts gehechtet | 1.7 | Fortgeschritten |
| 5132D | 1½ Salto vorwärts mit 1 Schraube | 2.1 | Experte |

## Wertungssystem

Die Wertung folgt dem echten Wasserspringen-Reglement:

```
Endpunktzahl = Ausführung × Schwierigkeitsgrad (DD)
```

**Ausführung (5.0 - 10.0)** wird berechnet aus:
- Anlauf-Timing (10%)
- Absprung-Qualität (25%)
- Flug/Rotation (30%)
- Öffnen-Timing (15%)
- Eintritts-Qualität (20%)

## Kampfrichter-Feedback

Nach jedem Sprung erhältst du detailliertes Feedback zu jeder Phase:
- **Exzellent** - Nahezu perfektes Timing
- **Gut** - Solide Ausführung
- **Mangelhaft** - Verbesserungsbedarf

Bei einem perfekten Eintritt erscheint die begehrte **"RIP!"**-Meldung.

## GDD-Konzepte

Dieser Prototyp basiert auf dem Game Design Document für ZEHN METER. Die vollständige Vision umfasst:

- **Karrieremodus** mit 7 Prestige-Stufen (Vereinsneuling → Legende)
- **Kalender-System** mit Training, Wettkämpfen, Sponsoren
- **180+ Sprünge** nach echtem Nummernsystem
- **Physikalisch simulierte Flugphase** mit Drehimpulserhaltung
- **AAA-Präsentation** mit Unreal Engine 5 und realistischer Wasser-Simulation

Siehe GDD-Dokumente für Details:
- `turmspringer-gdd.md` - Vollständiges Game Design Document
- `turmspringer-pitch.md` - Executive Summary

## Technologie

- **Vite** - Build-Tool und Dev-Server
- **Vanilla JavaScript** - Keine Framework-Abhängigkeiten
- **Canvas 2D** - Für schnelle Iteration der Gameplay-Mechanik

## Nächste Schritte

Dieser Vertical Slice ist der erste Schritt. Geplante Erweiterungen:

1. **Mehr Sprünge** - Alle Gruppen (Vorwärts, Rückwärts, Auerbach, Delphin, Handstand)
2. **Verbessertes Feedback** - Visuelle Timing-Indikatoren, Replay
3. **Sound** - Wasser-Splash, Publikum, Brett-Federung
4. **3D-Umsetzung** - Three.js oder später Unreal Engine

---

**Out of Scope für diesen Prototyp:**
- Karriere-Kalender und Saisonplanung
- Sponsoren und Finanzsystem
- Unreal Engine / AAA-Grafik
- Realistische Wasser-Simulation

---

*ZEHN METER - "Ich stehe allein auf zehn Metern Höhe, 12.000 Menschen halten den Atem an, und in 1,8 Sekunden entscheidet sich, ob vier Jahre Arbeit sich gelohnt haben."*
