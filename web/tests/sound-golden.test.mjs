// Characterisation test for the boss sound design: every sound in the book is played into
// a recording voice and into a recording Web Audio context, and the boss observer's choices
// across scripted fights are logged. `UPDATE_GOLDEN=1` rewrites tests/golden/sound.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRuntime } from '../src/runtime/runtime.mjs';
import { BossSound, BOOK, voice } from '../src/boss/sound.mjs';
import { KINDS } from '../src/boss/scene.mjs';

const bytes = await readFile(new URL('../dist/test.wasm', import.meta.url));
const file = new URL('./golden/sound.json', import.meta.url);

const fnv = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return h.toString(16);
};
const round = (value) =>
    typeof value === 'number'
        ? Math.round(value * 1e4) / 1e4
        : Array.isArray(value)
          ? value.map(round)
          : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, round(v)]))
            : value;
// Math.random is part of two sounds: make it a fixed sequence for the duration of a play.
function seeded(run) {
    const real = Math.random;
    let s = 12345;
    Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    try {
        return run();
    } finally {
        Math.random = real;
    }
}

// A voice that records the tone/noise requests.
function recorder() {
    const calls = [];
    return {
        calls,
        tone: (o) => calls.push(['tone', round(o)]),
        noise: (o) => calls.push(['noise', round(o)]),
    };
}
// A Web Audio context that records every node, parameter write and connection.
function fakeContext() {
    const log = [];
    let ids = 0;
    const node = (kind) => {
        const id = `${kind}${ids++}`;
        const target = {
            connect: (to) => {
                log.push(`${id}->${to.__id ?? 'dest'}`);
                return to;
            },
            disconnect: () => {},
            start: (t) => log.push(`${id}.start(${round(t)})`),
            stop: (t) => log.push(`${id}.stop(${round(t)})`),
            __id: id,
        };
        return new Proxy(target, {
            get(t, key) {
                if (key in t) return t[key];
                const param = {
                    setValueAtTime: (v, at) =>
                        log.push(`${id}.${String(key)}.set(${round(v)},${round(at)})`),
                    exponentialRampToValueAtTime: (v, at) =>
                        log.push(`${id}.${String(key)}.exp(${round(v)},${round(at)})`),
                    linearRampToValueAtTime: (v, at) =>
                        log.push(`${id}.${String(key)}.lin(${round(v)},${round(at)})`),
                };
                Object.defineProperty(param, 'value', {
                    set: (v) => log.push(`${id}.${String(key)}=${round(v)}`),
                });
                return param;
            },
            set(t, key, value) {
                if (key === 'buffer') log.push(`${id}.buffer=${value?.length ?? 'x'}`);
                else if (key !== 'onended')
                    log.push(`${id}.${String(key)}=${typeof value === 'object' ? 'obj' : value}`);
                return true;
            },
        });
    };
    return {
        log,
        currentTime: 0,
        sampleRate: 8000,
        createOscillator: () => node('osc'),
        createGain: () => node('gain'),
        createBiquadFilter: () => node('filter'),
        createBufferSource: () => node('src'),
        createBuffer: (channels, length) => ({
            length,
            getChannelData: () => new Float32Array(length),
        }),
    };
}

const leaves = (book, path = []) =>
    Object.entries(book).flatMap(([key, value]) =>
        typeof value === 'function'
            ? [[[...path, key].join('.'), value]]
            : value && typeof value === 'object'
              ? leaves(value, [...path, key])
              : [],
    );

const scenarios = {
    // Every sound in the book, at normal and mini-boss pitch, as high-level requests and as nodes.
    book() {
        const out = {};
        for (const [group, book] of Object.entries(BOOK))
            for (const [name, fn] of leaves(book)) {
                const calls = recorder();
                seeded(() => fn(calls, 0.9));
                const ctx = fakeContext();
                seeded(() => fn(voice(ctx, {}, 0, { gain: 0.85, pitch: 1.5 }), 0.9));
                out[`${group}.${name}`] =
                    `${calls.calls.length}:${fnv(JSON.stringify(calls.calls))}:${ctx.log.length}:${fnv(ctx.log.join('|'))}`;
            }
        return out;
    },
    // What the observer chooses to play while each fight is flown by a fixed script.
    async observer() {
        const out = {};
        for (const kind of KINDS.keys()) {
            let seed = 700 + kind;
            const game = await createRuntime(bytes, {
                random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
            });
            game.start(true);
            game.api.web_boss_practice(kind, 0, 0);
            const heard = [];
            const audio = {
                context: {},
                master: {},
                settings: { soundEnabled: true },
                suspended: false,
            };
            const sound = new BossSound(audio);
            sound.play = (k, section, key, o) =>
                heard.push(`${section}:${key ?? ''}:${o?.limit ?? ''}`);
            sound.sting = () => heard.push('sting');
            sound.defeat = () => heard.push('defeat');
            let old = new Float32Array(1408);
            for (let i = 1; i <= 900; i++) {
                game.step({
                    x: 2048 + Math.round(Math.sin(i / 17) * 1800),
                    y: 2048 + Math.round(Math.cos(i / 23) * 1800),
                    aimX: 1,
                    aimY: 0,
                    firePressed: i % 5 === 0,
                    fire: i % 5 < 2,
                });
                if (i === 450) game.api.web_test_boss_set(0, 1); // push the fight to its end
                const scene = new Float32Array(game.scene());
                sound.observe(old, scene);
                old = scene;
            }
            out[kind] = `${heard.length}:${fnv(heard.join('|'))}`;
        }
        return out;
    },
};

const current = {};
for (const [name, run] of Object.entries(scenarios)) current[name] = await run();
if (process.env.UPDATE_GOLDEN) await writeFile(file, JSON.stringify(current, null, 1) + '\n');
const golden = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
for (const name of Object.keys(scenarios))
    test(`sound golden: ${name}`, () => assert.deepEqual(current[name], golden[name]));
test('the sound golden covers the whole book', () => {
    assert(
        Object.keys(current.book).length > 60,
        `only ${Object.keys(current.book).length} sounds`,
    );
    assert.equal(Object.keys(current.observer).length, 12);
});
