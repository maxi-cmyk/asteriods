import { S } from '../src/runtime/scene-layout.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Controls, PauseSettingsShortcut } from '../src/input/controls.mjs';
import { defaults, loadProfiles, loadSettings, SettingsDraft } from '../src/state/settings.mjs';
import { createRuntime } from '../src/runtime/runtime.mjs';
const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const pad = () => ({
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, -1],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

test('rapid R2 presses fire on consecutive press/release ticks without a debounce delay or cooldown', async () => {
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    g.api.web_scenario(9);
    const p = pad(),
        c = new Controls(defaults());
    for (let i = 0; i < 100; i++) {
        p.buttons[7].value = 0.2; // A light pull, below browser .pressed thresholds.
        g.step(c.sample(p));
        assert.equal(
            g.scene()[S.LAST_SHOT_MS],
            g.scene()[S.GAME_MS],
            `press ${i + 1} must fire immediately`,
        );
        p.buttons[7].value = 0.02;
        g.step(c.sample(p));
        assert(g.scene()[S.LAST_SHOT_MS] < g.scene()[S.GAME_MS]);
    }
    p.buttons[7].value = 1;
    g.step(c.sample(p));
    const last = g.scene()[S.LAST_SHOT_MS];
    for (let i = 0; i < 50; i++) g.step(c.sample(p));
    assert.equal(g.scene()[S.LAST_SHOT_MS], last, 'holding must never repeat');
});

test('R2 hysteresis rejects small analog jitter but rearms after a light release', () => {
    const p = pad(),
        c = new Controls(defaults());
    for (const [value, fires] of [
        [0.1, false],
        [0.15, true],
        [0.12, true],
        [0.11, true],
        [0.09, false],
        [0.1, false],
        [0.2, true],
    ]) {
        p.buttons[7].value = value;
        assert.equal(c.sample(p).fire, fires);
    }
    c.clear();
    p.buttons[7] = { pressed: true };
    assert(c.sample(p).fire);
});

test('pause shortcut requires a fresh Cross press, consumes holds, and rejects reconnect holds', () => {
    const shortcut = new PauseSettingsShortcut(),
        p = pad();
    shortcut.update(p, false);
    p.buttons[0].pressed = true;
    assert(!shortcut.update(p, false));
    assert(!shortcut.update(p, true));
    p.buttons[0].pressed = false;
    assert(!shortcut.update(p, true));
    p.buttons[0].pressed = true;
    assert(shortcut.update(p, true));
    assert(!shortcut.update(p, true));
    shortcut.update(null, true);
    assert(!shortcut.update(p, true));
    p.buttons[0].pressed = false;
    shortcut.update(p, true);
    p.buttons[0].pressed = true;
    assert(shortcut.update(p, true));
});

test('control drafts save only on Apply and Close restores the last applied settings', () => {
    let value = null,
        writes = 0;
    const storage = {
        getItem: () => value,
        setItem: (key, next) => {
            value = next;
            writes++;
        },
    };
    const store = loadProfiles(storage),
        settings = defaults(),
        draft = new SettingsDraft(store, settings);
    settings.keys.fire = 'KeyZ';
    settings.mouseAimSensitivity = 0.5;
    assert(draft.changed());
    assert.equal(writes, 0);
    assert.equal(loadSettings(storage).keys.fire, 'Space');
    draft.discard();
    assert.equal(settings.keys.fire, 'Space');
    assert.equal(settings.mouseAimSensitivity, 1);
    settings.keys.fire = 'KeyZ';
    assert(draft.changed());
    assert(draft.apply(storage));
    assert.equal(writes, 1);
    assert.equal(loadSettings(storage).keys.fire, 'KeyZ');
    assert(!draft.changed());
    settings.keys.fire = 'KeyV';
    draft.changed();
    draft.discard();
    assert.equal(settings.keys.fire, 'KeyZ');
    store.activeProfile = 1;
    Object.assign(settings, store.profiles[1]);
    settings.deadzone = 0.1;
    draft.changed();
    draft.discard();
    assert.equal(store.activeProfile, 0);
    assert.equal(settings.keys.fire, 'KeyZ');
    assert.equal(store.profiles[1].deadzone, 0.25);
});

test('Apply retains settings for the visit when storage is blocked; later unapplied edits still roll back', () => {
    const store = loadProfiles(),
        settings = defaults(),
        draft = new SettingsDraft(store, settings);
    settings.movementSensitivity = 2;
    assert.equal(
        draft.apply({
            setItem() {
                throw Error('blocked');
            },
        }),
        false,
    );
    settings.movementSensitivity = 0.5;
    draft.changed();
    draft.discard();
    assert.equal(settings.movementSensitivity, 2);
});

test('fire pressed during pause does not queue a shot on resume', async () => {
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    g.api.web_scenario(9);
    g.step({ pause: true });
    g.step({ fire: true });
    const last = g.scene()[S.LAST_SHOT_MS];
    g.step({ fire: true, pause: true });
    g.step({ fire: true });
    assert.equal(g.scene()[S.LAST_SHOT_MS], last);
    g.step();
    g.step({ fire: true });
    assert.equal(g.scene()[S.LAST_SHOT_MS], g.scene()[S.GAME_MS]);
});

test('full R2 release between physics ticks rearms the next shot even if both ticks see held', async () => {
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    g.api.web_scenario(9);
    const p = pad(),
        c = new Controls(defaults());
    c.observeController(p);
    for (let i = 0; i < 100; i++) {
        p.buttons[7].value = 0;
        c.observeController(p); // Poll sees full release; no physics tick yet.
        p.buttons[7].value = 1;
        c.observeController(p);
        const input = c.sample(p);
        assert(input.fire && input.firePressed);
        g.step(input);
        assert.equal(
            g.scene()[S.LAST_SHOT_MS],
            g.scene()[S.GAME_MS],
            `off-tick press ${i + 1} lost`,
        );
    }
    const last = g.scene()[S.LAST_SHOT_MS];
    for (let i = 0; i < 20; i++) {
        c.observeController(p);
        g.step(c.sample(p));
    }
    assert.equal(g.scene()[S.LAST_SHOT_MS], last);
});

test('several trigger events between ticks survive as distinct presses, clear removes pending events', () => {
    const p = pad(),
        c = new Controls(defaults());
    c.observeController(p);
    for (let i = 0; i < 3; i++) {
        p.buttons[7].value = 1;
        c.observeController(p);
        p.buttons[7].value = 0;
        c.observeController(p);
    }
    for (let i = 0; i < 3; i++) assert(c.sample(p).firePressed);
    assert(!c.sample(p).firePressed);
    p.buttons[7].value = 1;
    c.observeController(p);
    c.discardFirePresses();
    assert(!c.sample(p).firePressed);
    c.clear();
    p.buttons[7].value = 0;
    assert(!c.sample(p).firePressed);
});

test('Cross presses fire independently while R2 stays held', async () => {
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    g.api.web_scenario(9);
    const p = pad(),
        c = new Controls(defaults());
    p.buttons[7].value = 1;
    g.step(c.sample(p));
    for (let i = 0; i < 50; i++) {
        p.buttons[0].pressed = false;
        c.observeController(p);
        p.buttons[0].pressed = true;
        c.observeController(p);
        g.step(c.sample(p));
        assert.equal(g.scene()[S.LAST_SHOT_MS], g.scene()[S.GAME_MS]);
    }
    assert.deepEqual(g.fireDiagnostics(), [51, 51, 0, 0]);
});

test('fire diagnostics distinguish pool exhaustion from laser blocking', async () => {
    const g = await createRuntime(bytes, { random: () => 0xffffffff });
    g.api.web_scenario(16);
    g.step({ fire: true });
    assert.deepEqual(g.fireDiagnostics(), [1, 0, 1, 0]);
    g.api.web_scenario(9);
    g.step({ laser: true });
    g.step({ laser: true, fire: true });
    assert.deepEqual(g.fireDiagnostics(), [1, 0, 0, 1]);
});
