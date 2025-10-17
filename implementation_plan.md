# 2D shared typing canvas MVP

## Scope

- Real-time shared canvas where users pan/zoom and see floating, ephemeral text.
- Everyone sees each user's typing live, letter-by-letter, in real time.
- Positions are computed client-side per session; layouts can differ across clients (no shared seed).
- No nicknames; users are anonymous and identified only by `userId`.
- Single global room; target 20–50 concurrent users on one Go WebSocket node; no persistence/auth.

## Backend (Go, apps/api)

- WebSocket endpoint `GET /connect` in `apps/api/main.go` using `net/http` + `github.com/gorilla/websocket`.
- Lightweight hub to track connections and broadcast presence + typing:
- Files: `apps/api/realtime/hub.go`, `apps/api/realtime/client.go`, `apps/api/realtime/types.go`.
- Maintain a set/map of clients and assigned `userId`. No positions, no nicknames, no history.
- Broadcast `presence` (IDs only) on join/leave and periodically (~30s).
- Relay typing events from any client to all clients (letter-by-letter updates).
- Heartbeats: read deadlines + `SetPongHandler`, server pings every ~20s; drop stale clients.
- Message schema (JSON over WS):
- Client→Server:
  - `hello` {}
  - `typing_update` { text: string }
  - `typing_end` { finalText?: string, ttlMs?: number }
- Server→Client:
  - `hello_ack` { userId: string }
  - `presence` { users: Array<{ id: string }>, ts: number }
  - `typing_state` { fromUserId: string, text: string, ts: number }
  - `typing_end` { fromUserId: string, finalText?: string, ts: number, ttlMs?: number }

## Frontend (Next.js, apps/web)

- Networking:
- `apps/web/lib/ws.ts` connect to `/connect`, auto-reconnect, typed handlers.
- `apps/web/lib/types.ts` shared message types.
- `apps/web/lib/spatial.ts` per-client layout utilities:
  - `getOrAssignPosition(userId: string): { x: number; y: number }` using a local session seed (e.g., from `crypto.getRandomValues()` persisted in memory or localStorage) so positions are stable for that client session only.
- Input & typing stream:
- `apps/web/components/input/TypingController.tsx` captures keystrokes (hidden input or canvas focus) and manages local per-user typing state.
- On first keypress: begin an implicit per-user composition. Send `typing_update` with full `text` (optionally coalesced every ~80–120ms).
- On Enter/Escape or inactivity (~1.5s): `typing_end`; start local fade.
- Canvas & rendering (custom DOM canvas):
- `apps/web/components/canvas/WorldCanvas.tsx` renders to `<canvas>` with `requestAnimationFrame`.
- Pan (mouse drag/touch), zoom (wheel/pinch), camera matrix; world↔screen transforms; DPR scaling.
- Initial camera centers on the current user's local position.
- Render per user:
  - Active: blinking caret at end; apply `typing_state` updates.
  - Ended: fade with TTL, then prune.
- Keep per-user state keyed by `userId`.
- Presence rendering:
- From `presence.users`, compute per-user positions using the local mapping and render markers/cursors at those world coordinates.
- Ephemerality:
- Active compositions end on inactivity or explicit end; ended compositions fade over `ttlMs` (default 12s) and are pruned.

## Efficiency & reliability

- Coalesce typing updates client-side at ~80–120ms; send full text per update.
- Enable permessage-deflate via Gorilla `EnableCompression: true`.
- Backpressure: if writes block or queues grow, drop oldest queued broadcast for slow clients; always forward latest.
- Size guards: enforce max text length per composition (~1,000 chars) and rate limit new compositions (~4/min).
- Timebase: server stamps `ts`; clients compute fades using server time deltas.

## Dev wiring & config

- Local dev:
- Go API at `http://localhost:8080/connect`.
- Next at `http://localhost:3000`.
- Next rewrite in `apps/web/next.config.ts` for `/connect` → `http://localhost:8080/connect`; connect using relative `/connect`.
- Scripts: run both concurrently via Turbo (`turbo run dev`) or two terminals.

## Milestones

1. WS plumbing (hello/presence/typing relay)
2. Canvas pan/zoom draw
3. Per-client id→position mapping
4. Typing controller and local stream
5. Remote compositions rendering
6. End/fade lifecycle
7. Reconnect/heartbeats
8. Perf polish

## Risks & mitigations

- Views differ per client by design: acceptable and may enhance the “ephemeral thoughts” feel.
- Ordering: no sequence numbers; apply latest by `ts` (server-stamped).
- Burst traffic: coalesce updates; compression; backpressure skipping.

## To-dos

- [ ] Add /connect endpoint with `net/http` + Gorilla WebSocket
- [ ] Implement hub to track clients, assign IDs, broadcast presence (IDs only)
- [ ] Relay typing events: start/update/end with broadcast to all
- [ ] Add ping/pong heartbeats and stale client cleanup
- [ ] Create WebSocket client with reconnect and typed handlers
- [ ] Implement WorldCanvas with pan/zoom and transforms
- [ ] Implement per-client id→position mapping util (no shared seed)
- [ ] Implement TypingController to capture input and send updates
- [ ] Render active/ended compositions with caret and fade lifecycle
- [ ] Add Next rewrite for /connect and dev scripts
- [ ] DPI scaling, text metrics cache, max visible thoughts
