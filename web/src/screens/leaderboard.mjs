// The top-five list, shared by Records (solo and team boards). Always five rows, so
// an empty board still reads as a board; the newest score can be highlighted.
export function renderLeaderboard(list, entries, { highlight = -1 } = {}) {
    const signature = JSON.stringify([entries, highlight]);
    if (list.dataset.rows === signature) return;
    list.dataset.rows = signature;
    list.replaceChildren(
        ...Array.from({ length: 5 }, (_, i) => {
            const entry = entries[i],
                row = document.createElement('li');
            row.dataset.empty = String(!entry);
            row.dataset.latest = String(i === highlight);
            for (const [name, text] of [
                ['rank', String(i + 1)],
                ['initials', entry ? entry.initials : '---'],
                ['score', entry ? Number(entry.score).toLocaleString('en-US') : '—'],
            ]) {
                const cell = document.createElement('span');
                cell.className = name;
                cell.textContent = text;
                row.append(cell);
            }
            return row;
        }),
    );
}
