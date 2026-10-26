// Renders the soundtrack to WAV files for auditioning outside the game.
//   node tools/soundtracks/render.mjs <out-dir> [track-id ...]
// The game plays the same compiled scores through Web Audio; this is a plain-JS mixdown of the same
// events (band-limited oscillators, a small echo), so the sound is close but not sample-identical.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileTrack, voiceConfig } from './score.mjs';
import { TRACKS } from './tracks.mjs';
import { launchSound } from './launch-sound.mjs';

const RATE = 44100;
const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);

// polyBLEP residual for a naive saw/pulse edge at phase t with step dt.
function blep(t, dt) {
    if (t < dt) {
        t /= dt;
        return t + t - t * t - 1;
    }
    if (t > 1 - dt) {
        t = (t - 1) / dt;
        return t * t + t + t + 1;
    }
    return 0;
}

function osc(wave, phase, dt) {
    switch (wave) {
        case 'sine':
            return Math.sin(2 * Math.PI * phase);
        case 'triangle':
            return 4 * Math.abs(phase - 0.5) - 1;
        case 'sawtooth':
            return 2 * phase - 1 - blep(phase, dt);
        default: {
            const duty = { square: 0.5, pulse25: 0.25, pulse125: 0.125 }[wave] ?? 0.5;
            let v = phase < duty ? 1 : -1;
            v += blep(phase, dt);
            v -= blep((phase - duty + 1) % 1, dt);
            return v;
        }
    }
}

class Mix {
    constructor(seconds, tail = 2) {
        this.n = Math.ceil((seconds + tail) * RATE);
        this.dry = [new Float32Array(this.n), new Float32Array(this.n)];
        this.wet = [new Float32Array(this.n), new Float32Array(this.n)];
    }
    put(i, value, pan, echo) {
        const l = Math.cos(((pan + 1) * Math.PI) / 4),
            r = Math.sin(((pan + 1) * Math.PI) / 4);
        this.dry[0][i] += value * l * 1.4142;
        this.dry[1][i] += value * r * 1.4142;
        if (echo) {
            this.wet[0][i] += value * l * echo;
            this.wet[1][i] += value * r * echo;
        }
    }
    // Ping-pong echo of the wet bus, added to the dry bus.
    applyEcho({ seconds, feedback, mix }) {
        const d = Math.round(seconds * RATE);
        const buf = [new Float32Array(this.n), new Float32Array(this.n)];
        for (let i = 0; i < this.n; i++) {
            for (let c = 0; c < 2; c++) {
                const back = i >= d ? buf[1 - c][i - d] : 0;
                buf[c][i] = this.wet[c][i] + back * feedback;
                this.dry[c][i] += buf[c][i] * mix;
            }
        }
    }
}

function envelope(t, dur, { a, d, s, r }) {
    if (t < 0) return 0;
    let g;
    if (t < a) g = t / a;
    else g = s + (1 - s) * Math.exp(-(t - a) / d);
    if (t > dur) g *= Math.max(0, 1 - (t - dur) / r);
    return g;
}

function note(mix, t0, dur, midi, cfg, gain = 1) {
    const pairs = cfg.pair ? [-cfg.pair, cfg.pair] : [0];
    const total = dur + cfg.r;
    const first = Math.floor(t0 * RATE);
    const count = Math.ceil(total * RATE);
    for (const cents of pairs) {
        const f = midiHz(midi) * 2 ** (cents / 1200);
        let phase = 0;
        for (let k = 0; k < count && first + k < mix.n; k++) {
            const t = k / RATE;
            const vib = cfg.vib ? Math.min(1, Math.max(0, (t - 0.12) / 0.2)) * 0.15 : 0;
            const hz = f * 2 ** ((vib * Math.sin(2 * Math.PI * 5.5 * t)) / 12);
            const dt = hz / RATE;
            phase = (phase + dt) % 1;
            const g = envelope(t, dur, cfg) * cfg.vol * gain * (pairs.length > 1 ? 0.5 : 1);
            mix.put(first + k, osc(cfg.wave, phase, dt) * g, cfg.pan, cfg.echo);
        }
    }
}

let seed = 12345;
const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
};

function drum(mix, t0, kind, vol) {
    const first = Math.floor(t0 * RATE);
    const cfg = voiceConfig({}, kind);
    const dur = { kick: 0.3, snare: 0.22, hat: 0.07, open: 0.3 }[kind];
    let phase = 0,
        prev = 0;
    for (let k = 0; k < dur * RATE && first + k < mix.n; k++) {
        const t = k / RATE;
        let v = 0;
        if (kind === 'kick') {
            phase += (45 + 130 * Math.exp(-t * 32)) / RATE;
            v = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 11) + (t < 0.004 ? noise() * 0.3 : 0);
        } else if (kind === 'snare') {
            phase += 190 / RATE;
            v = noise() * Math.exp(-t * 20) * 0.9 + Math.sin(2 * Math.PI * phase) * Math.exp(-t * 28) * 0.5;
        } else {
            const x = noise();
            v = (x - prev) * 0.5 * Math.exp(-t * (kind === 'open' ? 14 : 70));
            prev = x;
        }
        mix.put(first + k, v * cfg.vol * vol, cfg.pan, 0);
    }
}

// Biquad bandpass/lowpass whose cutoff glides exponentially from f to `to` over dur.
function filteredNoise(mix, n) {
    const first = Math.floor(n.at * RATE);
    const total = Math.floor((n.dur + 0.05) * RATE);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let k = 0; k < total && first + k < mix.n; k++) {
        const t = k / RATE;
        const f = n.f * (n.to / n.f) ** Math.min(1, t / n.dur);
        const w = (2 * Math.PI * f) / RATE,
            alpha = Math.sin(w) / (2 * n.q),
            cs = Math.cos(w);
        let b0, b1, b2;
        if (n.type === 'bandpass') [b0, b1, b2] = [alpha, 0, -alpha];
        else [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
        const a0 = 1 + alpha,
            a1 = -2 * cs,
            a2 = 1 - alpha;
        const x = noise();
        const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
        [x2, x1, y2, y1] = [x1, x, y1, y];
        mix.put(first + k, y * shape(t, n) * n.vol, 0, 0);
    }
}

// The Synth's envelopes: 'swell' builds to 92% of the note then drops; 'decay' hits and falls.
function shape(t, { dur, atk = 0.004, env = 'decay' }) {
    const floor = 0.0001;
    if (env === 'swell') {
        const peak = dur * 0.92;
        return t < peak ? floor * (1 / floor) ** (t / peak) : Math.max(0, 1 - (t - peak) / (dur - peak));
    }
    return t < atk ? t / atk : Math.exp((-(t - atk) * Math.log(1 / floor)) / (dur - atk));
}

function glideTone(mix, n) {
    const first = Math.floor(n.at * RATE);
    const total = Math.floor((n.dur + 0.05) * RATE);
    let phase = 0;
    for (let k = 0; k < total && first + k < mix.n; k++) {
        const t = k / RATE;
        const f = n.to ? n.f * (n.to / n.f) ** Math.min(1, t / n.dur) : n.f;
        const dt = f / RATE;
        phase = (phase + dt) % 1;
        mix.put(first + k, osc(n.type, phase, dt) * shape(t, n) * n.vol, 0, n.echo ?? 0);
    }
}

function finish(mix, { loopSeconds = 0, target = 0.16 } = {}) {
    // Loops are rendered twice so echoes and releases wrap; keep the second pass.
    const from = Math.round(loopSeconds * RATE);
    const length = loopSeconds ? from : mix.n;
    const out = [new Float32Array(length), new Float32Array(length)];
    for (let c = 0; c < 2; c++) for (let i = 0; i < length; i++) out[c][i] = mix.dry[c][i + from];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += out[0][i] ** 2 + out[1][i] ** 2;
    const gain = target / Math.sqrt(sum / (2 * length));
    let peak = 0;
    for (const ch of out)
        for (let i = 0; i < length; i++) {
            ch[i] = Math.tanh(ch[i] * gain * 1.1);
            peak = Math.max(peak, Math.abs(ch[i]));
        }
    return { out, peak };
}

export function wav(out) {
    const n = out[0].length;
    const buffer = Buffer.alloc(44 + n * 4);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + n * 4, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(RATE, 24);
    buffer.writeUInt32LE(RATE * 4, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++)
        for (let c = 0; c < 2; c++)
            buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[c][i])) * 32767 * 0.89), 44 + i * 4 + c * 2);
    return buffer;
}

export function renderTrack(id) {
    const track = TRACKS[id];
    const score = compileTrack(track);
    const mix = new Mix(score.seconds * 2);
    for (let pass = 0; pass < 2; pass++) {
        seed = 12345 + pass;
        for (const e of score.events) {
            const t0 = pass * score.seconds + e.step * score.stepSec;
            if (['kick', 'snare', 'hat', 'open'].includes(e.v)) drum(mix, t0, e.v, e.vol);
            else
                note(mix, t0, e.len * score.stepSec, e.midi, voiceConfig(track, e.v), 1);
        }
    }
    if (score.echo)
        mix.applyEcho({
            seconds: score.echo.beats * (60 / score.bpm),
            feedback: score.echo.feedback,
            mix: score.echo.mix,
        });
    return { ...finish(mix, { loopSeconds: score.seconds }), seconds: score.seconds };
}

export function renderLaunch() {
    const sound = launchSound();
    const mix = new Mix(sound.seconds);
    for (const t of sound.tones) glideTone(mix, t);
    for (const n of sound.noises) filteredNoise(mix, n);
    mix.applyEcho({
        seconds: sound.echo.beats * (60 / sound.echo.bpm),
        feedback: sound.echo.feedback,
        mix: sound.echo.mix,
    });
    return { ...finish(mix, { target: 0.12 }), seconds: sound.seconds };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [dir, ...ids] = process.argv.slice(2);
    if (!dir) throw new Error('usage: node tools/soundtracks/render.mjs <out-dir> [track-id ...]');
    mkdirSync(dir, { recursive: true });
    for (const id of ids.length ? ids : [...Object.keys(TRACKS), 'launch']) {
        const { out, peak, seconds } = id === 'launch' ? renderLaunch() : renderTrack(id);
        writeFileSync(join(dir, `${id}.wav`), wav(out));
        console.log(`${id.padEnd(18)} ${seconds.toFixed(1)}s peak ${peak.toFixed(2)}`);
    }
}
