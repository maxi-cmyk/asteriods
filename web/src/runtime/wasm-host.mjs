const SCORE_BYTES = 42; // five entries of three initials and a score: the version-1 layout
const SAVED = 'Top-five scores saved in this browser.';
const NO_STORAGE = 'Storage unavailable; initials cannot be saved.';
const UNREADABLE = 'Saved leaderboard could not be read.';
const SAVE_FAILED = 'Could not save initials. Allow browser storage and retry from score entry.';

// Instantiates the engine and supplies everything it may import: math, randomness, the
// audio tone hook and the leaderboard bytes in browser storage. `scoreStatus` carries the
// last storage outcome for the UI.
export class WasmHost {
    static async load(bytes, { storage, random, tone = () => {}, scoreKey }) {
        const host = new WasmHost(storage, scoreKey, random, tone);
        const { instance } = await WebAssembly.instantiate(bytes, host.#imports());
        host.api = instance.exports;
        host.api.__wasm_call_ctors();
        return host;
    }
    constructor(storage, scoreKey, random, tone) {
        this.storage = storage;
        this.scoreKey = scoreKey;
        this.tone = tone;
        this.api = null;
        this.scoreStatus = storage ? SAVED : NO_STORAGE;
        const words = new Uint32Array(64);
        let at = words.length;
        this.random =
            random ||
            (() => {
                if (at === words.length) {
                    crypto.getRandomValues(words);
                    at = 0;
                }
                return words[at++];
            });
    }
    get memory() {
        return this.api.memory;
    }
    #imports() {
        return {
            env: {
                sinf: Math.sin,
                cosf: Math.cos,
                browser_random: this.random,
                browser_tone: this.tone,
                browser_storage_read: (pointer, capacity) => this.#read(pointer, capacity),
                browser_storage_write: (pointer, length) => this.#write(pointer, length),
            },
        };
    }
    #read(pointer, capacity) {
        try {
            const raw = this.storage?.getItem(this.scoreKey);
            if (!raw) return 0;
            const record = JSON.parse(raw);
            if (
                !Array.isArray(record) ||
                record.length !== SCORE_BYTES ||
                record.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
            ) {
                this.scoreStatus = UNREADABLE;
                return 0;
            }
            if (pointer && capacity >= record.length)
                new Uint8Array(this.memory.buffer, pointer, record.length).set(record);
            return record.length;
        } catch {
            this.scoreStatus = UNREADABLE;
            return 0;
        }
    }
    #write(pointer, length) {
        try {
            if (!this.storage) {
                this.scoreStatus = NO_STORAGE;
                return 0;
            }
            this.storage.setItem(
                this.scoreKey,
                JSON.stringify([...new Uint8Array(this.memory.buffer, pointer, length)]),
            );
            this.scoreStatus = SAVED;
            return length;
        } catch {
            this.scoreStatus = SAVE_FAILED;
            return 0;
        }
    }
}
