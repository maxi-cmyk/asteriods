import { S, BLOCKS } from '../scene-layout.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../runtime.mjs';
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const ticks = (g, count = 1, input = {}) => {
    for (let i = 0; i < count; i++) g.step(input);
};
async function game() {
    let seed = 1847;
    return createRuntime(bytes, {
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    });
}

test('HD geometry is isolated from the original build and movement stays bounded', async () => {
    const g = await game();
    g.api.web_scenario(0);
    assert.equal(g.width, 480);
    assert.equal(g.height, 270);
    let s = new Float32Array(g.scene());
    assert.equal(s[35], 7);
    assert.equal(s[40], 3.65625);
    const x = s[4],
        y = s[5];
    g.step({ x: 4095, y: 4095 });
    s = g.scene();
    assert(Math.abs(Math.hypot(s[4] - x, s[5] - y) - 3.65625) < 0.0001);
    const moved = [s[4], s[5]];
    g.step();
    assert.deepEqual([...g.scene().slice(4, 6)], moved);
    ticks(g, 200, { x: 0, y: 0 });
    s = g.scene();
    assert.equal(s[4], s[41]);
    assert.equal(s[5], s[43]);
    assert(s[4] - 12 >= 0 && s[5] - 8 >= 0);
    ticks(g, 200, { x: 4095, y: 4095 });
    s = g.scene();
    assert.equal(s[4], s[42]);
    assert.equal(s[5], s[44]);
    assert(s[4] + 12 <= 480 && s[5] + 16 < 270);
});

test('HD entity data matches the planned sprite sizes and projectile origin', async () => {
    const g = await game();
    g.api.web_scenario(5);
    const s = new Float32Array(g.scene());
    assert.equal(s[64 + 3] * 2, 32);
    assert.equal(s[72 + 3] * 2, 20);
    assert.equal(s[80 + 3] * 2, 12);
    assert.equal(s[478], 1);
    assert.equal(s[481], 0);
    assert.equal(s[15], 1);
    ticks(g, 1, { fire: true });
    let scene = g.scene();
    assert.equal(g.snapshot()[9], 3);
    assert.equal(scene[S.RESERVED_9], 0);
    assert.equal(scene[256 + 1], scene[S.SHIP_X] + 13 + 18.75);
    assert(scene[262 + 2] < scene[S.SHIP_Y] && scene[268 + 2] > scene[S.SHIP_Y]);
    ticks(g, 10);
    assert(g.snapshot()[4] >= 20);
});

test('spawn warning and scaled asteroid speed keep the same gameplay timing', async () => {
    const g = await game();
    g.api.web_scenario(6);
    let s = g.scene();
    assert.equal(s[22], 1);
    assert(Math.abs(s[36] - 0.34 * 3.75) < 0.0001);
    ticks(g, 34);
    assert.equal(g.snapshot()[10], 0);
    ticks(g);
    assert.equal(g.snapshot()[10], 1);
    s = g.scene();
    assert.equal(s[64], 1);
    assert(Math.abs(s[70] + 1.275) < 0.0001);
    const before = s[65];
    ticks(g);
    assert(Math.abs(before - g.scene()[BLOCKS.ROCKS.at + 1] - 1.275) < 0.0001);
});

test('pause freezes exported world, pickup, effect, and animation time', async () => {
    const g = await game();
    g.api.web_scenario(5);
    ticks(g, 3);
    g.step({ pause: true });
    const before = new Float32Array(g.scene());
    ticks(g, 300, { fire: true, x: 4095 });
    const after = g.scene();
    for (const index of [2, 4, 5, 9, 14, 37, 65, 66, 479, 480])
        assert.equal(after[index], before[index]);
    g.step({ pause: true });
    g.step();
    assert(g.scene()[S.VISUAL_MS] > before[37]);
});

test('HD scores use a separate key without touching the original leaderboard', async () => {
    const storage = new Map([['asteroids.web.scores-v3', 'original-record']]);
    const adapter = {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
    };
    const g = await createRuntime(bytes, {
        storage: adapter,
        scoreKey: 'asteroids.web.hd.scores-v3',
        random: () => 0xffffffff,
    });
    g.api.web_scenario(3);
    ticks(g, 27);
    ticks(g, 2, { fire: true });
    assert.equal(g.state, 'game-over');
    assert.equal(storage.get('asteroids.web.scores-v3'), 'original-record');
    assert.equal(JSON.parse(storage.get('asteroids.web.hd.scores-v3')).length, 42);
});

test('release geometry and sprite atlas have explicit native dimensions', async () => {
    const atlas = JSON.parse(
        await readFile(new URL('../assets/sprites.json', import.meta.url), 'utf8'),
    );
    assert.deepEqual([atlas.ship.w, atlas.ship.h], [24, 16]);
    for (let size = 0; size < 3; size++)
        for (let variant = 0; variant < 3; variant++)
            for (let frame = 0; frame < 8; frame++) {
                const sprite = atlas[`rock-${size}-${variant}-${frame}`];
                assert.equal(sprite.w, [32, 20, 12][size]);
                assert.equal(sprite.h, sprite.w);
            }
    const png = await readFile(new URL('../assets/sprites.png', import.meta.url));
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 416);
});

test('ship and rock collisions use the new physical radii, not old OLED sizes', async () => {
    const hit = await game();
    hit.api.web_scenario(7);
    hit.step();
    assert.equal(hit.state, 'death');
    assert.equal(hit.snapshot()[3], 2);
    const miss = await game();
    miss.api.web_scenario(8);
    miss.step();
    assert.equal(miss.state, 'playing');
    assert.equal(miss.snapshot()[3], 3);
});
