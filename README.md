# Ephemeral

Ephemeral is a shared page where strangers type to each other in real time.
Each keystroke appears on other screens as it is typed, then blurs away. Press
Enter and your words are gone. There is no history and no account, and nothing
is saved.

[How it works](#how-it-works) · [Development](#development) ·
[Configuration](#configuration)

## How it works

- **Type, and others watch it appear.** Every character goes to everyone who is
  connected, letter by letter, as you write it.
- **Let it go.** Backspace removes a character for everyone. Enter clears your
  words, and they blur out on every screen.
- **See who is here.** Other visitors appear as their own lines of text, and
  disappear when they leave.
- **Keyboard characters only.** Input is limited to printable ASCII, so there
  are no emojis or pasted symbols.

## Status

Ephemeral is a small side project, hosted on Vercel and publicly available. It
runs in desktop and mobile browsers. Messages travel between the browser and a small relay server,
which forwards them and keeps nothing.

## Development

The repository is a Turborepo monorepo:

| Path       | Purpose                                         |
| ---------- | ----------------------------------------------- |
| `apps/web` | Next.js app (http://localhost:3000)             |
| `apps/api` | Go `net/http` WebSocket relay (localhost:8080)  |
| `e2e`      | Playwright tests against the real web app + API |

You need Node.js with pnpm, and Go 1.26 or later. The Go dev tools (Air,
staticcheck) are pinned in `apps/api/go.mod` and run with `go tool`, so there
is nothing else to install.

```sh
pnpm install
pnpm dev
```

| Command                 | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `pnpm dev`              | Run the web app and API with hot reload.                              |
| `pnpm --filter web dev` | Run only the web app (or `--filter api` for the API).                 |
| `pnpm check`            | Check formatting, lint, types, and run unit tests.                    |
| `pnpm verify`           | Run `check` plus Chromium end-to-end tests.                           |
| `pnpm test:e2e`         | Run end-to-end tests in Chromium, Firefox, WebKit, and mobile Chrome. |
| `pnpm format`           | Format with Prettier and gofmt.                                       |
| `pnpm build`            | Build both apps.                                                      |

Run `pnpm verify` before calling work done. End-to-end tests need browsers:
`pnpm exec playwright install chromium firefox webkit`. Set
`E2E_WEB_SERVER_LOGS=1` to see server logs while debugging them.

## Configuration

The web app finds the API through `NEXT_PUBLIC_API_URL`. The development
default lives in `apps/web/.env.development`; set the production value in the
hosting environment.

The API only accepts WebSocket connections from allowed browser origins. In
production, set `ALLOWED_ORIGINS` to the web app's origins, comma separated.
Each value must match `window.location.origin` of the deployed web app:

```sh
ALLOWED_ORIGINS=https://your-web-app.vercel.app,https://www.example.com
```
