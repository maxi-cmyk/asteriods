import test from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../src/input/controls.mjs';
import { defaults } from '../src/state/settings.mjs';
import { FLIGHT_STATES, needsRelease } from '../src/state/navigation.mjs';

// A held WASD key must keep steering through the flight's own state changes, and only the
// states that are really interruptions ask for the controls to be released first.
test('moving between flight states never asks the pilot to let go of the keys', () => {
    for (const from of FLIGHT_STATES)
        for (const to of FLIGHT_STATES)
            assert.equal(needsRelease(from, to), false, `${from} > ${to}`);
    // A respawn, specifically: playing > death > playing.
    assert.equal(needsRelease('playing', 'death') || needsRelease('death', 'playing'), false);
});

test('menus, pause, score entry and results still need the controls released', () => {
    for (const other of ['menu', 'paused', 'initials', 'game-over', 'results']) {
        assert.equal(needsRelease('playing', other), true, `playing > ${other}`);
        assert.equal(needsRelease(other, 'countdown'), true, `${other} > countdown`);
        assert.equal(needsRelease(other, 'playing'), true, `${other} > playing`);
    }
    assert.equal(needsRelease('playing', 'playing'), false, 'no change, nothing to release');
});

// The keyboard router with just enough of a page around it to run.
async function router({ state = 'playing' } = {}) {
    const listeners = {};
    globalThis.window = { addEventListener: (type, fn) => (listeners[type] = fn) };
    globalThis.document = { getElementById: () => ({ open: false }) };
    const { KeyboardRouter } = await import('../src/app/keyboard-router.mjs');
    const settings = defaults();
    const controls = new Controls(settings);
    const app = {
        input: { physicalKeys: new Set(), device: '' },
        navigation: { screen: 'play', live: true, pending: false },
        runtime: { state },
        settings,
        isSettingsOpen: () => false,
        menuActive: () => false,
        session: { keyboardControls: () => controls, claimMenu() {} },
        canvas: {
            focused: 0,
            focus() {
                this.focused++;
            },
        },
        unlockAudio() {},
    };
    new KeyboardRouter(app).install();
    // `on` is the kind of element the key lands on: 'body', 'button', 'input'...
    const press = (code, on = 'body') => {
        const event = {
            code,
            repeat: false,
            prevented: 0,
            preventDefault() {
                this.prevented++;
            },
            target: { closest: (selector) => (selector.split(/,\s*/).includes(on) ? {} : null) },
        };
        listeners.keydown(event);
        return event;
    };
    const release = (code, extra = {}) => listeners.keyup({ code, key: code, ...extra });
    return { app, controls, press, release };
}

test('WASD registers while the flight has focus', async () => {
    const { controls, press } = await router();
    const event = press('KeyW');
    assert.equal(controls.keys.has('KeyW'), true);
    assert.equal(event.prevented, 1);
});

test('after clicking Fullscreen or Music mid-flight, the next game key still registers', async () => {
    const { app, controls, press } = await router();
    const event = press('KeyD', 'button');
    assert.equal(controls.keys.has('KeyD'), true, 'the key was not dropped');
    assert.equal(app.canvas.focused, 1, 'focus went back to the field');
    assert.equal(event.prevented, 1, 'Space or Enter will not press the button');
});

test('buttons, fields and selects keep their own keys outside the flight and in text controls', async () => {
    const results = await router({ state: 'results' });
    results.press('KeyW', 'button');
    assert.equal(results.controls.keys.has('KeyW'), false);
    assert.equal(results.app.canvas.focused, 0);
    const flying = await router();
    for (const kind of ['input', 'select', 'textarea']) {
        flying.press('KeyA', kind);
        assert.equal(flying.controls.keys.has('KeyA'), false, kind);
    }
    assert.equal(flying.app.canvas.focused, 0);
});

test('letting go of Cmd drops keys whose release macOS swallowed', async () => {
    const { app, controls, press, release } = await router();
    press('KeyW');
    press('KeyA');
    assert.deepEqual([...app.input.physicalKeys].sort(), ['KeyA', 'KeyW']);
    // Cmd goes down and the W and A releases never arrive; then Cmd comes up.
    release('MetaLeft', { key: 'Meta' });
    assert.equal(app.input.physicalKeys.size, 0, 'no key is stuck as held');
    assert.equal(controls.keys.size, 0);
    // A key really still held comes back with its next auto-repeat.
    const repeat = press('KeyW');
    assert.equal(controls.keys.has('KeyW'), true);
    assert.equal(repeat.prevented, 1);
});

test('an ordinary key release still only releases that key', async () => {
    const { app, controls, press, release } = await router();
    press('KeyW');
    press('KeyD');
    release('KeyW');
    assert.deepEqual([...controls.keys], ['KeyD']);
    assert.deepEqual([...app.input.physicalKeys], ['KeyD']);
});
