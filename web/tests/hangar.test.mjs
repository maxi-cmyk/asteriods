import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    HULLS,
    DEFAULT_HULL,
    HANGAR_KEY,
    hullSprite,
    hullIcon,
    sanitizeHangar,
    loadHangar,
    saveHangar,
} from '../src/state/hangar.mjs';

const memory = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
};

test('unknown, missing or malformed choices fall back to the stock hull per profile', () => {
    assert.deepEqual(sanitizeHangar(null).profiles, [DEFAULT_HULL, DEFAULT_HULL]);
    assert.deepEqual(sanitizeHangar({ profiles: ['dart', 'nonsense'] }).profiles, [
        'dart',
        DEFAULT_HULL,
    ]);
    assert.deepEqual(sanitizeHangar({ profiles: 'dart' }).profiles, [DEFAULT_HULL, DEFAULT_HULL]);
});

test('choices round-trip through storage and survive corrupt data', () => {
    const storage = memory();
    assert.equal(saveHangar(storage, { profiles: ['moth', 'comet'] }), true);
    assert.deepEqual(loadHangar(storage).profiles, ['moth', 'comet']);
    storage.setItem(HANGAR_KEY, '{not json');
    assert.deepEqual(loadHangar(storage).profiles, [DEFAULT_HULL, DEFAULT_HULL]);
    assert.equal(
        saveHangar(
            {
                setItem() {
                    throw new Error('full');
                },
            },
            { profiles: [] },
        ),
        false,
    );
});

test('the stock hull uses the original atlas names; others use hull cells', () => {
    assert.equal(hullSprite('vanguard', 3), 'ship-aim-3');
    assert.equal(hullSprite('wasp', 15), 'hull-wasp-aim-15');
    assert.equal(hullSprite('bogus', 0), 'ship-aim-0');
    assert.equal(hullIcon('vanguard'), 'ship');
    assert.equal(hullIcon('hammer'), 'hull-hammer-icon');
});

test('ships.json carries all sixteen aiming cells and an icon for every non-stock hull', () => {
    const meta = JSON.parse(readFileSync(new URL('../assets/ships.json', import.meta.url)));
    for (const hull of HULLS.filter((h) => h.id !== DEFAULT_HULL)) {
        for (let n = 0; n < 16; n++)
            assert.ok(meta.cells[`hull-${hull.id}-aim-${n}`], `${hull.id} aim ${n}`);
        assert.ok(meta.cells[`hull-${hull.id}-icon`]);
        assert.equal(meta.hulls.find((h) => h.id === hull.id)?.name, hull.name);
    }
    assert.equal(new Set(HULLS.map((h) => h.id)).size, HULLS.length);
});
