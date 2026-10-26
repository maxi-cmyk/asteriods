// Shared sound shapes. Each takes the voice `v` (a Synth) and builds on its tone/noise.
export const arp = (v, notes, step, o = {}) =>
    notes.forEach((f, i) =>
        v.tone({
            f,
            at: i * step,
            dur: o.dur ?? step * 1.6,
            type: o.type ?? 'square',
            vol: o.vol ?? 0.07,
        }),
    );
export const boom = (v, size = 1, at = 0) => {
    v.tone({ f: 120 * size, to: 34, type: 'sine', at, dur: 0.5 * size + 0.2, vol: 0.26 });
    v.noise({ at, dur: 0.45 * size + 0.15, vol: 0.18, f: 1800, to: 120, type: 'lowpass' });
};
export const pop = (v, f = 700, at = 0, vol = 0.1) =>
    v.tone({ f, to: f * 2.4, type: 'sine', at, dur: 0.07, vol });
