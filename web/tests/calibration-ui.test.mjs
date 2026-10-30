import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleHtml } from '../tools/assemble-html.mjs';

const html = assembleHtml();
const panel = html.slice(
    html.indexOf('id="calibration"'),
    html.indexOf('data-settings-panel="audio"'),
);

test('the calibration panel keeps every element the controller code drives', () => {
    for (const id of [
        'calibrationController',
        'moveStick',
        'aimStick',
        'moveValues',
        'aimValues',
        'sampleDrift',
        'applyDeadzone',
        'sampleFill',
        'calibrationStatus',
        'inputPreview',
        'previewShip',
        'previewHelp',
    ])
        assert.ok(panel.includes(`id="${id}"`), id);
    for (const stick of ['moveStick', 'aimStick'])
        for (const part of ['raw', 'adjusted', 'deadzone'])
            assert.ok(
                new RegExp(`id="${stick}"[\\s\\S]*?class="${part}"`).test(panel),
                `${stick} .${part}`,
            );
    for (const id of ['moveValues', 'aimValues'])
        for (const part of ['raw-value', 'adjusted-value'])
            assert.ok(
                new RegExp(`id="${id}"[^>]*>[\\s\\S]*?class="${part}"`).test(panel),
                `${id} .${part}`,
            );
});
