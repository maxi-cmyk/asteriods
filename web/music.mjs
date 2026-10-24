// Original two-voice chiptunes: no streamed files, samples or third-party music.
// Compensate for the short, decaying note envelopes without changing SFX.
const MUSIC_GAIN = 1.2;

const THEMES = {
    home: {
        beat: 0.32,
        notes: [64, 71, 76, 71, 67, 74, 79, 74, 62, 69, 74, 69, 59, 66, 71, 66],
        bass: [40, 43, 38, 35],
    },
    flight: {
        beat: 0.18,
        notes: [64, 0, 67, 71, 76, 71, 67, 0, 62, 66, 69, 74, 71, 69, 66, 62],
        bass: [40, 40, 38, 35],
    },
};

export class ThemeMusic {
    constructor(context, destination) {
        this.context = context;
        this.bus = context.createGain();
        this.bus.gain.value = 0;
        this.bus.connect(destination);
        this.mode = 'off';
        this.step = 0;
        this.next = 0;
    }

    note(midi, time, duration, volume, type) {
        if (!midi) return;
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(volume, time + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        oscillator.connect(envelope).connect(this.bus);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.01);
        oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
        };
    }

    update(mode, enabled, volume, suspended) {
        const now = this.context.currentTime;
        if (mode !== this.mode || !enabled || suspended) {
            this.next = now + 0.03;
            this.step = 0;
        }
        this.mode = mode;
        const active = enabled && !suspended && !!THEMES[mode];
        this.bus.gain.setTargetAtTime(active ? volume * MUSIC_GAIN : 0, now, 0.025);
        if (!active) return;
        const theme = THEMES[mode];
        if (this.next < now) this.next = now + 0.01;
        // Small lookahead keeps scheduling bounded even after a background stall.
        while (this.next < now + 0.12) {
            this.note(
                theme.notes[this.step % theme.notes.length],
                this.next,
                theme.beat * 0.8,
                0.08,
                'square',
            );
            if (this.step % 4 === 0) {
                this.note(
                    theme.bass[Math.floor(this.step / 4) % 4],
                    this.next,
                    theme.beat * 3.5,
                    0.12,
                    'triangle',
                );
            }
            this.next += theme.beat;
            this.step++;
        }
    }
}
