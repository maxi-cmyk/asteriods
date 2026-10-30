import { Controls, radial, movementResponse, readController } from './controls.mjs';

export function stickValues(pad, settings, state = new Map()) {
    const controller = readController(pad, settings, state);
    return [0, 2].map((offset) => {
        const raw = [0, 1].map((axis) =>
            Math.max(-1, Math.min(1, Number(pad?.axes[offset + axis]) || 0)),
        );
        let adjusted = radial(...raw, offset === 0 ? settings.deadzone : settings.aimDeadzone);
        if (offset === 0) adjusted = movementResponse(...adjusted, settings.movementSensitivity);
        else adjusted = [controller?.aimX || 0, controller?.aimY || 0];
        return { raw, adjusted };
    });
}

export class DriftSample {
    constructor(index, now) {
        this.index = index;
        this.started = now;
        this.peak = 0;
        this.peaks = [0, 0];
        this.count = 0;
    }
    update(pad, now) {
        if (!pad?.connected || pad.index !== this.index || pad.mapping !== 'standard')
            return { error: 'Controller disconnected. Reconnect and sample again.' };
        for (const offset of [0, 2]) {
            const length = Math.hypot(pad.axes[offset] || 0, pad.axes[offset + 1] || 0);
            if (!Number.isFinite(length) || length > 0.4)
                return { error: 'Stick moved too far. Release both sticks and sample again.' };
            this.peak = Math.max(this.peak, length);
            this.peaks[offset / 2] = Math.max(this.peaks[offset / 2], length);
        }
        this.count++;
        if (now - this.started < 2000 || this.count < 20) return { pending: true };
        const suggested = Math.ceil((this.peak + 0.03) * 100) / 100;
        if (suggested > 0.45)
            return {
                error: 'Drift is too high for a reliable suggestion. Adjust manually or try another controller.',
            };
        return {
            suggested: Math.max(0.05, suggested),
            deadzones: this.peaks.map((peak) =>
                Math.max(0.05, Math.ceil((peak + 0.03) * 100) / 100),
            ),
        };
    }
}

// The controller calibration panel in Settings: a live stick plot, a movable preview ship
// driven through the real Controls, and a two-second drift sample that suggests deadzones.
class CalibrationPanel {
    constructor({ settings, findController, persist, render }) {
        this.settings = settings;
        this.findController = findController;
        this.persist = persist; // marks the settings draft changed
        this.render = render; // redraws the settings screen
        this.panel = document.querySelector('#calibration');
        this.preview = document.querySelector('#inputPreview');
        this.status = document.querySelector('#calibrationStatus');
        this.meter = document.querySelector('#sampleFill');
        this.sampleButton = document.querySelector('#sampleDrift');
        this.applyButton = document.querySelector('#applyDeadzone');
        this.previewControls = new Controls(settings);
        this.plotState = new Map();
        this.reset();
        this.#wire();
    }
    reset() {
        this.sampling = null; // a DriftSample while measuring
        this.suggestion = null; // [left, right] deadzones waiting to be applied
        this.previous = null;
        this.elapsed = 0;
        this.x = 160; // preview ship position and heading
        this.y = 65;
        this.angle = 0;
        this.pointer = null;
        this.previewControls.clear();
        this.plotState.clear();
        this.applyButton.disabled = true;
        this.#say('Release both sticks, then sample.');
        this.#progress(0);
    }
    // The status line, tinted by outcome: ok (amber) or error (pink).
    #say(text, tone = '') {
        this.status.textContent = text;
        if (this.status.dataset.tone !== tone) this.status.dataset.tone = tone;
    }
    #progress(fraction) {
        const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
        if (this.meter.style.width !== width) this.meter.style.width = width;
    }
    #wire() {
        const { preview, previewControls } = this;
        this.sampleButton.addEventListener('click', () => this.#startSample());
        this.applyButton.addEventListener('click', () => this.#applySuggestion());
        preview.addEventListener('pointermove', (event) => {
            if (event.pointerType !== 'mouse') return;
            previewControls.activateMouseAim();
            const rect = preview.getBoundingClientRect();
            this.pointer = [
                ((event.clientX - rect.left) * 320) / rect.width,
                ((event.clientY - rect.top) * 130) / rect.height,
            ];
        });
        preview.addEventListener('pointerdown', () => preview.focus());
        preview.addEventListener('keydown', (event) => {
            const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if ([...keys, ...Object.values(this.settings.keys)].includes(event.code)) {
                event.preventDefault();
                previewControls.keyDown(event.code, event.repeat);
            }
        });
        preview.addEventListener('keyup', (event) => previewControls.keyUp(event.code));
        preview.addEventListener('blur', () => {
            previewControls.clear();
            this.pointer = null;
        });
        preview.addEventListener('pointerleave', () => {
            this.pointer = null;
        });
    }
    #startSample() {
        const pad = this.findController();
        if (!pad) {
            this.#say('Connect a standard controller and press a button, then try again.', 'error');
            return;
        }
        this.sampling = new DriftSample(pad.index, performance.now());
        this.suggestion = null;
        this.applyButton.disabled = true;
        this.#say('Sampling for two seconds. Keep both sticks untouched…');
        this.#progress(0);
    }
    #applySuggestion() {
        const { suggestion, settings } = this;
        if (suggestion === null) return;
        settings.deadzone = suggestion[0];
        settings.aimDeadzone = suggestion[1];
        this.render();
        this.persist();
        this.#say(
            `Selected left ${Math.round(suggestion[0] * 100)}%, right ${Math.round(suggestion[1] * 100)}%. Press Apply to keep them.`,
            'ok',
        );
        this.suggestion = null;
        this.applyButton.disabled = true;
    }
    // Called every frame while the calibration tab is showing.
    update(now) {
        const delta = this.previous === null ? 0 : Math.min(60, now - this.previous);
        this.previous = now;
        const pad = this.findController();
        const connected = !!pad;
        this.sampleButton.disabled = !connected || !!this.sampling;
        const device = this.panel.querySelector('#calibrationController');
        setText(
            device,
            connected ? pad.id : 'No standard controller detected. Connect one and press a button.',
        );
        if (device.dataset.connected !== String(connected))
            device.dataset.connected = String(connected);
        this.#plotSticks(pad);
        this.#advanceSample(pad, now);
        this.#advancePreview(pad, now, delta);
    }
    #plotSticks(pad) {
        const { panel, settings } = this;
        const sticks = stickValues(pad, settings, this.plotState);
        for (const [i, stick] of sticks.entries()) {
            const plot = panel.querySelector(i === 0 ? '#moveStick' : '#aimStick');
            for (const name of ['raw', 'adjusted']) {
                const dot = plot.querySelector(`.${name}`);
                dot.setAttribute('cx', 50 + stick[name][0] * 44);
                dot.setAttribute('cy', 50 + stick[name][1] * 44);
            }
            plot.querySelector('.deadzone').setAttribute(
                'r',
                (i === 0 ? settings.deadzone : settings.aimDeadzone) * 44,
            );
            const values = panel.querySelector(i === 0 ? '#moveValues' : '#aimValues');
            for (const name of ['raw', 'adjusted'])
                setText(
                    values.querySelector(`.${name}-value`),
                    stick[name].map((v) => v.toFixed(2)).join(', '),
                );
        }
    }
    #advanceSample(pad, now) {
        if (!this.sampling) return;
        const result = this.sampling.update(pad, now);
        if (result.pending) {
            this.#progress((now - this.sampling.started) / 2000);
            return;
        }
        this.sampling = null;
        if (result.error) {
            this.#say(result.error, 'error');
            this.#progress(0);
        } else {
            this.suggestion = result.deadzones;
            this.applyButton.disabled = false;
            this.#progress(1);
            this.#say(
                `Suggested deadzones: left ${Math.round(this.suggestion[0] * 100)}%, right ${Math.round(this.suggestion[1] * 100)}%. Use these or keep your current settings.`,
                'ok',
            );
        }
    }
    // Match the game's fixed 20 ms input ticks, without advancing gameplay.
    #advancePreview(pad, now, delta) {
        const { previewControls } = this;
        this.elapsed += delta;
        while (this.elapsed >= 20) {
            if (this.pointer)
                previewControls.aimAt(this.pointer[0] - this.x, this.pointer[1] - this.y);
            const input = previewControls.sample(pad, now);
            const dx = (input.x - 2048) / (input.x >= 2048 ? 2047 : 2048),
                dy = (input.y - 2048) / (input.y >= 2048 ? 2047 : 2048);
            const scale = (2 / Math.max(1, Math.hypot(dx, dy))) * (input.precision ? 0.5 : 1);
            this.x = Math.max(14, Math.min(306, this.x + dx * scale));
            this.y = Math.max(14, Math.min(116, this.y + dy * scale));
            if (input.aimX || input.aimY)
                this.angle = (Math.atan2(input.aimY, input.aimX) * 180) / Math.PI;
            this.elapsed -= 20;
        }
        this.preview
            .querySelector('#previewShip')
            .setAttribute('transform', `translate(${this.x} ${this.y}) rotate(${this.angle})`);
    }
}

function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
}

export const setupCalibration = (options) => new CalibrationPanel(options);
