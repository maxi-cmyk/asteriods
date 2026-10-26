// A death sequence of its own for every boss and mini-boss. Each one plays from a
// frozen copy of the last frame the boss was alive (`snap`), so it can reuse the
// live sprites, layers and sub-targets. All of it is presentation: a pure function
// of the snapshot and the age in visual milliseconds, so pausing freezes it.
//
//   Sentinel      plates blast off, the bare eye overloads
//   Ringwarden    blades shear away one by one, the core implodes, then shatters
//   Cinderforge   hatches pop with fire jets, the shell splits on a column of fire, embers rain
//   Bastion       chain explosions walk nose to stern, the hull breaks in two
//   Tidecaller    the bell deflates and dissolves into bubbles
//   Warden        everything is pulled into a point, a silence, then rings of light
//   Picket        splits top and bottom      Shardling   blades spin off, core pops
//   Cinderling    cracks and vents fire      Gunnery     bursts along the hull, snaps in two
//   Moonjelly     dissolves in bubbles       Lens Imp    flickers out, collapses to a point
import { KINDS, bossState } from './scene.mjs';
import { SCRIPTS as frontier } from './death/frontier.mjs';
import { SCRIPTS as violet } from './death/violet.mjs';
import { SCRIPTS as ember } from './death/ember.mjs';
import { SCRIPTS as ruins } from './death/ruins.mjs';
import { SCRIPTS as lunar } from './death/lunar.mjs';
import { SCRIPTS as rift } from './death/rift.mjs';

export const DEATH_MS = [2400, 2400, 2800, 3000, 2600, 3000, 1500, 1500, 1700, 1700, 1500, 1600];
export const deathMs = (kind) => DEATH_MS[kind] ?? 2000;

// One script per kind, indexed by BossKind (bosses 0-5, their minis 6-11).
const SCRIPTS = { ...frontier, ...violet, ...ember, ...ruins, ...lunar, ...rift };

// Draws one boss's death. `finale` is {x, y, time, kind, snap}; returns false when the
// art for it has not loaded, so the caller can fall back to the plain blast.
export function drawDeath(ctx, art, finale, time, { reduced = false } = {}) {
    const kind = finale.kind,
        info = KINDS[kind],
        script = SCRIPTS[kind];
    if (!script || !finale.snap || !art.ready(info.region)) return false;
    const d = {
        ctx,
        art,
        kind,
        snap: finale.snap,
        state: bossState(finale.snap),
        x: finale.x,
        y: finale.y,
        age: time - finale.time,
        sheet: info.region,
        reduced,
    };
    if (d.age < 0 || d.age > deathMs(kind)) return true;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    script(d);
    ctx.restore();
    return true;
}
