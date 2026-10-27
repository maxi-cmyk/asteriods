import { S, BLOCKS, leaderboardEntries } from '../runtime/scene-layout.mjs';
import { element, setHidden, setProp, setText } from '../app/dom.mjs';
import { renderLeaderboard } from './leaderboard.mjs';

// The leaderboard changes a few times a session, so the scene's score block is compared as
// numbers and the entries are only decoded (and the list only diffed) when it moved.
const BOARD_FLOATS = BLOCKS.HIGHSCORES.stride * BLOCKS.HIGHSCORES.count;
const boardSeen = new Float32Array(BOARD_FLOATS + 2).fill(NaN);
function boardMoved(scene) {
    let moved = false;
    const note = (i, value) => {
        if (boardSeen[i] !== value) {
            boardSeen[i] = value;
            moved = true;
        }
    };
    for (let i = 0; i < BOARD_FLOATS; i++) note(i, scene[BLOCKS.HIGHSCORES.at + i]);
    note(BOARD_FLOATS, scene[S.SCORE_COUNT]);
    note(BOARD_FLOATS + 1, scene[S.SAVED_RANK]);
    return moved;
}
let toolbar = null;
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
    setHidden(element('pauseMenu'), navigation.screen !== 'pause');
    toolbar ??= document.querySelector('.toolbar');
    setProp(toolbar, 'inert', navigation.screen === 'pause' || showResults);
    if (!showResults) setProp(canvas, 'inert', navigation.screen !== 'play');
    setHidden(element('gameHome'), state !== 'game-over');
    setHidden(fireButton, !['initials', 'game-over'].includes(state));
    setText(
        fireButton,
        state === 'initials'
            ? scene[S.SAVE_FAILED]
                ? 'Retry saving initials'
                : 'Save initials'
            : 'Play again',
    );
    const settingsOpen = isSettingsOpen();
    setProp(soundButton, 'disabled', settingsOpen);
    setProp(element('music'), 'disabled', settingsOpen);
    setHidden(
        pauseButton,
        !['playing', 'countdown', 'death', 'paused'].includes(state) ||
            navigation.screen === 'pause',
    );
    if (!(navigation.screen === 'records' && element('recordsMode').value !== 'solo')) {
        if (boardMoved(scene))
            renderLeaderboard(element('leaderboard'), leaderboardEntries(scene), {
                highlight: scene[S.SAVED_RANK],
            });
    } else boardSeen.fill(NaN); // Records is showing a team board in this list
    if (state === 'initials')
        setText(
            hint,
            scene[S.SAVE_FAILED]
                ? 'Could not save initials. Allow browser storage, then choose Retry saving initials.'
                : 'Choose your initials with the direction keys, then Save initials.',
        );
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
