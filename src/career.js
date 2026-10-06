/** Leichte Karriere: Punkte, Freischaltungen, Verein → Region. Kein Kalender. */

export const REGIONAL_AT = 48;
const STORAGE_KEY = 'zehn-meter-career-v1';

const RIVALS = [
  { name: 'Lina Vogt', club: 6.6, regional: 7.4 },
  { name: 'Jonas Reuter', club: 7.0, regional: 7.9 },
  { name: 'Mara Keller', club: 7.3, regional: 8.2 },
];

export function emptyCareer() {
  return {
    points: 0,
    tier: 'club',
    dives: 0,
    best: 0,
    bestByDive: {},
    rips: 0,
  };
}

export function tierName(tier) {
  return tier === 'regional' ? 'Region' : 'Verein';
}

export function isUnlocked(career, dive) {
  return (career?.points ?? 0) >= (dive?.unlockAt ?? 0);
}

export function nextUnlock(career, catalog) {
  return catalog
    .filter((dive) => (dive.unlockAt ?? 0) > career.points)
    .sort((a, b) => a.unlockAt - b.unlockAt)[0] ?? null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function recordDive(career, dive, total, rip, catalog) {
  const points = round2(career.points + total);
  const tier = career.tier === 'regional' || points >= REGIONAL_AT ? 'regional' : 'club';
  const next = {
    points,
    tier,
    dives: career.dives + 1,
    best: round2(Math.max(career.best, total)),
    bestByDive: {
      ...career.bestByDive,
      [dive.id]: round2(Math.max(career.bestByDive[dive.id] ?? 0, total)),
    },
    rips: career.rips + (rip ? 1 : 0),
  };
  const unlocked = catalog.filter((item) => (item.unlockAt ?? 0) > career.points && (item.unlockAt ?? 0) <= points);
  return {
    career: next,
    gained: round2(total),
    unlocked,
    promoted: career.tier !== 'regional' && tier === 'regional',
  };
}

/** Deterministischer Gegner für den Wettkampfmodus. */
export function rivalFor(dive, career) {
  const rival = RIVALS[career.dives % RIVALS.length];
  const base = career.tier === 'regional' ? rival.regional : rival.club;
  const wobble = ((dive.id.charCodeAt(0) + dive.id.charCodeAt(1) + career.dives * 5) % 9) / 10 - 0.4;
  const execution = Math.round(Math.min(9.2, Math.max(5.2, base + wobble)) * 10) / 10;
  const total = round2(execution * dive.dd);
  return { name: rival.name, execution, total };
}

export function loadCareer() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw.points !== 'number') return emptyCareer();
    return {
      ...emptyCareer(),
      points: Number(raw.points) || 0,
      tier: raw.tier === 'regional' || Number(raw.points) >= REGIONAL_AT ? 'regional' : 'club',
      dives: Number(raw.dives) || 0,
      best: Number(raw.best) || 0,
      rips: Number(raw.rips) || 0,
      bestByDive: raw.bestByDive && typeof raw.bestByDive === 'object' ? raw.bestByDive : {},
    };
  } catch {
    return emptyCareer();
  }
}

export function saveCareer(career) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
  } catch {
    // Privater Modus oder voller Speicher: die Runde bleibt im Speicher.
  }
}

export function clearCareer() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorieren
  }
  return emptyCareer();
}
