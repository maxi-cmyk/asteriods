import { element } from '../dom.mjs';
import { accuracyText } from '../records.mjs';

export function renderPlayHud({ hud, scene, update }) {
    update(hud.lives, String(scene[0] === 0 ? 3 : scene[7]).padStart(2, '0'));
    update(hud.wave, String(scene[19] || 1).padStart(2, '0'));
    update(hud.score, String(scene[16]).padStart(6, '0'));
    update(hud.multiplier, `x${scene[17] || 1}`);
    hud.chainFill.style.width = `${(scene[18] / 3000) * 100}%`;
    const laserText = scene[47]
        ? `CHARGING ${(scene[48] / 1000).toFixed(1)}s`
        : scene[49] > 0
          ? `${(scene[49] / 1000).toFixed(1)}s`
          : 'READY';
    update(hud.laserStatus, laserText);
    hud.laserFill.style.width = `${scene[47] ? scene[48] / 15 : scene[49] > 0 ? (1 - scene[49] / 5000) * 100 : 100}%`;
    update(
        hud.shieldStatus,
        scene[15] ? 'ACTIVE' : scene[55] ? 'STORED' : 'EMPTY',
    );
    update(hud.precisionStatus, scene[56] ? 'PRECISION ON' : 'PRECISION');
    hud.precisionStatus.classList.toggle('active', !!scene[56]);
}
