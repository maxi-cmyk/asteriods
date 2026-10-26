// Characterisation test: a refactor must not change a single float the engine exports.
// Seeded scripted runs are hashed at fixed ticks; `UPDATE_GOLDEN=1 node --test` rewrites the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRuntime } from '../runtime.mjs';

const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const file = new URL('./golden/scene.json', import.meta.url);
const CLOCK = new Set([1, 3, 37]); // browser time, not simulation state

async function game(seed = 11) {
    let state = seed;
    return createRuntime(bytes, {
        random: () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0),
    });
}
function hash(floats) {
    let h = 0x811c9dc5;
    const bits = new Uint32Array(new Float32Array(floats).buffer);
    for (let i = 0; i < bits.length; i++) {
        if (CLOCK.has(i)) continue;
        h = Math.imul(h ^ bits[i], 0x01000193) >>> 0;
    }
    return h.toString(16);
}
const view = (g, pointer) => new Float32Array(g.api.memory.buffer, pointer, 1408);
const sweep = (i) => ({
    x: 2048 + Math.round(Math.sin(i / 17) * 1800),
    y: 2048 + Math.round(Math.cos(i / 23) * 1800),
    aimX: Math.cos(i / 9),
    aimY: Math.sin(i / 9),
    firePressed: i % 7 === 0,
    fire: i % 7 < 3,
});

const scenarios = {
    async solo() {
        const g = await game();
        g.start();
        const out = [];
        for (let i = 1; i <= 600; i++) {
            g.step(sweep(i));
            if (i % 100 === 0) out.push(hash(g.scene()));
        }
        return out;
    },
    async coop() {
        const g = await game(23);
        g.startCoop({ friendlyFire: false });
        const out = [];
        for (let i = 1; i <= 400; i++) {
            g.step({ players: [sweep(i), sweep(i + 40)] });
            if (i % 100 === 0)
                out.push(
                    hash(g.scene()),
                    hash(view(g, g.api.web_coop_player(0))),
                    hash(view(g, g.api.web_coop_player(1))),
                );
        }
        return out;
    },
    async practiceAll() {
        const out = {};
        for (let kind = 0; kind < 12; kind++) {
            for (const tier of [0, 2]) {
                const g = await game(5 + kind);
                g.start(true);
                g.api.web_boss_practice(kind, tier, 0);
                const sums = [];
                for (let i = 1; i <= 500; i++) {
                    g.step(sweep(i));
                    if (i % 125 === 0) sums.push(hash(g.scene()));
                }
                out[`${kind}.${tier}`] = sums;
            }
        }
        return out;
    },
};

const current = {};
for (const [name, run] of Object.entries(scenarios)) current[name] = await run();

if (process.env.UPDATE_GOLDEN) await writeFile(file, JSON.stringify(current, null, 1) + '\n');
const golden = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));

for (const name of Object.keys(scenarios))
    test(`scene golden: ${name}`, () => assert.deepEqual(current[name], golden[name]));
