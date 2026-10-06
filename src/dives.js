export const DIVES = [
  {
    id: '101C',
    name: 'Kopfsprung vorwärts gehockt',
    description: 'Einfacher Kopfsprung mit Hocke',
    dd: 1.4,
    difficulty: 'anfänger',
    unlocked: true,
    rotations: 0.5,
    twists: 0,
    phases: {
      approach: { baseTime: 2000, steps: 3 },
      takeoff: { windowMs: 150, powerTarget: [60, 80] },
      flight: { holdTime: 800, tuckDepth: 0.5 },
      kickout: { windowMs: 200 },
      entry: { windowMs: 120 }
    }
  },
  {
    id: '103B',
    name: '1½ Salto vorwärts gehechtet',
    description: 'Anderthalb Saltos vorwärts in Hechtposition',
    dd: 1.7,
    difficulty: 'fortgeschritten',
    unlocked: true,
    rotations: 1.5,
    twists: 0,
    phases: {
      approach: { baseTime: 2000, steps: 3 },
      takeoff: { windowMs: 120, powerTarget: [75, 90] },
      flight: { holdTime: 1000, tuckDepth: 0.7 },
      kickout: { windowMs: 150 },
      entry: { windowMs: 100 }
    }
  },
  {
    id: '5132D',
    name: '1½ Salto vorwärts mit 1 Schraube',
    description: 'Anderthalb Saltos mit einer vollen Schraube - freie Position',
    dd: 2.1,
    difficulty: 'experte',
    unlocked: true,
    rotations: 1.5,
    twists: 1,
    phases: {
      approach: { baseTime: 2000, steps: 3 },
      takeoff: { windowMs: 100, powerTarget: [80, 95] },
      flight: { holdTime: 1200, tuckDepth: 0.8, twistTaps: 2 },
      kickout: { windowMs: 120 },
      entry: { windowMs: 80 }
    }
  }
];

export function getDiveById(id) {
  return DIVES.find(d => d.id === id);
}

export function getUnlockedDives() {
  return DIVES.filter(d => d.unlocked);
}
