import { element } from '../app/dom.mjs';
import { accuracyText } from '../state/records.mjs';
import { KINDS, REGION_SHEETS } from '../boss/scene.mjs';
import { renderLeaderboard } from './leaderboard.mjs';

// The three filters are chip groups that drive hidden selects, so the stored
// filter state and the reset logic keep working on plain values.
let chipsWired = false;
function wireChips() {
    if (chipsWired) return;
    chipsWired = true;
    for (const group of document.querySelectorAll('.records-filters .chips')) {
        const select = element(group.dataset.for);
        group.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-value]');
            if (!button || button.disabled || select.value === button.dataset.value) return;
            select.value = button.dataset.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
}
function syncChips() {
    for (const group of document.querySelectorAll('.records-filters .chips')) {
        const select = element(group.dataset.for);
        for (const button of group.querySelectorAll('button[data-value]')) {
            const on = button.dataset.value === select.value;
            if (button.getAttribute('aria-pressed') !== String(on))
                button.setAttribute('aria-pressed', String(on));
            if (button.disabled !== select.disabled) button.disabled = select.disabled;
        }
    }
}

// The boss log: one tile per boss and mini-boss. Defeated ones show in colour with a
// count; the rest are silhouettes that say where they wait.
function buildBossLog(bossArt) {
    const log = element('recordsBossLog');
    if (log.childElementCount) return log;
    for (const [index, info] of KINDS.entries()) {
        const tile = document.createElement('figure');
        tile.dataset.kind = String(index);
        tile.dataset.mini = String(info.mini);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = info.mini ? 48 : 64;
        canvas.setAttribute('aria-hidden', 'true');
        const name = document.createElement('figcaption');
        const label = document.createElement('b');
        const count = document.createElement('span');
        name.append(label, count);
        tile.append(canvas, name);
        log.append(tile);
    }
    for (const sheet of REGION_SHEETS) bossArt?.load(sheet);
    return log;
}
function renderBossLog(runtime, profile, bossArt) {
    const log = buildBossLog(bossArt);
    const counts = runtime.bossRecords.profiles[profile];
    for (const tile of log.children) {
        const info = KINDS[Number(tile.dataset.kind)],
            count = counts[info.id] || 0;
        const canvas = tile.querySelector('canvas');
        if (canvas.dataset.drawn !== 'yes' && bossArt?.icon(Number(tile.dataset.kind), canvas))
            canvas.dataset.drawn = 'yes';
        const state = count ? 'beaten' : 'unseen';
        if (tile.dataset.state !== state) tile.dataset.state = state;
        const [label, number] = tile.querySelectorAll('figcaption > *');
        const wave = info.mini
            ? 3 + 5 * (Number(tile.dataset.kind) - 6)
            : 5 + 5 * Number(tile.dataset.kind);
        const name = count ? info.name : `Wave ${wave}`,
            tally = count ? `×${count}` : info.mini ? 'mini' : 'boss';
        if (label.textContent !== name) label.textContent = name;
        if (number.textContent !== tally) number.textContent = tally;
    }
}

export function renderRecordsScreen({
    runtime,
    resetRecordsArmed,
    resetProfile,
    disarmRecordsReset,
    update,
    bossArt,
}) {
    wireChips();
    const recordProfile = Number(element('recordsProfile').value);
    if (resetRecordsArmed && resetProfile !== recordProfile) disarmRecordsReset();
    const mode = element('recordsMode').value;
    const coOp = mode !== 'solo';
    element('recordsType').disabled = coOp;
    if (coOp && element('recordsType').value !== 'normal') element('recordsType').value = 'normal';
    syncChips();
    const recordRules = {
        mode: coOp ? 'co-op' : 'solo',
        friendlyFire: mode === 'coop-on',
        practice: !coOp && element('recordsType').value === 'practice',
    };
    update(
        element('leaderboardContext'),
        coOp ? 'Team initials board' : 'Initials board · solo, normal runs',
    );
    if (coOp) {
        const board = runtime.teamLeaderboard(recordRules.friendlyFire);
        renderLeaderboard(element('leaderboard'), board.entries);
        update(element('leaderboardStatus'), board.status);
    }
    const best = runtime.records.get(recordProfile, recordRules);
    update(
        element('recordsScope'),
        `Player ${recordProfile + 1} · ${coOp ? 'co-op' : 'solo'} · ${recordRules.practice ? 'practice' : 'normal'}${coOp ? ` · friendly fire ${recordRules.friendlyFire ? 'on' : 'off'}` : ''}`,
    );
    const metrics = element('recordsValues'),
        signature = JSON.stringify(best);
    if (metrics.dataset.signature !== signature) {
        metrics.dataset.signature = signature;
        metrics.replaceChildren();
        if (!best) {
            const empty = document.createElement('div');
            empty.className = 'empty-record';
            const title = document.createElement('dt'),
                body = document.createElement('dd');
            title.textContent = 'No completed runs yet';
            body.textContent = 'Finish a run to set your first personal bests.';
            empty.append(title, body);
            metrics.append(empty);
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
                dd.textContent = Number(value).toLocaleString('en-US');
                cell.append(dt, dd);
                metrics.append(cell);
            }
    }
    element('retryRecords').hidden = !runtime.records.status.startsWith('Could not save');
    if (!coOp) update(element('leaderboardStatus'), runtime.scoreStatus);
    update(
        element('recordsAccuracy'),
        best?.accuracy
            ? `Best accuracy ${accuracyText(best.accuracy.hits, best.accuracy.shots)}`
            : 'Best accuracy: needs a run with at least 50 shots',
    );
    renderBossLog(runtime, recordProfile, bossArt);
    update(element('recordsBosses'), runtime.bossRecords.text(recordProfile));
    if (!resetRecordsArmed) update(element('recordsStatus'), runtime.records.status);
}
