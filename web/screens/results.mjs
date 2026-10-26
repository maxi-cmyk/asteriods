import { element } from '../dom.mjs';
import { accuracyText } from '../records.mjs';
import { regionForWave } from '../regions.mjs';
import { bossNames } from '../boss-scene.mjs';

export function renderResultsScreen({
    results,
    showResults,
    canvas,
    lastState,
    result,
    scene,
    update,
}) {
    if (results.hidden === showResults) {
        results.hidden = !showResults;
        canvas.inert = showResults;
        canvas.setAttribute('aria-hidden', String(showResults));
        if (showResults) results.focus({ preventScroll: true });
        else if (lastState === 'results') canvas.focus({ preventScroll: true });
    }
    document.body.dataset.results = String(showResults);
    if (showResults) {
        const coop = !!result.players;
        results.querySelector('dl').hidden = coop;
        element('resultLaser').hidden = coop || !result.laserShots;
        const seconds = Math.floor(result.elapsedMs / 1000);
        const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        const defeated = bossNames(result.bossMask || 0);
        const bosses = element('resultBosses');
        const line = defeated.length
            ? `Defeated · ${defeated.join(', ')}${result.rules?.practice ? ` · hit ${result.bossHits || 0}×` : ''}`
            : '';
        update(bosses, line);
        bosses.hidden = !line;
        update(element('resultScore'), String(result.score));
        update(
            element('resultRegion'),
            `Wave ${result.wave} · ${regionForWave(result.wave).name}${coop ? ` · ${clock}` : ''}`,
        );
        if (coop) {
            update(element('continueResults'), 'Continue');
            update(element('personalBest'), 'Team complete');
            return;
        }
        update(
            element('continueResults'),
            result.rules.practice ? 'Return home' : 'Continue',
        );
        update(
            element('personalBest'),
            `${result.rules.practice ? 'Practice complete' : 'Run complete'} · Player ${result.profile + 1}`,
        );
        update(element('resultCps'), String(result.peakCps));
        update(element('resultAccuracy'), accuracyText(result.hits, result.shots));
        update(element('resultChain'), String(result.longestChain));
        update(element('resultTime'), clock);
        update(element('resultKills'), String(result.destroyed));
        update(element('resultMultiplier'), `×${result.bestMultiplier}`);
        update(
            element('resultLaser'),
            `Laser · ${result.laserShots} shot${result.laserShots === 1 ? '' : 's'} · ${result.laserKills} kill${result.laserKills === 1 ? '' : 's'}`,
        );
    }
}
