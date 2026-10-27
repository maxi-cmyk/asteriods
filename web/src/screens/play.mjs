import { S } from '../runtime/scene-layout.mjs';
import { setAttr, setData, setStyle, setVar } from '../app/dom.mjs';

// An ability's card lives above its status text; look it up once per element.
const cards = new WeakMap();
const card = (node) => {
    if (!cards.has(node)) cards.set(node, node.closest('.ability'));
    return cards.get(node);
};
export function renderPlayHud({ hud, scene, update }) {
    // The HUD sits over the playfield, so it steps aside when the ship flies under it.
    const flying = scene[S.STATE] !== 0 && scene[S.SHIP_ALIVE];
    setData(document.body, 'shipTop', String(!!flying && scene[S.SHIP_Y] < 56));
    setData(
        document.body,
        'shipBottom',
        String(!!flying && scene[S.SHIP_Y] > 210 && scene[S.SHIP_X] < 200),
    );
    const lives = scene[S.STATE] === 0 ? 3 : scene[S.LIVES];
    update(hud.lives, String(lives).padStart(2, '0'));
    setVar(hud.lives, '--n', String(Math.max(0, Math.min(9, lives))));
    const shieldCard = card(hud.shieldStatus),
        laserCard = card(hud.laserStatus);
    if (shieldCard)
        setAttr(
            shieldCard,
            'data-state',
            scene[S.SHIELD] ? 'active' : scene[S.SHIELD_STORED] ? 'stored' : 'empty',
        );
    if (laserCard)
        setAttr(
            laserCard,
            'data-state',
            scene[S.CHARGING] ? 'charging' : scene[S.LASER_COOLDOWN_MS] > 0 ? 'cooling' : 'ready',
        );
    update(hud.wave, String(scene[S.WAVE] || 1).padStart(2, '0'));
    update(hud.score, String(scene[S.SCORE]).padStart(6, '0'));
    update(hud.multiplier, `x${scene[S.MULTIPLIER] || 1}`);
    setStyle(hud.chainFill, 'width', `${(scene[S.CHAIN_MS] / 3000) * 100}%`);
    const laserText = scene[S.CHARGING]
        ? `CHARGING ${(scene[S.CHARGE_MS] / 1000).toFixed(1)}s`
        : scene[S.LASER_COOLDOWN_MS] > 0
          ? `${(scene[S.LASER_COOLDOWN_MS] / 1000).toFixed(1)}s`
          : 'READY';
    update(hud.laserStatus, laserText);
    setStyle(
        hud.laserFill,
        'width',
        `${scene[S.CHARGING] ? scene[S.CHARGE_MS] / 15 : scene[S.LASER_COOLDOWN_MS] > 0 ? (1 - scene[S.LASER_COOLDOWN_MS] / 5000) * 100 : 100}%`,
    );
    update(
        hud.shieldStatus,
        scene[S.SHIELD] ? 'ACTIVE' : scene[S.SHIELD_STORED] ? 'STORED' : 'EMPTY',
    );
    update(hud.precisionStatus, scene[S.PRECISION] ? 'PRECISION ON' : 'PRECISION');
    if (hud.precisionStatus.classList.contains('active') !== !!scene[S.PRECISION])
        hud.precisionStatus.classList.toggle('active', !!scene[S.PRECISION]);
}
