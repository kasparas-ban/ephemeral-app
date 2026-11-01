# Ephemeral

Ephemeral is a shared page where strangers type to each other in real time.
Keystrokes appear on other screens as they are typed, then blur away. Nothing is
saved.

## Key features

### 1. Live, letter-by-letter typing

Every keystroke reaches other visitors as it happens. Backspace removes a
character for everyone; Enter clears the Composition. Keep the relay fast and
the animations smooth, so typing feels immediate on every screen.

### 2. Nothing persists

There is no history, no account, and no storage. The API relays messages and
forgets them. Do not add features that record or replay what people typed.

### 3. A quiet, minimal interface

The page is mostly empty space and text. Prefer subtle motion and few controls.
Respect reduced-motion settings, and keep the layout stable on mobile when the
on-screen keyboard opens and closes.

## Engineering principles

- Prefer simplicity. Rewrite or refactor surrounding code when it reduces
  complexity or improves maintainability.
- Follow DRY where it improves clarity. Remove abstractions that only pass work
  through without simplifying callers.
- Prefer deep modules: keep interfaces small, hide complexity from callers, and
  keep related behavior together.
- Test behavior through the module's interface. Avoid splitting code solely to
  make isolated helpers testable.
- Write code that someone else can easily understand.
- Follow YAGNI and fight scope creep. Suggest worthwhile unrelated improvements
  separately, and ask before expanding the task.

## Project status

Ephemeral is a simple side project with no stakes. It is hosted on Vercel and
publicly available. Do not add compatibility code for earlier versions.

## Repository layout

A Turborepo monorepo with pnpm workspaces.

- `apps/web` is the Next.js app.
  - `app` holds routes, including the `/dev` simulator page.
  - `components/ephemeral` renders local and remote Compositions.
  - `components/info-overlay` is the info screen.
  - `lib` holds the WebSocket client, message types, and typing logic.
  - `stores` holds Jotai atoms for connection state and presence.
- `apps/api` is the Go `net/http` API. `realtime` contains the Hub and Client
  that relay messages over WebSocket.
- `e2e` contains Playwright tests that run the real web app and API.

## Glossary

**Visitor**:
A browser connected to the API. The server assigns each Visitor an ID; Visitors
do not know their own ID.

**Composition**:
The line of text a Visitor is currently typing. It exists only on screen and is
cleared by Enter or by the Visitor leaving.

**Presence**:
The list of other connected Visitors, sent to each Visitor whenever someone
joins or leaves.

**Relay**:
The API forwarding a typing message from one Visitor to all others, without
storing it.

## Workspace commands

For setup and starting the app, see
[README — Development](README.md#development).

- `pnpm check`: format check, lint, typecheck, and unit tests. Run it often.
- `pnpm verify`: `check` plus Chromium end-to-end tests. Run it before calling
  work done.

Run app-specific commands with `pnpm --filter web <script>` or
`pnpm --filter api <script>`.

## Coding conventions

- Use whitespace and blank lines to make the code's logical structure easy to
  read.
- Use Tailwind CSS utilities for UI, reserving custom CSS for global theming and
  effects Tailwind cannot express. Use `motion` for animation.
- Keep the message types in `apps/web/lib/types.ts` and
  `apps/api/realtime/types.go` in sync.
- Accept only printable ASCII input (see `apps/web/lib/typing.ts`).
- The React Compiler is enabled; do not add manual memoization without a
  measured reason.
- Prefer self-documenting code over comments.

## Commit messages

Write concise, behavior-focused messages describing the diff included in the
commit.

- Write a single capitalized subject line in imperative mood, at most 72
  characters, with no trailing period.
- Describe the change and its effect in product language; include
  implementation details only when they clarify the change.
- Avoid vague subjects such as `update`, `cleanup`, `misc`, or
  `address feedback`.
- Add a body only when motivation, a non-obvious approach, or risk needs
  explanation. Omit work history, file inventories, and validation logs.

## Pull requests

- Never merge a PR without the User's explicit acceptance of that PR. Creating
  or updating a PR, passing checks, and resolving feedback do not authorize a
  merge.
- One task per PR; include related refactoring that simplifies the change.
- Follow the [commit message conventions](#commit-messages) for titles, covering
  the full branch diff. Keep titles and descriptions current as scope changes.
- Describe the problem and resulting behavior for a reviewer without
  conversation context. Use simple and clear language. Omit work history, file
  inventories, test sections, and command logs.
- Include before-and-after images for visible UI changes, including mobile when
  relevant. Upload them to GitHub; keep PR-only assets out of the repository.

## Testing

- Test observable behavior through module interfaces; keep test-only code at
  application boundaries.
- Avoid tautological tests that repeat the implementation to derive expected
  results; assert independently defined behavior.
- Add focused coverage for bug fixes and meaningful behavior changes. Put web
  unit tests next to the code as `*.test.ts(x)` (Vitest), Go tests as
  `*_test.go`, and multi-Visitor behavior in `e2e/specs` (Playwright).
- Keep tests deterministic and isolated, and report anything unverified.
