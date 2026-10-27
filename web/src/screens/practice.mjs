import { S } from '../runtime/scene-layout.mjs';
import { element, setData } from '../app/dom.mjs';
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
        const heading = `${title} · Asteroids`;
        if (document.title !== heading) document.title = heading;
    }
    update(
        element('runLabel'),
        practice || (runtime.state === 'results' && runtime.result?.rules.practice)
            ? 'Practice flight'
            : 'Solo flight',
    );
    // The tools live in the Pause menu; the HUD shows a quiet tag instead of score and lives.
    setData(
        document.body,
        'practice',
        String(practice || (runtime.state === 'results' && !!runtime.result?.rules.practice)),
    );
    const tools = element('practiceTools');
    if (tools.hidden === practice) {
        tools.hidden = !practice;
        fitCanvas();
    }
    if (practiceButton.disabled) practiceButton.disabled = false;
}
