import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleHtml } from '../tools/assemble-html.mjs';

const html = assembleHtml();
const pause = html.slice(html.indexOf('id="pauseMenu"'), html.indexOf('id="runSummary"'));

test('practice tools live in the Pause menu, not on the playfield', () => {
    for (const id of ['resetTargets', 'endPractice']) {
        assert.ok(pause.includes(`id="${id}"`), `${id} should be in the pause menu`);
    }
    for (const id of ['practiceMultishot', 'practiceDoubleFire']) {
        assert.ok(!pause.includes(`id="${id}"`), `${id} moved out of the pause menu`);
        assert.ok(
            html.includes(`id="${id}" type="button" aria-pressed="false"`),
            `${id} is a HUD toggle`,
        );
    }
    assert.ok(!html.includes('id="practicePanel"'), 'the on-field practice panel is gone');
    assert.ok(!html.includes('id="practiceGoals"'), 'the skills checklist is gone');
});

test('the practice HUD shows a tag and a note, and nothing else for practice', () => {
    assert.ok(html.includes('class="practice-tag"'));
    assert.ok(html.includes('class="practice-note"'));
});
