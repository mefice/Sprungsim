/** Leichte Karriere: Punkte, Freischaltungen, Verein → Region. Kein Kalender. */

export const REGIONAL_AT = 48;

/** Pflichtlisten. Verein bleibt bei den leichten Nummern, die Region zieht nach oben. */
export const REQUIRED = {
  club: ['101C', '401C', '103B'],
  regional: ['103B', '5132D', '105C', '107C'],
};
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
    meets: [],
  };
}

export function careerTier(career) {
  if (career?.tier === 'regional' || (career?.points ?? 0) >= REGIONAL_AT) return 'regional';
  return 'club';
}

export function requiredIds(career) {
  return REQUIRED[careerTier(career)];
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
    meets: career.meets ?? [],
  };
  const unlocked = catalog.filter((item) => (item.unlockAt ?? 0) > career.points && (item.unlockAt ?? 0) <= points);
  return {
    career: next,
    gained: round2(total),
    unlocked,
    promoted: career.tier !== 'regional' && tier === 'regional',
  };
}

function rivalProfile(career) {
  return RIVALS[(career.dives ?? 0) % RIVALS.length];
}

function executionFor(base, dive, seed, slot) {
  const wobble = ((dive.id.charCodeAt(0) + dive.id.charCodeAt(1) + seed * 5 + slot * 3) % 9) / 10 - 0.4;
  return Math.round(Math.min(9.2, Math.max(5.2, base + wobble)) * 10) / 10;
}

/** Deterministischer Gegner für einen einzelnen Wettkampfsprung. */
export function rivalFor(dive, career) {
  const rival = rivalProfile(career);
  const base = career.tier === 'regional' ? rival.regional : rival.club;
  const execution = executionFor(base, dive, career.dives ?? 0, 0);
  return { name: rival.name, execution, total: round2(execution * dive.dd) };
}

/** Derselbe Name für alle drei Sprünge eines Dreikampfs. */
export function lockRival(career) {
  const rival = rivalProfile(career);
  return {
    name: rival.name,
    base: career.tier === 'regional' ? rival.regional : rival.club,
    seed: career.dives ?? 0,
  };
}

export function rivalSlot(locked, dive, slot) {
  const execution = executionFor(locked.base, dive, locked.seed, slot);
  return { name: locked.name, execution, total: round2(execution * dive.dd), slot };
}

export function suggestProgram(catalog, career) {
  const byId = new Map(catalog.map((dive) => [dive.id, dive]));
  const pool = requiredIds(career)
    .map((id) => byId.get(id))
    .filter((dive) => dive && isUnlocked(career, dive))
    .sort((a, b) => a.dd - b.dd || a.id.localeCompare(b.id));
  if (!pool.length) return [];
  if (pool.length === 1) return [pool[0].id, pool[0].id, pool[0].id];
  if (pool.length === 2) return [pool[0].id, pool[1].id, pool[1].id];
  const mid = pool[Math.floor((pool.length - 1) / 2)];
  return [pool[0].id, mid.id, pool[pool.length - 1].id];
}

export function rememberMeet(career, entry) {
  const meets = [{
    rival: entry.rival,
    player: round2(entry.player),
    rivalTotal: round2(entry.rivalTotal),
    verdict: entry.verdict,
    program: entry.program.slice(0, 3),
  }, ...(career.meets ?? [])].slice(0, 5);
  return { ...career, meets };
}

export function standings(rows) {
  const player = round2(rows.reduce((sum, row) => sum + row.player, 0));
  const rival = round2(rows.reduce((sum, row) => sum + row.rival, 0));
  const delta = round2(player - rival);
  let verdict = 'gleich';
  if (delta >= 0.05) verdict = 'vorn';
  else if (delta <= -0.05) verdict = 'hinten';
  return { player, rival, delta, verdict };
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
      meets: Array.isArray(raw.meets)
        ? raw.meets.filter((meet) => meet && typeof meet.player === 'number' && typeof meet.rivalTotal === 'number').slice(0, 5)
        : [],
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
