// Observers compare each scene with the one before, so they keep a copy of it. Allocating a new
// 1,408-float array for that every frame is pure garbage; this rotates two buffers instead.
// `keep` is the copy still in use as "the previous scene", which must not be overwritten while
// it is being compared against.
export function copyScene(pool, scene, keep = null) {
    let target = pool.find((copy) => copy !== keep && copy.length === scene.length);
    if (!target) {
        target = new Float32Array(scene.length);
        // Replace a stale buffer (wrong length) or grow to two, never the one in `keep`.
        const stale = pool.findIndex((copy) => copy !== keep && copy.length !== scene.length);
        if (stale >= 0) pool[stale] = target;
        else pool.push(target);
    }
    target.set(scene);
    return target;
}
