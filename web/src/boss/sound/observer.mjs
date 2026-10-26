import { S, BOSS, BOSS_AT } from '../../runtime/scene-layout.mjs';
import { ATTACK, SHOT, bossHazards, bossParts, bossShots } from '../scene.mjs';
import { BOOK } from './book/index.mjs';
import { groupOf, isMini } from './groups.mjs';
import { boom } from './shapes.mjs';
import { Synth } from './synth.mjs';
import { WINDOW_CUES, PART_BREAK_KINDS } from './cues.mjs';

// Mini-bosses borrow their parent's voice a fifth higher and a little shorter.
const MINI = { pitch: 1.5, gain: 0.85 };

// Generic fallbacks for anything a group's book does not cover.
const FALLBACK = {
    charge: (v, d) => v.tone({ f: 300, to: 900, type: 'square', dur: d, vol: 0.06, env: 'swell' }),
    live: (v) => v.noise({ dur: 0.3, vol: 0.12, f: 4000, to: 300, type: 'bandpass' }),
    shot: (v) => v.tone({ f: 1000, to: 500, type: 'square', dur: 0.06, vol: 0.04 }),
    part: (v) => boom(v, 0.6),
    hit: (v) => v.tone({ f: 200, to: 120, type: 'square', dur: 0.05, vol: 0.05 }),
    phase: (v) => {
        v.tone({ f: 90, to: 45, type: 'sawtooth', dur: 0.8, vol: 0.18 });
        boom(v, 1);
    },
    open: (v) => v.tone({ f: 500, to: 1000, type: 'sine', dur: 0.2, vol: 0.06 }),
    close: (v) => v.tone({ f: 800, to: 300, type: 'sine', dur: 0.15, vol: 0.05 }),
};
// Mini-boss attacks reuse the sound of the boss attack they preview.
const ALIAS = {
    [ATTACK.bolts]: ATTACK.cannon,
    [ATTACK.shards]: ATTACK.pick,
    [ATTACK.curve1]: ATTACK.curve,
    [ATTACK.sine6]: ATTACK.sine,
};
// A sound from the book: its group's section, or for a charge the aliased attack's.
export const entry = (kind, section, key) => {
    const book = BOOK[groupOf(kind)];
    const part = book?.[section];
    return key === undefined
        ? part
        : (part?.[key] ?? (section === 'charge' ? part?.[ALIAS[key]] : undefined));
};

// Telegraph lengths (seconds) the charge sounds are shaped for.
const WARN = {
    [ATTACK.lance]: 0.9,
    [ATTACK.fan]: 0.7,
    [ATTACK.volley]: 0.6,
    [ATTACK.cross]: 0.9,
    [ATTACK.burst]: 0.7,
    [ATTACK.prism]: 0.9,
    [ATTACK.pick]: 0.5,
    [ATTACK.collapse]: 1.2,
    [ATTACK.lob]: 1.2,
    [ATTACK.jets]: 0.9,
    [ATTACK.ember]: 0.6,
    [ATTACK.nova]: 1.0,
    [ATTACK.cannon]: 0.5,
    [ATTACK.missile]: 0.6,
    [ATTACK.mines]: 0.4,
    [ATTACK.broadside]: 0.8,
    [ATTACK.sine]: 0.6,
    [ATTACK.tendril]: 0.9,
    [ATTACK.spore]: 0.3,
    [ATTACK.pulse]: 0.7,
    [ATTACK.spiral]: 0.7,
    [ATTACK.curve]: 0.5,
    [ATTACK.accrete]: 0.9,
    [ATTACK.pull]: 1.2,
    [ATTACK.bolts]: 0.5,
    [ATTACK.shards]: 0.5,
    [ATTACK.curve1]: 0.5,
    [ATTACK.blink]: 0.7,
    [ATTACK.sine6]: 0.6,
};
const attackWarn = (id) => WARN[id] ?? 0.8;

const partExists = (scene, index) => !!scene[BOSS_AT + BOSS.PARTS.at + index * BOSS.PARTS.stride];
const partState = (scene, index) => scene[BOSS_AT + BOSS.PARTS.at + index * BOSS.PARTS.stride + 6];

// Plays boss sounds from the scene: compares consecutive scenes and sounds whatever just
// happened (an entrance, an attack charging, a hazard going live, a shot, a part breaking...).
export class BossSound {
    // `audio` is GameAudio: it owns the context, master gain and the enabled checks.
    constructor(audio) {
        this.audio = audio;
        this.last = new Map(); // when each sound last played, to rate-limit volleys
    }
    get live() {
        const a = this.audio;
        return a.context && a.settings.soundEnabled && !a.suspended;
    }
    // Plays one named sound for a kind; `limit` ms stops a volley turning to noise.
    play(kind, section, key, { seconds = 0.9, limit = 0 } = {}) {
        if (!this.live) return;
        const id = `${section}:${key}`,
            now = performance.now();
        if (limit && now - (this.last.get(id) ?? -1e9) < limit) return;
        this.last.set(id, now);
        const fn = entry(kind, section, key) ?? FALLBACK[section];
        if (!fn) return;
        this.run(kind, (v) => fn(v, seconds), section === 'charge' ? 1.5 : 1);
    }
    run(kind, build, level = 1) {
        const ctx = this.audio.context,
            mini = isMini(kind);
        build(
            new Synth(ctx, this.audio.master, ctx.currentTime + 0.005, {
                gain: (mini ? MINI.gain : 1) * level,
                pitch: mini ? MINI.pitch : 1,
            }),
        );
    }
    sting(kind) {
        this.run(kind, (v) => BOOK[groupOf(kind)].sting(v), 0.9);
    }
    defeat(kind) {
        this.run(kind, (v) => BOOK[groupOf(kind)].defeat(v), 0.8);
    }
    // Compare two consecutive scenes and sound whatever just happened.
    observe(old, scene) {
        if (!this.live || !old) return;
        const was = old[S.BOSS_ACTIVE],
            is = scene[S.BOSS_ACTIVE],
            kind = scene[BOSS_AT + BOSS.KIND] | 0;
        if (!was && is) {
            this.sting(kind);
            return;
        }
        if (was && !is) {
            this.defeat(old[BOSS_AT + BOSS.KIND] | 0);
            return;
        }
        if (!is) return;
        // Attack begins: charge for the length of the first telegraph that follows.
        const attack = scene[BOSS_AT + BOSS.ATTACK],
            oldAttack = old[BOSS_AT + BOSS.ATTACK];
        if (attack && attack !== oldAttack)
            this.play(kind, 'charge', attack, { seconds: attackWarn(attack) });
        const stage = scene[S.BOSS_STAGE],
            oldStage = old[S.BOSS_STAGE];
        if (stage > oldStage && oldStage > 0) this.play(kind, 'phase', undefined, { limit: 500 });
        this.#hazardsLive(kind, old, scene);
        this.#newShots(kind, scene);
        this.#partsLost(kind, old, scene);
        this.#windows(kind, old, scene);
        // A hit on the boss.
        if (scene[BOSS_AT + BOSS.FLASH_MS] > 0 && old[BOSS_AT + BOSS.FLASH_MS] === 0)
            this.play(kind, 'hit', undefined, { limit: 70 });
    }
    // Lethal hazards going live: their telegraph just ended.
    #hazardsLive(kind, old, scene) {
        const before = new Map(bossHazards(old).map((h) => [h.index, h]));
        for (const h of bossHazards(scene)) {
            const prev = before.get(h.index);
            if (prev && prev.warn > 0 && h.warn === 0)
                this.play(kind, 'live', h.kind, { limit: 150 });
        }
    }
    // New shots (age 0 this tick), one sound per family per tick.
    #newShots(kind, scene) {
        const families = new Set();
        for (const s of bossShots(scene)) if (s.age < 10) families.add(s.family);
        for (const family of families)
            this.play(kind, 'shot', family, {
                limit: family === SHOT.sine || family === SHOT.pellet ? 90 : 45,
            });
    }
    // Sub-targets lost, or (for panels) blown out.
    #partsLost(kind, old, scene) {
        const lost = bossParts(old).filter((p) => !partExists(scene, p.index));
        if (lost.length) this.play(kind, 'part', undefined, { limit: 120 });
        if (PART_BREAK_KINDS.has(kind)) {
            for (let i = 0; i < 8; i++)
                if (partState(scene, i) === 2 && partState(old, i) !== 2) {
                    this.play(kind, 'part', undefined, { limit: 120 });
                    break;
                }
        }
    }
    // Windows and gates opening and closing, from the boss's own state floats.
    #windows(kind, old, scene) {
        for (const cue of WINDOW_CUES[kind] ?? []) {
            const now = scene[BOSS_AT + cue.field],
                before = old[BOSS_AT + cue.field];
            if (now > 0.5 && before <= 0.5) this.play(kind, cue.rise);
            if (cue.fall && now <= 0.5 && before > 0.5) this.play(kind, cue.fall);
        }
    }
}
