import { element } from '../dom.mjs';
import { renderLeaderboard } from './leaderboard.mjs';
export function renderPlayChrome({
    runtime,
    navigation,
    showResults,
    canvas,
    fireButton,
    soundButton,
    pauseButton,
    hint,
    scene,
    controls,
    menuInput,
    stateLabel,
    lastState,
    update,
    isSettingsOpen,
}) {
    const state = runtime.state;
    element('pauseMenu').hidden = navigation.screen !== 'pause';
    document.querySelector('.toolbar').inert = navigation.screen === 'pause' || showResults;
    if (!showResults) canvas.inert = navigation.screen !== 'play';
    element('gameHome').hidden = state !== 'game-over';
    fireButton.hidden = !['initials', 'game-over'].includes(state);
    fireButton.textContent =
        state === 'initials'
            ? scene[30]
                ? 'Retry saving initials'
                : 'Save initials'
            : 'Play again';
    soundButton.disabled = isSettingsOpen();
    element('music').disabled = isSettingsOpen();
    pauseButton.hidden =
        !['playing', 'countdown', 'death', 'paused'].includes(state) ||
        navigation.screen === 'pause';
    const leaderboard = element('leaderboard');
    if (!(navigation.screen === 'records' && element('recordsMode').value !== 'solo')) {
        const entries = Array.from({ length: Math.min(5, scene[31]) }, (_, i) => {
            const at = 486 + i * 5;
            return {
                initials: String.fromCharCode(...scene.subarray(at + 1, at + 4)),
                score: scene[at],
            };
        });
        renderLeaderboard(leaderboard, entries, { highlight: scene[29] });
    }
    if (state === 'initials')
        hint.textContent = scene[30]
            ? 'Could not save initials. Allow browser storage, then choose Retry saving initials.'
            : 'Choose your initials with the direction keys, then Save initials.';
    if (state !== lastState) {
        controls.discardFirePresses();
        menuInput.reset();

        lastState = state;
        stateLabel.textContent = state.toUpperCase().replace('-', ' ');
        pauseButton.textContent = navigation.screen === 'pause' ? 'Resume' : 'Pause';
        pauseButton.disabled = !navigation.live;
        const hints = {
            results: '',
            demo: 'Demo · move or press fire to exit',
            menu: 'Press fire to start',
            countdown: 'Get ready',
            playing: '',
            paused: '',
            death: 'Ship lost',
            initials: 'Choose three letters, then press fire to save',
            'game-over': 'Release fire, then press to retry',
        };
        hint.textContent = hints[state];
    }

    return state;
}
