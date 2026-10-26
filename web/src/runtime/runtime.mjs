import { S, BLOCKS, SCENE_FLOATS, recordAt } from './scene-layout.mjs';
import { CoopLeaderboard } from '../state/coop-records.mjs';
import { decodeCoopPlayer } from './coop-scene.mjs';
import { PersonalBests, clearBrowserRecords } from '../state/records.mjs';
import { BossRecords } from '../boss/records.mjs';
import { CoopRun } from './coop-run.mjs';
import { RunRecorder } from './run-recorder.mjs';
import { WasmHost } from './wasm-host.mjs';

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
const STAT_KEYS = [
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
];

// The engine as the UI sees it: one object that steps the game, exposes the scene and
// remembers how runs ended. Solo and co-op share it; a CoopRun exists only during co-op.
class Runtime {
    constructor(host, { storage, scoreKey, profile }) {
        this.host = host;
        this.api = host.api;
        this.storage = storage;
        this.scoreKey = scoreKey;
        this.records = new PersonalBests(storage);
        this.bossRecords = new BossRecords(storage);
        this.recorder = new RunRecorder({
            records: this.records,
            bossRecords: this.bossRecords,
            profile,
        });
        this.profile = profile;
        this.coop = null; // CoopRun while a co-op run is current
        // Solo end-of-run screen: visible, then ready for Continue once fire is released.
        this.resultsVisible = false;
        this.resultsReady = false;
        this.awaitResultsRelease = false;
    }
    get scoreStatus() {
        return this.coop ? this.coop.board.status : this.host.scoreStatus;
    }
    get result() {
        return this.recorder.result;
    }
    get runProfile() {
        return this.recorder.runProfile;
    }
    get teamEntries() {
        return this.coop?.board.entries ?? [];
    }
    teamLeaderboard(friendlyFire) {
        return new CoopLeaderboard(this.storage, friendlyFire);
    }
    get state() {
        return this.coop?.phase || (this.resultsVisible ? 'results' : STATES[this.api.web_state()]);
    }
    get width() {
        return this.api.web_width();
    }
    get height() {
        return this.api.web_height();
    }
    // ---------------------------------------------------------------- co-op
    coopPlayers() {
        return [0, 1].map((owner) =>
            decodeCoopPlayer(
                new Float32Array(
                    new Float32Array(
                        this.host.memory.buffer,
                        this.api.web_coop_player(owner),
                        SCENE_FLOATS,
                    ),
                ),
            ),
        );
    }
    startCoop({ profiles = [0, 1], friendlyFire = false } = {}) {
        this.coop = new CoopRun({ profiles, friendlyFire, storage: this.storage });
        this.resultsVisible = false;
        this.recorder.beginCoop(friendlyFire);
        this.api.web_coop_start(+!!friendlyFire);
    }
    releaseCoopLasers(players) {
        if (!this.coop || this.api.web_state() !== 3) return;
        players.forEach((p, i) => this.api.web_coop_input(i, 0, 0, 0, 0, 0, +!!p.laser, 0, 0));
    }
    #finishCoop() {
        if (this.recorder.finishCoop(this.coop.profiles, this.coopPlayers())) this.coop.finish();
    }
    #stepCoop(inputs) {
        const { api, coop } = this;
        if (coop.phase) {
            api.web_audio_step();
            coop.stepEnd(inputs.players?.[inputs.menuOwner ?? 0] ?? inputs, this.result);
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
        if (api.web_state() === 6) this.#finishCoop();
    }

    // ---------------------------------------------------------------- run flow
    step(input = {}) {
        if (this.coop) {
            this.#stepCoop(input);
            return;
        }
        const { api } = this;
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
        if (this.resultsVisible) {
            api.web_audio_step();
            // Consume the ending press/hold before accepting a separate Continue.
            if (!fire && !firePressed) this.resultsReady = true;
            else if (this.resultsReady) this.continueResults();
            return;
        }
        if (this.awaitResultsRelease) {
            if (fire || firePressed) {
                fire = false;
                firePressed = false;
            } else this.awaitResultsRelease = false;
        }
        const previous = this.state;
        api.web_fire_press(+firePressed);
        api.web_actions(aimX, aimY, +laser, +precision, +shield);
        api.web_step(x, y, +fire, +click, +pause);
        if (this.state === 'countdown' && previous !== 'countdown') this.#beginRun(false);
        if (
            this.recorder.run &&
            (this.state === 'initials' ||
                this.state === 'game-over' ||
                (this.state === 'death' && this.snapshot()[3] === 0))
        )
            this.#finishRun();
        if (this.result && previous === 'death' && ['initials', 'game-over'].includes(this.state)) {
            this.resultsVisible = true;
            this.resultsReady = false;
        }
    }
    #beginRun(practice) {
        this.recorder.beginSolo(practice);
        this.resultsVisible = false;
        this.resultsReady = false;
        this.awaitResultsRelease = false;
    }
    #finishRun() {
        this.recorder.finishSolo(this.stats(), this.scene());
    }
    start(practice = false) {
        this.coop = null;
        this.api.web_start(+practice);
        this.#beginRun(practice);
    }
    menu() {
        this.coop = null;
        const practiceEnded = !!this.recorder.run?.rules.practice;
        if (practiceEnded) this.#finishRun();
        else this.recorder.discardRun();
        this.api.web_menu();
        this.resultsVisible = practiceEnded;
        this.resultsReady = false;
    }
    abandon() {
        this.coop = null;
        this.recorder.discardRun();
        this.recorder.discardResult();
        this.resultsVisible = false;
        this.resultsReady = false;
        this.awaitResultsRelease = true;
        this.api.web_menu();
    }
    continueResults() {
        if (this.coop) {
            this.coop.advance(this.result.score);
            return;
        }
        if (!this.resultsVisible) return;
        this.resultsVisible = false;
        this.awaitResultsRelease = true;
    }
    pause() {
        if (this.coop && ['playing', 'countdown'].includes(this.state)) this.api.web_coop_pause(1);
        else if (this.state === 'playing') this.step({ pause: true });
    }
    clearRecords() {
        const reset = clearBrowserRecords(this.storage, this.scoreKey);
        this.host.scoreStatus = reset.message;
        this.records.status = reset.message;
        if (reset.ok) {
            if (this.coop)
                this.coop.board = new CoopLeaderboard(this.storage, this.coop.friendlyFire);
            this.records.profiles = [{}, {}];
            this.bossRecords.reset();
            this.api.web_reload_scores();
        }
        return reset.ok;
    }

    // ---------------------------------------------------------------- practice tools
    resetTargets() {
        this.api.web_practice_targets();
    }
    doubleFire() {
        this.api.web_practice_double_fire();
    }
    multishot() {
        this.api.web_practice_multishot();
    }
    // Boss practice: a practice run whose room holds one chosen fight (0-5 bosses, 6-11 minis).
    bossPractice(kind, tier = 0, phase = 1) {
        this.api.web_boss_practice(kind, tier, phase);
    }
    // Assists change telegraph length and forces only; scoring is unaffected.
    bossAssist({ longWarnings = false, calm = false } = {}) {
        this.api.web_boss_assist(+longWarnings, +calm);
    }

    // ---------------------------------------------------------------- reading the engine
    stats() {
        if (this.coop) return this.coopPlayers()[0].stats;
        const values = new Float32Array(this.host.memory.buffer, this.api.web_stats(), 16);
        return Object.fromEntries(STAT_KEYS.map((key, i) => [key, values[i]]));
    }
    fireDiagnostics() {
        return [...new Uint32Array(this.host.memory.buffer, this.api.web_fire_diagnostics(), 4)];
    }
    // The scene as a float view. In co-op it is player one's scene with the team's totals
    // and, on the end screens, the co-op results and initials entry written over it.
    scene() {
        if (!this.coop)
            return new Float32Array(this.host.memory.buffer, this.api.web_scene(), SCENE_FLOATS);
        const scene = this.coopPlayers()[0].scene;
        scene[S.SCORE] = scene[S.COOP_TEAM_SCORE];
        scene[S.FINAL_SCORE] = scene[S.COOP_TEAM_SCORE];
        const { coop, result } = this;
        if (coop.phase) {
            scene[S.RUN_DESTROYED] = result.players.reduce((sum, p) => sum + p.destroyed, 0);
            scene[S.RUN_BEST_MULTIPLIER] = Math.max(...result.players.map((p) => p.bestMultiplier));
            scene[S.STATE] = coop.phase === 'initials' ? 5 : 6;
            scene[S.SELECTED_INITIAL] = coop.editor.slot;
            scene[S.SAVE_FAILED] = +coop.saveFailed;
            scene[S.SCORE_COUNT] = coop.board.entries.length;
            coop.editor.letters.forEach(
                (c, i) => (scene[BLOCKS.INITIALS.at + i] = c.charCodeAt(0)),
            );
            coop.board.entries.forEach((e, i) => {
                const at = recordAt(BLOCKS.HIGHSCORES, i);
                scene[at] = e.score;
                [...e.initials].forEach((c, j) => (scene[at + 1 + j] = c.charCodeAt(0)));
            });
        }
        return scene;
    }
    pixels() {
        return new Uint8Array(this.host.memory.buffer, this.api.web_pixels(), 128 * 64);
    }
    snapshot() {
        return [...new Float32Array(this.host.memory.buffer, this.api.web_snapshot(), 16)];
    }
}

export async function createRuntime(
    bytes,
    { storage, random, tone = () => {}, scoreKey = SCORE_KEY, profile = () => 0 } = {},
) {
    const host = await WasmHost.load(bytes, { storage, random, tone, scoreKey });
    const runtime = new Runtime(host, { storage, scoreKey, profile });
    host.api.web_init();
    return runtime;
}
