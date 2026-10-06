/** Drei Sprünge für den Vertical Slice, DD nach GDD-Größenordnung (10 m). */
export const DIVES = [
  {
    id: '101C',
    name: 'Kopfsprung vorwärts gehockt',
    summary: 'Ein halber Salto. Zum Lernen von Absprung, Öffnen und Rip.',
    dd: 1.4,
    level: 'Anfänger',
    somersaults: 0.5,
    twistHalves: 0,
    position: 'C',
    powerBand: [0.56, 0.82],
  },
  {
    id: '103B',
    name: '1½ Salto vorwärts gehechtet',
    summary: 'Mehr Rotation: die Hocke muss sitzen, das Öffnen auch.',
    dd: 1.6,
    level: 'Fortgeschritten',
    somersaults: 1.5,
    twistHalves: 0,
    position: 'B',
    powerBand: [0.7, 0.92],
  },
  {
    id: '5132D',
    name: '1½ Salto vorwärts mit 1 Schraube',
    summary: 'Wie der Salto, plus zwei Schrauben-Taps im Takt.',
    dd: 2.0,
    level: 'Experte',
    somersaults: 1.5,
    twistHalves: 2,
    position: 'D',
    powerBand: [0.74, 0.96],
  },
];

export function getDiveById(id) {
  return DIVES.find((dive) => dive.id === id) ?? null;
}
