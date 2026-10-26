import { WIDTH, HEIGHT } from './constants.mjs';
import {
    S,
    BOSS,
    BLOCKS,
    recordAt,
    records,
    enteredInitials,
    leaderboardEntries,
} from '../runtime/scene-layout.mjs';
import { Backgrounds } from './backgrounds.mjs';
import { gradeAtlas } from './art-grade.mjs';
import { DEFAULT_HULL, hullSprite } from '../state/hangar.mjs';
import { glow, smallBlast, bossBlast, bossShake, SMALL_BLAST_MS } from './fx.mjs';
import { BossArt } from '../boss/art.mjs';
import { BossLayer } from '../boss/render.mjs';
import { deathMs, drawDeath } from '../boss/death.mjs';
import { BOSS_AT, KINDS } from '../boss/scene.mjs';
export { WIDTH, HEIGHT };
const COLOUR = {
    background: '#080f19',
    ink: '#f2f1df',
    muted: '#91a4b3',
    dim: '#273849',
    cyan: '#70d9ed',
    amber: '#efb963',
    hot: '#ed7659',
};

async function loadImage(url) {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
}
export async function loadArt() {
    const [atlas, font, response, hullImage, hullResponse] = await Promise.all([
        loadImage('./assets/sprites.png'),
        loadImage('./assets/font.png'),
        fetch('./assets/sprites.json'),
        loadImage('./assets/ships.png'),
        fetch('./assets/ships.json'),
    ]);
    if (!response.ok || !hullResponse.ok) throw new Error('Sprite manifest could not load');
    const sprites = await response.json(),
        { cells } = await hullResponse.json();
    // Hangar hulls ride below the stock atlas so one image serves every sprite.
    const sheet = document.createElement('canvas');
    sheet.width = Math.max(atlas.width, hullImage.width);
    sheet.height = atlas.height + hullImage.height;
    const ctx = sheet.getContext('2d');
    ctx.drawImage(atlas, 0, 0);
    ctx.drawImage(hullImage, 0, atlas.height);
    for (const [name, cell] of Object.entries(cells))
        sprites[name] = { ...cell, y: cell.y + atlas.height };
    // Region scenery (planets, moons, the black hole) is optional: without it the
    // backgrounds still draw their sky, nebulae and stars.
    let worlds = null;
    try {
        const [image, response] = await Promise.all([
            loadImage('./assets/worlds.png'),
            fetch('./assets/worlds.json'),
        ]);
        if (response.ok) worlds = { image, frames: await response.json() };
    } catch (error) {
        console.warn('World sprites unavailable', error);
    }
    return { atlas: gradeAtlas(sheet, sprites), font, sprites, worlds };
}

export class PixelRenderer {
    // `calm` pins the opening scene (demo flights); otherwise the wave picks the region.
    constructor(canvas, art, { calm = false } = {}) {
        this.canvas = canvas;
        this.calm = calm;
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
        this.finale = null;
        this.bossArt = art.bossArt || new BossArt();
        this.bosses = new BossLayer(this.bossArt, { reduced: this.reduced });
        this.hulls = [DEFAULT_HULL, DEFAULT_HULL];
        this.context = canvas.getContext('2d', { alpha: false });
        this.context.imageSmoothingEnabled = false;
        this.art = art;
        this.fonts = new Map();
        this.previous = null;
        this.shake = 0.5;
        this.readyUntil = 0;
        this.effects = [];
        this.stars = Array.from({ length: 100 }, (_, i) => ({
            x: (i * 137 + 71) % WIDTH,
            y: (i * i * 29 + 31) % HEIGHT,
            depth: i % 3,
        }));
    }
    sprite(name, x, y, scale = 1, alpha = 1) {
        const sprite = this.art.sprites[name];
        if (!sprite) return;
        const ctx = this.context;
        ctx.globalAlpha = alpha;
        ctx.drawImage(
            this.art.atlas,
            sprite.x,
            sprite.y,
            sprite.w,
            sprite.h,
            Math.round(x),
            Math.round(y),
            sprite.w * scale,
            sprite.h * scale,
        );
        ctx.globalAlpha = 1;
    }
    text(value, x, y, colour = COLOUR.ink, scale = 1, align = 'left') {
        const text = String(value);
        let font = this.fonts.get(colour);
        if (!font) {
            font = document.createElement('canvas');
            font.width = 96;
            font.height = 128;
            const ctx = font.getContext('2d');
            ctx.drawImage(this.art.font, 0, 0);
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = colour;
            ctx.fillRect(0, 0, 96, 128);
            this.fonts.set(colour, font);
        }
        if (align === 'center') x -= (text.length * 6 * scale) / 2;
        if (align === 'right') x -= text.length * 6 * scale;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i) & 255;
            this.context.drawImage(
                font,
                (code % 16) * 6,
                Math.floor(code / 16) * 8,
                6,
                8,
                Math.round(x + i * 6 * scale),
                Math.round(y),
                6 * scale,
                8 * scale,
            );
        }
    }
    box(x, y, width, height, colour) {
        const ctx = this.context;
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, width, 1);
        ctx.fillRect(x, y + height - 1, width, 1);
        ctx.fillRect(x, y, 1, height);
        ctx.fillRect(x + width - 1, y, 1, height);
    }
    background(time = 0) {
        const ctx = this.context;
        ctx.fillStyle = COLOUR.background;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        for (const star of this.stars) {
            const x =
                Math.floor(((star.x - time * (star.depth + 1) * 0.002) % WIDTH) + WIDTH) % WIDTH;
            ctx.fillStyle = ['#182633', '#263c4c', '#4b6573'][star.depth];
            ctx.fillRect(x, star.y, 1, 1);
        }
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
            practice: this.calm || !!scene[S.PRACTICE] || state === 7,
            fight:
                scene[S.BOSS_ACTIVE] && scene[BOSS_AT + BOSS.TIER] >= 3
                    ? { kind: scene[BOSS_AT + BOSS.KIND], tier: scene[BOSS_AT + BOSS.TIER] }
                    : null,
        });
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
                const kind = old[BOSS_AT];
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
        this.effects = this.effects
            .filter((effect) => scene[S.VISUAL_MS] - effect.time < SMALL_BLAST_MS)
            .slice(-20);
        if (this.finale && scene[S.VISUAL_MS] - this.finale.time >= deathMs(this.finale.kind))
            this.finale = null;
        this.previous = new Float32Array(scene);
    }
    world(scene) {
        const ctx = this.context;
        const time = scene[S.VISUAL_MS];
        this.bosses.draw(ctx, scene, time);
        for (const [i, rock] of records(scene, BLOCKS.ROCKS).entries()) {
            if (!rock[0]) continue;
            const size = rock[5],
                diameter = [32, 20, 12][size];
            const frame = ((Math.floor(rock[4] / (Math.PI / 4)) % 8) + 8) % 8;
            this.sprite(
                `rock-${size}-${i % 3}-${frame}`,
                rock[1] - diameter / 2,
                rock[2] - diameter / 2,
            );
        }
        if (scene[S.SPAWN_WARNING]) {
            const y = Math.round(scene[S.SPAWN_Y]);
            ctx.fillStyle = scene[S.PENDING_FAST] ? COLOUR.hot : COLOUR.amber;
            if (scene[S.PENDING_FAST])
                this.text('FAST', WIDTH - 8, Math.max(0, y - 14), COLOUR.hot, 1, 'right');
            for (let i = 0; i < 4; i++) ctx.fillRect(WIDTH - 2 - i, y - i, 1, i * 2 + 1);
        }
        if (scene[S.PICKUP_ACTIVE]) {
            glow(
                ctx,
                scene[S.PICKUP_X],
                scene[S.PICKUP_Y],
                11,
                scene[S.PICKUP_KIND] === 0 ? '239,185,99' : '110,240,255',
                0.45 + 0.15 * Math.sin(time / 180),
            );
            if (scene[S.PICKUP_KIND] === 2) {
                this.box(
                    Math.round(scene[S.PICKUP_X]) - 8,
                    Math.round(scene[S.PICKUP_Y]) - 7,
                    17,
                    15,
                    COLOUR.cyan,
                );
                this.text('2X', scene[S.PICKUP_X], scene[S.PICKUP_Y] - 3, COLOUR.cyan, 1, 'center');
            } else
                this.sprite(
                    scene[S.PICKUP_KIND] === 0 ? 'multishot' : 'shield',
                    scene[S.PICKUP_X] - 6,
                    scene[S.PICKUP_Y] - 6,
                );
        }
        if (scene[S.COLLECT_CUE_MS]) {
            const radius = 8 + Math.floor((400 - scene[S.COLLECT_CUE_MS]) / 80);
            this.box(
                Math.round(scene[S.COLLECT_X]) - radius,
                Math.round(scene[S.COLLECT_Y]) - radius,
                radius * 2 + 1,
                radius * 2 + 1,
                COLOUR.cyan,
            );
        }
        for (const [owner, playerScene] of (
            this.coopPlayers?.map((p) => p.scene) || [scene]
        ).entries()) {
            for (const bullet of records(playerScene, BLOCKS.BULLETS)) {
                if (!bullet[0]) continue;
                const length = Math.hypot(bullet[3], bullet[4]) || 1;
                const dx = bullet[3] / length,
                    dy = bullet[4] / length;
                for (let pixel = 0; pixel < 6; pixel++) {
                    ctx.fillStyle =
                        pixel < 2
                            ? COLOUR.ink
                            : this.coopPlayers
                              ? ['#70d9ed', '#efb963'][owner]
                              : playerScene[S.MULTISHOT_MS] > 0
                                ? COLOUR.cyan
                                : COLOUR.amber;
                    ctx.fillRect(
                        Math.round(bullet[1] - dx * pixel),
                        Math.round(bullet[2] - dy * pixel),
                        owner === 1 ? 1 : 2,
                        2,
                    );
                }
                const tint = this.coopPlayers
                    ? ['112,217,237', '239,185,99'][owner]
                    : playerScene[S.MULTISHOT_MS] > 0
                      ? '112,217,237'
                      : '239,185,99';
                glow(ctx, bullet[1], bullet[2], 6, tint, 0.55);
                // A bullet still inside the muzzle zone gets a brief flash.
                if (
                    playerScene[S.SHIP_ALIVE] &&
                    Math.hypot(
                        bullet[1] - playerScene[S.SHIP_X],
                        bullet[2] - playerScene[S.SHIP_Y],
                    ) < 22
                )
                    glow(ctx, bullet[1], bullet[2], 9, '255,222,160', 0.8);
            }
        }
        for (const particle of records(scene, BLOCKS.PARTICLES)) {
            if (!particle[0]) continue;
            ctx.fillStyle = particle[3] > 10 ? '#d8b890' : '#8a5a58';
            ctx.fillRect(Math.round(particle[1]), Math.round(particle[2]), 1, 1);
        }
        if (this.coopPlayers) {
            for (const player of this.coopPlayers) {
                this.playerOwner = player.id;
                this.playerColour = player.id === 0 ? COLOUR.cyan : COLOUR.amber;
                this.laser(player.scene);
                if (player.alive) this.ship(player.scene);
            }
            this.playerColour = null;
            this.playerOwner = null;
            this.playerMarkers();
        } else {
            this.laser(scene);
            if (scene[S.SHIP_ALIVE]) this.ship(scene);
        }
        for (const effect of this.effects) smallBlast(ctx, effect, time);
        if (this.finale) {
            // Each boss has its own death (boss-death.mjs); the plain blast is the fallback
            // while its art is still loading.
            if (!drawDeath(ctx, this.bossArt, this.finale, time, { reduced: this.reduced })) {
                const info = KINDS[this.finale.kind];
                bossBlast(ctx, this.finale, time, {
                    width: WIDTH,
                    height: HEIGHT,
                    reduced: this.reduced,
                    sprite: (name, x, y, scale) => this.sprite(name, x, y, scale),
                    chunks: this.bossArt.rubble(this.finale.kind),
                    scale: this.finale.mini
                        ? 0.6
                        : Math.max(1, Math.max(...(info?.size || [220])) / 200),
                });
            }
            this.finaleBanner(time);
        }
        if (!scene[S.PRACTICE] && scene[S.WAVE_CUE] && scene[S.STATE] === 2)
            this.text(`WAVE ${scene[S.WAVE]}`, WIDTH / 2, 14, COLOUR.muted, 1, 'center');
        if (this.cue && !scene[S.PRACTICE] && scene[S.STATE] !== 3) {
            this.context.globalAlpha = this.cue.alpha;
            this.text(this.cue.name.toUpperCase(), WIDTH / 2, 44, COLOUR.cyan, 1, 'center');
            this.context.globalAlpha = 1;
        }
    }
    finaleBanner(time) {
        const age = time - this.finale.time;
        const end = deathMs(this.finale.kind) - 200;
        if (age < 350 || age > end) return;
        const alpha = Math.min(1, (age - 350) / 250, (end - age) / 250);
        this.context.globalAlpha = alpha;
        const line = `${(KINDS[this.finale.kind]?.name || 'BOSS').toUpperCase()} DESTROYED`;
        this.text(line, WIDTH / 2 + 1, 191, '#1a0c2c', 2, 'center');
        this.text(line, WIDTH / 2, 190, '#ffe2aa', 2, 'center');
        this.context.globalAlpha = 1;
    }
    ray(x, y, dx, dy, length, colour, width = 1, step = 1) {
        const ctx = this.context;
        ctx.fillStyle = colour;
        const offset = Math.floor(width / 2);
        for (let distance = 0; distance < length; distance += step) {
            const px = Math.round(x + dx * distance),
                py = Math.round(y + dy * distance);
            if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) break;
            ctx.fillRect(px - offset, py - offset, width, width);
        }
    }
    laser(scene) {
        if (scene[S.CHARGING] && scene[S.SHIP_ALIVE]) {
            const progress = Math.min(1, scene[S.CHARGE_MS] / 1500);
            const x = scene[S.SHIP_X] + scene[S.AIM_X] * 13,
                y = scene[S.SHIP_Y] + scene[S.AIM_Y] * 13;
            this.ray(
                x,
                y,
                scene[S.AIM_X],
                scene[S.AIM_Y],
                560,
                progress > 0.8 ? this.playerColour || COLOUR.cyan : '#28536b',
                1,
                8,
            );
            this.box(Math.round(x) - 2, Math.round(y) - 2, 5, 5, this.playerColour || COLOUR.cyan);
            this.context.fillStyle = this.playerColour || COLOUR.cyan;
            this.context.fillRect(
                Math.round(scene[S.SHIP_X]) - 12,
                Math.min(HEIGHT - 3, Math.round(scene[S.SHIP_Y]) + 24),
                Math.ceil(24 * progress),
                2,
            );
        }
        if (scene[S.BEAM_MS]) {
            this.ray(
                scene[S.BEAM_X],
                scene[S.BEAM_Y],
                scene[S.BEAM_DX],
                scene[S.BEAM_DY],
                560,
                '#205d78',
                7,
            );
            this.ray(
                scene[S.BEAM_X],
                scene[S.BEAM_Y],
                scene[S.BEAM_DX],
                scene[S.BEAM_DY],
                560,
                this.playerColour || COLOUR.cyan,
                4,
            );
            this.ray(
                scene[S.BEAM_X],
                scene[S.BEAM_Y],
                scene[S.BEAM_DX],
                scene[S.BEAM_DY],
                560,
                COLOUR.ink,
                2,
                this.playerOwner === 1 ? 7 : 1,
            );
        }
    }
    ship(scene) {
        const ctx = this.context,
            x = Math.round(scene[S.SHIP_X]),
            y = Math.round(scene[S.SHIP_Y]);
        const time = scene[S.VISUAL_MS],
            dx = scene[S.AIM_X] || 0,
            dy = scene[S.AIM_Y] || 0;
        const direction = ((Math.round((Math.atan2(dy, dx) * 8) / Math.PI) % 16) + 16) % 16;
        if (scene[S.SHIELD]) {
            ctx.fillStyle = this.playerColour || COLOUR.cyan;
            for (let step = 0; step < 48; step++) {
                if (step % (this.playerOwner === 1 ? 6 : 12) === 0) continue;
                const angle = (step * Math.PI) / 24;
                ctx.fillRect(
                    x + Math.round(Math.cos(angle) * 15),
                    y + Math.round(Math.sin(angle) * 15),
                    1,
                    1,
                );
            }
        }
        const visible =
            !scene[S.INVINCIBLE_MS] || Math.floor(scene[S.INVINCIBLE_MS] / 100) % 2 !== 0;
        if (visible) {
            const flame = 3 + (Math.floor(time / 80) % 3);
            glow(ctx, x - dx * 15, y - dy * 15, 13, '255,130,60', 0.6);
            glow(ctx, x - dx * 12, y - dy * 12, 6, '120,220,255', 0.5);
            glow(ctx, x, y, 13, '90,200,255', 0.18);
            this.ray(x - dx * 11, y - dy * 11, -dx, -dy, flame + 4, '#9d502e', 3);
            this.ray(x - dx * 11, y - dy * 11, -dx, -dy, flame + 2, COLOUR.amber, 1);
            this.sprite(hullSprite(this.hulls[this.playerOwner ?? 0], direction), x - 16, y - 16);
        }
        if (scene[S.MULTISHOT_MS]) {
            ctx.fillStyle = this.playerColour || COLOUR.cyan;
            ctx.fillRect(x - 9, y + 20, Math.ceil((18 * scene[S.MULTISHOT_MS]) / 6000), 1);
        }
        // Ability state lives in the HUD strip; only a brief flash marks the laser coming back.
        if (!this.coopPlayers && this.readyUntil > scene[S.VISUAL_MS])
            this.text('LASER READY', WIDTH / 2, 28, this.playerColour || COLOUR.cyan, 1, 'center');
        // A small pixel reticle shows the last deliberate aim direction.
        const targetX = Math.round(x + dx * 38),
            targetY = Math.round(y + dy * 38);
        ctx.fillStyle = scene[S.PRECISION] ? this.playerColour || COLOUR.cyan : COLOUR.muted;
        ctx.fillRect(targetX - 3, targetY, 2, 1);
        ctx.fillRect(targetX + 2, targetY, 2, 1);
        ctx.fillRect(targetX, targetY - 3, 1, 2);
        ctx.fillRect(targetX, targetY + 2, 1, 2);
    }
    playerMarkers() {
        const [a, b] = this.coopPlayers;
        const close = Math.abs(a.x - b.x) < 45 && Math.abs(a.y - b.y) < 45;
        for (const player of this.coopPlayers) {
            if (!player.alive) continue;
            const colour = player.id === 0 ? COLOUR.cyan : COLOUR.amber;
            const x = Math.max(15, Math.min(WIDTH - 15, player.x));
            let y = player.y < 40 ? player.y + 25 : player.y - 24;
            if (close) y += player.id === 0 ? -7 : 7;
            y = Math.max(9, Math.min(HEIGHT - 10, y));
            this.context.fillStyle = '#080f19';
            this.context.fillRect(x - 13, y - 3, 27, 13);
            this.text(`P${player.id + 1}`, x, y, colour, 1, 'center');
            if (player.id === 0) {
                this.context.fillStyle = colour;
                this.context.fillRect(x - 13, y + 2, 1, 1);
                this.context.fillRect(x - 12, y + 1, 1, 3);
                this.context.fillRect(x - 11, y + 2, 1, 1);
            } else this.box(x - 13, y + 1, 4, 4, colour);
            // A matching hull accent stays visible when two sprites overlap.
            this.context.fillStyle = colour;
            this.context.fillRect(player.x - 2, player.y - 2, 4, 4);
        }
    }
    overlay(title, subtitle, scene) {
        const ctx = this.context;
        ctx.fillStyle = '#080f19e8';
        ctx.fillRect(78, 77, 324, 112);
        this.text(title, WIDTH / 2, 99, COLOUR.ink, 2, 'center');
        this.text(subtitle, WIDTH / 2, 137, COLOUR.muted, 1, 'center');
        if (scene[S.STATE] === 3)
            this.text('OPTIONS / ESC TO RESUME', WIDTH / 2, 159, COLOUR.cyan, 1, 'center');
    }
    menu(scene) {
        this.sprite('ship', WIDTH / 2 - 12, 53, 1);
        this.text('ASTEROIDS', WIDTH / 2, 91, COLOUR.ink, 3, 'center');
        this.text('PRESS FIRE TO START', WIDTH / 2, 139, COLOUR.cyan, 1, 'center');
        const [top] = leaderboardEntries(scene);
        const leader = top ? `${top.initials}  ${top.score}` : '---  0';
        this.text(`BEST  ${leader}`, WIDTH / 2, 169, COLOUR.muted, 1, 'center');
        this.text('MOVE  /  SHOOT  /  SURVIVE', WIDTH / 2, 223, COLOUR.muted, 1, 'center');
    }
    summary(scene) {
        this.text(
            scene[S.STATE] === 5 ? 'TOP FIVE!' : 'GAME OVER',
            WIDTH / 2,
            29,
            COLOUR.ink,
            2,
            'center',
        );
        this.text(
            `SCORE ${scene[S.FINAL_SCORE]}${scene[S.FINAL_SCORE] > scene[S.RUN_PRIOR_BEST] ? ' / NEW BEST' : ''}`,
            WIDTH / 2,
            54,
            COLOUR.amber,
            1,
            'center',
        );
        this.text(
            `WAVE ${scene[S.WAVE]} / ${Math.floor(scene[S.GAME_MS] / 1000)}s / ${scene[S.RUN_DESTROYED]} KILLS / x${scene[S.RUN_BEST_MULTIPLIER]}`,
            WIDTH / 2,
            70,
            COLOUR.muted,
            1,
            'center',
        );
        if (scene[S.STATE] === 5) {
            const letters = enteredInitials(scene);
            this.text(letters, WIDTH / 2, 96, COLOUR.ink, 3, 'center');
            const x = WIDTH / 2 - 27 + scene[S.SELECTED_INITIAL] * 18;
            this.context.fillStyle = COLOUR.cyan;
            this.context.fillRect(x, 122, 15, 2);
            this.text(
                'UP/DOWN: LETTER   LEFT/RIGHT: SLOT',
                WIDTH / 2,
                151,
                COLOUR.muted,
                1,
                'center',
            );
            this.text(
                scene[S.SAVE_FAILED] ? 'SAVE FAILED - PRESS FIRE TO RETRY' : 'PRESS FIRE TO SAVE',
                WIDTH / 2,
                181,
                scene[S.SAVE_FAILED] ? COLOUR.hot : COLOUR.cyan,
                1,
                'center',
            );
        } else {
            const board = leaderboardEntries(scene);
            for (let i = 0; i < 5; i++) {
                const initials = board[i] ? board[i].initials : '---';
                const score = board[i] ? String(board[i].score).padStart(6, ' ') : '     -';
                this.text(
                    `${i + 1}  ${initials}   ${score}`,
                    WIDTH / 2,
                    92 + i * 20,
                    i === scene[S.SAVED_RANK] ? COLOUR.cyan : COLOUR.muted,
                    1,
                    'center',
                );
            }
            this.text(
                'RELEASE FIRE, THEN PRESS TO RETRY',
                WIDTH / 2,
                219,
                COLOUR.cyan,
                1,
                'center',
            );
        }
    }
    render(scene, players = null) {
        this.coopPlayers = players;
        this.observe(scene);
        this.bossArt.prepare(scene[S.WAVE]);
        this.scenery(scene);
        if (scene[S.STATE] === 0) this.menu(scene);
        else if (scene[S.STATE] === 5 || scene[S.STATE] === 6) this.summary(scene);
        else {
            if (scene[S.STATE] !== 1) {
                this.context.save();
                const offset =
                    scene[S.SHAKE_OFFSET] > 31 ? scene[S.SHAKE_OFFSET] - 64 : scene[S.SHAKE_OFFSET];
                if (scene[S.STATE] !== 3)
                    this.context.translate(0, Math.round(offset * this.shake * 2));
                if (scene[S.STATE] !== 3 && this.finale && !this.reduced) {
                    const kick = bossShake(scene[S.VISUAL_MS], this.finale) * 5 * this.shake * 2;
                    this.context.translate(
                        Math.round(Math.sin(scene[S.VISUAL_MS] * 0.09) * kick),
                        Math.round(Math.cos(scene[S.VISUAL_MS] * 0.11) * kick),
                    );
                }
                this.world(scene);
                this.context.restore();
            }
            if (scene[S.STATE] === 1) {
                const count = 3 - Math.floor(scene[S.STATE_AGE_MS] / 500);
                this.text(count > 0 ? count : 'GO', WIDTH / 2, 111, COLOUR.ink, 4, 'center');
            }
            // Pause is drawn by the DOM pause menu over a scrim; the canvas stays clean.
        }
    }
    comparison() {
        this.background(0);
        this.text('FLIGHT ASSETS', 16, 15, COLOUR.ink, 2);
        this.text('NATIVE PIXELS / 480 X 270', 16, 39, COLOUR.muted);
        const xs = [44, 136, 220, 296, 366, 430];
        const names = ['ship', 'rock-0-0-0', 'rock-1-1-0', 'rock-2-2-0', 'multishot', 'shield'];
        const labels = ['24X16', '32X32', '20X20', '12X12', '12X12', '12X12'];
        names.forEach((name, i) => {
            const { w, h } = this.art.sprites[name];
            this.sprite(name, xs[i] - w / 2, 96 - h / 2);
            this.text(labels[i], xs[i], 125, COLOUR.muted, 1, 'center');
        });
        this.text('SHIP / ROCKS / MULTISHOT / SHIELD', 16, 164, COLOUR.muted);
        for (let frame = 0; frame < 8; frame++)
            this.sprite(`explosion-${frame}`, 17 + frame * 55, 190);
        this.text('EXPLOSION  /  8 FRAMES, 320 MS', 16, 239, COLOUR.muted);
    }
}
