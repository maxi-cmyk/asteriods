import { createRuntime } from '../runtime/runtime.mjs';

// A separate WASM instance: no player profile, persistent storage, or audio imports. The shell
// reads its scene to pick the soundtrack for the stage it is showing.
// Callers own the clock and must stop it whenever Home is hidden.
export async function createDemo(bytes, renderer) {
    const runtime = await createRuntime(bytes);
    let active = false;
    return {
        get active() {
            return active;
        },
        start() {
            runtime.abandon();
            runtime.api.web_demo();
            renderer?.gate.invalidate();
            active = true;
        },
        stop() {
            active = false;
            runtime.abandon();
        },
        step() {
            if (!active) return;
            runtime.step();
            if (runtime.state === 'menu') runtime.api.web_demo();
        },
        render() {
            if (active) renderer?.renderIfChanged(runtime.scene());
        },
        scene() {
            return runtime.scene();
        },
        snapshot() {
            return runtime.snapshot();
        },
    };
}
