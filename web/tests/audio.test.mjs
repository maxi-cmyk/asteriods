import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRuntime } from '../src/runtime/runtime.mjs';
import { MusicPlayer } from '../src/audio/music.mjs';
import {
    HOME_PLAYLIST,
    MusicDirector,
    bossRequest,
    planetRequest,
} from '../src/audio/soundtrack.mjs';
import { S, BOSS, BOSS_AT } from '../src/runtime/scene-layout.mjs';
import { defaults, sanitizeSettings, SettingsDraft, loadProfiles } from '../src/state/settings.mjs';

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

// A stand-in for Web Audio and <audio>: tracks are plain objects whose clock the test moves.
function playerFixture(tracks) {
    const gains = [];
    const context = {
        currentTime: 0,
        createGain() {
            const node = {
                gain: {
                    value: 0,
                    setTargetAtTime(value) {
                        this.last = value;
                    },
                },
                connect: (next) => next,
                disconnect() {},
            };
            gains.push(node);
            return node;
        },
        createMediaElementSource: () => ({ connect: (next) => next, disconnect() {} }),
    };
    const elements = [];
    const open = (url) => {
        const element = {
            url,
            currentTime: 0,
            ended: false,
            playing: false,
            play() {
                this.playing = true;
                return Promise.resolve();
            },
            pause() {
                this.playing = false;
            },
            removeAttribute() {
                this.url = '';
            },
        };
        elements.push(element);
        return element;
    };
    const manifest = () => ({ tracks });
    const player = new MusicPlayer(context, {}, { manifest, open, base: '' });
    const tick = (seconds, request, enabled = true, suspended = false) => {
        context.currentTime += seconds;
        for (const element of elements) if (element.playing) element.currentTime += seconds;
        player.update(request, enabled, 0.5, suspended);
    };
    const live = () => elements.filter((e) => e.url);
    return { player, elements, tick, live, gains, context };
}

const TRACKS_FIXTURE = {
    a: { file: 'a.mp3', end: 20, gain: 0.5 },
    b: { file: 'b.mp3', end: 30, gain: 0.5 },
    c: { file: 'c.mp3', end: 40, gain: 0.5 },
};
const single = (id) => ({ key: id, tracks: [id] });

test('music fades in, crossfades on a new request, and drops the old stream afterwards', () => {
    const { tick, live, elements } = playerFixture(TRACKS_FIXTURE);
    tick(0.016, single('a'));
    assert.equal(live().length, 1);
    assert.equal(elements[0].playing, true);
    for (let i = 0; i < 60; i++) tick(0.05, single('a'));
    tick(0.016, single('b'));
    assert.equal(live().length, 2, 'both streams play while crossfading');
    for (let i = 0; i < 60; i++) tick(0.05, single('b'));
    assert.deepEqual(
        live().map((e) => e.url),
        ['b.mp3'],
    );
});

test('a single-track request loops before the track ends; a playlist moves to the next track', () => {
    const solo = playerFixture(TRACKS_FIXTURE);
    solo.tick(0.016, single('a'));
    solo.elements[0].currentTime = 19.8;
    solo.tick(0.05, single('a'));
    assert.equal(solo.elements.length, 2, 'the same track starts again');
    assert.equal(solo.elements[1].url, 'a.mp3');

    const list = playerFixture(TRACKS_FIXTURE);
    const request = { key: 'list', tracks: ['a', 'b', 'c'] };
    list.tick(0.016, request);
    list.elements[0].currentTime = 17;
    list.tick(0.05, request);
    assert.equal(list.live().at(-1).url, 'b.mp3');
    list.elements.find((e) => e.url === 'b.mp3').currentTime = 27;
    for (let i = 0; i < 120; i++) list.tick(0.05, request);
    assert.equal(list.live().at(-1).url, 'c.mp3');
    list.elements.find((e) => e.url === 'c.mp3').currentTime = 37.5;
    for (let i = 0; i < 120; i++) list.tick(0.05, request);
    assert.equal(list.live().at(-1).url, 'a.mp3', 'the playlist wraps around');
});

test('music pauses in place when suspended, resumes where it was, and clears when turned off', async () => {
    const f = playerFixture(TRACKS_FIXTURE);
    const request = single('a');
    f.tick(0.016, request);
    f.tick(1, request);
    const position = f.elements[0].currentTime;
    f.tick(0.016, request, true, true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(f.elements[0].playing, false);
    f.tick(5, request, true, true);
    f.tick(0.016, request);
    assert.equal(f.elements[0].playing, true);
    assert.ok(Math.abs(f.elements[0].currentTime - position) < 0.1);
    f.tick(0.016, request, false);
    assert.equal(f.live().length, 0);
});

test('the music chooser picks home, region and boss tracks from the scene', () => {
    const director = new MusicDirector();
    const sceneAt = (wave, boss = null) => {
        const scene = new Float32Array(2000);
        scene[S.WAVE] = wave;
        if (boss !== null) {
            scene[S.BOSS_ACTIVE] = 1;
            scene[BOSS_AT + BOSS.KIND] = boss;
        }
        return scene;
    };
    const flying = (scene) =>
        director.request({ screen: 'play', runtimeState: 'playing', scene }).key;
    assert.deepEqual(director.request({ screen: 'home' }).tracks, HOME_PLAYLIST);
    assert.equal(flying(sceneAt(1)), 'frontier');
    assert.equal(flying(sceneAt(5)), 'frontier');
    assert.equal(flying(sceneAt(6)), 'violet');
    assert.equal(flying(sceneAt(16)), 'ruins');
    assert.equal(flying(sceneAt(40)), 'rift');
    assert.equal(flying(sceneAt(10, 1)), 'boss_ringwarden');
    assert.equal(
        flying(sceneAt(10)),
        'boss_ringwarden',
        'the boss theme lasts until the wave changes',
    );
    assert.equal(flying(sceneAt(11)), 'ember');
    assert.equal(flying(sceneAt(12, 8)), 'ember', 'a mini-boss keeps the region track');
    assert.equal(flying(sceneAt(25, 4)), 'boss_tidecaller');
    assert.equal(
        director.request({ screen: 'play', runtimeState: 'results', scene: sceneAt(3) }),
        null,
    );
    // The pause menu (and a window losing focus, which pauses) keeps the music going.
    assert.equal(flying(sceneAt(25, 4)), 'boss_tidecaller');
    assert.equal(
        director.request({ screen: 'pause', runtimeState: 'paused' }).key,
        'boss_tidecaller',
    );
    // The Home demo follows the stage it is showing.
    assert.equal(director.request({ screen: 'home', demoScene: sceneAt(16) }).key, 'ruins');
    assert.equal(
        director.request({ screen: 'home', demoScene: sceneAt(5, 0) }).key,
        'boss_sentinel',
    );
});

test('every track the game can ask for is in the soundtrack manifest and on disk', async () => {
    const dir = new URL('../assets/soundtracks/', import.meta.url);
    const { tracks } = JSON.parse(await readFile(new URL('soundtracks.json', dir), 'utf8'));
    const wanted = new Set(HOME_PLAYLIST);
    for (let wave = 1; wave <= 30; wave += 5) wanted.add(planetRequest(wave).key);
    for (let kind = 0; kind < 6; kind++) wanted.add(bossRequest(kind).key);
    assert.equal(wanted.size, 3 + 6 + 6);
    for (const id of wanted) {
        const track = tracks[id];
        assert.ok(track, `${id} is in the manifest`);
        assert.ok((await readFile(new URL(track.file, dir))).length > 10000, `${id} exists`);
        assert.ok(track.end > 20 && track.end <= track.seconds + 0.01, `${id} has a sane end`);
        assert.ok(track.gain > 0 && track.gain <= 1);
    }
    // The home playlist is three songs of about the same length, so the cycle feels even.
    const lengths = HOME_PLAYLIST.map((id) => tracks[id].end);
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 5, lengths.join(', '));
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
