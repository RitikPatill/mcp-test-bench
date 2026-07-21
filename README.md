# MCP Test Bench

> `jest` + `lighthouse` for MCP servers — discover tools, generate test scenarios, score with LLM-as-judge, and audit for security.

![Screenshot placeholder](docs/screenshot-placeholder.png)

## What it does

MCP Test Bench is a local, open-source evaluation harness for [Model Context Protocol](https://modelcontextprotocol.io) servers. Point it at any MCP server (stdio command or SSE URL) and it:

1. **Discovers** every tool, resource, and prompt the server exposes.
2. **Generates** realistic test scenarios from the tool schemas using Claude.
3. **Executes** those scenarios by driving Claude as an agent through the MCP server, recording every tool call and response.
4. **Judges** each run against configurable rubrics using LLM-as-judge (correctness, tool-selection accuracy, efficiency, safety).
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
| Claude agent loop with live SSE trace streaming | **M3** ✅ |
| `runScenario` async-generator + SQLite turn recording | **M3** ✅ |
| `McpSession` persistent MCP connection across turns | **M3** ✅ |
| `/runs/[id]` trace timeline page (live + replayed) | **M3** ✅ |
| LLM-as-judge scoring (4 built-in rubrics) | **M4** ✅ |
| Radar chart + per-criterion reasoning on Run page | **M4** ✅ |
| Auto-generated test scenarios (Claude) | **M5** ✅ |
| Scenario browser with tag filters (happy-path/edge/adversarial) | **M5** ✅ |
| Server detail page with schema accordion | **M5** ✅ |
| Home page server list + Add Server form | **M5** ✅ |
| Security scanner (static + runtime) | **M6** ✅ |
| Security tab per server (findings list + scan button) | **M6** ✅ |
| `findings` DB table with severity/category/remediation | **M6** ✅ |
| `POST /api/servers/[id]/scan` + `GET` findings route | **M6** ✅ |
| Home page server table with score, sparkline, pass rate, findings | **M7** ✅ |
| Server comparison view (`/compare?ids=...`) with rubric bar chart | **M7** ✅ |
| Runs tab per server with tag + status filtering | **M7** ✅ |
| Dark mode toggle (next-themes, `prefers-color-scheme`) | **M7** ✅ |
| `GET /api/servers/[id]/stats` · `GET /api/servers/[id]/runs` · `GET /api/compare` | **M7** ✅ |
| Vitest tests for all three new API routes | **M7** ✅ |
| YAML scripted scenarios | M8 |
| CLI (`mcpbench run`) for CI | M8 |

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

- `packages/core` — `discoverServer()` MCP client, `McpSession` long-lived connection, `runScenario()` Claude agent loop, `judgeRun()` LLM-as-judge (4 built-in rubrics), `generateScenarios()` Claude-powered scenario generator, `scanServer()` security scanner (static checks for prompt-injection patterns, unbounded-output tools, and destructive tools without confirmation; runtime output scanning for PII and injection), `getDbReady()` SQLite helper (libsql + drizzle-orm), shared types
- `apps/web` — Next.js 15 App Router dashboard; `GET /api/servers` lists servers, `POST /api/servers` registers + discovers a server, `GET /api/servers/[id]` returns server detail, `GET /api/servers/[id]/stats` returns latest score, sparkline, pass rate, and finding counts, `POST /api/servers/[id]/generate-scenarios` generates N test scenarios with Claude, `GET /api/servers/[id]/scenarios` lists scenarios (filterable by tag), `POST /api/servers/[id]/scenarios` creates a manual scenario, `GET /api/servers/[id]/runs` lists runs with optional tag/status filter, `POST /api/servers/[id]/scan` runs the security scanner and persists findings, `GET /api/servers/[id]/scan` returns existing findings, `GET /api/compare?ids=...` returns comparison data for 2–3 servers, `POST /api/runs` fires an eval run, `GET /api/runs/[id]` returns the run + turns, `GET /api/runs/[id]/stream` streams `RunEvent`s as SSE, `/servers/[id]` shows server detail + scenario browser + Security tab + Runs tab with tag/status filters, `/runs/[id]` shows the live trace timeline, `/compare?ids=...` shows a rubric-by-rubric grouped bar chart for selected servers
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
| **M3** ✅ | `runScenario()` Claude agent loop (`@anthropic-ai/sdk`); `McpSession` persistent MCP connection; `scenarios`/`runs`/`turns` DB tables; SSE streaming via in-process broker; `/runs/[id]` trace timeline with live `EventSource` updates |
| **M4** ✅ | `judgeRun()` LLM-as-judge with `claude-haiku-4-5-20251001`; 4 built-in rubrics (general, filesystem, data\_retrieval, code\_execution); `judgements` DB table; radar chart + per-criterion reasoning on the Run page |
| **M5** ✅ | `generateScenarios()` in `packages/core`: prompts Claude to produce N scenarios (happy-path, edge-case, adversarial, multi-tool) from the discovered schema, deduplicates, and persists as `Scenario` rows; `POST /api/servers/[id]/generate-scenarios` API route; `/servers/[id]` server detail page with schema accordion and "Generate scenarios" button; scenario browser with tag-based filtering; home page server list with Add Server form |
| **M6** ✅ | `packages/core/scanner`: static checks detect prompt-injection patterns (hidden instructions, base64 blobs, jailbreak phrases per CyberArk "Poison Everywhere" research), unbounded-output tools, and destructive tools lacking confirmation semantics; runtime hooks flag suspicious tool outputs mid-run; `findings` DB table with severity (`info`/`warn`/`critical`), category, and remediation notes; `POST /api/servers/[id]/scan` + `GET` findings route; Security tab per server with findings list, severity badges, and scan button; fixtures based on Damn Vulnerable MCP server test cases |
| **M7** ✅ | Dashboard comparison + history: home page server table with latest score badge, recharts sparkline, pass-rate %, and severity-coded finding counts; Compare checkbox on each row with sticky `CompareBar`; `/compare?ids=...` page with rubric-by-rubric grouped bar chart and summary table; Runs tab on the server detail page with tag + status dropdown filters; `GET /api/servers/[id]/stats`, `GET /api/servers/[id]/runs`, `GET /api/compare` API routes; dark-mode toggle via `next-themes`; Skeleton/Select shadcn components; Vitest unit tests for all three new API routes |
| M8 | YAML scripted scenarios; CLI binary (`mcpbench run`) for CI integration |

## License

[MIT](LICENSE)
