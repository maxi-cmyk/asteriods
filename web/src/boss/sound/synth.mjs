const noiseBuffers = new WeakMap();
// One second of fixed white noise per audio context, shared by every noise burst.
function noiseBuffer(ctx) {
    let buffer = noiseBuffers.get(ctx);
    if (!buffer) {
        buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let seed = 12345;
        for (let i = 0; i < data.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            data[i] = seed / 2147483648 - 1;
        }
        noiseBuffers.set(ctx, buffer);
    }
    return buffer;
}

const FLOOR = 0.0001;

// A small synth: schedules tones and filtered noise relative to `t0` on a Web Audio context.
// `gain` scales every volume and `pitch` every frequency (mini-bosses use a higher voice).
export class Synth {
    constructor(ctx, dest, t0 = ctx.currentTime, { gain = 1, pitch = 1 } = {}) {
        this.ctx = ctx;
        this.dest = dest;
        this.t0 = t0;
        this.gain = gain;
        this.pitch = pitch;
    }
    // Shapes a gain parameter: 'decay' hits and falls, 'swell' builds to the end (charge-ups),
    // 'pulse' holds a level with soft edges (hums).
    #envelope(param, t, dur, vol, atk, env) {
        const peak = Math.max(0.0002, vol * this.gain);
        param.setValueAtTime(FLOOR, t);
        if (env === 'swell') {
            param.exponentialRampToValueAtTime(peak, t + dur * 0.92);
            param.exponentialRampToValueAtTime(FLOOR, t + dur);
        } else if (env === 'pulse') {
            param.exponentialRampToValueAtTime(peak, t + Math.min(0.06, dur * 0.2));
            param.setValueAtTime(peak, t + dur * 0.75);
            param.exponentialRampToValueAtTime(FLOOR, t + dur);
        } else {
            param.exponentialRampToValueAtTime(peak, t + atk);
            param.exponentialRampToValueAtTime(FLOOR, t + dur);
        }
    }
    // An oscillator gliding from `f` to `to`, optionally with vibrato { rate, depth }.
    tone({
        f,
        to = f,
        type = 'sine',
        at = 0,
        dur = 0.2,
        vol = 0.1,
        atk = 0.004,
        env = 'decay',
        vib = null,
        detune = 0,
        lin = false,
    }) {
        const { ctx, pitch } = this;
        const osc = ctx.createOscillator(),
            amp = ctx.createGain(),
            t = this.t0 + at;
        osc.type = type;
        osc.frequency.setValueAtTime(f * pitch, t);
        if (to !== f)
            osc.frequency[lin ? 'linearRampToValueAtTime' : 'exponentialRampToValueAtTime'](
                Math.max(1, to * pitch),
                t + dur,
            );
        osc.detune.value = detune;
        if (vib) {
            const lfo = ctx.createOscillator(),
                depth = ctx.createGain();
            lfo.frequency.value = vib.rate;
            depth.gain.value = vib.depth * pitch;
            lfo.connect(depth).connect(osc.frequency);
            lfo.start(t);
            lfo.stop(t + dur + 0.05);
        }
        this.#envelope(amp.gain, t, dur, vol, atk, env);
        osc.connect(amp).connect(this.dest);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        osc.onended = () => amp.disconnect();
    }
    // Filtered noise whose cutoff glides from `f` to `to`.
    noise({
        at = 0,
        dur = 0.2,
        vol = 0.1,
        f = 1000,
        to = f,
        q = 1,
        type = 'lowpass',
        atk = 0.004,
        env = 'decay',
    }) {
        const { ctx } = this;
        const src = ctx.createBufferSource(),
            filter = ctx.createBiquadFilter(),
            amp = ctx.createGain(),
            t = this.t0 + at;
        src.buffer = noiseBuffer(ctx);
        src.loop = true;
        filter.type = type;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(f, t);
        if (to !== f) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        this.#envelope(amp.gain, t, dur, vol, atk, env);
        src.connect(filter).connect(amp).connect(this.dest);
        src.start(t);
        src.stop(t + dur + 0.05);
        src.onended = () => amp.disconnect();
    }
}

export const voice = (ctx, dest, t0, options) => new Synth(ctx, dest, t0, options);
