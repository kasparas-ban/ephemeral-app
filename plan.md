# Turborepo + Go API Migration Plan

## Goals

- Move the existing Next.js app into `apps/web`.
- Add a Go `net/http` API in `apps/api` listening on :8080.
- Orchestrate dev/build with Turborepo and pnpm workspaces.

## 1) Create monorepo scaffolding

- At repo root, add `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

- Add `turbo.json` pipeline:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "dev": { "cache": false, "persistent": true },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "bin/**"]
    },
    "lint": {},
    "typecheck": {}
  }
}
```

- Replace root `package.json` with workspace root (keep pnpm):

```json
{
  "name": "ephemeral-monorepo",
  "private": true,
  "packageManager": "pnpm@latest",
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean"
  }
}
```

- Create a base TS config at the root for sharing (optional but recommended):

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "baseUrl": "."
  }
}
```

## 2) Move Next.js app into `apps/web`

- Create `apps/web/` and move these into it: - `app/`, `components/`, `lib/`, `public/`, `next.config.ts`, `tsconfig.json`, `components.json`, any local config (e.g., `postcss.config.mjs`, `globals.css`) - Move the app’s `package.json` to `apps/web/package.json`; set `name` to `"web"`
- Update `apps/web/tsconfig.json` to extend root base config:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- Ensure any import path assumptions still hold (adjust `baseUrl`/paths if needed). No code changes anticipated beyond updated relative paths if you had any '../' assumptions to root.

## 3) Add Go API in `apps/api`

- Create `apps/api/` with:

```txt
apps/api/
  go.mod
  main.go
  package.json   // for turbo integration only
  bin/           // gitkeep optional
```

- `apps/api/go.mod` (local module path is fine):

```go
module api

go 1.22
```

- `apps/api/main.go` minimal server on :8080:

```go
package main

import (
  "fmt"
  "log"
  "net/http"
)

func main() {
  http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    _, _ = w.Write([]byte(`{"status":"ok"}`))
  })

  addr := ":8080"
  fmt.Println("Go API listening on", addr)
  log.Fatal(http.ListenAndServe(addr, nil))
}
```

- `apps/api/package.json` to let Turborepo run Go tasks:

```json
{
  "name": "api",
  "private": true,
  "scripts": {
    "dev": "go run .",
    "build": "go build -o ./bin/api",
    "start": "./bin/api",
    "lint": "go vet ./...",
    "typecheck": "echo 'no ts typecheck'"
  }
}
```

- (Optional) Hot-reload for Go: - Use `air` or `reflex` if desired and update `dev` script accordingly.

## 4) Wire pipeline and dev UX

- Nothing special needed in `turbo.json` beyond the pipeline above; Turbo will run tasks per package.
- Root commands: - `pnpm install` - `pnpm dev` → runs `web#dev` and `api#dev` concurrently - `pnpm build` → runs `web#build` and `api#build` with cache - `pnpm lint` / `pnpm typecheck`
- Production suggestion: - `pnpm -C apps/web start` to serve Next after `build` - `pnpm -C apps/api start` to run the Go binary after `build`

## 5) Optional: Frontend -> API integration

- If you want `apps/web` to call the Go API during dev, set `NEXT_PUBLIC_API_URL` to `http://localhost:8080`.
- Or add a Next.js rewrite in `apps/web/next.config.ts`:

```js
async rewrites() {
  return [{ source: "/api/:path*", destination: "http://localhost:8080/:path*" }];
}
```

## 6) Repo hygiene

- Update `.gitignore` to include `apps/api/bin/`.
- Verify CI/CD (if any) builds with `pnpm i && pnpm build`.
- Consider adding `packages/` later for shared TS utilities.
