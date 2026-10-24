import { ThemeMusic } from './music.mjs';
export class GameAudio {
    constructor(settings) {
        this.settings = settings;
        this.frequency = 0;
        this.previous = null;
        this.suspended = false;
    }
    unlock() {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!this.context) {
            this.context = new Audio();
            this.master = this.context.createGain();
            this.master.connect(this.context.destination);
            this.music = new ThemeMusic(this.context, this.context.destination);
            this.tone = this.context.createOscillator();
            this.tone.type = 'square';
            this.toneGain = this.context.createGain();
            this.toneGain.gain.value = 0;
            this.tone.connect(this.toneGain).connect(this.master);
            this.tone.start();
            this.charge = this.context.createOscillator();
            this.charge.type = 'sine';
            this.chargeGain = this.context.createGain();
            this.chargeGain.gain.value = 0;
            this.charge.connect(this.chargeGain).connect(this.master);
            this.charge.start();
        }
        this.context.resume().catch(() => {});
        this.apply();
    }
    apply() {
        if (!this.context) return;
        const now = this.context.currentTime;
        this.master.gain.setTargetAtTime(
            this.settings.soundEnabled && !this.suspended
                ? this.settings.volume
                : 0,
            now,
            0.015,
        );
        this.tone.frequency.setValueAtTime(Math.max(1, this.frequency), now);
        this.toneGain.gain.setValueAtTime(this.frequency > 0 ? 0.06 : 0, now);
    }
    setTone(value) {
        this.frequency = value;
        this.apply();
    }
    cue(kind) {
        if (!this.context || !this.settings.soundEnabled || this.suspended)
            return;
        const now = this.context.currentTime,
            osc = this.context.createOscillator(),
            gain = this.context.createGain();
        const discharge = kind === 'discharge';
        osc.type = discharge ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(discharge ? 1200 : 660, now);
        osc.frequency.exponentialRampToValueAtTime(
            discharge ? 60 : 1320,
            now + (discharge ? 0.28 : 0.16),
        );
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(discharge ? 0.16 : 0.09, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + (discharge ? 0.35 : 0.22),
        );
        osc.connect(gain).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.4);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }
    setMode(mode, suspended = false) {
        this.mode = mode;
        this.musicSuspended = suspended;
        this.music?.update(
            mode,
            this.settings.musicEnabled,
            this.settings.volume,
            suspended,
        );
    }
    startWarp() {
        if (!this.context || !this.settings.soundEnabled) return;
        this.stopWarp();
        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(65, now);
        oscillator.frequency.exponentialRampToValueAtTime(1800, now + 1.9);
        oscillator.frequency.exponentialRampToValueAtTime(90, now + 2.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(
            this.settings.volume * 0.12,
            now + 0.3,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.65);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start();
        oscillator.stop(now + 2.7);
        this.warp = { oscillator, gain };
        oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
        };
    }
    stopWarp() {
        if (!this.warp) return;
        const { oscillator, gain } = this.warp;
        gain.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
        try {
            oscillator.stop(this.context.currentTime + 0.05);
        } catch {}
        this.warp = null;
    }
    observe(scene) {
        const old = this.previous;
        if (this.context) {
            const charging = scene[47] && scene[0] === 2 && !this.suspended;
            this.charge.frequency.setTargetAtTime(
                180 + (scene[48] / 1500) * 900,
                this.context.currentTime,
                0.025,
            );
            this.chargeGain.gain.setTargetAtTime(
                charging ? 0.07 : 0,
                this.context.currentTime,
                0.025,
            );
        }
        if (old && scene[2] >= old[2] && scene[0] === 2) {
            if (scene[50] > old[50]) this.cue('discharge');
            if (old[49] > 0 && scene[49] === 0) this.cue('ready');
        }
        this.previous = new Float32Array(scene);
    }
    suspend(value) {
        if (value) this.stopWarp();
        this.suspended = value;
        this.apply();
        if (value && this.context)
            this.chargeGain.gain.setValueAtTime(0, this.context.currentTime);
    }
}
