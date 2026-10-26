import { element } from '../dom.mjs';
import { HULLS, hullById, hullIcon, saveHangar } from '../hangar.mjs';
import { drawShowcase } from '../showcase.mjs';
import { requirementText } from '../unlocks.mjs';

// The Hangar equips a cosmetic hull per local profile. Focus (or hover) previews
// a hull on the stage; activating it equips it immediately and saves.
export function createHangarScreen({ getArt, store, storage, activeProfile, reduced, unlocks }) {
    let pilot = 0,
        preview = null,
        status = '';
    const stage = element('hangarStage').getContext('2d');
    const bay = element('hangarBay');
    const pilotButtons = [...document.querySelectorAll('[data-pilot]')];
    const equipped = () => store.profiles[pilot];
    const locked = (id) => (unlocks ? !unlocks.isUnlocked(pilot, id) : false);

    function icon(canvas, hull) {
        const art = getArt(),
            cell = art?.sprites[hullIcon(hull)];
        if (!cell) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(art.atlas, cell.x, cell.y, cell.w, cell.h, 0, 0, 24, 16);
    }
    function build() {
        bay.replaceChildren(
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
                button.addEventListener('focus', () => {
                    preview = hull.id;
                    render();
                });
                button.addEventListener('pointerenter', () => {
                    preview = hull.id;
                    render();
                });
                button.addEventListener('click', () => equip(hull.id));
                return button;
            }),
        );
    }
    function equip(id) {
        if (locked(id)) {
            status = requirementText(id);
            preview = id;
            render();
            return;
        }
        store.profiles[pilot] = id;
        const saved = saveHangar(storage, store);
        const name = hullById(id).name;
        status = saved
            ? ''
            : `${name} equipped for this visit only. Browser storage is unavailable.`;
        preview = id;
        render();
    }
    function render() {
        if (!bay.children.length) build();
        const shown = hullById(preview || equipped());
        for (const button of bay.children) {
            button.setAttribute('aria-checked', String(button.dataset.hull === equipped()));
            const isLocked = locked(button.dataset.hull);
            button.dataset.locked = String(isLocked);
            button.setAttribute('aria-disabled', String(isLocked));
            button.querySelector('span').textContent = isLocked
                ? `${hullById(button.dataset.hull).name} · locked`
                : hullById(button.dataset.hull).name;
            button.dataset.preview = String(button.dataset.hull === shown.id);
            icon(button.querySelector('canvas'), button.dataset.hull);
        }
        for (const button of pilotButtons)
            button.setAttribute('aria-pressed', String(Number(button.dataset.pilot) === pilot));
        element('hangarName').textContent = shown.name;
        element('hangarName').style.setProperty('--accent', shown.accent);
        const shownLocked = locked(shown.id);
        element('hangarBlurb').textContent = shownLocked ? requirementText(shown.id) : shown.blurb;
        element('hangarTag').textContent = shownLocked
            ? 'LOCKED'
            : shown.id === equipped()
              ? 'EQUIPPED'
              : 'PREVIEW';
        element('hangarStatus').textContent = status;
    }
    for (const button of pilotButtons)
        button.addEventListener('click', () => {
            pilot = Number(button.dataset.pilot);
            preview = null;
            status = '';
            render();
        });
    return {
        open() {
            pilot = activeProfile();
            preview = null;
            status = '';
            build();
            render();
        },
        render,
        draw(time) {
            const art = getArt();
            if (!art) return;
            const shown = preview || equipped();
            const direction = reduced() ? 0 : Math.floor(time / 900) % 16;
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
                reduced: reduced(),
                seed: 2,
            });
        },
    };
}
