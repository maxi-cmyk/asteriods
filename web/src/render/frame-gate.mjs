// The engine ticks at 50 Hz but the browser may refresh at 60-144 Hz. Between ticks the scene is
// byte-for-byte the same, and every layer is a pure function of the scene plus a few render
// settings, so those frames would repaint identical pixels. The gate remembers the last scene
// (and the settings that shape the picture) and says whether anything changed.
export class FrameGate {
    constructor() {
        this.scenes = []; // one copy per scene compared: the main one, then each co-op player
        this.key = null;
    }
    // Forces the next `changed` call to report true (a screen change, an engine restart).
    invalidate() {
        this.key = null;
    }
    // `scenes` are the Float32Arrays that decide the picture; `key` is a string of the render
    // settings. It stores what it saw, so call it once per frame it guards.
    changed(key, scenes) {
        let same = this.key === key && this.scenes.length === scenes.length;
        for (let i = 0; same && i < scenes.length; i++) {
            const scene = scenes[i],
                copy = this.scenes[i];
            if (copy.length !== scene.length) same = false;
            else
                for (let j = 0; j < scene.length; j++)
                    if (scene[j] !== copy[j]) {
                        same = false;
                        break;
                    }
        }
        if (same) return false;
        this.scenes = scenes.map((scene, i) => {
            const copy = this.scenes[i]?.length === scene.length ? this.scenes[i] : null;
            return copy ? (copy.set(scene), copy) : new Float32Array(scene);
        });
        this.key = key;
        return true;
    }
}
