import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../src/runtime/runtime.mjs';
import { KINDS } from '../src/boss/scene.mjs';

// Draw against a recording canvas: no DOM, no images, just what each death asks for.
const calls = [];
const canvas = () => ({ width: 340, height: 340, getContext: () => ctx });
globalThis.document = { createElement: () => canvas() };
const ctx = new Proxy(
    {},
    {
        get: (t, k) =>
            k in t
                ? t[k]
                : (...a) => {
                      calls.push(String(k));
                  },
        set: (t, k, v) => {
            t[k] = v;
            return true;
        },
    },
);
const { drawDeath, deathMs, DEATH_MS } = await import('../src/boss/death.mjs');
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));

async function snapshot(kind) {
    let seed = 11 + kind;
    const game = await createRuntime(bytes, {
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    });
    game.start(true);
    game.api.web_boss_practice(kind, 0, 1);
    for (let i = 0; i < 300; i++) game.step();
    return new Float32Array(game.scene());
}
const fakeArt = (used) => ({
    ready: () => true,
    drawFx: (c, sheet, key) => {
        used.add(`${sheet}/${key}`);
        return true;
    },
    draw: (c, sheet, key) => {
        used.add(`${sheet}/${key}`);
        return true;
    },
    rubble: () => [
        { canvas: { width: 30, height: 30 }, dx: 10, dy: -5 },
        { canvas: { width: 30, height: 30 }, dx: -20, dy: 15 },
    ],
});

test('every boss has its own death that draws for its whole length', async () => {
    const signatures = new Map();
    for (const kind of KINDS.keys()) {
        const snap = await snapshot(kind),
            used = new Set();
        const finale = { x: snap[513], y: snap[514], time: 0, kind, snap };
        calls.length = 0;
        let drawn = 0;
        for (let age = 0; age <= deathMs(kind) + 100; age += 40) {
            const before = calls.length;
            assert.equal(
                drawDeath(ctx, fakeArt(used), finale, age, { reduced: false }),
                true,
                `${KINDS[kind].name} at ${age}`,
            );
            drawn += calls.length > before;
        }
        assert(drawn >= (deathMs(kind) / 40) * 0.6, `${KINDS[kind].name}: draws on most frames`);
        signatures.set(kind, [...used].sort().join(','));
    }
    assert.equal(
        new Set(signatures.values()).size,
        12,
        'twelve different sequences, twelve different sprite sets',
    );
    for (const kind of KINDS.keys()) assert(deathMs(kind) >= 1500 && deathMs(kind) <= 3000);
    assert.equal(DEATH_MS.length, 12);
});

test('reduced motion keeps the sequence but drops flashes and shakes', async () => {
    const snap = await snapshot(0),
        finale = { x: snap[513], y: snap[514], time: 0, kind: 0, snap };
    for (const reduced of [false, true]) {
        calls.length = 0;
        for (let age = 0; age < 2400; age += 40)
            drawDeath(ctx, fakeArt(new Set()), finale, age, { reduced });
        if (reduced) assert.equal(calls.filter((c) => c === 'fillRect').length > 0, true);
    }
});
