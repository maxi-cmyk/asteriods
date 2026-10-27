import { WIDTH, HEIGHT } from './constants.mjs';
import { S, BOSS, BOSS_AT } from '../runtime/scene-layout.mjs';
import { Backgrounds } from './backgrounds.mjs';
import { DEFAULT_HULL } from '../state/hangar.mjs';
import { bossShake } from './fx.mjs';
import { BossArt } from '../boss/art.mjs';
import { BossLayer } from '../boss/render.mjs';
import { PixelCanvas } from './pixel-canvas.mjs';
import { FrameGate } from './frame-gate.mjs';
import { SceneObserver } from './scene-observer.mjs';
import {
    RockLayer,
    SpawnWarningLayer,
    PickupLayer,
    BulletLayer,
    ParticleLayer,
} from './layers/world.mjs';
import { PlayersLayer } from './layers/players.mjs';
import { EffectsLayer, FinaleLayer, CueLayer } from './layers/effects.mjs';
import { TitleScreen, SummaryScreen, Countdown } from './layers/screens.mjs';

export { WIDTH, HEIGHT };
export { loadArt } from './art.mjs';

// Draws one scene per call: the region backdrop, then the flight as an ordered stack of
// layers (boss, rocks, pickups, bullets, ships, effects, cues), or a full-canvas screen.
export class PixelRenderer {
    // The wave picks the region, in a run and in the Home demo alike.
    constructor(canvas, art) {
        this.canvas = canvas;
        this.cue = null;
        const query =
            typeof matchMedia === 'function'
                ? matchMedia('(prefers-reduced-motion: reduce)')
                : null;
        this.reduced = !!query?.matches;
        this.backgrounds = new Backgrounds({ reduced: this.reduced });
        this.backgrounds.setWorlds(art.worlds);
        query?.addEventListener?.('change', (event) => {
            this.reduced = event.matches;
            this.backgrounds.setReduced(event.matches);
            if (this.bosses) this.bosses.reduced = event.matches;
        });
        this.bossArt = art.bossArt || new BossArt();
        this.bosses = new BossLayer(this.bossArt, { reduced: this.reduced });
        this.hulls = [DEFAULT_HULL, DEFAULT_HULL];
        this.context = canvas.getContext('2d', { alpha: false });
        this.context.imageSmoothingEnabled = false;
        this.art = art;
        this.px = new PixelCanvas(this.context, art);
        this.observer = new SceneObserver();
        this.gate = new FrameGate();
        this.shake = 0.5; // screen-shake strength, 0-1, from settings
        this.title = new TitleScreen();
        this.summary = new SummaryScreen();
        this.countdown = new Countdown();
        const boss = { draw: (f) => this.bosses.draw(f.ctx, f.scene, f.time) };
        this.layers = [
            boss,
            new RockLayer(),
            new SpawnWarningLayer(),
            new PickupLayer(),
            new BulletLayer(),
            new ParticleLayer(),
            new PlayersLayer(),
            new EffectsLayer(),
            new FinaleLayer(),
            new CueLayer(),
        ];
    }
    // The scene the observer last saw (the boss gallery seeds this to stage a death).
    get previous() {
        return this.observer.previous;
    }
    set previous(scene) {
        this.observer.previous = scene;
    }
    sprite(name, x, y, scale, alpha) {
        this.px.sprite(name, x, y, scale, alpha);
    }
    text(...args) {
        this.px.text(...args);
    }
    // Everything a layer may need for this frame.
    #frame(scene, players) {
        return {
            ctx: this.context,
            px: this.px,
            scene,
            time: scene[S.VISUAL_MS],
            players,
            hulls: this.hulls,
            observer: this.observer,
            reduced: this.reduced,
            bossArt: this.bossArt,
            cue: this.cue,
        };
    }
    scenery(scene) {
        const state = scene[S.STATE],
            hold = state === 5 || state === 6;
        const dim = [1, 2, 3, 4, 7].includes(state);
        this.cue = this.backgrounds.draw(this.context, {
            time: scene[S.VISUAL_MS],
            wave: scene[S.WAVE],
            hold,
            dim,
            run: state >= 1 && state !== 0,
            practice: !!scene[S.PRACTICE],
            fight:
                scene[S.BOSS_ACTIVE] && scene[BOSS_AT + BOSS.TIER] >= 3
                    ? { kind: scene[BOSS_AT + BOSS.KIND], tier: scene[BOSS_AT + BOSS.TIER] }
                    : null,
        });
    }
    // Everything besides the scene that changes what render() paints.
    #settingsKey() {
        const { backgrounds } = this;
        return `${this.shake}|${backgrounds.motion}|${backgrounds.brightness}|${this.reduced}|${this.hulls.join()}|${this.bossArt.version}`;
    }
    // render() for the live loop: the same pixels, but only when the scene or a setting moved
    // since the last call. Repeat calls between engine ticks cost a comparison, not a repaint.
    renderIfChanged(scene, players = null) {
        const scenes = players ? [scene, ...players.map((p) => p.scene)] : [scene];
        if (!this.gate.changed(this.#settingsKey(), scenes)) return false;
        this.render(scene, players);
        return true;
    }
    render(scene, players = null) {
        this.observer.observe(scene);
        this.bossArt.prepare(scene[S.WAVE]);
        this.scenery(scene);
        const frame = this.#frame(scene, players);
        const state = scene[S.STATE];
        if (state === 0) this.title.draw(frame);
        else if (state === 5 || state === 6) this.summary.draw(frame);
        else {
            if (state !== 1) {
                const ctx = this.context;
                ctx.save();
                if (state !== 3) this.#shake(scene);
                for (const layer of this.layers) layer.draw(frame);
                ctx.restore();
            }
            if (state === 1) this.countdown.draw(frame);
            // Pause is drawn by the DOM pause menu over a scrim; the canvas stays clean.
        }
    }
    // Hit shake from the engine, plus the kick of a boss going down.
    #shake(scene) {
        const ctx = this.context;
        const offset =
            scene[S.SHAKE_OFFSET] > 31 ? scene[S.SHAKE_OFFSET] - 64 : scene[S.SHAKE_OFFSET];
        ctx.translate(0, Math.round(offset * this.shake * 2));
        const { finale } = this.observer;
        if (finale && !this.reduced) {
            const kick = bossShake(scene[S.VISUAL_MS], finale) * 5 * this.shake * 2;
            ctx.translate(
                Math.round(Math.sin(scene[S.VISUAL_MS] * 0.09) * kick),
                Math.round(Math.cos(scene[S.VISUAL_MS] * 0.11) * kick),
            );
        }
    }
}
