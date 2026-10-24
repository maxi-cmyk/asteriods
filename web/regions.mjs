// Presentation-only travel through five-wave regions. The authoritative wave
// number picks the region; nothing here touches spawning, timing, or scoring.
export const WAVES_PER_REGION = 5;
export const CUE_MS = 2200;
export const REDUCED_MS = 200;

// `gesture` is the planned destination transition from nextSteps 4C.1; a
// gesture whose `ready` flag is false uses the shared crossfade at the same
// duration until it has been visually verified. `fallback` is the flat colour
// shown if a region's art cannot be built.
export const REGIONS = Object.freeze([
  { id:'frontier', name:'Celestial frontier', first:1, last:5, fallback:'#0a1226', enter:null },
  { id:'violet', name:'Violet orbit', first:6, last:10, fallback:'#150f2c', enter:{ gesture:'orbital-pass', ms:550, ready:true } },
  { id:'ember', name:'Ember orbit', first:11, last:15, fallback:'#2a1220', enter:{ gesture:'atmospheric-sweep', ms:600, ready:true } },
  { id:'ruins', name:'Ruined moon', first:16, last:20, fallback:'#101426', enter:{ gesture:'skyline-emergence', ms:650, ready:true } },
  { id:'lunar', name:'Lunar passage', first:21, last:25, fallback:'#0a1830', enter:{ gesture:'cloud-clearance', ms:500, ready:true } },
  { id:'rift', name:'Outer rift', first:26, last:Infinity, fallback:'#0b0716', enter:{ gesture:'ring-convergence', ms:650, ready:true } },
]);

export function regionIndexForWave(wave) {
  const number = Number.isFinite(wave) ? Math.floor(wave) : 1;
  return Math.min(REGIONS.length - 1, Math.max(0, Math.floor((number - 1) / WAVES_PER_REGION)));
}
export const regionForWave = wave => REGIONS[regionIndexForWave(wave)];

// Quick settle: hold, overlapping reveal, then rest. Returns 0..1.
export function envelope(t) {
  if (t <= .15) return 0;
  if (t >= .8) return 1;
  const x = (t - .15) / .65;
  return x * x * (3 - 2 * x);
}

// Follows the authoritative wave and schedules at most one transition per
// region boundary. `time` is the game's visual clock, which stands still while
// paused, so a frozen transition resumes with its remaining time.
export class RegionTimeline {
  constructor({ reduced = false } = {}) { this.reduced = reduced; this.reset(); }
  reset() { this.index = 0; this.transition = null; this.cueUntil = -1; this.seen = false; }
  // Menu, results, and practice show the calm opening scene.
  observe({ wave, time, run, practice = false }) {
    if (!run || practice) { this.reset(); return; }
    const target = regionIndexForWave(wave);
    if (!this.seen) { this.index = target; this.seen = true; this.cueUntil = time + CUE_MS; return; }
    if (target === this.index) return;
    // A later region than the next one, or a lower wave, snaps to the truth.
    if (target === this.index + 1 && !this.transition) {
      const enter = REGIONS[target].enter;
      const ms = this.reduced ? REDUCED_MS : enter.ms;
      const gesture = this.reduced || !enter.ready ? 'fade' : enter.gesture;
      this.transition = { from:this.index, to:target, start:time, ms, gesture };
    } else this.transition = null;
    this.index = target;
    this.cueUntil = time + CUE_MS;
  }
  progress(time) {
    const move = this.transition;
    if (!move) return null;
    const t = (time - move.start) / move.ms;
    if (t >= 1 || t < 0) { this.transition = null; return null; }
    return { ...move, t, e:envelope(t) };
  }
  cue(time) {
    const left = this.cueUntil - time;
    if (!this.seen || left <= 0) return null;
    return { name:REGIONS[this.index].name, alpha:Math.min(1, left / 400) };
  }
}
