## Monorepo Overview

Turborepo monorepo with a Next.js app and a Go API.

```
apps/
  web/        # Next.js application
  api/        # Go (net/http) API on :8080

pnpm-workspace.yaml    # workspace packages
turbo.json             # Turborepo tasks
tsconfig.base.json     # shared TS config
```

## Prerequisites

- Node.js and PNPM (workspace uses PNPM)
- Go 1.22+
- Air (Go hot reload) — install with:

```bash
go install github.com/air-verse/air@latest
```

Ensure your `GOBIN` is on `PATH` so `air` is available.

## Install

```bash
pnpm install
```

## Development

- Run all apps (web + api):

```bash
pnpm dev
```

- Run only one app:

```bash
pnpm --filter web dev   # Next.js (http://localhost:3000)
pnpm --filter api dev   # Go API with air (http://localhost:8080)
```

The web app consumes the API via `NEXT_PUBLIC_API_URL`. This is set in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Build

- Build everything via Turborepo:

```bash
pnpm build
```

- Build individually:

```bash
pnpm -C apps/web build
pnpm -C apps/api build
```

## Run (Production)

```bash
# after pnpm build
pnpm -C apps/web start          # Next.js
pnpm -C apps/api start          # Go binary (built at apps/api/bin/api)
```

## Useful Commands

```bash
pnpm -r lint            # run lint across workspace (if configured)
pnpm -r typecheck       # run typecheck across workspace (if configured)
pnpm clean              # turbo clean
```

## End-to-End Tests

The E2E suite uses Playwright and starts the real Go API plus a production
Next.js server on test-only ports.

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e          # Chromium, Firefox, WebKit, and mobile Chrome
pnpm test:e2e:ui       # interactive Playwright runner
pnpm test:e2e:debug    # headed debug mode
pnpm test:e2e:report   # open the latest HTML report
```

Playwright ignores server stdout/stderr by default so routine websocket and
framework logs do not crowd the reporter output. To show those logs while
debugging, run:

```bash
E2E_WEB_SERVER_LOGS=1 pnpm test:e2e
```

Defaults:

```bash
E2E_WEB_PORT=13000
E2E_API_PORT=18080
E2E_HOST=127.0.0.1
```

## Notes

- Workspace packages are defined in `pnpm-workspace.yaml` (`apps/*`, `packages/*`).
- Turborepo tasks are configured in `turbo.json` (`dev`, `build`, `lint`, `typecheck`).
- The Next.js app (`apps/web`) uses `@/*` path alias.
