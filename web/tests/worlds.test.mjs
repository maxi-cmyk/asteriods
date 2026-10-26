import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGIONS } from '../src/render/regions.mjs';

const meta = JSON.parse(readFileSync(new URL('../assets/worlds.json', import.meta.url)));
const png = readFileSync(new URL('../assets/worlds.png', import.meta.url));
const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);

test('every world strip fits inside worlds.png and has whole frames', () => {
    for (const [name, w] of Object.entries(meta)) {
        assert.ok(w.frames >= 1 && Number.isInteger(w.frames), name);
        assert.ok(
            w.x >= 0 && w.y >= 0 && w.x + w.w * w.frames <= width && w.y + w.h <= height,
            `${name} out of bounds`,
        );
    }
});

test('every sprite a region background draws exists in the sheet', () => {
    const source = readFileSync(new URL('../src/render/backgrounds.mjs', import.meta.url), 'utf8');
    const used = [...source.matchAll(/drawWorld\(ctx, worlds, '([a-z-]+)'/g)].map((m) => m[1]);
    assert.ok(used.length >= REGIONS.length);
    for (const name of new Set(used)) assert.ok(meta[name], `missing world ${name}`);
});

test('tier 3+ fight scenery exists in the sheet, covers every boss and cycles through all three objects', async () => {
    const { FIGHT_SCENERY, fightSceneryFor } = await import('../src/render/backgrounds.mjs');
    for (const entry of FIGHT_SCENERY) assert.ok(meta[entry.name], entry.name);
    assert.equal(meta['pulsar'].frames, 16);
    assert.equal(meta['quasi-star'].frames, 1);
    for (const tier of [3, 4, 5, 6]) {
        const seen = new Set();
        for (let kind = 0; kind < 6; kind++) seen.add(fightSceneryFor({ kind, tier }).name);
        assert.equal(seen.size, 3, `tier ${tier} shows all three`);
    }
    assert.notEqual(
        fightSceneryFor({ kind: 0, tier: 3 }).name,
        fightSceneryFor({ kind: 0, tier: 4 }).name,
    );
});
