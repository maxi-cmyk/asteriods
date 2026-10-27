import { S, BOSS, BOSS_AT, BLOCKS, recordAt } from '../runtime/scene-layout.mjs';
import { SMALL_BLAST_MS } from './fx.mjs';
import { deathMs } from '../boss/death.mjs';
import { copyScene } from '../runtime/scene-copy.mjs';

// Compares each scene with the one before and turns what happened into short-lived visual
// events: rock and ship explosions, a boss death, the "laser ready" flash. The renderer's
// layers only read the result.
export class SceneObserver {
    constructor() {
        this.previous = null;
        this.effects = []; // small explosions { x, y, time, size }
        this.finale = null; // the boss death in progress { x, y, time, kind, mini, snap }
        this.readyUntil = 0; // show "LASER READY" until this visual time
        this.copies = []; // the two reusable buffers `previous` alternates between
    }
    observe(scene) {
        const old = this.previous;
        if (
            old &&
            old[S.LASER_COOLDOWN_MS] > 0 &&
            scene[S.LASER_COOLDOWN_MS] === 0 &&
            scene[S.STATE] === 2
        )
            this.readyUntil = scene[S.VISUAL_MS] + 1100;
        if (old && scene[S.GAME_MS] < old[S.GAME_MS]) this.readyUntil = 0;
        if (old && old[S.GAME_MS] <= scene[S.GAME_MS] && [2, 4].includes(scene[S.STATE])) {
            for (let i = 0; i < BLOCKS.ROCKS.count; i++) {
                const at = recordAt(BLOCKS.ROCKS, i);
                if (old[at] && (!scene[at] || scene[at + 5] !== old[at + 5]) && old[at + 1] > -16) {
                    this.effects.push({
                        x: old[at + 1],
                        y: old[at + 2],
                        time: scene[S.VISUAL_MS],
                        size: old[at + 5],
                    });
                }
            }
            if (old[S.SHIP_ALIVE] && !scene[S.SHIP_ALIVE])
                this.effects.push({
                    x: scene[S.SHIP_X],
                    y: scene[S.SHIP_Y],
                    time: scene[S.VISUAL_MS],
                    size: 3,
                });
            if (old[S.BOSS_ACTIVE] && !scene[S.BOSS_ACTIVE]) {
                const kind = old[BOSS_AT + BOSS.KIND];
                this.finale = {
                    x: old[S.BOSS_X],
                    y: old[S.BOSS_Y],
                    time: scene[S.VISUAL_MS],
                    kind,
                    mini: !!old[BOSS_AT + BOSS.MINI],
                    snap: new Float32Array(old),
                };
            }
        }
        if (old && scene[S.GAME_MS] < old[S.GAME_MS]) {
            this.effects = [];
            this.finale = null;
        }
        const now = scene[S.VISUAL_MS];
        if (this.effects.some((effect) => now - effect.time >= SMALL_BLAST_MS))
            this.effects = this.effects.filter((effect) => now - effect.time < SMALL_BLAST_MS);
        if (this.effects.length > 20) this.effects = this.effects.slice(-20);
        if (this.finale && scene[S.VISUAL_MS] - this.finale.time >= deathMs(this.finale.kind))
            this.finale = null;
        this.previous = copyScene(this.copies, scene, old);
    }
}
