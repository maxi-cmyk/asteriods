import { element } from '../app/dom.mjs';

export function renderHomeScreen({
    demoEngine,
    navigation,
    controllerLabel,
    menuDevice,
    profileStore,
}) {
    const watching = !!demoEngine?.active && navigation.screen === 'home';
    element('homeDemo').hidden = !watching;
    element('demoControls').hidden = !watching;
    element('screenTitle').hidden = watching;
    element('homeHint').hidden = watching;
    element('demoHint').hidden = !watching;
    controllerLabel.hidden = watching;
    document.body.dataset.demo = String(watching);
    document.querySelector('.home-menu').hidden = watching;
    element('homeHint').textContent = watching
        ? 'Demo flight · any key or controller action returns Home'
        : menuDevice === 'controller'
          ? 'D-pad / left stick: navigate · Cross: select · Circle: back'
          : 'Arrow keys: navigate · Enter: select · Esc: back';
    if (watching) demoEngine.render();
    element('profileLabel').textContent = `Player ${profileStore.activeProfile + 1}`;
}
