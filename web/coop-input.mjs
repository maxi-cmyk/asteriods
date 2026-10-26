import { Controls } from './controls.mjs';
import { sanitizeSettings } from './settings.mjs';
export const supportedPad = (pad) => pad?.connected && pad.mapping === 'standard';
export const neutralPad = (pad) =>
    !(pad?.buttons || []).some((b) => b?.pressed || b?.value > 0.2) &&
    !(pad?.axes || []).some((v) => Math.abs(v) > 0.55);
export class CoopInput {
    constructor(profiles) {
        this.profiles = profiles;
        this.devices = ['keyboard', ''];
        this.profileIds = [0, 1];
        this.ready = [false, false];
        this.armed = [false, false];
        this.controls = [
            new Controls(sanitizeSettings(profiles[0])),
            new Controls(sanitizeSettings(profiles[1])),
        ];
        this.menuOwner = 0;
        this.claimed = [null, null];
        this.live = false;
        this.launchArmed = false;
    }
    pad(slot, pads) {
        const device = this.devices[slot];
        const pad = pads.find((p) => supportedPad(p) && String(p.index) === device);
        if (this.live && pad && pad !== this.claimed[slot] && pad.id !== this.claimed[slot]?.id)
            return null;
        return pad ?? null;
    }
    valid(pads) {
        return (
            this.devices[0] !== this.devices[1] &&
            this.profileIds[0] !== this.profileIds[1] &&
            this.devices.every((device, i) => device === 'keyboard' || !!this.pad(i, pads))
        );
    }
    assign(slot, device, pads) {
        if (
            !this.live &&
            (this.ready[slot] ||
                this.devices.some((d, i) => i !== slot && this.ready[i] && d === device))
        )
            return false;
        this.devices[slot] = device;
        this.claimed[slot] = pads.find((p) => String(p?.index) === device) ?? null;
        if (this.live) this.reset();
        else this.resetSlot(slot);
        return true;
    }
    setProfile(slot, profile) {
        if (
            this.ready[slot] ||
            ![0, 1].includes(profile) ||
            this.profileIds.some((p, i) => i !== slot && this.ready[i] && p === profile)
        )
            return false;
        this.profileIds[slot] = profile;
        this.resetSlot(slot);
        return true;
    }
    resetSlot(slot) {
        this.launchArmed = false;
        this.ready[slot] = false;
        this.armed[slot] = false;
        this.controls[slot].clear();
    }
    reset() {
        this.launchArmed = false;
        this.ready = [false, false];
        this.armed = [false, false];
        this.clear();
    }
    clear() {
        this.controls.forEach((c) => c.clear());
    }
    refresh() {
        this.controls.forEach(
            (c, i) => (c.settings = sanitizeSettings(this.profiles[this.profileIds[i]])),
        );
    }
    keyboard() {
        const slot = this.devices.indexOf('keyboard');
        return slot < 0 ? null : this.controls[slot];
    }
    keyboardSlot() {
        return this.devices.indexOf('keyboard');
    }
    observe(pads) {
        this.controls.forEach((c, i) => {
            if (this.devices[i] !== 'keyboard') c.observeController(this.pad(i, pads));
        });
    }
    neutral(pads, keys = false, pointer = false) {
        return (
            this.valid(pads) &&
            !keys &&
            !pointer &&
            this.devices.every((d, i) => d === 'keyboard' || neutralPad(this.pad(i, pads)))
        );
    }
    sample(pads, now) {
        const players = this.controls.map((c, i) =>
            c.sample(this.devices[i] === 'keyboard' ? null : this.pad(i, pads), now),
        );
        const paused = players.findIndex((p) => p.pause);
        if (paused >= 0) this.menuOwner = paused;
        return { players, menuOwner: this.menuOwner, pause: paused >= 0 };
    }
    join(slot, pads) {
        if (!this.ready[slot] && !this.valid(pads)) return false;
        this.ready[slot] = !this.ready[slot];
        return true;
    }
    lobbyTick(pads) {
        for (let i = 0; i < 2; i++) {
            if (this.devices[i] === 'keyboard') continue;
            const pad = this.pad(i, pads);
            if (!pad) {
                this.ready[i] = false;
                this.armed[i] = false;
                continue;
            }
            const down = !!pad.buttons?.[0]?.pressed;
            if (neutralPad(pad)) this.armed[i] = true;
            if (down && this.armed[i]) {
                this.join(i, pads);
                this.armed[i] = false;
            }
        }
    }
    canStart(pads) {
        if (!this.valid(pads) || !this.ready.every(Boolean)) {
            this.launchArmed = false;
            return false;
        }
        if (this.devices.every((d, i) => d === 'keyboard' || neutralPad(this.pad(i, pads))))
            this.launchArmed = true;
        return (
            this.launchArmed &&
            this.devices.every(
                (d, i) =>
                    d === 'keyboard' ||
                    (!(this.pad(i, pads)?.axes || []).some((v) => Math.abs(v) > 0.55) &&
                        !(this.pad(i, pads)?.buttons || []).some(
                            (b, index) => index !== 0 && (b.pressed || b.value > 0.2),
                        )),
            )
        );
    }
    begin(pads) {
        if (!this.canStart(pads)) throw Error('Both players must be ready and release controls');
        this.claimed = this.devices.map((d) => pads.find((p) => String(p?.index) === d) ?? null);
        this.live = true;
        this.clear();
        this.refresh();
    }
    lost(index) {
        const slot = this.devices.indexOf(String(index));
        if (slot >= 0) {
            this.claimed[slot] = null;
            this.devices[slot] = '';
            this.reset();
            return true;
        }
        return false;
    }
}
