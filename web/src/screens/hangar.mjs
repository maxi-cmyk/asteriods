import { element } from '../app/dom.mjs';
import { HULLS, hullById, hullIcon, saveHangar } from '../state/hangar.mjs';
import { drawShowcase } from '../render/showcase.mjs';
import { requirementText } from '../boss/unlocks.mjs';

// The Hangar equips a cosmetic hull per local profile. Focus (or hover) previews
// a hull on the stage; activating it equips it immediately and saves.
class HangarScreen {
    constructor({ getArt, store, storage, activeProfile, reduced, unlocks }) {
        Object.assign(this, { getArt, store, storage, activeProfile, reduced, unlocks });
        this.pilot = 0; // which local profile is being edited
        this.preview = null; // hull id under focus or hover
        this.status = '';
        this.stage = element('hangarStage').getContext('2d');
        this.bay = element('hangarBay');
        this.pilotButtons = [...document.querySelectorAll('[data-pilot]')];
        for (const button of this.pilotButtons)
            button.addEventListener('click', () => {
                this.pilot = Number(button.dataset.pilot);
                this.preview = null;
                this.status = '';
                this.render();
            });
    }
    get equipped() {
        return this.store.profiles[this.pilot];
    }
    #locked(id) {
        return this.unlocks ? !this.unlocks.isUnlocked(this.pilot, id) : false;
    }
    #drawIcon(canvas, hull) {
        const art = this.getArt(),
            cell = art?.sprites[hullIcon(hull)];
        if (!cell) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(art.atlas, cell.x, cell.y, cell.w, cell.h, 0, 0, 24, 16);
    }
    #build() {
        this.bay.replaceChildren(
            ...HULLS.map((hull) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.hull = hull.id;
                button.setAttribute('role', 'radio');
                button.style.setProperty('--accent', hull.accent);
                const canvas = document.createElement('canvas');
                canvas.width = 24;
                canvas.height = 16;
                canvas.setAttribute('aria-hidden', 'true');
                const label = document.createElement('span');
                label.textContent = hull.name;
                button.append(canvas, label);
                const show = () => {
                    this.preview = hull.id;
                    this.render();
                };
                button.addEventListener('focus', show);
                button.addEventListener('pointerenter', show);
                button.addEventListener('click', () => this.#equip(hull.id));
                return button;
            }),
        );
    }
    #equip(id) {
        if (this.#locked(id)) {
            this.status = requirementText(id);
            this.preview = id;
            this.render();
            return;
        }
        this.store.profiles[this.pilot] = id;
        const saved = saveHangar(this.storage, this.store);
        this.status = saved
            ? ''
            : `${hullById(id).name} equipped for this visit only. Browser storage is unavailable.`;
        this.preview = id;
        this.render();
    }
    render() {
        if (!this.bay.children.length) this.#build();
        const equipped = this.equipped;
        const shown = hullById(this.preview || equipped);
        for (const button of this.bay.children) {
            const id = button.dataset.hull;
            button.setAttribute('aria-checked', String(id === equipped));
            const isLocked = this.#locked(id);
            button.dataset.locked = String(isLocked);
            button.setAttribute('aria-disabled', String(isLocked));
            button.querySelector('span').textContent = isLocked
                ? `${hullById(id).name} · locked`
                : hullById(id).name;
            button.dataset.preview = String(id === shown.id);
            this.#drawIcon(button.querySelector('canvas'), id);
        }
        for (const button of this.pilotButtons)
            button.setAttribute(
                'aria-pressed',
                String(Number(button.dataset.pilot) === this.pilot),
            );
        element('hangarName').textContent = shown.name;
        element('hangarName').style.setProperty('--accent', shown.accent);
        const shownLocked = this.#locked(shown.id);
        element('hangarBlurb').textContent = shownLocked ? requirementText(shown.id) : shown.blurb;
        element('hangarTag').textContent = shownLocked
            ? 'LOCKED'
            : shown.id === equipped
              ? 'EQUIPPED'
              : 'PREVIEW';
        element('hangarStatus').textContent = this.status;
    }
    // Opening starts on the active profile with nothing previewed.
    open() {
        this.pilot = this.activeProfile();
        this.preview = null;
        this.status = '';
        this.#build();
        this.render();
    }
    // The animated stage: the shown hull turning slowly on the showcase backdrop.
    draw(time) {
        const art = this.getArt();
        if (!art) return;
        const { stage } = this;
        const shown = this.preview || this.equipped;
        const direction = this.reduced() ? 0 : Math.floor(time / 900) % 16;
        drawShowcase(stage, art, {
            ships: [
                {
                    hull: shown,
                    x: Math.round(stage.canvas.width * 0.4),
                    y: Math.round(stage.canvas.height * 0.5),
                    direction,
                    scale: 3,
                },
            ],
            time,
            reduced: this.reduced(),
            seed: 2,
        });
    }
}

export const createHangarScreen = (options) => new HangarScreen(options);
