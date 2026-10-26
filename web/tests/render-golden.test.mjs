// Characterisation test for the renderer, the boss painters and the backgrounds: scenes from
// the real engine are drawn onto a recording canvas and every call is hashed.
// `UPDATE_GOLDEN=1 node --test tests/render-golden.test.mjs` rewrites tests/golden/render.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { makeCanvas, fakeArt, trace, resetTrace } from './render-harness.mjs';
import { createRuntime } from '../src/runtime/runtime.mjs';
import { S } from '../src/runtime/scene-layout.mjs';

const { PixelRenderer } = await import('../src/render/renderer.mjs');
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const file = new URL('./golden/render.json', import.meta.url);

async function game(seed) {
    let state = seed;
    return createRuntime(bytes, {
        random: () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0),
    });
}
const sweep = (i) => ({
    x: 2048 + Math.round(Math.sin(i / 17) * 1800),
    y: 2048 + Math.round(Math.cos(i / 23) * 1800),
    aimX: Math.cos(i / 9),
    aimY: Math.sin(i / 9),
    firePressed: i % 7 === 0,
    fire: i % 7 < 3,
});
const renderer = () => new PixelRenderer(makeCanvas(480, 270), fakeArt());
// Renders one frame and returns the hash of everything it drew.
function frame(r, scene, players = null) {
    resetTrace();
    r.render(scene, players);
    return `${trace.calls}:${trace.hash.toString(16)}`;
}

const scenarios = {
    async menu() {
        const g = await game(3);
        return [frame(renderer(), g.scene())];
    },
    async solo() {
        const g = await game(11),
            r = renderer(),
            out = [];
        g.start();
        for (let i = 1; i <= 520; i++) {
            g.step(sweep(i));
            if (i % 40 === 0) out.push(frame(r, g.scene()));
        }
        return out;
    },
    async coop() {
        const g = await game(23),
            r = renderer(),
            out = [];
        g.startCoop({ friendlyFire: false });
        for (let i = 1; i <= 300; i++) {
            g.step({ players: [sweep(i), sweep(i + 40)] });
            if (i % 60 === 0) out.push(frame(r, g.scene(), g.coopPlayers()));
        }
        return out;
    },
    async fights() {
        const out = {};
        for (let kind = 0; kind < 12; kind++)
            for (const tier of [0, 3]) {
                const g = await game(5 + kind),
                    r = renderer(),
                    sums = [];
                g.start(true);
                g.api.web_boss_practice(kind, tier, 0);
                for (let i = 1; i <= 400; i++) {
                    g.step(sweep(i));
                    if (i % 100 === 0) sums.push(frame(r, g.scene()));
                }
                out[`${kind}.${tier}`] = sums;
            }
        return out;
    },
    // A boss that dies: the scene before, then the same scene with the boss gone.
    async finales() {
        const out = {};
        for (let kind = 0; kind < 12; kind++) {
            const g = await game(40 + kind),
                r = renderer(),
                sums = [];
            g.start(true);
            g.api.web_boss_practice(kind, 0, 0);
            for (let i = 1; i <= 250; i++) g.step(sweep(i));
            const alive = new Float32Array(g.scene());
            sums.push(frame(r, alive));
            const dead = new Float32Array(alive);
            dead[S.BOSS_ACTIVE] = 0;
            for (const ms of [40, 600, 1400, 2200, 3200]) {
                dead[S.VISUAL_MS] = alive[S.VISUAL_MS] + ms;
                dead[S.GAME_MS] = alive[S.GAME_MS] + ms;
                sums.push(frame(r, dead));
            }
            out[kind] = sums;
        }
        return out;
    },
    // The end screens drawn on the canvas: score entry, then the leaderboard.
    async summaries() {
        const g = await game(9),
            r = renderer();
        g.start();
        for (let i = 1; i <= 60; i++) g.step(sweep(i));
        const base = new Float32Array(g.scene());
        const out = [];
        for (const state of [5, 6, 1, 3]) {
            const scene = new Float32Array(base);
            scene[S.STATE] = state;
            scene[S.FINAL_SCORE] = 4200;
            scene[S.SCORE_COUNT] = 3;
            out.push(frame(r, scene));
        }
        return out;
    },
};

const current = {};
for (const [name, run] of Object.entries(scenarios)) current[name] = await run();
if (process.env.UPDATE_GOLDEN) await writeFile(file, JSON.stringify(current, null, 1) + '\n');
const golden = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
for (const name of Object.keys(scenarios))
    test(`render golden: ${name}`, () => assert.deepEqual(current[name], golden[name]));
