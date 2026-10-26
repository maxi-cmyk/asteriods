import { element } from '../app/dom.mjs';
export function renderDiagnostics({ inputDiagnostics, diagnosticPad, runtime, controls, update }) {
    if (!inputDiagnostics.hidden) {
        const pad = diagnosticPad;
        update(
            element('inputRaw'),
            pad
                ? `X: ${pad.buttons[0]?.pressed ? 'DOWN' : 'up'} · R2: ${(pad.buttons[7]?.value ?? 0).toFixed(3)} (${pad.buttons[7]?.pressed ? 'DOWN' : 'up'}) · L2: ${(pad.buttons[6]?.value ?? 0).toFixed(3)}`
                : 'No controller visible to this tab. Press a controller button with this tab focused.',
        );
        const [presses, shots, pool, laser] = runtime.fireDiagnostics();
        update(
            element('inputCounts'),
            `Controller presses detected: ${controls.observedFirePresses} · Game presses: ${presses} · Shots fired: ${shots}`,
        );
        update(
            element('inputBlocks'),
            `Rejected — full projectile pool: ${pool} · Laser charging: ${laser} · State: ${runtime.state}`,
        );
    }
}
