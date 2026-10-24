import { element } from '../dom.mjs';
import { accuracyText } from '../records.mjs';

export function renderRecordsScreen({
    runtime,
    resetRecordsArmed,
    resetProfile,
    disarmRecordsReset,
    update,
}) {
    const recordProfile = Number(element('recordsProfile').value);
    if (resetRecordsArmed && resetProfile !== recordProfile)
        disarmRecordsReset();
    const recordRules = {
        practice: element('recordsType').value === 'practice',
    };
    const best = runtime.records.get(recordProfile, recordRules);
    update(
        element('recordsScope'),
        `Player ${recordProfile + 1} · Solo · ${recordRules.practice ? 'Practice' : 'Normal'} · Friendly fire off · No modifiers`,
    );
    const metrics = element('recordsValues'),
        signature = JSON.stringify(best);
    if (metrics.dataset.signature !== signature) {
        metrics.dataset.signature = signature;
        metrics.replaceChildren();
        if (!best) {
            const dt = document.createElement('dt'),
                dd = document.createElement('dd');
            dt.textContent = 'No completed runs yet';
            dd.className = 'empty-record';
            dd.textContent = 'Finish a run to set your first personal bests.';
            metrics.append(dt, dd);
        } else
            for (const [label, value] of [
                ['Score', best.score],
                ['Highest wave', best.wave],
                ['Peak CPS', best.peakCps],
                ['Longest chain', best.longestChain],
            ]) {
                const cell = document.createElement('div'),
                    dt = document.createElement('dt'),
                    dd = document.createElement('dd');
                dt.textContent = label;
                dd.textContent = value;
                cell.append(dt, dd);
                metrics.append(cell);
            }
    }
    element('retryRecords').hidden =
        !runtime.records.status.startsWith('Could not save');
    update(element('leaderboardStatus'), runtime.scoreStatus);
    update(
        element('recordsAccuracy'),
        best?.accuracy
            ? `Best accuracy: ${accuracyText(best.accuracy.hits, best.accuracy.shots)}`
            : 'Best accuracy: — (requires at least 50 projectiles in a run)',
    );
    if (!resetRecordsArmed)
        update(element('recordsStatus'), runtime.records.status);
}
