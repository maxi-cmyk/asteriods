// The clock menu animation and the launch warp run on. It stops while the window is
// suspended and never jumps more than 100 ms in one frame.
export class PresentationClock {
    constructor() {
        this.time = 0;
        this.last = null;
    }
    tick(now, suspended) {
        const elapsed = this.last === null ? 0 : Math.min(100, now - this.last);
        this.last = now;
        if (!suspended) this.time += elapsed;
    }
    // After a pause the next frame must not count the gap.
    resync() {
        this.last = null;
    }
}
