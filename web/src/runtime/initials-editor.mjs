const STICK_LOW = 1300,
    STICK_HIGH = 2800,
    REPEAT_TICKS = 12;

// Three-letter initials entry driven by a stick: left/right picks the slot, up/down the
// letter, both auto-repeating. (The solo engine does this in C++; co-op does it here.)
export class InitialsEditor {
    constructor() {
        this.reset();
    }
    reset() {
        this.letters = ['A', 'A', 'A'];
        this.slot = 0;
        this.ready = false; // fire was released since the screen opened
        this.letterRepeat = 0;
        this.slotDirection = 0;
        this.slotRepeat = 0;
    }
    get text() {
        return this.letters.join('');
    }
    // `input.x` / `input.y` are raw 0-4095 stick values (2048 is centre).
    navigate(input) {
        const horizontal = input.x < STICK_LOW ? -1 : input.x > STICK_HIGH ? 1 : 0;
        if (!horizontal) {
            this.slotDirection = 0;
            this.slotRepeat = 0;
        } else if (horizontal !== this.slotDirection || !this.slotRepeat) {
            this.slot = Math.max(0, Math.min(2, this.slot + horizontal));
            this.slotRepeat = REPEAT_TICKS;
            this.slotDirection = horizontal;
        } else this.slotRepeat--;
        const direction = input.y < STICK_LOW ? 1 : input.y > STICK_HIGH ? -1 : 0;
        if (!direction) this.letterRepeat = 0;
        else if (!this.letterRepeat) {
            this.letters[this.slot] = String.fromCharCode(
                65 + ((this.letters[this.slot].charCodeAt(0) - 65 + direction + 26) % 26),
            );
            this.letterRepeat = REPEAT_TICKS;
        } else this.letterRepeat--;
    }
}
