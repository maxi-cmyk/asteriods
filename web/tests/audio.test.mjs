import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../runtime.mjs';
import { ThemeMusic } from '../music.mjs';
import { defaults, sanitizeSettings, SettingsDraft, loadProfiles } from '../settings.mjs';

const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));

test('game-over tone completes on Results within 700ms without advancing the run', async () => {
    let tone = 0;
    const runtime = await createRuntime(bytes, {
        random: () => 12345,
        tone: (value) => {
            tone = value;
        },
    });
    runtime.start();
    runtime.api.web_scenario(3);
    for (let i = 0; i < 250 && runtime.state !== 'results'; i++) runtime.step();
    assert.equal(runtime.state, 'results');
    assert.equal(tone, 200);
    const snapshot = runtime.snapshot();
    const scene = [...runtime.scene()];
    const result = structuredClone(runtime.result);
    for (let i = 0; i < 34; i++) runtime.step();
    assert.equal(tone, 120);
    runtime.step();
    assert.equal(tone, 0);
    assert.deepEqual(runtime.snapshot(), snapshot);
    assert.deepEqual([...runtime.scene()], scene);
    assert.deepEqual(runtime.result, result);
});

function audioFixture() {
    const events = [];
    const parameter = () => ({
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        setTargetAtTime(value) {
            events.push(value);
        },
    });
    const context = {
        currentTime: 0,
        createGain() {
            return { gain: parameter(), connect() {}, disconnect() {} };
        },
        createOscillator() {
            return {
                frequency: parameter(),
                connect() {
                    return this;
                },
                disconnect() {},
                start(time) {
                    events.push({ start: time });
                },
                stop() {},
            };
        },
    };
    return { context, events };
}

test('music schedules bounded voices and mutes on pause, hidden tab and disabled preference', () => {
    const { context, events } = audioFixture();
    const music = new ThemeMusic(context, {});
    music.update('home', true, 0.5, false);
    assert.equal(events.filter((e) => typeof e === 'object').length, 2);
    music.update('home', true, 0.5, false);
    assert.equal(events.filter((e) => typeof e === 'object').length, 2);
    music.update('off', true, 0.5, false);
    assert.equal(events.at(-1), 0);
    music.update('flight', true, 0.5, true);
    assert.equal(events.at(-1), 0);
    music.update('flight', false, 0.5, false);
    assert.equal(events.at(-1), 0);
    context.currentTime = 10000;
    music.update('flight', true, 0.5, false);
    assert.equal(events.filter((e) => typeof e === 'object').length, 4);
});

test('old profiles default music off; music and SFX preferences remain independent and draftable', () => {
    const settings = sanitizeSettings({ soundEnabled: true });
    assert.equal(settings.musicEnabled, false);
    assert.equal(sanitizeSettings({ musicEnabled: true }).soundEnabled, false);
    const store = loadProfiles();
    const live = defaults();
    const draft = new SettingsDraft(store, live);
    live.musicEnabled = true;
    assert.equal(draft.changed(), true);
    draft.discard();
    assert.equal(live.musicEnabled, false);
});
