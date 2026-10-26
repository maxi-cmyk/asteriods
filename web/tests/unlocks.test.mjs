import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnlocks, UNLOCKS_KEY, REQUIREMENTS, requirementText } from '../src/boss/unlocks.mjs';
import { HANGAR_KEY, HULLS } from '../src/state/hangar.mjs';

const memory = (seed = {}) => {
    const data = new Map(Object.entries(seed));
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
};

test('every non-stock hull is earned by exactly one mini-boss', () => {
    const earned = Object.keys(REQUIREMENTS);
    assert.deepEqual(
        earned.sort(),
        HULLS.filter((h) => h.id !== 'vanguard')
            .map((h) => h.id)
            .sort(),
    );
    assert.equal(requirementText('dart'), 'Defeat Picket on wave 3');
    assert.equal(requirementText('comet'), 'Defeat Lens Imp on wave 28');
    assert.equal(requirementText('vanguard'), '');
});

test('a new player starts with the stock hull and earns the rest per profile', () => {
    const storage = memory(),
        unlocks = createUnlocks(storage);
    assert.equal(unlocks.isUnlocked(0, 'vanguard'), true);
    assert.equal(unlocks.isUnlocked(0, 'dart'), false);
    assert.equal(unlocks.grant(0, 'dart'), true);
    assert.equal(unlocks.grant(0, 'dart'), false, 'only the first defeat counts');
    assert.equal(unlocks.isUnlocked(0, 'dart'), true);
    assert.equal(unlocks.isUnlocked(1, 'dart'), false, 'unlocks belong to the profile');
    assert.deepEqual(createUnlocks(storage).hullsFor(1 << 6), ['dart']);
    assert.equal(createUnlocks(storage).isUnlocked(0, 'dart'), true, 'unlocks survive a reload');
});

test('a returning player keeps every hull', () => {
    const unlocks = createUnlocks(memory({ [HANGAR_KEY]: '{}' }));
    for (const hull of HULLS) assert.equal(unlocks.isUnlocked(0, hull.id), true);
    assert.equal(unlocks.all, true);
});

test('corrupt or unavailable storage degrades to a fresh start without throwing', () => {
    assert.equal(createUnlocks(memory({ [UNLOCKS_KEY]: '{nope' })).isUnlocked(0, 'wasp'), false);
    assert.equal(createUnlocks(null).isUnlocked(0, 'wasp'), false);
});

import { BossRecords, BOSS_RECORDS_KEY } from '../src/boss/records.mjs';
import { clearBrowserRecords } from '../src/state/records.mjs';

test('boss defeats are counted by name per profile and cleared with the other records', () => {
    const storage = {
        data: new Map(),
        getItem(k) {
            return this.data.get(k) ?? null;
        },
        setItem(k, v) {
            this.data.set(k, v);
        },
    };
    const records = new BossRecords(storage);
    assert.equal(records.text(0), 'Defeated: no bosses yet');
    records.record(0, (1 << 0) | (1 << 6));
    records.record(0, 1 << 0);
    assert.equal(records.text(0), 'Defeated: Sentinel ×2 · Picket ×1');
    assert.equal(records.text(1), 'Defeated: no bosses yet');
    assert.equal(new BossRecords(storage).text(0), 'Defeated: Sentinel ×2 · Picket ×1');
    assert.equal(clearBrowserRecords(storage, 'scores').ok, true);
    assert.equal(new BossRecords(storage).text(0), 'Defeated: no bosses yet');
    assert.ok(storage.data.has(BOSS_RECORDS_KEY));
});
