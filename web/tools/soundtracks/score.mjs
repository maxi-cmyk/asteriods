// Compiles a track description into a flat, time-ordered list of note and drum events.
// Original chiptune scores only: nothing here is sampled or taken from another work.
//
// A track is a few 8-bar phrases that loop. Each bar is written in scale degrees
// (1-7, `^` an octave up, `_` an octave down, `#`/`b` a semitone) so the same riff can be
// moved between keys and modes. A bar holds 4, 8 or 16 tokens that divide it evenly;
// `.` is a rest and `-` holds the previous note.
export const STEPS_PER_BAR = 16;
export const BARS_PER_PHRASE = 8;

export const SCALES = Object.freeze({
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
});

// Per-voice sound design. `bus: 'echo'` sends the voice through the track's echo.
export const VOICES = Object.freeze({
    lead: { wave: 'square', vol: 0.22, a: 0.006, d: 0.3, s: 0.6, r: 0.05, vib: true, pan: 0, echo: 1 },
    harm: { wave: 'pulse25', vol: 0.12, a: 0.006, d: 0.3, s: 0.5, r: 0.05, pan: 0.4, echo: 1 },
    arp: { wave: 'pulse25', vol: 0.085, a: 0.003, d: 0.13, s: 0, r: 0.02, pan: -0.4, echo: 1 },
    pad: { wave: 'triangle', vol: 0.1, a: 0.3, d: 0.5, s: 0.8, r: 0.4, pair: 6, pan: 0, echo: 0.3 },
    bass: { wave: 'triangle', vol: 0.34, a: 0.004, d: 0.2, s: 0.7, r: 0.03, pan: 0, echo: 0 },
    kick: { vol: 0.5, pan: 0 },
    snare: { vol: 0.24, pan: 0.1 },
    hat: { vol: 0.07, pan: 0.3 },
    open: { vol: 0.08, pan: 0.3 },
});

const DRUMS = Object.freeze({
    soft: { k: 'x.......x.......', s: '................', h: 'x.x.x.x.x.x.x.x.' },
    half: { k: 'x.......x.x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.xx' },
    four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    drive: { k: 'x..xx..xx..xx.x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
    march: { k: 'x.......x.x.....', s: '....x..x....x.xx', h: 'x.x.x.x.x.x.x.x.' },
    forge: { k: 'x.x.x...x.x.x...', s: '....x.......x..x', h: '..x...x...x...xo' },
});

const BASS = Object.freeze({
    pulse: 'r...r...r...r...',
    half: 'r-------f-------',
    eighths: 'r.r.r.r.r.r.r.r.',
    drive: 'r.rrr.rrr.rrr.rr',
    gallop: 'r.rrr.rrr.rrr.rr',
    walk: 'r...f...r...t.f.',
    octave: 'r.o.r.o.r.o.r.o.',
    offbeat: '..r...r...r...r.',
});

const ARPS = Object.freeze({
    up8: '0.1.2.3.4.3.2.1.',
    up16: '0123432101234321',
    down16: '4321012343210123',
    bell: '4..2..5.4..2..3.',
    ping: '0.2.4.2.0.2.4.5.',
    sync: '0.2.1.2.0.21.2.4',
});

const hex = (c) => (c === '.' ? null : Number.parseInt(c, 36));

function parseDegree(token, scale, tonic) {
    const m = /^([\^_]*)([1-7])([b#]*)$/.exec(token);
    if (!m) throw new Error(`bad degree "${token}"`);
    const octave = [...m[1]].reduce((n, c) => n + (c === '^' ? 1 : -1), 0);
    const acc = [...m[3]].reduce((n, c) => n + (c === '#' ? 1 : -1), 0);
    return { degree: Number(m[2]), octave, acc, midi: tonic + scale[m[2] - 1] + 12 * octave + acc };
}

// A diatonic shift (a third above or below) used for the harmony voice.
function shifted(token, by, scale, tonic) {
    const p = parseDegree(token, scale, tonic);
    const index = p.degree - 1 + by;
    const octave = p.octave + Math.floor(index / 7);
    return tonic + scale[((index % 7) + 7) % 7] + 12 * octave + p.acc;
}

export function parseBar(bar, label = 'bar') {
    const tokens = bar.trim().split(/\s+/);
    if (16 % tokens.length) throw new Error(`${label}: ${tokens.length} tokens do not fit a bar`);
    const per = 16 / tokens.length;
    return tokens.map((token, i) => ({ token, step: i * per, len: per }));
}

export function chordOffsets(scale, spec) {
    const m = /^([1-7])([Mmsdp+]*)$/.exec(spec);
    if (!m) throw new Error(`bad chord "${spec}"`);
    const i = m[1] - 1;
    const at = (n) => scale[(i + n) % 7] + (i + n >= 7 ? 12 : 0);
    let [root, third, fifth] = [at(0), at(2), at(4)];
    for (const flag of m[2]) {
        if (flag === 'M') third = root + 4;
        if (flag === 'm') third = root + 3;
        if (flag === 's') third = root + 5;
        if (flag === 'd') [third, fifth] = [root + 3, root + 6];
        if (flag === 'p') [third, fifth] = [root + 7, root + 12];
    }
    const tones = [root, third, fifth, root + 12, third + 12, fifth + 12, root + 24];
    if (m[2].includes('+')) tones[3] = at(6);
    return tones;
}

const LAYERS = Object.freeze({
    drums: ['kick', 'snare', 'hat'],
    beat: ['kick', 'hat'],
});
const layerSet = (text) =>
    new Set(text.split(/[\s,]+/).flatMap((name) => LAYERS[name] ?? [name]));

export function voiceConfig(track, voice) {
    const base = VOICES[voice];
    const over = track.voices?.[voice] ?? {};
    return { ...base, ...over, vol: base.vol * (over.gain ?? 1) };
}

export function compileTrack(track) {
    const scale = SCALES[track.scale];
    if (!scale) throw new Error(`${track.id}: unknown scale ${track.scale}`);
    const stepSec = 60 / track.bpm / 4;
    const drums = DRUMS[track.drums] ?? DRUMS.four;
    const events = [];
    const add = (event) => events.push(event);
    track.form.forEach((section, phrase) => {
        const layers = layerSet(section.layers);
        const melody = track.melody[section.mel];
        const prog = track.prog[section.prog ?? 'a'];
        for (let b = 0; b < BARS_PER_PHRASE; b++) {
            const bar = phrase * BARS_PER_PHRASE + b;
            const base = bar * STEPS_PER_BAR;
            const label = `${track.id} phrase ${phrase + 1} bar ${b + 1}`;
            const tones = chordOffsets(scale, prog[b]);
            const barText = melody[b] ?? track.melody.a[b];
            const notes = parseBar(barText, label);
            const art = track.art ?? 0.92;
            // The lead and its harmony: a rest or `-` ends/extends the previous note.
            const line = [];
            for (const { token, step, len } of notes) {
                if (token === '-') {
                    if (line.at(-1)) line.at(-1).len += len;
                } else if (token === '.') line.push(null);
                else line.push({ token, step, len });
            }
            for (const note of line.filter(Boolean)) {
                const common = { step: base + note.step, len: note.len * art };
                if (layers.has('lead'))
                    add({
                        ...common,
                        v: 'lead',
                        midi: parseDegree(note.token, scale, track.tonic).midi,
                    });
                if (layers.has('harm'))
                    add({
                        ...common,
                        v: 'harm',
                        midi: shifted(note.token, track.harm ?? -2, scale, track.tonic),
                    });
            }
            if (layers.has('pad'))
                for (const t of tones.slice(0, 3))
                    add({
                        step: base,
                        len: STEPS_PER_BAR,
                        v: 'pad',
                        midi: track.tonic - 12 + t,
                    });
            if (layers.has('arp')) {
                const pattern = ARPS[track.arp] ?? ARPS.up8;
                for (let s = 0; s < 16; s++) {
                    const idx = hex(pattern[s]);
                    if (idx !== null)
                        add({
                            step: base + s,
                            len: track.arpLen ?? 1.5,
                            v: 'arp',
                            midi: track.tonic - 12 + (track.arpLift ?? 0) + tones[idx],
                        });
                }
            }
            if (layers.has('bass')) {
                const pattern = BASS[track.bass] ?? BASS.pulse;
                let last = null;
                for (let s = 0; s < 16; s++) {
                    const c = pattern[s];
                    if (c === '.') continue;
                    if (c === '-') {
                        if (last) last.len += 1;
                        continue;
                    }
                    const offset = { r: tones[0], o: tones[3], f: tones[2], t: tones[1] }[c];
                    last = {
                        step: base + s,
                        len: 1.8,
                        v: 'bass',
                        midi: track.tonic - 24 + offset,
                    };
                    add(last);
                }
            }
            for (let s = 0; s < 16; s++) {
                const fill = b === BARS_PER_PHRASE - 1 && s >= 12;
                if (layers.has('kick') && drums.k[s] === 'x' && !fill)
                    add({ step: base + s, v: 'kick', vol: s === 0 ? 1 : 0.85 });
                if (layers.has('snare') && (drums.s[s] === 'x' || fill))
                    add({ step: base + s, v: 'snare', vol: fill ? 0.6 + (s - 12) * 0.12 : 1 });
                if (layers.has('hat') && !fill && drums.h[s] !== '.')
                    add({
                        step: base + s,
                        v: drums.h[s] === 'o' ? 'open' : 'hat',
                        vol: s % 4 === 2 ? 1 : 0.6,
                    });
            }
        }
    });
    events.sort((a, b) => a.step - b.step);
    const steps = track.form.length * BARS_PER_PHRASE * STEPS_PER_BAR;
    return {
        id: track.id,
        bpm: track.bpm,
        stepSec,
        steps,
        seconds: steps * stepSec,
        echo: track.echo ?? null,
        events,
    };
}
