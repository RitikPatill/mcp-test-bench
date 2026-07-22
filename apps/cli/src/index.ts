import { program } from 'commander'
import { loadConfig } from './config.js'
import { runCommand } from './commands/run.js'
import { reportCommand } from './commands/report.js'

program
  .name('mcpbench')
  .description('MCP Test Bench — evaluate MCP servers with Claude')
  .version('0.0.1')

program
  .command('run <config>')
  .description('Run an evaluation against an MCP server')
  .option('--db <path>', 'path to SQLite database', 'local.db')
  .option('--baseline <score>', 'fail if mean score drops below this value (0-10)')
  .option('--no-scan', 'skip the security scan')
  .action(async (configPath: string, opts: { db: string; baseline?: string; scan: boolean }) => {
    try {
      const config = loadConfig(configPath)
      await runCommand(configPath, opts, config)
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        // ZodError
        console.error('mcpbench: invalid config:')
        const zodErr = err as { issues: Array<{ path: unknown[]; message: string }> }
        for (const issue of zodErr.issues) {
          console.error(`  ${issue.path.join('.')}: ${issue.message}`)
        }
      } else {
        console.error(`mcpbench: ${err instanceof Error ? err.message : String(err)}`)
      }
      process.exit(1)
    }
  })

program
  .command('report')
  .description('Export a report for the last (or specified) run')
  .option('--format <fmt>', 'output format: json or junit', 'json')
  .option('--run-id <id>', 'specific run ID to report on (default: latest)')
  .option('--db <path>', 'path to SQLite database', 'local.db')
  .option('--output <file>', 'write output to file instead of stdout')
  .action(
    async (opts: { format: string; runId?: string; db: string; output?: string }) => {
      try {
        await reportCommand(opts)
      } catch (err) {
        console.error(`mcpbench: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    },
  )

program.parse()
