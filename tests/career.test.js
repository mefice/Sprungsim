import assert from 'node:assert/strict';
import test from 'node:test';
import { DIVES } from '../src/dives.js';
import {
  REGIONAL_AT,
  emptyCareer,
  isUnlocked,
  nextUnlock,
  recordDive,
  rivalFor,
} from '../src/career.js';

const dive = DIVES[0];

test('Punkte schalten Sprünge frei und heben vom Verein in die Region', () => {
  const start = emptyCareer();
  assert.equal(isUnlocked(start, DIVES.find((item) => item.id === '101C')), true);
  assert.equal(isUnlocked(start, DIVES.find((item) => item.id === '5132D')), false);
  assert.equal(nextUnlock(start, DIVES).id, '401C');

  const first = recordDive(start, dive, 14, true, DIVES);
  assert.equal(first.career.points, 14);
  assert.equal(first.career.rips, 1);
  assert.equal(first.career.bestByDive['101C'], 14);
  assert.equal(first.promoted, false);
  assert.equal(start.points, 0);

  const second = recordDive(first.career, dive, 20, false, DIVES);
  assert.equal(second.career.points, 34);
  assert.ok(second.unlocked.some((item) => item.id === '401C'));
  assert.equal(isUnlocked(second.career, DIVES.find((item) => item.id === '5132D')), true);

  const regional = recordDive(second.career, dive, 16, false, DIVES);
  assert.equal(regional.career.points, 50);
  assert.ok(regional.career.points >= REGIONAL_AT);
  assert.equal(regional.promoted, true);
  assert.equal(regional.career.tier, 'regional');
  assert.equal(regional.career.best, 20);
});

test('Der Wettkampf-Gegner ist stabil und liegt in einem lesbaren Band', () => {
  const club = rivalFor(DIVES[1], emptyCareer());
  const again = rivalFor(DIVES[1], emptyCareer());
  assert.equal(club.name, again.name);
  assert.equal(club.total, again.total);
  assert.ok(club.execution >= 5.2 && club.execution <= 9.2);
  assert.equal(club.total, Math.round(club.execution * DIVES[1].dd * 100) / 100);

  const region = rivalFor(DIVES[1], { ...emptyCareer(), tier: 'regional', dives: 4 });
  assert.ok(region.execution >= club.execution - 0.2);
});
