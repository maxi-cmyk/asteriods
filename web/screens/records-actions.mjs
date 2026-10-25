import { element } from '../dom.mjs';
export function createRecordsActions({ getRuntime, profileStore, draw }) {
    let resetRecordsArmed = false;
    function disarmRecordsReset() {
        resetRecordsArmed = false;
        element('resetRecords').textContent =
            'Reset this profile’s personal bests';
        element('cancelResetRecords').hidden = true;
    }
    element('cancelResetRecords').addEventListener('click', disarmRecordsReset);
    for (const id of ['recordsProfile', 'recordsType', 'recordsMode'])
        element(id).addEventListener('change', () => {
            disarmRecordsReset();
            draw();
        });
    element('recordsProfile').value = profileStore.activeProfile;
    let resetProfile;
    element('resetRecords').addEventListener('click', () => {
        const current = Number(element('recordsProfile').value);
        if (!resetRecordsArmed || resetProfile !== current) {
            resetRecordsArmed = true;
            resetProfile = current;
            element('resetRecords').textContent =
                `Confirm reset for Player ${current + 1}`;
            element('cancelResetRecords').hidden = false;
            element('recordsStatus').textContent =
                'Clears all personal bests for this profile, including practice. Top-five scores are kept.';
            return;
        }
        getRuntime().records.reset(current);
        disarmRecordsReset();
        draw();
    });
    let browserResetArmed = false;
    function cancelBrowserReset() {
        browserResetArmed = false;
        element('clearBrowserRecords').textContent =
            'Clear this browser’s records';
        element('cancelBrowserReset').hidden = true;
        element('browserResetStatus').textContent = '';
    }
    element('cancelBrowserReset').addEventListener('click', cancelBrowserReset);
    element('clearBrowserRecords').addEventListener('click', () => {
        const status = element('browserResetStatus');
        if (!browserResetArmed) {
            browserResetArmed = true;
            element('clearBrowserRecords').textContent =
                'Confirm: clear all browser records';
            element('cancelBrowserReset').hidden = false;
            status.textContent =
                'Clears solo and co-op team leaderboards and all personal bests ' +
                'for both profiles, including practice. This cannot be undone.';
            return;
        }
        const cleared = getRuntime().clearRecords();
        cancelBrowserReset();
        disarmRecordsReset();
        status.textContent = cleared
            ? 'All game records cleared in this browser.'
            : getRuntime().scoreStatus;
        draw();
    });

    return {
        disarmRecordsReset,
        cancelBrowserReset,
        get armed() {
            return resetRecordsArmed;
        },
        get profile() {
            return resetProfile;
        },
    };
}
