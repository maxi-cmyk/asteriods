import { S } from '../scene-layout.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime, SCORE_KEY } from '../runtime.mjs';
import { axisToRaw, Controls, readController } from '../controls.mjs';
const bytes = await readFile(new URL('../dist/oled-test.wasm', import.meta.url));
const memoryStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
};
async function game(storage = memoryStorage()) {
    let seed = 12345;
    return createRuntime(bytes, {
        storage,
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    });
}
function tick(g, n = 1, input = {}) {
    for (let i = 0; i < n; i++) g.step(input);
}
function press(g) {
    tick(g, 2, { fire: true });
    tick(g, 2);
}

test('original menu pixels, countdown, movement, press edges, and pause', async () => {
    const g = await game();
    assert.equal(g.state, 'menu');
    assert(g.pixels().some((value) => value === 1));
    assert(g.pixels().every((value) => value === 0 || value === 1));
    press(g);
    assert.equal(g.state, 'countdown');
    tick(g, 76);
    assert.equal(g.state, 'playing');
    const before = g.snapshot();
    tick(g, 1, { x: 4095, y: 4095 });
    const after = g.snapshot();
    assert(Math.abs(Math.hypot(after[1] - before[1], after[2] - before[2]) - 1.3) < 0.0001);
    tick(g, 2, { fire: true });
    const heat = g.snapshot()[6];
    tick(g, 5, { fire: true });
    assert.equal(g.snapshot()[6], heat);
    tick(g, 1, { pause: true });
    assert.equal(g.state, 'paused');
    const frozen = g.snapshot();
    tick(g, 1000, { fire: true, x: 4095 });
    assert.deepEqual(g.snapshot(), frozen);
    tick(g, 1, { pause: true });
    assert.equal(g.state, 'playing');
});

test('native L3 double-click path and analog deadzone', async () => {
    const g = await game();
    g.api.web_scenario(0);
    const before = g.snapshot();
    tick(g, 1, { x: axisToRaw(0.2) });
    assert.equal(g.snapshot()[1], before[1]);
    tick(g, 2, { click: true });
    tick(g, 2);
    tick(g, 2, { click: true });
    assert.equal(g.state, 'paused');
});

test('rapid primary presses never accumulate heat or a firing delay; holds do not repeat', async () => {
    const g = await game();
    g.api.web_scenario(4);
    for (let i = 0; i < 100; i++) {
        press(g);
        assert.equal(g.snapshot()[6], 0);
        assert.equal(g.snapshot()[7], 0);
        assert.equal(g.snapshot()[8], 0);
    }
    g.api.web_scenario(4);
    tick(g, 2, { fire: true });
    const shot = g.scene()[S.LAST_SHOT_MS];
    tick(g, 10, { fire: true });
    assert.equal(g.scene()[S.LAST_SHOT_MS], shot);
    tick(g, 2);
    tick(g, 2, { fire: true });
    assert(g.scene()[S.LAST_SHOT_MS] > shot);
});

test('multishot fires three bullets without heat', async () => {
    const g = await game();
    g.api.web_scenario(1);
    tick(g, 2, { fire: true });
    const s = g.snapshot();
    assert.equal(s[9], 3);
    assert.equal(s[6], 0);
    assert.equal(s[12], 5960);
});

test('shield absorbs overlap and then death/respawn clear effects', async () => {
    const g = await game();
    g.api.web_scenario(2);
    tick(g);
    assert.equal(g.snapshot()[3], 3);
    assert.equal(g.snapshot()[13], 0);
    tick(g, 39);
    assert.equal(g.state, 'playing');
    tick(g);
    assert.equal(g.state, 'death');
    assert.equal(g.snapshot()[3], 2);
    tick(g, 25);
    assert.equal(g.state, 'playing');
});

test('qualifying initials, fresh confirmation, persistence, and retry guard', async () => {
    const storage = memoryStorage();
    const g = await game(storage);
    g.api.web_scenario(3);
    tick(g);
    assert.equal(g.state, 'death');
    tick(g, 25);
    assert.equal(g.state, 'initials');
    tick(g);
    tick(g, 2, { y: 0 });
    tick(g);
    tick(g, 2, { fire: true });
    assert.equal(g.state, 'game-over');
    const record = JSON.parse(storage.getItem(SCORE_KEY));
    assert.equal(record.length, 42);
    assert.equal(record[1], 1);
    assert.equal(String.fromCharCode(...record.slice(6, 9)), 'BAA');
    tick(g, 30, { fire: true });
    assert.equal(g.state, 'game-over');
    tick(g, 2);
    tick(g, 2, { fire: true });
    assert.equal(g.state, 'countdown');
    const reloaded = await game(storage);
    assert.equal(reloaded.snapshot()[14], 1);
    assert.equal(reloaded.snapshot()[15], 1234);
});

test('storage rejection leaves initials ready for a deliberate retry', async () => {
    const g = await game({
        getItem: () => null,
        setItem: () => {
            throw Error('blocked');
        },
    });
    g.api.web_scenario(3);
    tick(g, 27);
    tick(g, 2, { fire: true });
    assert.equal(g.state, 'initials');
    assert.equal(g.snapshot()[14], 0);
});

test('controller standard mapping and keyboard pause edges', () => {
    const pad = {
        connected: true,
        mapping: 'standard',
        axes: [0.75, -0.5],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    };
    pad.buttons[0].pressed = true;
    pad.buttons[9].pressed = true;
    const controls = new Controls();
    let input = controls.sample(pad);
    assert(input.fire && input.pause);
    assert.equal(input.x, axisToRaw(0.75));
    assert.equal(input.y, axisToRaw(-0.5));
    assert.equal(controls.sample(pad).pause, false);
    pad.buttons[0].pressed = false;
    pad.buttons[7].pressed = true;
    assert(controls.sample(pad).fire);
    assert.equal(readController({ ...pad, mapping: '' }), null);
    assert.equal(readController({ ...pad, connected: false }), null);
    controls.keyDown('ArrowLeft');
    assert.equal(controls.sample(null).x, 0);
    controls.keyDown('Escape');
    assert(controls.sample(null).pause);
    controls.keyDown('Escape', true);
    assert(!controls.sample(null).pause);
    controls.clear();
    assert.equal(controls.sample(null).x, 2048);
});

test('browser OLED demo requires explicit launch; exit fire is consumed', async () => {
    let writes = 0;
    const g = await game({ getItem: () => null, setItem: () => writes++ });
    tick(g, 1500);
    assert.equal(g.state, 'menu');
    g.api.web_demo();
    assert.equal(g.state, 'demo');
    for (let i = 0; i < 15000; i++) {
        g.step();
        assert(!['initials', 'game-over'].includes(g.state));
    }
    assert.equal(writes, 0);
    // Restart idle interval in a known state, then enter again.
    g.menu();
    tick(g, 501);
    assert.equal(g.state, 'menu');
    g.api.web_demo();
    assert.equal(g.state, 'demo');
    tick(g, 2, { fire: true });
    assert.equal(g.state, 'menu');
    tick(g, 10, { fire: true });
    assert.equal(g.state, 'menu');
    tick(g, 2);
    press(g);
    assert.equal(g.state, 'countdown');
});
