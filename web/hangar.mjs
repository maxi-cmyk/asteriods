// Hangar: which cosmetic hull each local profile flies. Hulls change looks only;
// movement, hitboxes, weapons and scoring are identical, so records stay
// comparable. Choices persist per profile under their own storage key, apart
// from Settings, so equipping never counts as an unapplied settings change.
export const HANGAR_KEY = 'asteroids.web.hangar-v1';
export const DEFAULT_HULL = 'vanguard';
// `vanguard` is the stock sprite in sprites.png; the rest come from ships.png.
export const HULLS = Object.freeze([
    {
        id: 'vanguard',
        name: 'Vanguard',
        blurb: 'The stock fighter. Light hull, clean lines.',
        accent: '#6ef0ff',
    },
    {
        id: 'dart',
        name: 'Dart',
        blurb: 'Swept wings and a quick nose. The all-rounder.',
        accent: '#5ee4ff',
    },
    {
        id: 'lancer',
        name: 'Lancer',
        blurb: 'A long needle with tiny wings. Cuts straight.',
        accent: '#ffc860',
    },
    {
        id: 'wasp',
        name: 'Wasp',
        blurb: 'Forward-swept blades. Looks mean, flies fine.',
        accent: '#ff6ec7',
    },
    { id: 'hammer', name: 'Hammer', blurb: 'Broad, armoured and proud of it.', accent: '#ff8a4a' },
    {
        id: 'moth',
        name: 'Moth',
        blurb: 'Wide delta wings that catch the light.',
        accent: '#9a7aff',
    },
    { id: 'comet', name: 'Comet', blurb: 'A rounded capsule with side pods.', accent: '#7aff9a' },
]);
export const isHull = (id) => HULLS.some((hull) => hull.id === id);
export const hullById = (id) => HULLS.find((hull) => hull.id === id) || HULLS[0];
export const hullSprite = (id, direction) =>
    id === DEFAULT_HULL || !isHull(id) ? `ship-aim-${direction}` : `hull-${id}-aim-${direction}`;
export const hullIcon = (id) => (id === DEFAULT_HULL || !isHull(id) ? 'ship' : `hull-${id}-icon`);

export function sanitizeHangar(raw) {
    const list = Array.isArray(raw?.profiles) ? raw.profiles : [];
    return { profiles: [0, 1].map((i) => (isHull(list[i]) ? list[i] : DEFAULT_HULL)) };
}
export function loadHangar(storage) {
    let raw;
    try {
        raw = JSON.parse(storage?.getItem(HANGAR_KEY) || 'null');
    } catch {}
    return sanitizeHangar(raw);
}
export function saveHangar(storage, store) {
    try {
        storage.setItem(HANGAR_KEY, JSON.stringify({ version: 1, ...sanitizeHangar(store) }));
        return true;
    } catch {
        return false;
    }
}
