#pragma once
// Helpers shared by the fights. Each fight family lives in its own header and describes
// its kinds with a BossOps row (see boss/ops.h); coordinates are playfield pixels.

static unsigned bs_density(unsigned n) {
    return boss.tier >= 2 ? (n * 5 + 3) / 4 : n;
}

static float bs_angle_to(float x, float y, float tx, float ty) { return bs_atan2(ty - y, tx - x); }
static void bs_guard_body(float *out, unsigned& n, float x, float y, float r) {
    out[n * 3] = x; out[n * 3 + 1] = y; out[n * 3 + 2] = r; n++;
}
static void bs_particles(float x, float y) { particles_spawn(x, y); }
