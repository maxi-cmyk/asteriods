# Network design and security

Local-only (`docs/` is gitignored). Companion to `DESIGN-DECISIONS.md` (overview) and
`nextSteps.md` (plan: S3–S6). Status tags: **[decided]**, **[open]** (a choice still to make),
**[todo]** (a check to build or run). Last reviewed 2026-10-27. Nothing here is built yet.

## 1. Topology

```
 Local   browser ─────────────── game.wasm (in the page)            no network

 LAN     browser A ──┐
                     ├─ ws:// ── Node server ── game.wasm (headless)    host's PC
         browser B ──┘          (npm run host, serves the page too)

 Online  browser A ──┐
                     ├─ wss:// ─ reverse proxy/platform ─ container: same Node server
         browser B ──┘                                    + game.wasm (headless)
```

| | Local | LAN | Online |
| --- | --- | --- | --- |
| Who simulates | each browser | the server | the server |
| Transport | none | `ws://` (plain) | `wss://` (TLS) |
| Page served from | any | the host's server (same origin) | the server, or a static host |
| Trust boundary | none | between players on the same network | the public internet |
| Who is "the server" | n/a | one player's computer | your cloud account |

The server program is identical for LAN and Online. Only the deployment differs.

## 2. Architecture decisions

| # | Decision | Status | Reason | Rejected alternative |
| --- | --- | --- | --- | --- |
| N1 | **Authoritative server** runs the simulation; clients send inputs, draw scenes | decided | The engine takes `sin/cos` from the browser, so two browsers can disagree; the server is the one referee, so there is nothing to sync and cheating is limited | Lockstep (needs bit-identical browsers); browser-as-host (throttled tabs, can cheat, NAT) |
| N2 | **WebSocket** transport | decided | Works through every proxy and platform, no signalling server | WebRTC (NAT/TURN, more moving parts) |
| N3 | **Same-origin**: server serves the page and `/ws` | decided | No CORS, one URL, one cert | Separate static host (kept as an option via a Server URL setting) |
| N4 | One server program for LAN and Online | decided | Cannot drift apart | Separate LAN build |
| N5 | **One instance per region**, rooms in memory | decided | Simple; rooms are small | Shared state store, sticky load balancing |
| N6 | **No accounts**; players are anonymous slots in a room | decided | Nothing to leak or breach | Login |
| N7 | **Input frames** up (`seq, tick, stick, aim, buttons`), **snapshots** down (25 Hz, quantised, delta) | decided | Small, and the client never sends state | Client-sent positions |
| N8 | Server stubs host imports (storage, audio); records stay on each client | decided | Server stays stateless between runs | Server-side records |
| N9 | Client prediction for own ship | **open** | Only if LAN input lag measures over ~80 ms | Always predict |
| N10 | Fall back to WebRTC data channels | **open** | Only if measured packet loss makes TCP stalls visible | n/a |

Reference numbers: tick 50 Hz, snapshot 25 Hz, target under 20 kB/s per client, reconnect
grace 10 s, interpolation delay about 2 snapshots. Raw scene is 1408 floats (5.6 kB) per tick.

### The maths behind the numbers

- **Bandwidth.** A raw scene is 1408 × 4 B = 5632 B. At 25 Hz that is about 141 kB/s per client, so
  the 20 kB/s target needs roughly 7× from delta coding and quantisation. A delta `s_k − s_{k−1}` is
  mostly zeros (inactive pool slots), which is why delta coding suits this data. A low-rank (SVD/PCA)
  model of the scene stream is the other idea; spawns and despawns are jumps a linear subspace models
  badly, so it is an experiment, not a plan (`web/combat-docs/12`).
- **Quantisation error.** A uniform step `q` leaves at most `q/2` error per number, so at most
  `(q/2)·√1408 ≈ 19·q` in norm if every number were at its worst; in practice positions matter and
  most of the vector is zero. Choose `q` per field from what the renderer can show (one playfield
  pixel is the natural ceiling).
- **Interpolation (N7).** Snapshots arrive every second tick. Drawing at `render time − 2 snapshots`
  (80 ms) always has two snapshots to blend: `(1 − α)·a + α·b`, `α` the fraction between them. Blend
  only slots that are active in both snapshots and moved less than a threshold; spawns, despawns and
  teleports (Lens Imp blink, Warden cloak) must snap. The same rule applies to local interpolation
  (`web/combat-docs/01`).
- **Prediction (N9).** The ship has no velocity state: the stick sets the velocity each tick
  (`web/combat-docs/02`). So predicting your own ship is replaying the unacknowledged inputs on the
  last acknowledged position, `p ← clamp(p + c·u)`, where the clamp is a projection onto the
  playfield box. If the server applies the same input sequence the correction is exact; if it
  differs, snap or blend over a few ticks.

## 3. Decisions still to make

Recommendations are defaults I would take unless you object.

| # | Question | Options | Recommended |
| --- | --- | --- | --- |
| S1 | Room code | 4 digits / 6 chars from a 32-letter alphabet (about 30 bits) / long invite link | 6 chars **plus** per-IP attempt limits; codes expire when the room empties |
| S2 | Who may create Online rooms | anyone / needs a server key / allow-list | Optional `ROOM_CREATE_KEY`: public servers set it, so strangers cannot use your compute and bill |
| S3 | LAN bind address | `0.0.0.0` (all interfaces) / localhost only | `0.0.0.0` only for `npm run host`, with a printed warning and a "listening on" list; default `npm start` stays localhost |
| S4 | LAN passcode | none / optional short code | Optional 4-digit passcode shown in the host lobby; on by default |
| S5 | Who can kick or close a room | any / host only | The player who created the room (host) only |
| S6 | Display names | free text / initials only / none | None: P1/P2 plus the 3-letter initials the game already has (no free text, nothing to moderate) |
| S7 | Log retention | none / 7 days / 30 days | 7 days; IPs hashed; no message contents |
| S8 | Rate limits | see §5.3 | Start with the table in §5.3 and tune from logs |
| S9 | Cost guard | none / platform spend cap / max rooms | Platform spend limit plus `MAX_ROOMS` and `MAX_ROOMS_PER_IP` |
| S10 | Shared global leaderboard | never / server-signed results | Never for now; if added, the server signs results and refuses client-submitted scores |
| S11 | Version compatibility | strict equal / minor tolerance | Strict equal build id; mismatch shows "refresh the page" |
| S12 | Page host for Online | server serves page / static host + Server URL | Server serves the page; Server URL setting for self-hosting |
| S13 | Reverse proxy / TLS | platform-provided / Caddy on a VPS | Platform-provided on Fly.io/Railway; Caddy on a VPS |
| S14 | Voice or text chat | none / preset emotes | None |

## 4. Threat model

**Assets:** the integrity of a run (scores, fairness), the host's machine and network (LAN), the
cloud bill and availability (Online), players' privacy (IP addresses).

**Who could attack, and what they can try:**

| Actor | Tries | Main defence |
| --- | --- | --- |
| Cheating player (modified client) | Fake scores, positions, fire rate, speed hacks | Server authority: only inputs are accepted; input range and rate validated; server clock decides time |
| Malicious joiner | Join a room uninvited, kick players, crash the room | Room code + attempt limits; host-only controls; strict message validation |
| Flooder / DoS | Many connections or huge messages to exhaust CPU/RAM/bandwidth | Connection, message-size and rate caps; room caps; platform limits |
| Someone guessing room codes | Enumerate codes to join | Code entropy + limits per IP + short code lifetime |
| Cross-site attacker | A web page you visit opens a socket to your LAN server and acts as you | `Origin` check on the WebSocket handshake; no cookies or ambient auth |
| Network snooper (café Wi-Fi, LAN) | Read or alter traffic | `wss://` online; LAN is plain, so assume a trusted network and say so |
| Bill-runner | Use a public server as free compute | Create-key (S2), room caps, spend limit |
| Supply chain | Malicious dependency | Few dependencies (`ws` only), pinned lockfile, audit in CI |

**Out of scope:** account takeover (no accounts), payment data (none), anti-bot input
automation (cannot be solved server-side for a casual game).

## 5. Security checklist by layer

Each item is a **[todo]** until built and tested (see §7).

### 5.1 Transport
- [ ] Online only over `wss://`; the server refuses plain `ws` when `NODE_ENV=production` unless
  behind a trusted proxy that terminates TLS.
- [ ] HSTS and `Secure` headers on the page.
- [ ] LAN is plain `ws://` by design. The lobby says "local network only, not encrypted".

### 5.2 Rooms and identity
- [ ] Room code (minimum 6 digits) from a CSPRNG (`crypto.randomInt`), not `Math.random`.
- [ ] Per-player **session token** (128-bit random) issued at join, required to reconnect, bound to
  the slot; never reused; never put in URLs or logs.
- [ ] A room accepts joins only while in lobby (unless it is the same token reconnecting).
- [ ] Failed join attempts limited per IP (e.g. 10 per minute), then temporary block.
- [ ] Host-only actions (start, kick, close) check the token, not a client-supplied flag.

### 5.3 Messages
Validate every frame before it touches the simulation. Starting limits:

| Limit | Value |
| --- | --- |
| Max message size | 256 bytes (inputs) |
| Input rate | at most 1 frame per tick (50/s) per player; extras dropped |
| Control messages | 5 per second |
| Connection idle timeout | 30 s without a ping |
| Handshake timeout | 5 s |

- [ ] Reject: wrong version, unknown type, non-finite numbers, stick/aim outside [-1, 1], bad `seq`.
- [ ] Check the **norm**, not only each component: the real range is `‖stick‖ ≤ 1`, and a per-axis
  check lets `(1, 1)` through (`‖·‖ = √2`). The engine already projects the stick onto the unit disc
  (`combat_move_ship` divides by `max(1, ‖s‖)`) and normalises aim, so an oversized vector cannot buy
  extra speed while the server runs the unmodified engine; the norm check is defence in depth.
- [ ] Never allocate by a client-supplied length; fixed-size binary frames only.
- [ ] Queue per player capped; late/duplicate frames discarded, never replayed.

### 5.4 Authority and fairness
- [ ] The simulation reads only inputs from the server's own receive buffer. No client position,
  score, health, time or random value is ever used.
- [ ] The server RNG seed is generated server-side and not sent to clients.
- [ ] The clock is the server's tick counter; client timestamps are used only for ping stats.
- [ ] A finished run's result comes from the server and is delivered once, with the build id.

### 5.5 Resource limits
- [ ] `MAX_ROOMS`, `MAX_ROOMS_PER_IP`, `MAX_CONNECTIONS`, `MAX_CONNECTIONS_PER_IP`.
- [ ] Tick budget watchdog: if a room's tick takes over 15 ms repeatedly, log and shed (end the
  room, refuse new ones); never let one room slow the others.
- [ ] Empty/idle rooms closed after 60 s; abandoned lobbies after 10 min.
- [ ] Backpressure: if a client's socket buffer grows, drop snapshots (never queue unbounded).

### 5.6 Web security (the page and the socket)
- [ ] **Origin check** on the WebSocket upgrade: allow only the server's own origin (and
  `ALLOWED_ORIGINS`). This blocks cross-site WebSocket hijacking, especially on LAN.
- [ ] No cookies or ambient credentials; the session token is sent in the first message.
- [ ] Response headers on the page: `Content-Security-Policy` (default-src 'self'; connect-src
  'self' plus the Server URL if configured), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`.
- [ ] The static file server rejects path traversal (already checked in `serve.mjs`) and never
  serves the test wasm builds (also already so).
- [ ] The Server URL setting accepts only `wss://` (or `ws://` for private LAN addresses) and is
  shown to the player before connecting.

### 5.7 Privacy
- [ ] No accounts, names or free text. Initials are three letters chosen on the client.
- [ ] IP addresses are used for rate limits and shown to nobody. Logs store a salted hash and
  expire in 7 days.
- [ ] LAN guests see the host's address only (they typed it). The host sees guest IPs only on the
  console if logging is on.
- [ ] A short privacy note in Help: what is sent (inputs), what is stored (nothing server-side).

### 5.8 Deployment
- [ ] Container runs as non-root, read-only filesystem where possible, no shell tools beyond
  needed, a health endpoint that reveals only "ok".
- [ ] No secrets in the image or repo; `ROOM_CREATE_KEY` and similar come from platform secrets.
- [ ] `.dockerignore` excludes notes, tests, `.git`.
- [ ] `npm audit` and lockfile review in CI; Dependabot or manual monthly update.
- [ ] Platform spend cap set before the first public deploy; alert on instance restarts.
- [ ] Graceful shutdown on SIGTERM: tell clients, finish or abandon rooms cleanly.

## 6. LAN-specific traps

1. **Binding.** The server must listen on all interfaces for a second computer to reach it. That
   exposes it to everyone on the network (guests on café/shared Wi-Fi). Mitigations: S3/S4
   (explicit opt-in, passcode), Origin check, rate limits.

2. **Mixed content.** A page loaded over `https://` cannot open `ws://` to a LAN address (only
   `localhost` is exempt). So LAN play must load the page over **http** from the host itself
   (same origin), never from the Online site. The lobby's "LAN" path therefore gives the guest an
   `http://<ip>:<port>` link rather than a button on the hosted page.

3. **Private-network access rules.** Browsers are tightening what public sites may request from
   private addresses. The same-origin LAN design avoids it; re-test on current Chrome and Safari.

4. **OS firewall.** macOS and Windows ask to allow incoming connections the first time. Document
   it in the setup guide.

5. **AP isolation.** Some Wi-Fi blocks device-to-device traffic; the lobby should detect "guest
   cannot reach host" and say so.

6. **Plain text.** Anyone on the same network can read or alter LAN traffic. Acceptable for this
   game; say so in the lobby.
   
7. **Changing IP.** DHCP can change the host's address; the lobby shows the current one each time.

## 7. Security tests to build

| Test | Proves |
| --- | --- |
| Fuzz the frame decoder (random, truncated, oversized, NaN) | No crash, no state change |
| Flood test: 1000 msgs/s from one socket | Rate limit drops/closes it; other rooms unaffected |
| Origin test: handshake from `http://evil.test` | Refused |
| Join brute-force: 1000 wrong codes from one IP | Blocked after the limit |
| Wrong token reconnect | Refused; slot not taken over |
| Version mismatch | Clear error, no room created |
| Host-only action by guest | Refused |
| Load test with bot clients (reuse the boss bot) | Tick time stays under budget at the room cap |
| Slow client (stalled reads) | Server memory stays bounded |
| `npm audit`, container scan (e.g. Trivy), header check | No known high issues |
| Manual: LAN from a second machine with firewall on | Works only after allow; works with AP isolation off |

## 8. If something goes wrong

- Kill a single room: admin signal or host "close room" → clients get "room closed" and return to
  the lobby.
- Kill the server: SIGTERM does a graceful shutdown; platform `restart` is safe because no state is
  persisted.
- Abuse from one IP: add it to a block list env var and redeploy.
- Leaked `ROOM_CREATE_KEY`: rotate the secret and redeploy.
- Unexpected bill: lower `MAX_ROOMS`, scale to zero, review the spend cap.
- Keep a short runbook (S5.4) with these steps and the platform's commands.
