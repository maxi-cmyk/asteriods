# 10 · Boss and mini-boss scripts

Source: `native/boss/fights/*.h`. Numbers are copied from the code at the time of writing; if they
disagree, the code wins. Times are ms from the attack's start (`t`), lengths and radii in px, angles
in radians. "Aim" means toward `boss.target` (the pilot chosen by `bs_acquire`). `n` in counts is the
tier-0 value; tier ≥ 2 multiplies by 1.25 through `bs_density`.

Every row: `OPS = {home x, y, k, phases, cut, rest}` (06). Hit circles are what bullets/laser hit;
**body** circles hurt the ship (09).

---

## 1. Sentinel (`sentinel.h`) and Picket

`OPS_SENTINEL = {366,135, k3, 2 phases, cut 60, rest 950/800/800}`; hp 18×3 at wave 5.

**Mechanic: the gate.** `bs_gate_update` slews `aux[0]` (gate open 0…1) by ±0.08/tick toward 1 when
no attack is running, 0 otherwise. Open (>0.5): core circle r33, flags 3. Closed: `BC_BLOCK` r72,
flags 1. So the plates are shut during attacks and open during the rest. Body: r72 around the centre.

Sequence: phase 1 `LANCE, FAN`; phase 2 `LANCE, FAN, VOLLEY, CROSS`.

| Attack | Timeline | Detail |
| --- | --- | --- |
| LANCE | t0 lane; end 1240 | lane at `x = boss.x − 30`, `y = target_y`, angle π, length = x, half-width 9, warn 900, live 320 |
| FAN | arc at 0 (warn 700); fire at 700; end 800 | arc ±0.28 rad, length 190; 3 needles at `ang + (−1,0,1)·0.28`, speed 2.2, from the turret `(x−82, y)` |
| VOLLEY | aim line at 0 (warn 600, length 400); `n=5` needles at 600 + k·120; end 600 + 120n + 100 | each needle aimed **live** at the nearest pilot at fire time, speed 1.8 |
| CROSS | both lanes at 0; end 1240 | horizontal lane at `y = target ± 80` (away from the pilot, clamp 40…230); vertical lane at `x = target ± 90` (clamp 40…250); warn 900, live 320, half-width 9 |

**Picket** (mini): `{380,135,k5,1,–,1100}`, lance only, bobs `y = home ± 36` with a 7 s period,
core r18 when open / block r40 closed, body r40.

---

## 2. Ringwarden (`ringwarden.h`) and Shardling

`{352,135,k6,3 phases,cut 66/33, rest 1200/1100/1000}`; core circle r26; 27 parts.

**Parts** (`PK_BLADE`): 16 outer blades on a ring of radius 106 (part radius 14) and 11 inner on 70
(radius 12), hp 1. The rings spin (`aux[1]` +0.0042/tick, `aux[2]` −0.0075/tick) and breathe
(`aux[0]` = 1 + 0.02·sin). Blades are `BC_PART` circles, flags 3; the core is emitted after them, so
a bullet strikes whichever it meets first — blades protect the core unless gaps line up. Boss y
drifts ±40 with an 8 s period. A broken blade (`until`) regrows with hp 1.
Ringwarden also drops a timed shield every 7 s (06).

Sequence: p1 `BURST, BURST`; p2 `BURST, PRISM, PICK, PRISM`; p3 `COLLAPSE, BURST, PRISM, PICK`.

| Attack | Timeline | Detail |
| --- | --- | --- |
| BURST | tell at 0 (warn 700, r124); fire at 700; end 1000 | up to 12 shards (speed 1.6) from every 2nd outer blade, then every 3rd inner; each source blade breaks and regrows after **3000** |
| PRISM | beam at 0 (warn 900, live 1745); end 900+1745+100 | origin = core; start angle = aim ∓ 0.785 (dir random), sweeping 0.018 rad/tick (0.9 rad/s) over 90° |
| PICK | aim line at 0 (warn 500) from `(x−128, y)`; 3 fast shots at 500, 650, 800; end 900 | speed 2.6 |
| COLLAPSE | ring at 0 (warn 1200, live 4500, radius 40, +2.0/tick, half-gap 0.61) plus tell; rings shrink `aux[0]` 1→0.2 over 1200; at 1200 all blades break (regrow **2500**) and shake; end 1300 | gap centred ±1.0 rad from the pilot, alternating by `cycle` |

Hit on a blade → it breaks (regrow 6000). The core is hit only through gaps, broken blades, or by the
laser (flags 3 everywhere, so it pierces).

**Shardling** (mini): `{370,135,k8,1,–,1000}`. Three `BC_BLOCK` blades (r11) orbit at radius 46
(`aux[2]` += 0.02/tick); core r22. One attack: aim line (warn 500, length 480) from a muzzle 62 px
toward the pilot, 3 fast shots (2.6) at 500/650/800, and it **kites** — drifts toward x=300 at
the start and back home at 1100 (max 1.1 px/tick horizontally, tracks pilot y at 0.8).

---

## 3. Cinderforge (`cinderforge.h`) and Cinderling

`{340,135,k7,3 phases,cut 66/33, rest 900/750/650}`; 8 panel parts on an arc of radius 108
(`angle = π + (i − 3.5)·0.32`), hp 3, r16.

**Circles:** while `stamp[0]` (open-until) is in the future: core r34 flags 3. Otherwise: each panel
(flags 1), a `BC_BLOCK` shell r114 (flags 1), and the core r34 with **flags 2** (laser only).
**Soak:** laser at half unless open. **Panel hit:** closed panels lose hp and become broken
(state 2); open/broken panels forward 1 damage to the core.
**Body:** r116. Heat glow `aux[0]`, open flag `aux[1]`.

Sequence: p1 `LOB, EMBER, GEYSER, LOB`; p2 `LOB, JETS, HAMMER, EMBER, GEYSER, VENT`;
p3 `NOVA, BARRAGE, JETS, HAMMER, LOB, EMBER, VENT`.

| Attack | Detail |
| --- | --- |
| LOB | `n` = 1 (p1) or 2 (p2+) lobs 500 apart; `bs_lob`: an `SF_LOB` shot flies 1200 ms to a marker (clamped 36…330 × 36…240) and a pool hazard (warn 1200, live 4000, r22) is created and linked; the second lob targets the nearest pilot. Ends at `(n−1)·500 + 1300` |
| JETS | at 0: `3 + broken panels` (max 4) lanes from panels (width 14, length 420, warn 900, live 500); broken panels fire first; fired panels are marked open until +2900; end 1500 |
| EMBER | arc (warn 600, 0.6 rad, length 190), at 600 an `n=7` fan of embers, speed 2.4, spacing 0.2 rad |
| HAMMER | `n=3` full-height columns (lane angle π/2, length 270, half-width 15, warn 900, live 380) 550 ms apart; first on the pilot's column ±25, others 70–110 px away from the previous, ≥ 60 apart |
| GEYSER | `n=4` lanes up from the floor (y 262, angle −π/2, length 120–180, half-width 11, warn 900, live 450) 420 apart at random x (first near the pilot); a scorch (r12, 4.5 s) at each base after the jet |
| BARRAGE | 3 lobs 350 apart around the pilot (±75 px, ±70 y) |
| VENT | 2–3 panels (blown-out ones first) get aim lines (warn 600); at 600 each spits 3 embers (±0.18) |
| NOVA | ring from the core (radius 120, +2.0/tick, half-gap 0.52, warn 1000, live 4200) + tell; at 1000 every second panel blows out, **the shell opens for 2000**, shake |

Pools burn down into scorch (6 s) — see 08. A lob shot down by the player is the trade: the pool is
cancelled, but three embers and a small scorch remain (07).

**Cinderling** (mini): `{380,135,k5,1,–,900}`; core r24, block r50. Picks `LOB` only when no lob and
no pool exist. The shell opens for 2300 ms after each lob (`stamp[0]`).

---

## 4. Bastion (`bastion.h`) and Gunnery

`{324,138,k5,2 phases,cut 50, rest 1300/1000/1000}`; 3 hardpoints (`PK_HARD`, hp 6, r 34/28/24) at
offsets `(8,−56)` dorsal, `(−28,58)` missile bay, `(50,56)` launch bay. Core r17 at `(x+114, y+2)`.
Body: four overlapping circles along the hull.

**Armour (`soak`):** while any hardpoint exists, primary shots are halved (see 09); the laser ignores
it. **Revive:** if all three are down for 8000 ms they come back **once** with hp 6; entering phase 2
revives them with hp 7. The attacks require their hardpoint: `pick` skips attacks whose part is gone.

Sequence: p1 `CANNON, MISSILE, CANNON, MINES`; p2 `CANNON, MISSILE, BROAD, MINES`.

| Attack | Detail |
| --- | --- |
| CANNON | `n` = 1 (p1) / 2 (p2) bolts, 400 apart: `bs_bolt` creates an aim line (warn 500, length 520) and queues a bolt in `aux[8…]`; `bs_bolts_tick` fires it (speed 3.0) at `game_ms ≥ fire_at`. The second bolt aims at the nearest pilot |
| MISSILE | 2 / 3 homing missiles (hp 2, turn 0.04, life 4000) 600 apart from the belly bay |
| MINES | 2 / 3 mines (drift −0.8, vy ±, hp 1, life 2000) 700 apart |
| BROAD | arc warning (warn 800, π/2 wide); 10 needles at 800 + i·110 from alternating top/bottom hull edges, aimed at the nearest pilot, speed 2.2 |

**Gunnery** (mini): `{372,135,k8,1,–,1100}`; one core circle r15, `MA_BOLTS`: two aim lines then two
bolts; bobs ±20 with a 6 s period.

---

## 5. Tidecaller (`tidecaller.h`) and Moonjelly

`{356,142,k5,3 phases,cut 70/35, rest 800/700/520}`; 3 bubbles (`PK_BUBBLE`, hp 2, r14) orbit at 108.
The body sways in a figure of eight (period 9 s). Bell core r72 at `(x, y−37)`.

**Circles:** with any bubble: bubbles (flags 3), `BC_BLOCK` r72 (flags 1) and the core flags 2 (laser
only); with none: core flags 3. **Soak:** a laser first **pops all bubbles**. Bubbles reform **once**,
3000 ms after the last pops.

Sequence: p1 `SINE, RAIN, SINE, WALL`; p2 `SINE, TENDRIL, WALL, RAIN, SPORE, WHIRL`;
p3 adds `PULSE`.

| Attack | Detail |
| --- | --- |
| SINE | per-stream randoms in `scratch` (muzzle height ±62, tilt ±0.16, seed). Arc warning 600; `n` = 13 (p1) / 16 (p2+) columns; each column's height, bearing (±0.11), speed 1.6–2.2 and amplitude 18–32 come from a hash of the seed; gaps 68–118 ms; from phase 2 a mirrored (phase π) column is added |
| TENDRIL | two `HK_ARM` (length 190, warn 900, live 3272) pivoting from above and below, sweeping toward each other at ±0.016 rad/tick |
| SPORE | 1 (p1–2) / 2 (p3) spores (r18, hp 1, life 2000), the second aimed at the nearest pilot |
| PULSE | ring from the bell (radius 66, +2.0, half-gap 0.52, warn 700, live 4000) |
| WALL | 2 (3 in p3) walls 1100 apart: two aim lines mark a 68 px gap (warn 700), then 17 pellets across the field (speed 1.45) skip the gap; gap y random 64…206 |
| RAIN | 5 (7 in p3) spores fall from random columns 380 ms apart (speed 1.15, life 2300) |
| WHIRL | two rings (radius 76, −0.22/tick closing, half-gap 0.62, warn 1100, live 3400) at random points ≥ 105 px from every pilot and ≥ 110 from each other, each with a spinning gap |

**Moonjelly** (mini): `{380,140,k8,1,–,1300}`; core r44; one attack, `MA_SINE6`, 6 aimed sine columns.

---

## 6. Horizon Warden (`warden.h`) and Lens Imp

`{338,135,k4,3 phases,cut 70/35, rest 1000/850/700}`; 4 S-stars (`PK_STAR`, hp 5, r8) on ellipses
`{a,b,rotation}` = `(138,78,.5) (152,96,2.2) (124,70,4.1) (106,60,3.2)`. Each star fires one needle
(speed 2.2, after a 500 ms aim line) every 4000 ms, staggered 1000 ms apart.

**Orbit maths (SVD reading).** `bs_star_pos` places star `i` at
`boss + R(rot)·diag(a, b)·(cos t, sin t)`, so the orbit map is `M = R(rot)·diag(a, b)`. That is
already a singular value decomposition: `U = R(rot)`, `Σ = diag(a, b)`, `V = I`, and `(cos t, sin t)`
is the unit circle that `M` stretches into the orbit. The singular values are the semi-axes, the
eigenvalues of `MMᵀ` are `a²` and `b²`, `|det M| = ab` gives the area `π·ab`, and `κ = a/b` is the
squash. (`rot` is an angle: values over π duplicate the ellipse at `rot − π`. The phase is
`clock·(100/a) + 2·rot`, so larger orbits turn more slowly and the speed along each long axis is the
same for all four stars.)

| Star | `σ₁ = a` | `σ₂ = b` | `rot` (rad) | `κ = a/b` | eigenvalues of `MMᵀ` | orbit area |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 138 | 78 | 0.5 | 1.77 | 19044, 6084 | 33 816 px² |
| 1 | 152 | 96 | 2.2 | 1.58 | 23104, 9216 | 45 842 px² |
| 2 | 124 | 70 | 4.1 | 1.77 | 15376, 4900 | 27 269 px² |
| 3 | 106 | 60 | 3.2 | 1.77 | 11236, 3600 | 19 981 px² |

(Checked with `numpy.linalg.svd` on `M` and `eigvalsh` on `MMᵀ`.) The same decomposition would turn
these orbits into exact elliptical hit shapes; see the exercise in 09.

**Core window:** every 8 s the core is hittable for 2000 ms (`stamp[1]`, `aux[1]` = halo). Circles:
star circles always (flags 3, r9); outside the window a `BC_BLOCK` r100 plus a laser-only core r46;
inside the window (or with all stars dead) the core r46 flags 3. A window that would land during a
cloak waits until 400 ms after it.

**Mirror** (phase ≥ 2): during the closed stretch between windows — forms for 600 ms (`aux[5] = .5`),
then holds 2600 ms (p2) / 3500 ms (p3) at `aux[5] = 1`. While up, the core/block are replaced by a
`BC_DEFLECT` r104 (09). The stars can still be shot.

**Cloak** (`WX_CLOAK`): shimmer 600 ms (tell ring), then vanishes for 2400 ms at a new height
(100…172, ≥ 30 px from the old), firing two fans of 3 needles (±0.22) from the dark, each after a
500 ms aim line. No circles and no body while cloaked. Not started during or just before a window.

Sequence: p1 `LANCE, SPIRAL, PICK, FAN, CURVE, PRISM`; p2 `LOB, CANNON, JETS, MISSILE, EMBER, BURST,
MINES`; p3 `SINE, TENDRIL, CLOAK, ACCRETE, SPORE, NOVA, PULL`. From phase 3, every even attack
(`seq_total % 2 == 0`) is drawn at random from `WARDEN_POOL` (every earlier boss attack). Attacks from
other bosses run through their own `*_run` function with the Warden's position.

| New attack | Detail |
| --- | --- |
| SPIRAL | tell 700; 15 steps 160 apart, each fires 3 pellets (speed 1.7) from a ring of radius 124, angles `k·0.30 + j·2π/3`, skipping those pointing at the right wall (`cosf(a) > .5`: a dot product `u·e_x > 0.5`, i.e. within 60° of straight right) |
| CURVE | aim line 500; `n=5` `SF_CURVE` shots 300 apart, speed 2.0, `turn ±0.012`/tick away from the core; initial angle pre-compensated so they arrive near the pilot. Calm assist: turn 0 |
| ACCRETE | per alive pilot a closing ring at their position (radius 96 shrinking 6% per pass to a floor of 48, collapsing at 0.9/tick to 32; half-gap 0.52; gap spin 0.011; warn 900) |
| PULL | tell 1200 then `HK_PULL` live 1500, 0.8 px/tick toward the core; used **once** (`stamp[4]`); never under calm assist |
| BURST / JETS / NOVA | Ringwarden burst / Cinderforge jets / nova re-cut for the Warden |

**Exercise (Markov view).** From phase 3 every even attack is drawn uniformly from `WARDEN_POOL`, so
attack-to-attack behaviour is a Markov chain with a transition matrix `T` whose rows sum to 1. The
long-run attack frequencies are its stationary distribution, the left eigenvector of `T` with
`λ = 1`. Build `T` from the sequence rows and the pool, compute that eigenvector, and compare with
attack counts from many seeded runs (13). Not done here.

**Lens Imp** (mini): `{380,135,k6,1,–,1000}`; core r30. Alternates `CURVE1` (one curving shot, aim
line 500) and `BLINK` (900 ms tell, then reappears at another height ≥ 50 px away); while blinking it
has no circle and no body.

---

## Reading a new fight in the code

1. Find its `OPS_*` row (end of the file) and the `BossRow` sequence at the top.
2. `*_begin` creates parts; `*_update` is passive motion and part positions.
3. `*_circles` and `*_body` define what can be hit and what hurts.
4. `*_run(id, t)` is a `switch` of attacks; every effect is `if (bs_at(t, ms))`.
5. `aux`/`stamp`/`scratch` slots are named by enums at the top of the file (list in 12).
