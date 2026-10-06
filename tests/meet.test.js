import assert from 'node:assert/strict';
import test from 'node:test';
import { DIVES } from '../src/dives.js';
import {
  emptyCareer,
  isUnlocked,
  lockRival,
  recordDive,
  rememberMeet,
  rivalSlot,
  standings,
  suggestProgram,
} from '../src/career.js';

test('Vorschlag nutzt nur freigeschaltete Sprünge und füllt drei Startplätze', () => {
  const fresh = suggestProgram(DIVES, emptyCareer());
  assert.equal(fresh.length, 3);
  assert.deepEqual(fresh, ['101C', '103B', '103B']);
  for (const id of fresh) {
    assert.equal(isUnlocked(emptyCareer(), DIVES.find((dive) => dive.id === id)), true);
  }

  const club = suggestProgram(DIVES, { ...emptyCareer(), points: 40 });
  assert.deepEqual(club, ['101C', '401C', '103B']);

  const region = suggestProgram(DIVES, { ...emptyCareer(), points: 100, tier: 'regional' });
  assert.deepEqual(region, ['103B', '5132D', '107C']);
  assert.equal(region.includes('101C'), false);
});

test('Ein Dreikampf behält den Rivalen und summiert den Laufstand', () => {
  const career = { ...emptyCareer(), dives: 2, tier: 'club' };
  const locked = lockRival(career);
  const program = ['101C', '103B', '401C'].map((id) => DIVES.find((dive) => dive.id === id));
  const slots = program.map((dive, slot) => rivalSlot(locked, dive, slot));
  assert.equal(new Set(slots.map((slot) => slot.name)).size, 1);
  assert.equal(slots[0].name, locked.name);
  assert.equal(rivalSlot(locked, program[1], 1).total, slots[1].total);

  const table = standings([
    { player: 12, rival: slots[0].total },
    { player: 11, rival: slots[1].total },
    { player: 10, rival: slots[2].total },
  ]);
  assert.equal(table.player, 33);
  assert.equal(table.rival, Math.round((slots[0].total + slots[1].total + slots[2].total) * 100) / 100);
  assert.ok(['vorn', 'hinten', 'gleich'].includes(table.verdict));
});

test('Abgeschlossene Dreikämpfe bleiben die letzten fünf und überleben die nächste Wertung', () => {
  let career = emptyCareer();
  for (let i = 0; i < 6; i += 1) {
    career = rememberMeet(career, {
      rival: `Rivale ${i}`,
      player: 30 + i,
      rivalTotal: 28,
      verdict: 'vorn',
      program: ['101C', '103B', '103B'],
    });
  }
  assert.equal(career.meets.length, 5);
  assert.equal(career.meets[0].rival, 'Rivale 5');
  assert.equal(career.meets[4].rival, 'Rivale 1');

  const after = recordDive(career, DIVES[0], 10, false, DIVES);
  assert.equal(after.career.meets[0].rival, 'Rivale 5');
  assert.equal(career.meets.length, 5);
});
