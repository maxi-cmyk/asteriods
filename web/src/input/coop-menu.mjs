import { MenuInput } from '../state/navigation.mjs';
import { adjustField } from './menu-fields.mjs';
import { supportedPad } from './coop-input.mjs';
export const READY_HOLD_MS = 1500;

// Each pad keeps its own cursor. Mouse/keyboard focus never becomes a pad's
// editable field, and selecting values requires an explicit confirm first.
export class CoopMenu {
    constructor(input, getElement, back, getFocused = () => document.activeElement) {
        Object.assign(this, { input, getElement, back, getFocused });
        this.reset();
    }
    reset() {
        this.pads = new Map();
        this.readyProgress = [0, 0];
    }
    // One tick of every pad's menu input. Returns after leaving the screen.
    sample(pads, now) {
        this.readyProgress = [0, 0];
        const supported = pads.filter(supportedPad);
        const connected = new Set(supported.map((p) => p.index));
        for (const index of this.pads.keys()) if (!connected.has(index)) this.pads.delete(index);
        for (const pad of supported) {
            const state = this.#state(pad);
            const action = state.menu.sample(pad, now);
            if (state.focus !== this.getFocused()) state.editing = false;
            const slot = this.input.devices.indexOf(String(pad.index));
            if (action.back) {
                state.backAt = now;
                state.backUsed = false;
                state.backSlot = slot;
                state.backProfile = this.input.profileIds[slot];
            }
            if (state.backAt !== null) {
                // Holding Circle / B readies the pilot; a tap goes back.
                if (this.#holdBack(state, pad, pads, now, slot) === 'left') return;
                continue;
            }
            if (Object.keys(action).length) this.#navigate(state, action, pad);
        }
    }
    #state(pad) {
        let state = this.pads.get(pad.index);
        if (!state) {
            state = { menu: new MenuInput(), focus: null, editing: false, backAt: null };
            this.pads.set(pad.index, state);
        }
        return state;
    }
    // Returns 'left' when a tap went back out of the screen.
    #holdBack(state, pad, pads, now, slot) {
        const elapsed = now - state.backAt;
        const held = !!pad.buttons?.[1]?.pressed || (pad.buttons?.[1]?.value || 0) > 0.2;
        const eligible =
            slot >= 0 &&
            slot === state.backSlot &&
            this.input.profileIds[slot] === state.backProfile &&
            !this.input.ready[slot] &&
            this.input.valid(pads);
        if (elapsed >= READY_HOLD_MS && !state.backUsed) {
            state.backUsed = true;
            if (eligible) {
                state.editing = false;
                state.focus = this.getElement(`coopReady${slot}`);
                state.focus.click();
                state.focus.focus();
            }
        }
        if (held) {
            if (eligible && !state.backUsed) this.readyProgress[slot] = elapsed / READY_HOLD_MS;
            return 'holding';
        }
        state.backAt = null;
        if (!state.backUsed) {
            if (state.editing) state.editing = false;
            else {
                this.back();
                return 'left';
            }
        }
        return 'released';
    }
    // Up/down/left/right move this pad's cursor over its own controls; confirm selects.
    #navigate(state, action, pad) {
        let slot = this.input.devices.indexOf(String(pad.index));
        if (slot < 0) slot = this.input.devices.indexOf('');
        if (slot < 0) return;
        const nodes = [
            `coopDevice${slot}`,
            `coopProfile${slot}`,
            `coopReady${slot}`,
            'coopFriendly',
            'coopStart',
        ]
            .map(this.getElement)
            .filter((el) => !el.disabled);
        if (!nodes.includes(state.focus)) {
            state.focus = null;
            state.editing = false;
        }
        const direction = action.direction || action.horizontal;
        if (direction) {
            if (state.editing && state.focus?.matches('select'))
                adjustField(state.focus, direction);
            else {
                const index = nodes.indexOf(state.focus);
                state.focus = nodes[(index + direction + nodes.length) % nodes.length];
                state.editing = false;
            }
            state.focus?.focus();
        }
        if (action.confirm) {
            if (!state.focus) {
                state.focus = this.getElement(`coopReady${slot}`);
                state.focus.focus();
            } else {
                state.focus.focus();
                if (state.focus.matches('select')) state.editing = !state.editing;
                else state.focus.click();
            }
        }
    }
}
