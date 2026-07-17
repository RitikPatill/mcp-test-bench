# MCP Test Bench

> `jest` + `lighthouse` for MCP servers — discover tools, generate test scenarios, score with LLM-as-judge, and audit for security.

![Screenshot placeholder](docs/screenshot-placeholder.png)

## What it does

MCP Test Bench is a local, open-source evaluation harness for [Model Context Protocol](https://modelcontextprotocol.io) servers. Point it at any MCP server (stdio command or SSE URL) and it:

1. **Discovers** every tool, resource, and prompt the server exposes.
2. **Generates** realistic test scenarios from the tool schemas using Claude.
3. **Executes** those scenarios by driving Claude as an agent through the MCP server, recording every tool call and response.
4. **Judges** each run against configurable rubrics using LLM-as-judge (correctness, safety, efficiency, hallucination).
5. **Audits** the server for common security issues: prompt-injection in tool descriptions, unbounded outputs, PII leakage, dangerous side-effect tools without confirmation gates.
6. **Visualizes** everything in a Next.js dashboard — run history, trace timelines, tool-call diffs, security findings, and per-server rankings.

## Why it exists

The MCP ecosystem is exploding but there's no shared way to answer: *does this MCP server actually work well with an LLM agent?* and *is it safe to install?* Right now the answer is "vibes". Test Bench turns that into a repeatable score with traces you can inspect.

## Features

| Feature | Status |
|---|---|
| pnpm monorepo with Turborepo build pipeline | **M1** ✅ |
| Next.js 15 App Router + Tailwind + shadcn/ui hello-world | **M1** ✅ |
| TypeScript strict mode across all packages | **M1** ✅ |
| Vitest test harness (`packages/core`) | **M1** ✅ |
| ESLint + Prettier enforced workspace-wide | **M1** ✅ |
| stdio + SSE MCP server connection | **M2** ✅ |
| Tool / resource / prompt discovery | **M2** ✅ |
| SQLite persistence, zero infra | **M2** ✅ |
| Auto-generated test scenarios (Claude) | M3 |
| YAML scripted scenarios | M3 |
| LLM-as-judge scoring (4 rubrics) | M4 |
| Security scanner (static + runtime) | M5 |
| Web dashboard with trace timeline | M6 |
| CLI (`mcpbench run`) for CI | M7 |

## Architecture

```
flowchart LR
    UI[Next.js Dashboard] -->|REST/SSE| API[API Routes]
    API --> Runner[Eval Runner]
    API --> DB[(SQLite)]
    Runner --> MCPClient[MCP Client stdio + SSE]
    Runner --> Agent[Claude Agent Loop]
    Runner --> Judge[LLM-as-Judge]
    Runner --> Scanner[Security Scanner]
    MCPClient -.spawns.-> Target[Target MCP Server]
    Agent --> Anthropic[Anthropic API]
    Judge --> Anthropic
```

### Packages

- `packages/core` — `discoverServer()` MCP client, `getDbReady()` SQLite helper (libsql + drizzle-orm), shared types (`ServerConfig`, `DiscoveredSchema`)
- `apps/web` — Next.js 15 App Router dashboard; `POST /api/servers` registers a server config, runs discovery, and persists the result to SQLite
- `apps/cli` — `mcpbench` CLI binary

Build tasks are orchestrated with [Turborepo](https://turbo.build) (`turbo.json` at the repo root).

## Quickstart

```bash
git clone https://github.com/your-org/mcp-test-bench
cd mcp-test-bench
pnpm install
cp .env.example .env          # set DATABASE_PATH (optional) and ANTHROPIC_API_KEY (required M3+)
pnpm dev                      # starts Next.js on localhost:3000
```

### Requirements

- Node.js ≥ 20
- pnpm ≥ 9
- An [Anthropic API key](https://console.anthropic.com) (required from M3 onward for scenario generation and judging)

## Development

```bash
pnpm build          # build all packages
pnpm test           # run all tests (Vitest)
pnpm lint           # ESLint across all packages
pnpm format         # Prettier format
```

Run a single package:

```bash
pnpm --filter @mcp-test-bench/core test
pnpm --filter @mcp-test-bench/web dev
```

## Roadmap

| Milestone | Description |
|---|---|
| **M1** ✅ | pnpm + Turborepo monorepo scaffold; Next.js 15 + Tailwind + shadcn/ui hello-world; TypeScript strict; Vitest; ESLint; Prettier; `.env.example` |
| **M2** ✅ | `discoverServer()` wrapping `@modelcontextprotocol/sdk` for stdio + SSE; normalized `DiscoveredSchema`; SQLite via `@libsql/client` + drizzle-orm; `POST /api/servers` route; integration tests against `server-everything` |
| M3 | Scenario generation with Claude, YAML runner |
| M4 | LLM-as-judge with 4 built-in rubrics |
| M5 | Security scanner |
| M6 | Full dashboard — traces, diffs, rankings |
| M7 | CLI binary + CI integration |

## License

[MIT](LICENSE)
