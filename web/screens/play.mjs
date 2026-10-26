export function renderPlayHud({ hud, scene, update }) {
    // The HUD sits over the playfield, so it steps aside when the ship flies under it.
    const flying = scene[0] !== 0 && scene[6];
    document.body.dataset.shipTop = String(!!flying && scene[5] < 56);
    document.body.dataset.shipBottom = String(!!flying && scene[5] > 210 && scene[4] < 200);
    const lives = scene[0] === 0 ? 3 : scene[7];
    update(hud.lives, String(lives).padStart(2, '0'));
    hud.lives.style.setProperty('--n', Math.max(0, Math.min(9, lives)));
    hud.shieldStatus
        .closest('.ability')
        ?.setAttribute('data-state', scene[15] ? 'active' : scene[55] ? 'stored' : 'empty');
    hud.laserStatus
        .closest('.ability')
        ?.setAttribute('data-state', scene[47] ? 'charging' : scene[49] > 0 ? 'cooling' : 'ready');
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
    update(hud.shieldStatus, scene[15] ? 'ACTIVE' : scene[55] ? 'STORED' : 'EMPTY');
    update(hud.precisionStatus, scene[56] ? 'PRECISION ON' : 'PRECISION');
    hud.precisionStatus.classList.toggle('active', !!scene[56]);
}
