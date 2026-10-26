import { S } from '../src/runtime/scene-layout.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Controls, readController, movementResponse } from '../src/input/controls.mjs';
import {
    defaults,
    loadProfiles,
    saveProfiles,
    loadSettings,
    SETTINGS_KEY,
} from '../src/state/settings.mjs';
import { DriftSample, stickValues } from '../src/input/calibration.mjs';
import { createRuntime } from '../src/runtime/runtime.mjs';
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const pad = () => ({
    index: 0,
    id: 'Test pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
});
const near = (a, b, tolerance = 0.001) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('legacy settings migrate without losing bindings; profiles persist independently', () => {
    let saved = JSON.stringify({
        ...defaults(),
        mouseAimSensitivity: undefined,
        aimSensitivity: 0.4,
        keys: { ...defaults().keys, fire: 'KeyZ' },
    });
    const storage = {
        getItem: () => saved,
        setItem: (key, value) => {
            assert.equal(key, SETTINGS_KEY);
            saved = value;
        },
    };
    const store = loadProfiles(storage);
    assert.equal(store.profiles[0].mouseAimSensitivity, 0.4);
    assert.equal(store.profiles[0].keys.fire, 'KeyZ');
    assert.deepEqual(store.profiles[1], defaults());
    store.profiles[1].movementSensitivity = 2;
    store.profiles[1].deadzone = 0.08;
    store.activeProfile = 1;
    assert(saveProfiles(storage, store));
    assert.deepEqual(loadProfiles(storage), store);
    assert.equal(loadSettings(storage).movementSensitivity, 2);
    assert.equal(loadProfiles(storage).profiles[0].keys.fire, 'KeyZ');
    assert.deepEqual(
        loadProfiles({
            getItem() {
                throw Error();
            },
        }).profiles,
        [defaults(), defaults()],
    );
    assert.equal(
        saveProfiles(
            {
                setItem() {
                    throw Error();
                },
            },
            store,
        ),
        false,
    );
});

test('radial movement response preserves direction, neutral, and maximum speed', () => {
    for (const sensitivity of [0.25, 1, 2]) {
        assert.deepEqual(movementResponse(0, 0, sensitivity), [0, 0]);
        near(Math.hypot(...movementResponse(1, 1, sensitivity)), 1);
        const adjusted = movementResponse(0.3, 0.4, sensitivity);
        near(adjusted[0] / adjusted[1], 0.75);
    }
    assert(movementResponse(0.5, 0, 0.25)[0] < movementResponse(0.5, 0, 2)[0]);
    const p = pad(),
        settings = defaults();
    p.axes = [0.1, 0.1, 0, 0];
    assert.equal(readController(p, settings).x, 2048);
    p.axes = [1, 1, 0, 0];
    const input = readController(p, settings);
    near(Math.hypot((input.x - 2048) / 2047, (input.y - 2048) / 2047), 1);
});

test('sensitivity changes partial movement in WASM, preserving full speed, precision, stop, and bounds', async () => {
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    const distances = [];
    for (const movementSensitivity of [0.25, 2]) {
        g.api.web_scenario(9);
        const p = pad();
        p.axes[0] = 0.6;
        const c = new Controls({ ...defaults(), movementSensitivity });
        let x = g.scene()[S.SHIP_X];
        g.step(c.sample(p));
        distances.push(g.scene()[S.SHIP_X] - x);
        p.axes[0] = 1;
        p.axes[1] = 1;
        let before = [...g.scene().slice(4, 6)];
        g.step(c.sample(p));
        near(
            Math.hypot(g.scene()[S.SHIP_X] - before[0], g.scene()[S.SHIP_Y] - before[1]),
            3.65625,
            0.002,
        );
        p.buttons[5].pressed = true;
        p.buttons[4].pressed = true;
        before = [...g.scene().slice(4, 6)];
        g.step(c.sample(p));
        near(
            Math.hypot(g.scene()[S.SHIP_X] - before[0], g.scene()[S.SHIP_Y] - before[1]),
            3.65625 * 0.5,
            0.002,
        );
        p.axes = [0, 0, 0, 0];
        before = [...g.scene().slice(4, 6)];
        g.step(c.sample(p));
        assert.deepEqual([...g.scene().slice(4, 6)], before);
        for (let i = 0; i < 200; i++) g.step({ x: 4095, y: 4095 });
        assert.equal(g.scene()[S.SHIP_X], g.scene()[S.SHIP_MAX_X]);
        assert.equal(g.scene()[S.SHIP_Y], g.scene()[S.SHIP_MAX_Y]);
    }
    assert(distances[1] > distances[0]);
});

test('mouse and controller angular response are independent; deadzone retains aim', () => {
    function turn(settings, mouse) {
        const c = new Controls(settings),
            p = pad();
        p.axes[2] = 1;
        if (mouse) c.aimAt(10, 0);
        c.sample(mouse ? null : p);
        p.axes[2] = 0;
        p.axes[3] = 1;
        if (mouse) c.aimAt(0, 10);
        return c.sample(mouse ? null : p).aimY;
    }
    const slow = { ...defaults(), aimSensitivity: 0.25, mouseAimSensitivity: 0.25 };
    const mouseFast = { ...slow, mouseAimSensitivity: 2 },
        padFast = { ...slow, aimSensitivity: 2 };
    assert(turn(mouseFast, true) > turn(slow, true));
    near(turn(mouseFast, false), turn(slow, false));
    assert(turn(padFast, false) > turn(slow, false));
    near(turn(padFast, true), turn(slow, true));
    const c = new Controls(defaults()),
        p = pad();
    p.axes[3] = 1;
    c.sample(p);
    p.axes[3] = 0.1;
    assert.equal(c.sample(p).aimY, 0); // No new aim; WASM retains the last direction.
});

test('drift sample uses both sticks and requires deliberate application', () => {
    const p = pad(),
        settings = defaults();
    p.axes = [0.03, 0.04, 0.1, 0];
    const sample = new DriftSample(0, 0);
    for (let now = 0; now < 2000; now += 100) assert(sample.update(p, now).pending);
    assert.equal(sample.update(p, 2000).suggested, 0.13);
    assert.equal(settings.deadzone, 0.25);
    const sticks = stickValues(p, settings);
    assert.deepEqual(sticks[0].adjusted, [0, 0]);
    assert.deepEqual(sticks[1].raw, [0.1, 0]);
    assert(new DriftSample(0, 0).update({ ...p, index: 1 }, 20).error);
    assert(new DriftSample(0, 0).update({ ...p, connected: false }, 20).error);
    assert(new DriftSample(0, 0).update({ ...p, axes: [0.8, 0, 0, 0] }, 20).error);
});

test('right-stick drift cannot override retained aim or movement deadzone', async () => {
    const settings = { ...defaults(), deadzone: 0.1, aimDeadzone: 0.35 },
        p = pad(),
        c = new Controls(settings);
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    g.api.web_scenario(9);
    p.axes = [0.2, 0, 1, 0];
    g.step(c.sample(p));
    for (const y of [0.2, 0.34, 0.36, 0.39, 0.31, 0]) {
        p.axes = [0.2, 0, 0, y];
        const input = c.sample(p);
        assert.equal(input.aimY, 0);
        assert(input.x > 2048);
        g.step(input);
        near(g.scene()[S.AIM_X], 1);
        near(g.scene()[S.AIM_Y], 0);
    }
    p.axes[3] = 1;
    g.step(c.sample(p));
    p.axes[3] = 0.34;
    const neutral = c.sample(p);
    assert.equal(neutral.aimY, 0);
    const before = g.scene()[S.AIM_Y];
    g.step(neutral);
    near(g.scene()[S.AIM_Y], before);
});

test('independent right-stick deadzone migrates, validates and persists without changing movement settings', () => {
    const storage = { getItem: () => JSON.stringify({ deadzone: 0.29 }), setItem() {} };
    const legacy = loadSettings(storage);
    assert.equal(legacy.deadzone, 0.29);
    assert.equal(legacy.aimDeadzone, 0.35);
    const store = loadProfiles(storage);
    store.profiles[0].aimDeadzone = 0.55;
    let saved;
    saveProfiles({ setItem: (key, value) => (saved = value) }, store);
    const loaded = loadSettings({ getItem: () => saved });
    assert.equal(loaded.aimDeadzone, 0.55);
    assert.equal(loaded.deadzone, 0.29);
});

test('a stale mouse target cannot take over after controller aim returns to center', () => {
    const c = new Controls(defaults()),
        p = pad();
    c.aimAt(10, 0);
    c.sample(p);
    p.axes[3] = -1;
    c.aimAt(10, 0);
    c.sample(p);
    p.axes[3] = 0;
    c.aimAt(10, 0);
    let input = c.sample(p);
    assert.equal(input.aimX, 0);
    assert.equal(input.aimY, 0);
    c.activateMouseAim();
    c.aimAt(10, 0);
    input = c.sample(p);
    assert(input.aimX > 0);
});
