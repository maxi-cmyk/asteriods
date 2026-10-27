import { element, setData, setHidden, setText } from '../app/dom.mjs';

let menu = null;

export function renderHomeScreen({
    demoEngine,
    navigation,
    controllerLabel,
    menuDevice,
    profileStore,
}) {
    const watching = !!demoEngine?.active && navigation.screen === 'home';
    setHidden(element('homeDemo'), !watching);
    setHidden(element('demoControls'), !watching);
    setHidden(element('screenTitle'), watching);
    setHidden(element('homeHint'), watching);
    setHidden(element('demoHint'), !watching);
    setHidden(controllerLabel, watching);
    setData(document.body, 'demo', String(watching));
    menu ??= document.querySelector('.home-menu');
    setHidden(menu, watching);
    setText(
        element('homeHint'),
        watching
            ? 'Demo flight · any key or controller action returns Home'
            : menuDevice === 'controller'
              ? 'D-pad / left stick: navigate · Cross: select · Circle: back'
              : 'Arrow keys: navigate · Enter: select · Esc: back',
    );
    if (watching) demoEngine.render();
    setText(element('profileLabel'), `Player ${profileStore.activeProfile + 1}`);
}
