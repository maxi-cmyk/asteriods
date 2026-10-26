// Boss HUD: the entrance card and the slim health bar under the top HUD. Both are
// DOM so the type stays crisp; they only read the scene.
import { KINDS, TIER_NAMES, bossState } from './boss-scene.mjs';
import { regionForWave } from './regions.mjs';

export function createBossUi(root = document) {
    const intro = root.getElementById('bossIntro');
    const bar = root.getElementById('bossBar');
    if (!intro || !bar) return { render() {} };
    const title = intro.querySelector('b'),
        sub = intro.querySelector('.boss-region'),
        tag = intro.querySelector('.boss-tier');
    const label = bar.querySelector('.boss-name'),
        track = bar.querySelector('.boss-track'),
        fill = track.querySelector('i');
    let kind = -1,
        stage = 0,
        flashTimer = 0;
    const setHidden = (node, hidden) => {
        if (node.hidden !== hidden) node.hidden = hidden;
    };
    return {
        // `visible` is false on Pause, Results and the menus.
        render(scene, visible = true) {
            const state = bossState(scene);
            if (!visible || !state.active) {
                setHidden(intro, true);
                setHidden(bar, true);
                if (!state.active) {
                    kind = -1;
                    stage = 0;
                }
                return;
            }
            const info = KINDS[state.kind];
            if (kind !== state.kind) {
                kind = state.kind;
                stage = state.stage;
                title.textContent = info.name;
                sub.textContent = state.mini
                    ? `Mini-boss · ${regionForWave(Math.max(1, state.wave || 1)).name}`
                    : regionForWave(Math.max(1, state.wave || 5)).name;
                tag.textContent = state.tier ? `Tier ${TIER_NAMES[Math.min(3, state.tier)]}` : '';
                label.textContent = state.practice ? `${info.name} · practice` : info.name;
                track.querySelectorAll('u').forEach((node) => node.remove());
                for (const at of info.phases) {
                    const notch = document.createElement('u');
                    notch.style.left = `${at * 100}%`;
                    track.append(notch);
                }
            }
            const entering = state.entrance < 1;
            setHidden(intro, !entering || state.mini);
            intro.dataset.beat =
                state.entrance < 0.18 ? 'in' : state.entrance > 0.8 ? 'out' : 'hold';
            setHidden(bar, entering);
            const ratio = state.maximum
                ? Math.max(0, Math.min(1, state.health / state.maximum))
                : 0;
            fill.style.width = `${(ratio * 100).toFixed(1)}%`;
            bar.dataset.mini = String(state.mini);
            bar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
            if (state.stage > stage && stage > 0) {
                bar.classList.remove('crossed');
                void bar.offsetWidth;
                bar.classList.add('crossed');
                clearTimeout(flashTimer);
                flashTimer = setTimeout(() => bar.classList.remove('crossed'), 420);
            }
            stage = state.stage;
        },
    };
}
