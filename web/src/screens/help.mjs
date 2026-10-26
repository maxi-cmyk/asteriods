import { element } from '../app/dom.mjs';
import { KEY_ACTIONS, PAD_ACTIONS, PAD_BUTTONS, keyLabel } from '../state/settings.mjs';

export function createHelpScreen(settings) {
    let lastHelpDevice = '';
    function render(controller) {
        const signature = JSON.stringify([controller, settings]);
        if (lastHelpDevice === signature) return;
        lastHelpDevice = signature;
        element('helpDevice').textContent = controller
            ? 'Connected controller · your current profile bindings'
            : 'Keyboard + mouse · your current profile bindings';
        const rows = controller
            ? [
                  ['Move / Aim', 'Left stick / Right stick'],
                  ...Object.entries(PAD_ACTIONS).map(([key, [label]]) => [
                      label,
                      PAD_BUTTONS[settings.buttons[key]],
                  ]),
                  [
                      'Precision movement',
                      `${PAD_BUTTONS[settings.buttons.shield]} + ${PAD_BUTTONS[settings.buttons.precision]}`,
                  ],
              ]
            : [
                  [
                      'Move',
                      ['up', 'left', 'down', 'right']
                          .map((k) => keyLabel(settings.keys[k]))
                          .join(' / ') + ' or arrows',
                  ],
                  [
                      'Aim',
                      'Mouse or ' +
                          ['aimUp', 'aimLeft', 'aimDown', 'aimRight']
                              .map((k) => keyLabel(settings.keys[k]))
                              .join(' / '),
                  ],
                  ...['fire', 'laser', 'shield', 'precision', 'pause'].map((key) => [
                      KEY_ACTIONS[key][0],
                      keyLabel(settings.keys[key]) +
                          (key === 'fire'
                              ? ' / left click / Enter'
                              : key === 'laser'
                                ? ' / right click'
                                : key === 'pause'
                                  ? ' / Esc'
                                  : ''),
                  ]),
              ];
        const list = element('helpBindings');
        list.replaceChildren();
        for (const [label, value] of rows) {
            const dt = document.createElement('dt'),
                dd = document.createElement('dd');
            dt.textContent = label;
            dd.textContent = value;
            list.append(dt, dd);
        }
    }
    return { render };
}
