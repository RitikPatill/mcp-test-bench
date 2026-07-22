# Contributing

## Prerequisites

- Node ≥ 20
- pnpm ≥ 9 (`npm i -g pnpm`)
- `ANTHROPIC_API_KEY` environment variable (required for agent loop, judge, and generator)

## Setup

```bash
git clone https://github.com/your-org/mcp-test-bench
cd mcp-test-bench
pnpm i
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY
```

## Running locally

```bash
pnpm dev
```

Turborepo starts the Next.js dashboard (`apps/web`) on `localhost:3000` and watches `packages/core` for changes simultaneously.

## Running tests

```bash
pnpm test
```

Uses [vitest](https://vitest.dev/). Integration tests (e.g. `client.test.ts`) require a live MCP server process and are automatically skipped when the environment is not set up — they are plain `it()` calls with a 30-second timeout and no special annotation needed; vitest will timeout-skip them in CI if the process can't be spawned.

Tests that call the Anthropic API are guarded with `skipIf(!process.env.ANTHROPIC_API_KEY)` — see existing test files in `packages/core/src/` for the exact pattern. They are skipped in CI unless the secret is provided.

## Branch / PR workflow

- Branch off `main`: `git checkout -b feat/your-feature`
- PR title format: `feat(scope): short description` (Conventional Commits)
- Each PR should correspond to one milestone or a well-scoped unit of work
- Squash-merge into `main`

## Code conventions

- **TypeScript strict** — `strict: true` in all `tsconfig.json` files; no `any` without a comment.
- **Drizzle query builder only** — no raw SQL strings. Use the Drizzle ORM API for all database access.
- **No raw SQL** — even in tests or scripts.
- **shadcn/ui for new UI components** — run `pnpm dlx shadcn@latest add <component>` and place the output in `apps/web/src/components/ui/`.
- **`await params` in API routes** — Next.js 15 requires async params; always `const { id } = await params` before use.
- **`getDbReady` pattern** — call `await getDbReady(process.env.DATABASE_PATH ?? 'local.db')` at the top of every server-side module that needs the DB.

## Adding a security check

1. Open `packages/core/src/scanner/checks.ts`.
2. Export a new function with the signature:
   ```ts
   export function checkYourCheck(schema: DiscoveredSchema, serverId: string): RawFinding[]
   ```
3. Call it from `packages/core/src/scanner/index.ts` inside `scanServer()`.
4. Add a test case in `packages/core/src/scanner/scanner.test.ts` covering at least one positive and one negative match.

## Adding a rubric

1. Open `packages/core/src/judge/rubrics.ts`.
2. Define a new `Rubric` object using `validateRubric({ ... })`. Criterion weights must sum to exactly `1.0`.
3. Add it to the `BUILTIN_RUBRICS` map at the bottom of the file.
4. Reference it by its `id` string in scenario YAML files or via the `--rubric` CLI flag.
