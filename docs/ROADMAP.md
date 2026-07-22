# Roadmap

### Near-term (next 3 milestones)

- **Custom judge models** — allow swapping the judge to any OpenAI-compatible endpoint via a `judge.model` key in the config YAML, so teams can use self-hosted or cheaper models for scoring.
- **Plugin scanners** — define a `ScannerPlugin` interface (a single exported async function) so community security checks can be distributed as npm packages and loaded via config.
- **Hosted / cloud mode** — optional remote SQLite backend (Turso / libsql) so teams can share evaluation results across machines without running a server.

### Medium-term

- **Replay mode** — re-run the judge on already-saved turns without re-executing the agent, enabling cheap re-scoring when rubrics change.
- **Scenario library** — shareable community YAML scenario packs, one pack per common server type (filesystem, database, code execution, web search), importable via `mcpbench import`.
- **Resource + prompt evaluation** — the current agent loop is tool-only; extend it to exercise MCP resources and prompt templates as first-class eval targets.

### Long-term / stretch

- **Fine-tuned judge model** — train a small open-weight model on human-annotated MCP run data to replace the Claude judge call, enabling fully offline evaluation.
- **Visual diff for tool-call sequences** — side-by-side diff view comparing the tool call sequence of two runs of the same scenario, highlighting divergences.
- **MCP server registry integration** — auto-import servers listed in the public MCP registry so users can one-click evaluate any published server.
