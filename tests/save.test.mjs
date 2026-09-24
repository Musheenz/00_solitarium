// Backup code tests.   node --test tests/save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { backupCode, parseBackupCode, freshStats } from '../docs/js/save.js';

test('backup code round-trips', () => {
  for (const [won, played, bestStreak] of [[0, 0, 0], [4127, 6500, 23], [1, 1, 1], [99999, 150000, 400]]) {
    const code = backupCode({ ...freshStats(), won, played, bestStreak });
    assert.match(code, /^[0-9A-Z]+-[0-9A-Z]+-[0-9A-Z]+-[0-9A-Z]{2}$/);
    assert.deepEqual(parseBackupCode(code), { won, played, bestStreak });
    assert.deepEqual(parseBackupCode(' ' + code.toLowerCase() + ' '), { won, played, bestStreak });
  }
});

test('mistyped backup codes are rejected', () => {
  const code = backupCode({ ...freshStats(), won: 4127, played: 6500, bestStreak: 23 });
  const typo = code.replace(/^./, (c) => (c === '1' ? '2' : '1'));
  assert.equal(parseBackupCode(typo), null);
  assert.equal(parseBackupCode('hello'), null);
  assert.equal(parseBackupCode(''), null);
});
