import { WIDTH, HEIGHT } from '../render/constants.mjs';
import { S } from '../runtime/scene-layout.mjs';

// Raw input state shared by the game loop and the menus: held keys and buttons, the mouse
// aim point, which controller is active and which device the player touched last.
export class InputHub {
    constructor(app) {
        this.app = app;
        this.physicalKeys = new Set();
        this.pointerButtons = new Set();
        this.pointerPosition = null;
        this.activePadIndex = null;
        this.device = 'keyboard'; // 'keyboard' | 'mouse' | 'controller'
        this.gameplayReady = false; // controls were released since the last interruption
    }
    connectedPads() {
        try {
            return Array.from(navigator.getGamepads?.() || []);
        } catch {
            return [];
        }
    }
    findController() {
        return this.app.session.findPad();
    }
    // Anything pressed on any device (the player must let go before gameplay resumes).
    held(pad) {
        return (
            this.physicalKeys.size ||
            this.pointerButtons.size ||
            (pad?.buttons || []).some((b) => b?.pressed || b?.value > 0.2) ||
            (pad?.axes || []).some((v) => Math.abs(v) > 0.55)
        );
    }
    // Drops everything held, e.g. when the window loses focus.
    release() {
        this.physicalKeys.clear();
        this.pointerButtons.clear();
        this.pointerPosition = null;
    }
    // Points the ship's aim at the mouse, in playfield coordinates.
    applyMouseAim() {
        if (!this.pointerPosition) return;
        const { app } = this;
        const rect = app.canvas.getBoundingClientRect(),
            scene = app.session.aimScene();
        app.session
            .keyboardControls()
            ?.aimAt(
                ((this.pointerPosition[0] - rect.left) * WIDTH) / rect.width - scene[S.SHIP_X],
                ((this.pointerPosition[1] - rect.top) * HEIGHT) / rect.height - scene[S.SHIP_Y],
            );
    }
    install() {
        const { app } = this,
            { canvas } = app;
        const controls = () => app.session.keyboardControls();
        canvas.addEventListener('pointermove', (event) => {
            if (app.navigation.screen === 'play' && event.pointerType === 'mouse') {
                this.pointerPosition = [event.clientX, event.clientY];
                controls()?.activateMouseAim();
            }
        });
        canvas.addEventListener('pointerdown', (event) => {
            if (
                app.navigation.screen !== 'play' ||
                event.pointerType !== 'mouse' ||
                ![0, 2].includes(event.button)
            )
                return;
            event.preventDefault();
            canvas.focus();
            controls()?.activateMouseAim();
            this.pointerPosition = [event.clientX, event.clientY];
            controls()?.pointerDown(event.button, performance.now());
            canvas.setPointerCapture(event.pointerId);
        });
        window.addEventListener('pointerup', (event) => controls()?.pointerUp(event.button));
        canvas.addEventListener('pointercancel', () => {
            app.controls.clear();
            this.pointerPosition = null;
        });
        canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        window.addEventListener('pointerdown', (event) => {
            this.device = 'mouse';
            this.pointerButtons.add(event.button);
        });
        window.addEventListener('pointerup', (event) => this.pointerButtons.delete(event.button));
        window.addEventListener('pointerdown', () => app.unlockAudio());
        // Preserve brief controller releases between the fixed simulation ticks.
        // No gameplay or DOM work occurs in this input-only polling callback.
        setInterval(() => {
            const { runtime, navigation } = app;
            if (
                !runtime ||
                app.loop.suspended ||
                navigation.screen !== 'play' ||
                runtime.state === 'results' ||
                !this.gameplayReady
            )
                return;
            const pads = this.connectedPads();
            const pad =
                pads.find((p) => p?.index === this.activePadIndex && p.connected) ||
                pads.find((p) => p?.connected && p.mapping === 'standard');
            app.session.observe(pad);
        }, 4);
    }
}
