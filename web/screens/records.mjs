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
    const mode=element('recordsMode').value;
    const coOp=mode!=='solo';
    element('recordsType').disabled=coOp;
    const recordRules = {mode:coOp?'co-op':'solo', friendlyFire:mode==='coop-on',
        practice: !coOp && element('recordsType').value === 'practice'};
    update(element('leaderboardContext'),coOp?'Team initials leaderboard':'Initials leaderboard · Solo normal runs');
    if(coOp) {
        const board=runtime.teamLeaderboard(recordRules.friendlyFire);
        const list=element('leaderboard');
        const signature=JSON.stringify(board.entries);
        if(list.dataset.rows!==signature) {
            list.dataset.rows=signature;list.replaceChildren();
            for(const entry of board.entries.length?board.entries:[null]) {
                const li=document.createElement('li');li.textContent=entry?`${entry.initials}    ${entry.score}`:'No team scores saved yet.';list.append(li);
            }
        }
        update(element('leaderboardStatus'),board.status);
    }
    const best = runtime.records.get(recordProfile, recordRules);
    update(
        element('recordsScope'),
        `Profile ${recordProfile + 1} · ${coOp?'Co-op':'Solo'} · ${recordRules.practice ? 'Practice' : 'Normal'} · Friendly fire ${recordRules.friendlyFire?'on':'off'} · No modifiers`,
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
    if(!coOp)update(element('leaderboardStatus'), runtime.scoreStatus);
    update(
        element('recordsAccuracy'),
        best?.accuracy
            ? `Best accuracy: ${accuracyText(best.accuracy.hits, best.accuracy.shots)}`
            : 'Best accuracy: — (requires at least 50 projectiles in a run)',
    );
    if (!resetRecordsArmed)
        update(element('recordsStatus'), runtime.records.status);
}
