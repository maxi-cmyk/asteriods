import { element } from '../dom.mjs';
export function renderPractice({
    scene,
    navigation,
    runtime,
    update,
    practiceButton,
    fitCanvas,
}) {
    const practice = !!scene[60];
    const title =
        navigation.screen === 'pause'
            ? 'Paused'
            : runtime.state === 'results'
              ? 'Results'
              : runtime.state === 'initials'
                ? 'Save initials'
                : runtime.state === 'game-over'
                  ? 'Leaderboard'
                  : practice
                    ? 'Practice'
                    : 'Solo flight';
    if (['play', 'pause'].includes(navigation.screen)) {
        update(element('screenTitle'), title);
        document.title = `${title} · Asteroids`;
    }
    update(
        element('runLabel'),
        practice ||
            (runtime.state === 'results' && runtime.result?.rules.practice)
            ? 'Practice flight'
            : 'Solo flight',
    );
    const practicePanel = element('practicePanel');
    if (practicePanel.hidden === practice) {
        practicePanel.hidden = !practice;
        fitCanvas();
    }
    practiceButton.disabled = false;
    for (const [index, item] of [
        ...document.querySelectorAll('#practiceGoals li'),
    ].entries()) {
        const done = !!(scene[62] & (1 << index));
        item.classList.toggle('done', done);
        const label = `${item.textContent}: ${done ? 'complete' : 'to try'}`;
        if (item.getAttribute('aria-label') !== label)
            item.setAttribute('aria-label', label);
    }
    const tried = Array.from(
        { length: 5 },
        (_, i) => !!(scene[62] & (1 << i)),
    ).filter(Boolean).length;
    update(
        element('practiceProgress'),
        tried === 5
            ? 'All five skills tried. Keep practicing, or end practice.'
            : `${tried}/5 skills tried. No lives lost. Targets and shields replenish. Scores stay out of the leaderboard.`,
    );
    return practicePanel;
}
