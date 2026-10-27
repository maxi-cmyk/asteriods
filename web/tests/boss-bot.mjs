import { S } from '../src/runtime/scene-layout.mjs';
// A scripted pilot for the boss tests: it steers with BossPilot (src/demo/boss-pilot.mjs),
// the same steering the Home demo flies with, and fires at a human rate. It proves a fight is
// beatable and measures how long the fight takes; it is not a speed-run.
import { bossHazards, bossParts, bossShots, bossState } from '../src/boss/scene.mjs';
import { BossPilot } from '../src/demo/boss-pilot.mjs';

export { hazardHits } from '../src/demo/boss-pilot.mjs';

export class BossBot {
    constructor(game, { shotsPerSecond = 6, margin = 12 } = {}) {
        this.game = game;
        this.pilot = new BossPilot(game, { margin });
        this.every = Math.max(1, Math.round(50 / shotsPerSecond));
        this.tick = 0;
        this.stats = { shots: 0 };
    }
    body() {
        return this.pilot.body();
    }
    target(scene, boss, parts) {
        return this.pilot.target(scene, boss, parts);
    }
    step(input = {}) {
        const game = this.game,
            scene = game.scene(),
            boss = bossState(scene);
        if (!boss.active) {
            game.step({ ...input });
            this.tick++;
            return;
        }
        const parts = bossParts(scene),
            shots = bossShots(scene),
            hazards = bossHazards(scene),
            body = this.pilot.body();
        const sx = scene[S.SHIP_X],
            sy = scene[S.SHIP_Y];
        const tgt = this.pilot.target(scene, boss, parts);
        // Prefer a standing spot near x=110 and the target's height, away from the body.
        const home = { x: 110, y: tgt ? Math.max(40, Math.min(230, tgt.y)) : 135 };
        const best = this.pilot.steer(scene, { shots, hazards, body }, home);
        let aimX = 1,
            aimY = 0,
            fire = false;
        if (tgt) {
            const ax = tgt.x - sx,
                ay = tgt.y - sy,
                len = Math.hypot(ax, ay) || 1;
            aimX = ax / len;
            aimY = ay / len;
            fire = this.tick % this.every === 0;
            if (fire) this.stats.shots++;
        }
        game.step({
            ...input,
            x: 2048 + Math.round(best.dx * 2047),
            y: 2048 + Math.round(best.dy * 2047),
            aimX,
            aimY,
            firePressed: fire,
            fire,
        });
        this.tick++;
    }
}
