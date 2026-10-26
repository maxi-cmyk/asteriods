import { CoopLeaderboard } from './coop-records.mjs';
import { decodeCoopPlayer } from './coop-scene.mjs';
import { PersonalBests, clearBrowserRecords } from './records.mjs';
import { BossRecords } from './boss-records.mjs';
export const STATES = [
    'menu',
    'countdown',
    'playing',
    'paused',
    'death',
    'initials',
    'game-over',
    'demo',
];
export const SCORE_KEY = 'asteroids.web.scores-v3';

export async function createRuntime(
    bytes,
    { storage, random, tone = () => {}, scoreKey = SCORE_KEY, profile = () => 0 } = {},
) {
    let api;
    let scoreStatus = storage
        ? 'Top-five scores saved in this browser.'
        : 'Storage unavailable; initials cannot be saved.';
    const words = new Uint32Array(64);
    let wordIndex = words.length;
    const nextRandom =
        random ||
        (() => {
            if (wordIndex === words.length) {
                crypto.getRandomValues(words);
                wordIndex = 0;
            }
            return words[wordIndex++];
        });
    const imports = {
        env: {
            sinf: Math.sin,
            cosf: Math.cos,
            browser_random: nextRandom,
            browser_tone: tone,
            browser_storage_read(pointer, capacity) {
                try {
                    const raw = storage?.getItem(scoreKey);
                    if (!raw) return 0;
                    const record = JSON.parse(raw);
                    if (
                        !Array.isArray(record) ||
                        record.length !== 42 ||
                        record.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
                    ) {
                        scoreStatus = 'Saved leaderboard could not be read.';
                        return 0;
                    }
                    if (pointer && capacity >= record.length)
                        new Uint8Array(api.memory.buffer, pointer, record.length).set(record);
                    return record.length;
                } catch {
                    scoreStatus = 'Saved leaderboard could not be read.';
                    return 0;
                }
            },
            browser_storage_write(pointer, length) {
                try {
                    if (!storage) {
                        scoreStatus = 'Storage unavailable; initials cannot be saved.';
                        return 0;
                    }
                    storage.setItem(
                        scoreKey,
                        JSON.stringify([...new Uint8Array(api.memory.buffer, pointer, length)]),
                    );
                    scoreStatus = 'Top-five scores saved in this browser.';
                    return length;
                } catch {
                    scoreStatus =
                        'Could not save initials. Allow browser storage and retry from score entry.';
                    return 0;
                }
            },
        },
    };
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    api = instance.exports;
    const records = new PersonalBests(storage);
    const bossRecords = new BossRecords(storage);
    let run = null,
        result = null;
    let coop = null,
        coopPhase = null,
        teamBoard = null;
    let initials = ['A', 'A', 'A'],
        initialSlot = 0,
        initialReady = false,
        initialRepeat = 0;
    let teamSaveFailed = false;
    let initialHorizontal = 0,
        initialHorizontalRepeat = 0;
    function coopPlayers() {
        return [0, 1].map((owner) =>
            decodeCoopPlayer(
                new Float32Array(
                    new Float32Array(api.memory.buffer, api.web_coop_player(owner), 1408),
                ),
            ),
        );
    }
    function finishCoop() {
        if (!run) return;
        const players = coopPlayers();
        const summaries = players.map((p, i) => ({
            profile: coop.profiles[i],
            score: p.score,
            wave: p.stats.highestWave,
            peakCps: p.stats.peakCps,
            longestChain: p.stats.longestChain,
            shots: p.stats.spawned,
            hits: p.stats.hits,
            laserShots: p.stats.laserShots,
            laserKills: p.stats.laserKills,
            destroyed: p.scene[57],
            bestMultiplier: p.scene[58],
            bossParticipation: p.participation,
        }));
        result = {
            rules: run.rules,
            profile: coop.profiles[0],
            players: summaries,
            score: players[0].teamScore,
            wave: players[0].scene[19],
            elapsedMs: players[0].scene[2],
            bossKills: players[0].scene[523],
            bossMask: players[0].scene[610],
        };
        summaries.forEach((p) => records.record(p.profile, run.rules, p));
        summaries.forEach((p) => bossRecords.record(p.profile, players[0].scene[610]));
        run = null;
        coopPhase = 'results';
        initialReady = false;
    }
    function stepCoop(inputs) {
        if (coopPhase) {
            api.web_audio_step();
            if (coopPhase === 'results') return;
            const input = inputs.players?.[inputs.menuOwner ?? 0] ?? inputs;
            if (!input.fire && !input.firePressed) initialReady = true;
            if (coopPhase === 'initials') {
                const horizontal = input.x < 1300 ? -1 : input.x > 2800 ? 1 : 0;
                if (!horizontal) {
                    initialHorizontal = 0;
                    initialHorizontalRepeat = 0;
                } else if (horizontal !== initialHorizontal || !initialHorizontalRepeat) {
                    initialSlot = Math.max(0, Math.min(2, initialSlot + horizontal));
                    initialHorizontalRepeat = 12;
                    initialHorizontal = horizontal;
                } else initialHorizontalRepeat--;
                const direction = input.y < 1300 ? 1 : input.y > 2800 ? -1 : 0;
                if (!direction) initialRepeat = 0;
                else if (!initialRepeat) {
                    initials[initialSlot] = String.fromCharCode(
                        65 + ((initials[initialSlot].charCodeAt(0) - 65 + direction + 26) % 26),
                    );
                    initialRepeat = 12;
                } else initialRepeat--;
                if (initialReady && input.firePressed) {
                    initialReady = false;
                    teamSaveFailed = !teamBoard.save(coop.runId, initials.join(''), result.score);
                    if (!teamSaveFailed) coopPhase = 'game-over';
                }
            }
            return;
        }
        const players = inputs.players || [{}, {}];
        players.forEach((p, i) =>
            api.web_coop_input(
                i,
                ((p.x ?? 2048) - 2048) / 2048,
                ((p.y ?? 2048) - 2048) / 2048,
                +!!p.firePressed,
                p.aimX || 0,
                p.aimY || 0,
                +!!p.laser,
                +!!p.precision,
                +!!p.shield,
            ),
        );
        if (inputs.pause || players.some((p) => p.pause))
            api.web_coop_pause(+(api.web_state() !== 3));
        else api.web_step(2048, 2048, 0, 0, 0);
        if (api.web_state() === 6) finishCoop();
    }
    let resultsVisible = false,
        resultsReady = false,
        awaitResultsRelease = false;
    function beginRun(practice = false) {
        run = {
            profile: profile() === 1 ? 1 : 0,
            rules: { mode: 'solo', friendlyFire: false, modifiers: [], practice },
        };
        result = null;
        resultsVisible = false;
        resultsReady = false;
        awaitResultsRelease = false;
    }
    function finishRun() {
        if (!run) return;
        const stats = runtime.stats(),
            scene = runtime.scene();
        result = {
            ...run,
            score: scene[16],
            wave: stats.highestWave,
            peakCps: stats.peakCps,
            longestChain: stats.longestChain,
            shots: stats.spawned,
            hits: stats.hits,
            laserShots: stats.laserShots,
            laserKills: stats.laserKills,
            bossKills: scene[523],
            bossMask: scene[610],
            bossHits: scene[611],
            elapsedMs: scene[2],
            destroyed: scene[57],
            bestMultiplier: scene[58],
        };
        records.record(run.profile, run.rules, result);
        if (!run.rules.practice) bossRecords.record(run.profile, result.bossMask || 0);
        run = null;
    }
    const runtime = {
        records,
        bossRecords,
        get scoreStatus() {
            return coop ? teamBoard.status : scoreStatus;
        },
        get coop() {
            return coop;
        },
        teamLeaderboard(friendlyFire) {
            return new CoopLeaderboard(storage, friendlyFire);
        },
        get teamEntries() {
            return teamBoard?.entries ?? [];
        },
        coopPlayers,
        releaseCoopLasers(players) {
            if (!coop || api.web_state() !== 3) return;
            players.forEach((p, i) => api.web_coop_input(i, 0, 0, 0, 0, 0, +!!p.laser, 0, 0));
        },
        startCoop({ profiles = [0, 1], friendlyFire = false } = {}) {
            if (
                profiles.length !== 2 ||
                profiles[0] === profiles[1] ||
                profiles.some((p) => ![0, 1].includes(p))
            )
                throw Error('Choose distinct profiles');
            coop = {
                profiles: [...profiles],
                friendlyFire: !!friendlyFire,
                runId: Symbol('co-op run'),
            };
            coopPhase = null;
            result = null;
            resultsVisible = false;
            teamBoard = new CoopLeaderboard(storage, !!friendlyFire);
            initials = ['A', 'A', 'A'];
            initialSlot = 0;
            initialReady = false;
            initialRepeat = 0;
            teamSaveFailed = false;
            initialHorizontal = 0;
            initialHorizontalRepeat = 0;
            run = {
                rules: {
                    mode: 'co-op',
                    friendlyFire: !!friendlyFire,
                    modifiers: [],
                    practice: false,
                },
            };
            api.web_coop_start(+!!friendlyFire);
        },
        clearRecords() {
            const reset = clearBrowserRecords(storage, scoreKey);
            scoreStatus = reset.message;
            records.status = reset.message;
            if (reset.ok) {
                if (coop) teamBoard = new CoopLeaderboard(storage, coop.friendlyFire);
                records.profiles = [{}, {}];
                bossRecords.reset();
                api.web_reload_scores();
            }
            return reset.ok;
        },
        get result() {
            return result;
        },
        get runProfile() {
            return run?.profile ?? result?.profile ?? (profile() === 1 ? 1 : 0);
        },
        api,
        step(input = {}) {
            if (coop) {
                stepCoop(input);
                return;
            }
            let {
                x = 2048,
                y = 2048,
                fire = false,
                firePressed = false,
                click = false,
                pause = false,
                aimX = 0,
                aimY = 0,
                laser = false,
                precision = false,
                shield = false,
            } = input;
            if (resultsVisible) {
                api.web_audio_step();
                // Consume the ending press/hold before accepting a separate Continue.
                if (!fire && !firePressed) resultsReady = true;
                else if (resultsReady) runtime.continueResults();
                return;
            }
            if (awaitResultsRelease) {
                if (fire || firePressed) {
                    fire = false;
                    firePressed = false;
                } else awaitResultsRelease = false;
            }
            const previous = runtime.state;
            api.web_fire_press(+firePressed);
            api.web_actions(aimX, aimY, +laser, +precision, +shield);
            api.web_step(x, y, +fire, +click, +pause);
            if (runtime.state === 'countdown' && previous !== 'countdown') beginRun(false);
            if (
                run &&
                (runtime.state === 'initials' ||
                    runtime.state === 'game-over' ||
                    (runtime.state === 'death' && runtime.snapshot()[3] === 0))
            )
                finishRun();
            if (
                result &&
                previous === 'death' &&
                ['initials', 'game-over'].includes(runtime.state)
            ) {
                resultsVisible = true;
                resultsReady = false;
            }
        },
        start(practice = false) {
            coop = null;
            coopPhase = null;
            api.web_start(+practice);
            beginRun(practice);
        },
        menu() {
            coop = null;
            coopPhase = null;
            const practiceEnded = !!run?.rules.practice;
            if (practiceEnded) finishRun();
            else run = null;
            api.web_menu();
            resultsVisible = practiceEnded;
            resultsReady = false;
        },
        abandon() {
            coop = null;
            coopPhase = null;
            run = null;
            result = null;
            resultsVisible = false;
            resultsReady = false;
            awaitResultsRelease = true;
            api.web_menu();
        },
        continueResults() {
            if (coop) {
                if (coopPhase === 'results') {
                    coopPhase = teamBoard.qualifies(result.score) ? 'initials' : 'game-over';
                    initialReady = false;
                }
                return;
            }
            if (!resultsVisible) return;
            resultsVisible = false;
            awaitResultsRelease = true;
        },
        resetTargets() {
            api.web_practice_targets();
        },
        // Boss practice: a practice run whose room holds one chosen fight (0-5 bosses, 6-11 minis).
        bossPractice(kind, tier = 0, phase = 1) {
            api.web_boss_practice(kind, tier, phase);
        },
        // Assists change telegraph length and forces only; scoring is unaffected.
        bossAssist({ longWarnings = false, calm = false } = {}) {
            api.web_boss_assist(+longWarnings, +calm);
        },
        doubleFire() {
            api.web_practice_double_fire();
        },
        stats() {
            if (coop) return coopPlayers()[0].stats;
            const values = new Float32Array(api.memory.buffer, api.web_stats(), 16);
            return Object.fromEntries(
                [
                    'cps',
                    'peakCps',
                    'spawned',
                    'hits',
                    'longestChain',
                    'highestWave',
                    'doubleFireMs',
                    'laserShots',
                    'laserKills',
                    'presses',
                    'pending',
                ].map((key, i) => [key, values[i]]),
            );
        },
        multishot() {
            api.web_practice_multishot();
        },
        get state() {
            return coopPhase || (resultsVisible ? 'results' : STATES[api.web_state()]);
        },
        get width() {
            return api.web_width();
        },
        get height() {
            return api.web_height();
        },
        fireDiagnostics() {
            return [...new Uint32Array(api.memory.buffer, api.web_fire_diagnostics(), 4)];
        },
        scene() {
            if (!coop) return new Float32Array(api.memory.buffer, api.web_scene(), 1408);
            const scene = coopPlayers()[0].scene;
            scene[16] = scene[556];
            scene[27] = scene[556];
            if (coopPhase) {
                scene[57] = result.players.reduce((sum, p) => sum + p.destroyed, 0);
                scene[58] = Math.max(...result.players.map((p) => p.bestMultiplier));
                scene[0] = coopPhase === 'initials' ? 5 : 6;
                scene[28] = initialSlot;
                scene[30] = +teamSaveFailed;
                scene[31] = teamBoard.entries.length;
                initials.forEach((c, i) => (scene[32 + i] = c.charCodeAt(0)));
                teamBoard.entries.forEach((e, i) => {
                    const at = 486 + i * 5;
                    scene[at] = e.score;
                    [...e.initials].forEach((c, j) => (scene[at + 1 + j] = c.charCodeAt(0)));
                });
            }
            return scene;
        },
        pixels() {
            return new Uint8Array(api.memory.buffer, api.web_pixels(), 128 * 64);
        },
        snapshot() {
            return [...new Float32Array(api.memory.buffer, api.web_snapshot(), 16)];
        },
        pause() {
            if (coop && ['playing', 'countdown'].includes(runtime.state)) api.web_coop_pause(1);
            else if (runtime.state === 'playing') runtime.step({ pause: true });
        },
    };
    api.__wasm_call_ctors();
    api.web_init();
    return runtime;
}
