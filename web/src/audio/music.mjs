// Plays the soundtrack files with crossfades. Tracks stream through <audio> elements (a three
// minute song is not decoded into memory) and every element is routed through its own gain node.
//
// A request names the tracks to play (see soundtrack.mjs). The player
//   - fades the first one in, and crossfades whenever the request changes (a new stage or boss);
//   - near the end of a track, crossfades into the next one in the request, or back into the
//     same one when it is the only track, so a stage that is not passed keeps looping;
//   - ends each track where the music audibly ends (`end` in the manifest), not at the file's
//     end, because supplied tracks finish with a second or two of silence.
// Fades are equal-power and advance only while playing, so pausing mid-fade resumes mid-fade.
export const FADE = Object.freeze({
    start: 0.6, // nothing was playing
    stage: 2, // the request changed: a new region or a boss
    stop: 1, // the request ended
    next: 4, // a playlist moves on
    loop: 0.5, // a single track returns to its start
});
// Seconds ahead of a transition that the next file starts loading.
const PREPARE = 8;

const equalPower = (level) => Math.sin((level * Math.PI) / 2);

function openElement(url) {
    const element = new Audio(url);
    element.preload = 'auto';
    return element;
}

export class MusicPlayer {
    // `manifest()` returns { tracks: { id: { file, end, gain } } }, or null until it has loaded.
    constructor(
        context,
        destination,
        { manifest, base = './assets/soundtracks/', open = openElement },
    ) {
        this.context = context;
        this.manifest = manifest;
        this.base = base;
        this.open = open;
        this.bus = context.createGain();
        this.bus.gain.value = 0;
        this.bus.connect(destination);
        this.voices = [];
        this.standby = null;
        this.key = null;
        this.queue = [];
        this.index = 0;
        this.last = null;
        this.paused = false;
        this.timer = null;
    }

    #voice(id) {
        const track = this.manifest()?.tracks[id];
        if (!track) return null;
        const element = this.open(this.base + track.file);
        const source = this.context.createMediaElementSource(element);
        const node = this.context.createGain();
        node.gain.value = 0;
        source.connect(node).connect(this.bus);
        return { id, track, element, source, node, level: 0, target: 0, rate: 1, chained: false };
    }

    // Loads the next file before its crossfade begins, so the fade never waits on the network.
    #prepare(id) {
        if (this.standby?.id === id) return;
        this.#discard(this.standby);
        this.standby = this.#voice(id);
    }

    #discard(voice) {
        if (!voice) return;
        voice.element.pause();
        voice.element.removeAttribute?.('src');
        voice.source.disconnect();
        voice.node.disconnect();
    }

    // Fades the playing tracks out and starts `id`. False when the manifest is not loaded yet.
    #start(id, seconds) {
        let voice = this.standby?.id === id ? this.standby : null;
        if (voice) this.standby = null;
        else voice = this.#voice(id);
        if (!voice) return false;
        for (const old of this.voices) {
            old.target = 0;
            old.rate = 1 / seconds;
            old.chained = true;
        }
        voice.target = 1;
        voice.rate = 1 / seconds;
        voice.element.play()?.catch?.(() => {});
        this.voices.push(voice);
        return true;
    }

    #fadeOutAll(seconds) {
        for (const voice of this.voices) {
            voice.target = 0;
            voice.rate = 1 / seconds;
        }
    }

    // Near the end of the newest track, move on to the next one in the request.
    #chain() {
        const head = this.voices.findLast((voice) => voice.target > 0);
        if (!head || head.chained) return;
        const next = this.queue[(this.index + 1) % this.queue.length];
        const seconds = this.queue.length > 1 ? FADE.next : FADE.loop;
        const left = head.track.end - head.element.currentTime;
        if (head.element.ended || left <= seconds) {
            if (this.#start(next, seconds)) this.index = (this.index + 1) % this.queue.length;
        } else if (left <= seconds + PREPARE) this.#prepare(next);
    }

    #advance(dt, now) {
        for (const voice of this.voices) {
            const step = voice.rate * dt;
            voice.level =
                voice.target > voice.level
                    ? Math.min(voice.target, voice.level + step)
                    : Math.max(voice.target, voice.level - step);
            const gain = voice.track.gain * equalPower(voice.level);
            // A voice holding steady (fully in or out) needs no new automation event.
            if (gain !== voice.applied) {
                voice.node.gain.setTargetAtTime(gain, now, 0.02);
                voice.applied = gain;
            }
        }
        this.voices = this.voices.filter((voice) => {
            const finished = voice.target === 0 && voice.level === 0;
            if (finished) this.#discard(voice);
            return !finished;
        });
    }

    #pause() {
        if (this.paused) return;
        this.paused = true;
        // Let the bus ramp to silence first so the cut does not click.
        this.timer = setTimeout(() => {
            this.timer = null;
            for (const voice of this.voices) voice.element.pause();
        }, 60);
    }

    #resume() {
        if (!this.paused) return;
        this.paused = false;
        this.last = null;
        clearTimeout(this.timer);
        this.timer = null;
        for (const voice of this.voices) voice.element.play()?.catch?.(() => {});
    }

    #clear() {
        for (const voice of this.voices) this.#discard(voice);
        this.#discard(this.standby);
        this.voices = [];
        this.standby = null;
        this.key = null;
    }

    update(request, enabled, volume, suspended) {
        const now = this.context.currentTime;
        const live = enabled && !suspended;
        const level = live ? volume : 0;
        if (level !== this.busLevel) {
            this.bus.gain.setTargetAtTime(level, now, 0.03);
            this.busLevel = level;
        }
        if (!live) {
            this.#pause();
            // Turning music off forgets the request; a pause or a hidden tab keeps its place.
            if (!enabled) this.#clear();
            return;
        }
        this.#resume();
        const dt = this.last === null ? 0 : Math.min(1, Math.max(0, now - this.last));
        this.last = now;
        if (!request) {
            this.key = null;
            this.#fadeOutAll(FADE.stop);
        } else if (request.key !== this.key) {
            const fade = this.voices.some((voice) => voice.target > 0) ? FADE.stage : FADE.start;
            if (this.#start(request.tracks[0], fade)) {
                this.key = request.key;
                this.queue = request.tracks;
                this.index = 0;
            }
        }
        if (this.key) this.#chain();
        this.#advance(dt, now);
    }
}
