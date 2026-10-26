// Boss attack gallery: runs every attack in the real engine (boss practice, starting
// in the attack's phase), photographs it with the real renderer, and plays its sounds.
// `window.exportSheets(url)` composes the whole guide into PNG sheets and posts them.
import { PixelRenderer, loadArt } from './renderer.mjs';
import { createRuntime } from './runtime.mjs';
import { GUIDE } from './boss-guide.mjs';
import { KINDS, bossState } from './boss-scene.mjs';
import { deathMs } from './boss-death.mjs';
import { BossSound } from './boss-sound.mjs';

const status = document.getElementById('status');
const root = document.getElementById('bosses');
const art = await loadArt();
const bytes = await (await fetch('./game.wasm')).arrayBuffer();
const WARN = {
    1: 0.9,
    2: 0.7,
    3: 0.6,
    4: 0.9,
    10: 0.7,
    11: 0.9,
    12: 0.5,
    13: 1.2,
    20: 1.2,
    21: 0.9,
    22: 0.6,
    23: 1,
    30: 0.5,
    31: 0.6,
    32: 0.4,
    33: 0.8,
    40: 0.6,
    41: 0.9,
    42: 0.3,
    43: 0.7,
    50: 0.7,
    51: 0.5,
    52: 0.9,
    53: 1.2,
    60: 0.5,
    61: 0.5,
    62: 0.5,
    63: 0.7,
    64: 0.6,
};

// Plays through the gallery's own AudioContext, created on the first click.
let context = null,
    bossSound = null;
function sound() {
    if (!bossSound) {
        context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0.8;
        master.connect(context.destination);
        bossSound = new BossSound({
            context,
            master,
            settings: { soundEnabled: true },
            suspended: false,
        });
    }
    context.resume();
    return bossSound;
}
const playAttack = (kind, entry, part) => {
    const s = sound();
    if (part === 'charge') s.play(kind, 'charge', entry.id, { seconds: WARN[entry.id] ?? 0.8 });
    else s.play(kind, entry.release[0], entry.release[1]);
};

async function photograph(kind, entry) {
    let seed = 4000 + kind * 17 + entry.id;
    const game = await createRuntime(bytes, {
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    });
    game.start(true);
    game.bossPractice(kind, 0, entry.phase);
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const renderer = new PixelRenderer(canvas, art);
    renderer.reduced = true;
    await Promise.all([renderer.bossArt.load(KINDS[kind].region), renderer.bossArt.load('shots')]);
    for (let tick = 0; tick < 14000; tick++) {
        const scene = game.scene();
        // Walk the ship to a readable spot, then hold still.
        game.step({
            x: scene[4] < 110 ? 2048 + 1500 : 2048,
            y: scene[5] < 145 ? 2048 + 1200 : scene[5] > 155 ? 2048 - 1200 : 2048,
            aimX: 1,
            aimY: 0,
        });
        const b = bossState(game.scene());
        if (b.attack === entry.id && b.attackMs >= entry.at && b.stage >= entry.phase) {
            renderer.render(game.scene());
            return canvas;
        }
    }
    renderer.render(game.scene());
    return canvas;
}

const tileCanvases = new Map();
const defeatPlayers = new Map();

// The last frame a boss is alive, taken from a real fight, so its death can replay.
async function lastBreath(kind) {
    let seed = 7000 + kind;
    const game = await createRuntime(bytes, {
        random: () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0),
    });
    game.start(true);
    game.bossPractice(kind, 0, 1);
    for (let i = 0; i < 400; i++) game.step({ x: 2048, y: 2048 });
    return new Float32Array(game.scene());
}
// A canvas that replays a boss's death on a loop, from a fresh renderer each time.
function defeatPlayer(kind, snapshot, art) {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    let renderer = null,
        start = 0,
        running = false;
    const reset = async () => {
        renderer = new PixelRenderer(canvas, art);
        renderer.reduced = false;
        await Promise.all([
            renderer.bossArt.load(KINDS[kind].region),
            renderer.bossArt.load('shots'),
        ]);
        const alive = new Float32Array(snapshot);
        alive[0] = 2;
        alive[37] = 0;
        alive[2] = 0;
        renderer.previous = alive;
        start = performance.now();
        sound().defeat(kind);
    };
    const frame = (now) => {
        if (!running) return;
        const time = now - start,
            dead = new Float32Array(snapshot);
        dead[0] = 2;
        dead[512] = 0;
        dead[37] = time + 1;
        dead[2] = time + 1;
        renderer.render(dead);
        if (time > deathMs(kind) + 900) {
            reset().then(() => requestAnimationFrame(frame));
            return;
        }
        requestAnimationFrame(frame);
    };
    canvas.addEventListener('click', async () => {
        if (running) {
            running = false;
            return;
        }
        running = true;
        await reset();
        requestAnimationFrame(frame);
    });
    return canvas;
}
async function build() {
    for (const boss of GUIDE) {
        const info = KINDS[boss.kind];
        const section = document.createElement('section');
        section.className = 'boss';
        section.innerHTML = `<h2>${info.name}<small>${info.mini ? 'mini-boss' : 'boss'}</small></h2><p class="mechanic"></p><div class="row"></div><div class="tiles"></div>`;
        section.querySelector('.mechanic').textContent = boss.mechanic;
        const row = section.querySelector('.row');
        for (const [label, call] of [
            ['▶ Entrance', () => sound().sting(boss.kind)],
            ['▶ Defeated', () => sound().defeat(boss.kind)],
        ]) {
            const button = document.createElement('button');
            button.textContent = label;
            button.addEventListener('click', call);
            row.append(button);
        }
        root.append(section);
        const tiles = section.querySelector('.tiles');
        {
            const figure = document.createElement('figure'),
                caption = document.createElement('figcaption');
            const player = defeatPlayer(boss.kind, await lastBreath(boss.kind), art);
            caption.innerHTML =
                '<b>Defeat</b><span class="phase">click to play, click to stop</span><p class="what"></p>';
            caption.querySelector('.what').textContent = boss.death;
            figure.append(player, caption);
            tiles.append(figure);
            defeatPlayers.set(boss.kind, player);
        }
        for (const entry of boss.attacks) {
            status.textContent = `Photographing ${info.name} · ${entry.name}…`;
            const canvas = await photograph(boss.kind, entry);
            tileCanvases.set(`${boss.kind}:${entry.id}`, canvas);
            const figure = document.createElement('figure');
            const caption = document.createElement('figcaption');
            caption.innerHTML =
                '<b></b><span class="phase"></span><p class="tell"></p><p class="what"></p><p class="counter"></p><div class="row"></div>';
            caption.querySelector('b').textContent = entry.name;
            caption.querySelector('.phase').textContent = info.mini
                ? ''
                : `from phase ${entry.phase}`;
            caption.querySelector('.tell').textContent = `Warning · ${entry.tell}`;
            caption.querySelector('.what').textContent = entry.text;
            caption.querySelector('.counter').textContent = `Answer · ${entry.counter}`;
            for (const [label, part] of [
                ['▶ Charge', 'charge'],
                ['▶ Release', 'release'],
            ]) {
                const button = document.createElement('button');
                button.textContent = label;
                button.addEventListener('click', () => {
                    playAttack(boss.kind, entry, part);
                });
                caption.querySelector('.row').append(button);
            }
            figure.append(canvas, caption);
            tiles.append(figure);
        }
    }
    status.textContent = `${GUIDE.reduce((n, b) => n + b.attacks.length, 0)} attacks photographed from the live engine.`;
}
await build();

// ---- sheets for sharing: wrap text and lay tiles out on one big canvas
function wrap(ctx, text, width) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > width && line) {
            lines.push(line);
            line = word;
        } else line = next;
    }
    if (line) lines.push(line);
    return lines;
}
function sheet(bosses, title) {
    const W = 480,
        CAP = 118,
        GAP = 14,
        COLS = 4,
        HEAD = 70;
    const rows = bosses.map((b) => Math.ceil(b.attacks.length / COLS));
    const height = 56 + bosses.reduce((h, b, i) => h + HEAD + rows[i] * (270 + CAP + GAP), 0) + 10;
    const canvas = document.createElement('canvas');
    canvas.width = COLS * (W + GAP) + GAP;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0518';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffc88a';
    ctx.font = '40px "Jersey 10"';
    ctx.fillText(title, GAP, 40);
    let y = 56;
    bosses.forEach((boss, bi) => {
        const info = KINDS[boss.kind];
        ctx.fillStyle = '#33447f';
        ctx.fillRect(GAP, y, canvas.width - GAP * 2, 2);
        ctx.fillStyle = '#ffe9c4';
        ctx.font = '34px "Jersey 10"';
        ctx.fillText(info.name.toUpperCase(), GAP, y + 34);
        ctx.fillStyle = '#ffc88a';
        ctx.font = '15px "Pixelify Sans"';
        wrap(ctx, boss.mechanic, canvas.width - GAP * 2)
            .slice(0, 2)
            .forEach((l, i) => ctx.fillText(l, GAP, y + 54 + i * 17));
        y += HEAD;
        boss.attacks.forEach((entry, i) => {
            const x = GAP + (i % COLS) * (W + GAP),
                top = y + Math.floor(i / COLS) * (270 + CAP + GAP);
            ctx.drawImage(tileCanvases.get(`${boss.kind}:${entry.id}`), x, top);
            ctx.fillStyle = '#0f1830';
            ctx.fillRect(x, top + 270, W, CAP);
            ctx.strokeStyle = '#33447f';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, top + 1, W - 2, 270 + CAP - 2);
            ctx.fillStyle = '#ffe9c4';
            ctx.font = '26px "Jersey 10"';
            ctx.fillText(entry.name.toUpperCase(), x + 10, top + 270 + 24);
            if (!info.mini) {
                ctx.fillStyle = '#be96e6';
                ctx.font = '15px "Jersey 10"';
                ctx.fillText(`FROM PHASE ${entry.phase}`, x + W - 110, top + 270 + 22);
            }
            ctx.font = '13px "Pixelify Sans"';
            let ly = top + 270 + 42;
            for (const [colour, text] of [
                ['#ff9a7a', `Warning · ${entry.tell}`],
                ['#eef2ff', entry.text],
                ['#9ef0b8', `Answer · ${entry.counter}`],
            ]) {
                ctx.fillStyle = colour;
                for (const line of wrap(ctx, text, W - 20).slice(0, 2)) {
                    ctx.fillText(line, x + 10, ly);
                    ly += 15;
                }
            }
        });
        y += rows[bi] * (270 + CAP + GAP);
    });
    return canvas;
}
window.exportSheets = async (url) => {
    await document.fonts.load('26px "Jersey 10"');
    await document.fonts.load('13px "Pixelify Sans"');
    const out = [];
    for (const [name, subset, title] of [
        ['bosses', GUIDE.filter((b) => b.kind < 6), 'BOSS ATTACKS'],
        ['minibosses', GUIDE.filter((b) => b.kind >= 6), 'MINI-BOSS ATTACKS'],
    ]) {
        const blob = await new Promise((resolve) =>
            sheet(subset, title).toBlob(resolve, 'image/png'),
        );
        const response = await fetch(`${url}/save?name=${name}`, { method: 'POST', body: blob });
        out.push(`${name}: ${response.status} ${blob.size}`);
    }
    return out.join(' · ');
};

// A filmstrip of every defeat, one row per boss, for review.
window.exportDeaths = async (url) => {
    const ages = [0.08, 0.2, 0.35, 0.5, 0.65, 0.85];
    const out = document.createElement('canvas');
    out.width = ages.length * 320;
    out.height = KINDS.length * 180;
    const octx = out.getContext('2d');
    for (const kind of KINDS.keys()) {
        const snapshot = await lastBreath(kind),
            canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        for (const [i, fraction] of ages.entries()) {
            const renderer = new PixelRenderer(canvas, art);
            renderer.reduced = false;
            await Promise.all([
                renderer.bossArt.load(KINDS[kind].region),
                renderer.bossArt.load('shots'),
            ]);
            const alive = new Float32Array(snapshot);
            alive[0] = 2;
            alive[37] = 0;
            alive[2] = 0;
            renderer.previous = alive;
            const dead = new Float32Array(snapshot),
                time = fraction * deathMs(kind);
            dead[0] = 2;
            dead[512] = 0;
            dead[37] = 1;
            dead[2] = 1;
            renderer.render(dead); // the first dead frame starts the sequence
            dead[37] = time + 1;
            dead[2] = time + 1;
            renderer.render(dead);
            octx.drawImage(canvas, i * 320, kind * 180, 320, 180);
        }
    }
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    return (await fetch(`${url}/save?name=deaths`, { method: 'POST', body: blob })).status;
};
