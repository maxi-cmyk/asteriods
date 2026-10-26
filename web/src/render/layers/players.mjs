import { S } from '../../runtime/scene-layout.mjs';
import { hullSprite } from '../../state/hangar.mjs';
import { WIDTH, HEIGHT, COLOUR } from '../constants.mjs';
import { glow } from '../fx.mjs';

// Solo draws in the default colours; each co-op pilot has a colour and an owner index.
const SOLO = Object.freeze({ colour: null, owner: null });
const COOP = [
    { colour: COLOUR.cyan, owner: 0 },
    { colour: COLOUR.amber, owner: 1 },
];

// The ships, their charging laser and beam, and (co-op) the P1/P2 name tags.
export class PlayersLayer {
    draw(frame) {
        const { players, scene } = frame;
        if (players) {
            for (const player of players) {
                const style = COOP[player.id === 0 ? 0 : 1];
                this.laser(frame, player.scene, style);
                if (player.alive) this.ship(frame, player.scene, style);
            }
            this.markers(frame, players);
        } else {
            this.laser(frame, scene, SOLO);
            if (scene[S.SHIP_ALIVE]) this.ship(frame, scene, SOLO);
        }
    }
    laser({ px, ctx }, scene, style) {
        const colour = style.colour || COLOUR.cyan;
        if (scene[S.CHARGING] && scene[S.SHIP_ALIVE]) {
            const progress = Math.min(1, scene[S.CHARGE_MS] / 1500);
            const x = scene[S.SHIP_X] + scene[S.AIM_X] * 13,
                y = scene[S.SHIP_Y] + scene[S.AIM_Y] * 13;
            px.ray(
                x,
                y,
                scene[S.AIM_X],
                scene[S.AIM_Y],
                560,
                progress > 0.8 ? colour : '#28536b',
                1,
                8,
            );
            px.box(Math.round(x) - 2, Math.round(y) - 2, 5, 5, colour);
            ctx.fillStyle = colour;
            ctx.fillRect(
                Math.round(scene[S.SHIP_X]) - 12,
                Math.min(HEIGHT - 3, Math.round(scene[S.SHIP_Y]) + 24),
                Math.ceil(24 * progress),
                2,
            );
        }
        if (scene[S.BEAM_MS]) {
            const at = [scene[S.BEAM_X], scene[S.BEAM_Y], scene[S.BEAM_DX], scene[S.BEAM_DY]];
            px.ray(...at, 560, '#205d78', 7);
            px.ray(...at, 560, colour, 4);
            px.ray(...at, 560, COLOUR.ink, 2, style.owner === 1 ? 7 : 1);
        }
    }
    ship({ px, ctx, hulls, observer, players }, scene, style) {
        const x = Math.round(scene[S.SHIP_X]),
            y = Math.round(scene[S.SHIP_Y]);
        const colour = style.colour || COLOUR.cyan;
        const time = scene[S.VISUAL_MS],
            dx = scene[S.AIM_X] || 0,
            dy = scene[S.AIM_Y] || 0;
        const direction = ((Math.round((Math.atan2(dy, dx) * 8) / Math.PI) % 16) + 16) % 16;
        if (scene[S.SHIELD]) {
            ctx.fillStyle = colour;
            for (let step = 0; step < 48; step++) {
                if (step % (style.owner === 1 ? 6 : 12) === 0) continue;
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
            px.ray(x - dx * 11, y - dy * 11, -dx, -dy, flame + 4, '#9d502e', 3);
            px.ray(x - dx * 11, y - dy * 11, -dx, -dy, flame + 2, COLOUR.amber, 1);
            px.sprite(hullSprite(hulls[style.owner ?? 0], direction), x - 16, y - 16);
        }
        if (scene[S.MULTISHOT_MS]) {
            ctx.fillStyle = colour;
            ctx.fillRect(x - 9, y + 20, Math.ceil((18 * scene[S.MULTISHOT_MS]) / 6000), 1);
        }
        // Ability state lives in the HUD strip; only a brief flash marks the laser coming back.
        if (!players && observer.readyUntil > scene[S.VISUAL_MS])
            px.text('LASER READY', WIDTH / 2, 28, colour, 1, 'center');
        // A small pixel reticle shows the last deliberate aim direction.
        const targetX = Math.round(x + dx * 38),
            targetY = Math.round(y + dy * 38);
        ctx.fillStyle = scene[S.PRECISION] ? colour : COLOUR.muted;
        ctx.fillRect(targetX - 3, targetY, 2, 1);
        ctx.fillRect(targetX + 2, targetY, 2, 1);
        ctx.fillRect(targetX, targetY - 3, 1, 2);
        ctx.fillRect(targetX, targetY + 2, 1, 2);
    }
    markers({ px, ctx }, players) {
        const [a, b] = players;
        const close = Math.abs(a.x - b.x) < 45 && Math.abs(a.y - b.y) < 45;
        for (const player of players) {
            if (!player.alive) continue;
            const colour = player.id === 0 ? COLOUR.cyan : COLOUR.amber;
            const x = Math.max(15, Math.min(WIDTH - 15, player.x));
            let y = player.y < 40 ? player.y + 25 : player.y - 24;
            if (close) y += player.id === 0 ? -7 : 7;
            y = Math.max(9, Math.min(HEIGHT - 10, y));
            ctx.fillStyle = '#080f19';
            ctx.fillRect(x - 13, y - 3, 27, 13);
            px.text(`P${player.id + 1}`, x, y, colour, 1, 'center');
            if (player.id === 0) {
                ctx.fillStyle = colour;
                ctx.fillRect(x - 13, y + 2, 1, 1);
                ctx.fillRect(x - 12, y + 1, 1, 3);
                ctx.fillRect(x - 11, y + 2, 1, 1);
            } else px.box(x - 13, y + 1, 4, 4, colour);
            // A matching hull accent stays visible when two sprites overlap.
            ctx.fillStyle = colour;
            ctx.fillRect(player.x - 2, player.y - 2, 4, 4);
        }
    }
}
