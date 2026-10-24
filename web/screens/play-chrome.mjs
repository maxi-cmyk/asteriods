import { element } from '../dom.mjs';
export function renderPlayChrome({
    runtime,
    navigation,
    practicePanel,
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
    practicePanel.inert = navigation.screen !== 'play' || showResults;
    document.querySelector('.toolbar').inert =
        navigation.screen === 'pause' || showResults;
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
    const rows = Array.from({ length: Math.min(5, scene[31]) }, (_, i) => {
        const at = 486 + i * 5;
        return `${String.fromCharCode(...scene.subarray(at + 1, at + 4))}    ${scene[at]}`;
    });
    const text = rows.join('|');
    if (leaderboard.dataset.rows !== text) {
        leaderboard.dataset.rows = text;
        leaderboard.replaceChildren(
            ...(rows.length ? rows : ['No scores saved yet.']).map((value) => {
                const li = document.createElement('li');
                li.textContent = value;
                return li;
            }),
        );
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
        pauseButton.textContent =
            navigation.screen === 'pause' ? 'Resume' : 'Pause';
        pauseButton.disabled = !navigation.live;
        const hints = {
            results: 'Run complete · review your stats, then continue',
            demo: 'Demo · move or press fire to exit',
            menu: 'Press fire to start',
            countdown: 'Get ready',
            playing: 'Release fire between shots',
            paused: 'Paused · choose Resume or press Options · Esc goes back',
            death: 'Ship lost',
            initials: 'Choose three letters, then press fire to save',
            'game-over': 'Release fire, then press to retry',
        };
        hint.textContent = hints[state];
    }

    return state;
}
