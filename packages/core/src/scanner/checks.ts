import type { DiscoveredSchema } from '../mcp-client/types.js'
import type { Finding, FindingCategory, Severity, ScanOptions } from './types.js'

type RawFinding = Omit<Finding, 'id' | 'createdAt'>

// ── Prompt-injection patterns ──────────────────────────────────────────────

const INJECTION_PATTERNS: Array<{ re: RegExp; severity: Severity; title: string; detail: string }> =
  [
    {
      re: /ignore\s+(previous|all|prior|above)\s+(instructions?|prompts?|commands?|context)/i,
      severity: 'critical',
      title: 'Prompt injection: ignore-instructions pattern',
      detail: 'Tool description contains "ignore previous/all instructions" — classic prompt-injection phrase.',
    },
    {
      re: /act\s+as\b/i,
      severity: 'critical',
      title: 'Prompt injection: role-override pattern ("act as")',
      detail: 'Tool description contains "act as" — common role-override injection.',
    },
    {
      re: /you\s+are\s+now\b/i,
      severity: 'critical',
      title: 'Prompt injection: role-override pattern ("you are now")',
      detail: 'Tool description contains "you are now" — attempts to reassign LLM identity.',
    },
    {
      re: /disregard\b/i,
      severity: 'critical',
      title: 'Prompt injection: disregard pattern',
      detail: 'Tool description contains "disregard" — may instruct the model to ignore safety or task constraints.',
    },
    {
      re: /\[system\]/i,
      severity: 'critical',
      title: 'Prompt injection: fake system tag ([system])',
      detail: 'Tool description contains "[system]" — attempts to spoof a system message.',
    },
    {
      re: /<\s*system\s*>/i,
      severity: 'critical',
      title: 'Prompt injection: fake system tag (<system>)',
      detail: 'Tool description contains "<system>" — attempts to spoof an XML system block.',
    },
    {
      re: /[A-Za-z0-9+/]{60,}={0,2}/,
      severity: 'warn',
      title: 'Suspicious base64-like string in description',
      detail: 'Long base64-like string found — verify it is not an encoded instruction.',
    },
    {
      re: /[\u200B-\u200D\uFEFF\u00AD\u202A-\u202E\u2066-\u2069]/,
      severity: 'critical',
      title: 'Invisible/zero-width characters in description',
      detail: 'Tool description contains zero-width or invisible Unicode characters — common steganographic injection technique (CyberArk "Poison Everywhere").',
    },
  ]

function scanText(
  text: string,
  location: string,
  serverId: string,
  category: FindingCategory = 'prompt-injection',
): RawFinding[] {
  const findings: RawFinding[] = []

  for (const { re, severity, title, detail } of INJECTION_PATTERNS) {
    if (re.test(text)) {
      findings.push({
        serverId,
        category,
        severity,
        title,
        detail,
        remediation:
          'Remove or rewrite the description to eliminate injection patterns. Validate all tool descriptions against an allow-list of safe language.',
        location,
      })
    }
  }

  if (text.length > 1000) {
    findings.push({
      serverId,
      category: 'prompt-injection',
      severity: 'info',
      title: 'Unusually long description',
      detail: `Description is ${text.length} characters — unusually long descriptions may hide embedded instructions.`,
      remediation: 'Keep tool descriptions concise (< 300 chars). Move detailed documentation to a README or resource.',
      location,
    })
  }

  return findings
}

export function checkPromptInjection(
  schema: DiscoveredSchema,
  serverId: string,
): RawFinding[] {
  const findings: RawFinding[] = []

  for (const tool of schema.tools) {
    if (tool.description) {
      findings.push(...scanText(tool.description, `tool:${tool.name}:description`, serverId))
    }
  }

  for (const resource of schema.resources) {
    if (resource.description) {
      findings.push(
        ...scanText(resource.description, `resource:${resource.uri}:description`, serverId),
      )
    }
  }

  for (const prompt of schema.prompts) {
    if (prompt.description) {
      findings.push(
        ...scanText(prompt.description, `prompt:${prompt.name}:description`, serverId),
      )
    }
  }

  return findings
}

// ── Unbounded-output check ─────────────────────────────────────────────────

const UNBOUNDED_NAME_RE = /^(list|get_all|fetch_all|read_all|dump|export)/i
const LIMIT_KEYS = new Set(['limit', 'max', 'page', 'count'])

export function checkUnboundedOutput(
  schema: DiscoveredSchema,
  serverId: string,
): RawFinding[] {
  const findings: RawFinding[] = []

  for (const tool of schema.tools) {
    if (!UNBOUNDED_NAME_RE.test(tool.name)) continue

    const properties =
      (tool.inputSchema?.properties as Record<string, unknown> | undefined) ?? {}
    const hasLimitParam = Object.keys(properties).some((k) => LIMIT_KEYS.has(k.toLowerCase()))

    if (!hasLimitParam) {
      findings.push({
        serverId,
        category: 'unbounded-output',
        severity: 'warn',
        title: `Unbounded output tool: ${tool.name}`,
        detail: `Tool "${tool.name}" looks like a list/dump operation but has no limit, max, page, or count parameter — it may return arbitrarily large payloads.`,
        remediation:
          'Add a `limit` parameter with a sensible default (e.g. 100) and document the maximum allowed value.',
        location: `tool:${tool.name}:inputSchema`,
      })
    }
  }

  return findings
}

// ── Destructive-tool check ─────────────────────────────────────────────────

const DESTRUCTIVE_RE =
  /\b(delete|remove|drop|truncate|destroy|wipe|reset|format|purge|erase|overwrite)\b/i
const CONFIRMATION_RE =
  /\b(confirm|confirmation|irreversible|cannot be undone|permanent|dry.?run)\b/i

const CRITICAL_VERBS = new Set(['delete', 'drop', 'truncate', 'destroy', 'wipe', 'purge', 'erase'])

function extractVerb(text: string): string | null {
  const m = text.match(DESTRUCTIVE_RE)
  return m ? m[1].toLowerCase() : null
}

export function checkDestructiveTools(
  schema: DiscoveredSchema,
  serverId: string,
): RawFinding[] {
  const findings: RawFinding[] = []

  for (const tool of schema.tools) {
    const combined = `${tool.name} ${tool.description ?? ''}`
    if (!DESTRUCTIVE_RE.test(combined)) continue
    if (CONFIRMATION_RE.test(combined)) continue

    const verb = extractVerb(combined)
    const severity: Severity =
      verb && CRITICAL_VERBS.has(verb) ? 'critical' : 'warn'

    findings.push({
      serverId,
      category: 'destructive-tool',
      severity,
      title: `Destructive tool without confirmation gate: ${tool.name}`,
      detail: `Tool "${tool.name}" performs a destructive operation (matched "${verb}") but its description contains no confirmation language or irreversibility warning.`,
      remediation:
        'Add a `confirm: boolean` parameter that must be explicitly set to `true`, or document irreversibility clearly in the description (e.g. "This action cannot be undone.").',
      location: `tool:${tool.name}:description`,
    })
  }

  return findings
}

// ── Runtime output scan ────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ re: RegExp; title: string; detail: string }> = [
  {
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    title: 'PII risk: email address in tool output',
    detail: 'Tool output contains what appears to be an email address.',
  },
  {
    re: /\b\d{3}-\d{2}-\d{4}\b/,
    title: 'PII risk: SSN-pattern in tool output',
    detail: 'Tool output contains a string matching a US Social Security Number format.',
  },
  {
    re: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/,
    title: 'PII risk: credit card number pattern in tool output',
    detail: 'Tool output contains a string matching a Visa or Mastercard credit card number pattern.',
  },
]

export function runtimeScanOutputs(
  turns: ScanOptions['turns'],
  serverId: string,
): RawFinding[] {
  if (!turns || turns.length === 0) return []

  const findings: RawFinding[] = []

  for (const turn of turns) {
    for (const result of turn.toolResults) {
      const text = JSON.stringify(result.content ?? '')
      const toolName = turn.toolCalls.find((tc) => tc.id === result.id)?.name ?? 'unknown'
      const location = `turn:${turn.index}:tool_result:${toolName}`

      // Check injection patterns (active attack — severity critical)
      for (const { re, title, detail } of INJECTION_PATTERNS) {
        if (re.test(text)) {
          findings.push({
            serverId,
            category: 'suspicious-output',
            severity: 'critical',
            title: `Runtime injection in output: ${title}`,
            detail: `Tool output from "${toolName}" at turn ${turn.index} contains: ${detail}`,
            remediation:
              'Sanitize tool outputs before returning to the agent. Strip or escape prompt-injection patterns in returned content.',
            location,
          })
        }
      }

      // Check PII patterns
      for (const { re, title, detail } of PII_PATTERNS) {
        if (re.test(text)) {
          findings.push({
            serverId,
            category: 'pii-risk',
            severity: 'warn',
            title,
            detail: `${detail} Detected in output from "${toolName}" at turn ${turn.index}.`,
            remediation:
              'Redact or mask PII in tool outputs. Ensure the MCP server applies PII filters before returning data to the agent.',
            location,
          })
        }
      }
    }
  }

  return findings
}
