import { BOSS, BOSS_AT } from '../runtime/scene-layout.mjs';
import { hullById } from '../state/hangar.mjs';
import { element } from './dom.mjs';

// A first defeat of a mini-boss in a real run earns its Hangar hull, with a toast.
export class BossUnlockToast {
    constructor(app) {
        this.app = app;
        this.lastMask = 0;
        this.timer = 0;
    }
    track(scene) {
        const { app } = this;
        const mask = scene[BOSS_AT + BOSS.DEFEATED_MASK] | 0;
        if (!mask) {
            this.lastMask = 0;
            return;
        }
        const fresh = mask & ~this.lastMask;
        this.lastMask = mask;
        if (!fresh || scene[BOSS_AT + BOSS.PRACTICE]) return;
        for (const hull of app.unlocks.hullsFor(fresh))
            if (
                app.session
                    .unlockProfiles()
                    .map((profile) => app.unlocks.grant(profile, hull))
                    .some(Boolean)
            )
                this.show(hullById(hull).name);
    }
    show(name) {
        const toast = element('unlockToast');
        toast.textContent = `${name} hull unlocked · see Hangar`;
        toast.hidden = false;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => (toast.hidden = true), 4200);
    }
}
