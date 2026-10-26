import { S } from '../scene-layout.mjs';
import { element } from '../dom.mjs';
export function renderPractice({ scene, navigation, runtime, update, practiceButton, fitCanvas }) {
    const practice = !!scene[S.PRACTICE];
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
                    : runtime.coop
                      ? 'Local co-op'
                      : 'Solo flight';
    if (['play', 'pause'].includes(navigation.screen)) {
        update(element('screenTitle'), title);
        document.title = `${title} · Asteroids`;
    }
    update(
        element('runLabel'),
        practice || (runtime.state === 'results' && runtime.result?.rules.practice)
            ? 'Practice flight'
            : 'Solo flight',
    );
    // The tools live in the Pause menu; the HUD shows a quiet tag instead of score and lives.
    document.body.dataset.practice = String(
        practice || (runtime.state === 'results' && !!runtime.result?.rules.practice),
    );
    const tools = element('practiceTools');
    if (tools.hidden === practice) {
        tools.hidden = !practice;
        fitCanvas();
    }
    practiceButton.disabled = false;
}
