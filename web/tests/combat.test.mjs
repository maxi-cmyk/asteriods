import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../runtime.mjs';
import { Controls, readController } from '../controls.mjs';
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
async function game(scenario = 9) {
    let seed = 9317;
    const g = await createRuntime(bytes, {
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    });
    g.api.web_scenario(scenario);
    return g;
}
function ticks(g, count = 1, input = {}) {
    for (let i = 0; i < count; i++) g.step(input);
}
function charge(g, input = {}) {
    g.step({ laser: true, ...input });
    ticks(g, 75, { laser: true, ...input });
}
function near(actual, expected) {
    assert(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`);
}
const pad = () => ({
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
});

test('right stick aims actual primary shots and retains aim through the deadzone', async () => {
    const g = await game();
    const p = pad();
    const c = new Controls();
    p.axes[3] = -1;
    p.buttons[7].pressed = true;
    ticks(g, 1, c.sample(p));
    let s = g.scene();
    near(s[45], 0);
    near(s[46], -1);
    near(s[257], 240);
    near(s[258], 135 - 13 - 18.75);
    near(s[259], 0);
    near(s[260], -18.75);
    g.step({ aimX: 0.1, aimY: 0.1 });
    near(g.scene()[46], -1);
});

test('multishot spread rotates with aim; left-facing projectiles leave the pool', async () => {
    const g = await game(1);
    ticks(g, 1, { fire: true, aimX: -1 });
    const s = g.scene();
    assert(g.snapshot()[9] === 3);
    assert(s[259] < 0 && s[265] < 0 && s[271] < 0);
    assert(s[266] > 0 && s[272] < 0);
    ticks(g, 30);
    assert.equal(g.snapshot()[9], 0);
});

test('tight multishot keeps speed and symmetric spread at every aim angle', async () => {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
        const g = await game(1);
        ticks(g, 1, { fire: true, aimX: Math.cos(angle), aimY: Math.sin(angle) });
        const scene = g.scene();
        assert.equal(g.snapshot()[9], 3);
        const directions = [];
        for (const offset of [256, 262, 268]) {
            const vx = scene[offset + 3],
                vy = scene[offset + 4];
            near(Math.hypot(vx, vy), 18.75);
            directions.push(
                Math.atan2(
                    Math.sin(Math.atan2(vy, vx) - angle),
                    Math.cos(Math.atan2(vy, vx) - angle),
                ),
            );
        }
        near(directions[0], 0);
        near(directions[1], -Math.asin(0.15));
        near(directions[2], Math.asin(0.15));
    }
});

test('tight multishot falls back to one shot with two free slots and rejects a full pool', async () => {
    for (const scenario of [15, 16]) {
        const g = await game(scenario);
        const before = g.snapshot()[9];
        ticks(g, 2, { fire: true, aimY: -1 });
        assert.equal(g.snapshot()[9], before + (scenario === 15 ? 1 : 0));
        const s = g.scene();
        if (scenario === 15) {
            const newOffset = 256 + before * 6;
            near(s[newOffset + 3], 0);
            near(s[newOffset + 4], -18.75);
        }
    }
});

test('precision halves straight and diagonal speed and stays unchanged after repeated shots', async () => {
    const g = await game();
    let before = new Float32Array(g.scene());
    g.step({ x: 4095, precision: true });
    let after = new Float32Array(g.scene());
    near(after[4] - before[4], 3.65625 * 0.5);
    before = after;
    g.step({ x: 4095, y: 4095, precision: true });
    after = g.scene();
    near(Math.hypot(after[4] - before[4], after[5] - before[5]), 3.65625 * 0.5);
    g.api.web_scenario(13);
    before = new Float32Array(g.scene());
    g.step({ x: 4095, precision: true });
    near(g.scene()[4] - before[4], 3.65625 * 0.5);
});

test('laser winds up for exactly 1500ms, fires once, and cools for exactly 5000ms', async () => {
    const g = await game();
    g.step({ laser: true, aimX: 1 });
    assert.equal(g.scene()[47], 1);
    assert.equal(g.scene()[48], 0);
    ticks(g, 74, { laser: true });
    assert.equal(g.scene()[48], 1480);
    assert.equal(g.scene()[50], 0);
    g.step({ laser: true });
    let s = g.scene();
    assert.equal(s[47], 0);
    assert.equal(s[49], 5000);
    assert.equal(s[50], 400);
    assert.equal(s[9], 0);
    ticks(g, 249, { laser: true });
    assert.equal(g.scene()[49], 20);
    assert.equal(g.scene()[47], 0);
    g.step({ laser: true });
    assert.equal(g.scene()[49], 0);
    assert.equal(g.scene()[47], 0);
    ticks(g, 200, { laser: true });
    assert.equal(g.scene()[47], 0);
    g.step();
    g.step({ laser: true });
    assert.equal(g.scene()[47], 1);
});

test('early laser release cancels without spending heat or cooldown; primary cannot fire during windup', async () => {
    const g = await game();
    g.step({ laser: true });
    ticks(g, 50, { laser: true, fire: true });
    assert.equal(g.snapshot()[9], 0);
    assert.equal(g.scene()[9], 0);
    g.step();
    assert.equal(g.scene()[47], 0);
    assert.equal(g.scene()[49], 0);
    assert.equal(g.scene()[9], 0);
});

test('laser destroys every intersected target without fragments', async () => {
    const g = await game(10);
    charge(g);
    assert.equal(g.snapshot()[4], 120);
    assert.equal(g.snapshot()[10], 2);
    ticks(g, 20, { laser: true });
    assert.equal(g.snapshot()[4], 120);
    assert.equal(g.scene()[50], 0);
});

test('laser uses its firing-time aim and freezes its visual ray after discharge', async () => {
    const g = await game();
    g.step({ laser: true, aimX: 1 });
    ticks(g, 74, { laser: true });
    g.step({ laser: true, aimY: -1 });
    let s = g.scene();
    near(s[53], 0);
    near(s[54], -1);
    near(s[51], 240);
    near(s[52], 122);
    g.step({ aimX: -1 });
    s = g.scene();
    near(s[45], -1);
    near(s[53], 0);
    near(s[54], -1);
});

test('pause freezes charge and cooldown; triggers pressed during pause are not queued', async () => {
    const g = await game();
    g.step({ laser: true });
    ticks(g, 40, { laser: true });
    g.step({ laser: true, pause: true });
    const progress = g.scene()[48];
    ticks(g, 400, { laser: true, aimY: 1 });
    assert.equal(g.scene()[48], progress);
    near(g.scene()[46], 0);
    g.step({ laser: true, pause: true });
    ticks(g, 35, { laser: true });
    assert.equal(g.scene()[49], 5000);
    g.step({ laser: true, pause: true });
    ticks(g, 400, { laser: true });
    assert.equal(g.scene()[49], 5000);
    const menu = await game();
    menu.step({ pause: true });
    ticks(menu, 2, { laser: true });
    menu.step({ pause: true, laser: true });
    menu.step({ laser: true });
    assert.equal(menu.scene()[47], 0);
});

test('laser remains available after repeated primary shots', async () => {
    const g = await game(13);
    g.step({ laser: true });
    assert.equal(g.scene()[47], 1);
    assert.equal(g.scene()[9], 0);
});

test('laser destroys large asteroids even with a full rock pool', async () => {
    const g = await game(14);
    assert.equal(g.snapshot()[10], 24);
    charge(g);
    assert.equal(g.snapshot()[10], 0);
    assert(g.snapshot()[4] > 0);
});

test('HD primary fire has no heat or delay after repeated presses', async () => {
    const g = await game();
    for (let i = 0; i < 100; i++) {
        ticks(g, 2, { fire: true });
        ticks(g, 2);
        assert.equal(g.scene()[9], 0);
        assert.equal(g.scene()[10], 0);
        assert.equal(g.scene()[12], 0);
    }
});

test('shield pickup is stored; L1 alone arms it; a precision chord never spends it', async () => {
    const g = await game(11);
    const p = pad();
    const c = new Controls();
    g.step();
    assert.equal(g.scene()[55], 1);
    assert.equal(g.scene()[15], 0);
    p.buttons[4].pressed = true;
    g.step(c.sample(p));
    assert.equal(g.scene()[15], 0);
    p.buttons[5].pressed = true;
    g.step(c.sample(p));
    assert.equal(g.scene()[56], 1);
    p.buttons[4].pressed = false;
    g.step(c.sample(p));
    assert.equal(g.scene()[15], 0);
    assert.equal(g.scene()[55], 1);
    p.buttons[5].pressed = false;
    g.step(c.sample(p));
    p.buttons[4].pressed = true;
    g.step(c.sample(p));
    p.buttons[4].pressed = false;
    g.step(c.sample(p));
    assert.equal(g.scene()[15], 1);
    assert.equal(g.scene()[55], 0);
    g.api.web_test_overlap();
    g.step();
    assert.equal(g.snapshot()[3], 3);
    assert.equal(g.scene()[15], 0);
});

test('manual shield protects in the activation frame and cannot create free charges', async () => {
    const g = await game(12);
    g.step({ shield: true });
    assert.equal(g.state, 'playing');
    assert.equal(g.snapshot()[3], 3);
    assert.equal(g.scene()[55], 0);
    ticks(g, 10, { shield: true });
    assert.equal(g.scene()[15], 0);
    assert.equal(g.snapshot()[3], 3);
});

test('death cancels windup and inventory; laser cooldown freezes during death and persists at respawn', async () => {
    const g = await game();
    charge(g);
    g.api.web_test_overlap();
    g.step();
    const cooldown = g.scene()[49];
    assert.equal(g.state, 'death');
    assert.equal(g.scene()[47], 0);
    assert.equal(g.scene()[50], 0);
    ticks(g, 25);
    assert.equal(g.state, 'playing');
    assert.equal(g.scene()[49], cooldown);
    g.api.web_scenario(9);
    assert.equal(g.scene()[49], 0);
    near(g.scene()[45], 1);
});

test('shoulder chords work in either order; keyboard equivalents and clear do not leak shield actions', () => {
    const c = new Controls(),
        p = pad();
    p.buttons[5].pressed = true;
    c.sample(p);
    p.buttons[4].pressed = true;
    assert(c.sample(p).precision);
    p.buttons[5].pressed = false;
    assert(!c.sample(p).shield);
    p.buttons[4].pressed = false;
    assert(!c.sample(p).shield);
    c.keyDown('KeyQ');
    c.sample(null);
    c.keyDown('KeyE');
    assert(c.sample(null).precision);
    c.keyUp('KeyQ');
    assert(!c.sample(null).shield);
    c.clear();
    c.keyDown('KeyQ');
    c.sample(null);
    c.clear();
    assert(!c.sample(null).shield);
    c.keyDown('KeyF');
    c.keyDown('KeyI');
    c.keyDown('ShiftLeft');
    const input = c.sample(null);
    assert(input.laser && input.precision);
    assert.equal(input.aimY, -1);
    assert.equal(readController(p).laser, false);
});
