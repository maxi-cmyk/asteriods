import { element } from '../dom.mjs';
import { accuracyText } from '../records.mjs';
import { regionForWave } from '../regions.mjs';

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
    if (showResults) {
        update(
            element('continueResults'),
            result.rules.practice
                ? 'Return to Home'
                : scene[0] === 5
                  ? 'Continue to score saving'
                  : 'Continue to leaderboard',
        );
        update(
            element('personalBest'),
            `${result.rules.practice ? 'Practice complete' : 'Run complete'} · Player ${result.profile + 1}`,
        );
        update(element('resultScore'), String(result.score));
        update(element('resultCps'), String(result.peakCps));
        update(
            element('resultAccuracy'),
            accuracyText(result.hits, result.shots),
        );
        update(element('resultChain'), String(result.longestChain));
        update(
            element('resultRegion'),
            `Location: ${regionForWave(result.wave).name} · Sentinels defeated: ${result.bossKills || 0}`,
        );
        update(
            element('resultLaser'),
            `Laser: ${result.laserShots} discharges · ${result.laserKills} kills`,
        );
        update(element('resultWave'), String(result.wave));
        const seconds = Math.floor(result.elapsedMs / 1000);
        update(
            element('resultTime'),
            `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        );
        update(element('resultKills'), String(result.destroyed));
        update(element('resultMultiplier'), `×${result.bestMultiplier}`);
    }
}
