import { createRuntime } from '../runtime/runtime.mjs';
import { S } from '../runtime/scene-layout.mjs';
import { Pilot } from './pilot.mjs';

const LIVES = 3;

// A separate WASM instance: no player profile, persistent storage, or audio imports. The shell
// reads its scene to pick the soundtrack for the stage it is showing. A pilot flies a real run
// (rocks, power-ups, the laser, every boss) from wave 1, and a new run begins whenever one ends,
// so the demo keeps playing until the shell stops it. Running out of lives is not the end: the
// pilot gets them back, so one demo flies through every region and boss without starting over.
// Callers own the clock and must stop it whenever Home is hidden.
export async function createDemo(bytes, renderer) {
    const runtime = await createRuntime(bytes);
    const { api } = runtime;
    let active = false,
        pilot = null;
    // One engine tick with the given inputs (a neutral stick and idle weapons by default).
    const tick = ({
        x = 2048,
        y = 2048,
        aimX = 0,
        aimY = 0,
        fire = false,
        firePressed = false,
        laser = false,
        shield = false,
    } = {}) => {
        api.web_fire_press(+firePressed);
        api.web_actions(aimX, aimY, +laser, 0, +shield);
        api.web_step(x, y, +fire, 0, 0);
    };
    // A fresh run from wave 1, with the longer boss warnings a first-time viewer would want.
    const begin = () => {
        runtime.abandon();
        api.web_boss_assist(1, 0);
        api.web_start(0);
        pilot = new Pilot(runtime);
        renderer?.gate.invalidate();
    };
    return {
        get active() {
            return active;
        },
        start() {
            begin();
            active = true;
        },
        stop() {
            active = false;
            pilot = null;
            runtime.abandon();
        },
        step() {
            if (!active) return;
            switch (runtime.state) {
                case 'playing':
                    tick(pilot.decide(runtime.scene()));
                    break;
                case 'death':
                    // The last life just went: take the run back instead of letting it end.
                    if (!runtime.scene()[S.LIVES]) api.web_demo_lives(LIVES);
                    tick();
                    break;
                case 'countdown':
                    tick();
                    break;
                default:
                    // Out of lives (score entry, game over) or back at the menu: go again.
                    begin();
            }
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
