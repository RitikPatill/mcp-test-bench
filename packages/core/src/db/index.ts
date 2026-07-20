import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

export { servers, scenarios, runs, turns, judgements, findings } from './schema.js'

export type DrizzleDb = ReturnType<typeof drizzle>
const instances = new Map<string, DrizzleDb>()

export async function getDbReady(dbPath = 'local.db'): Promise<DrizzleDb> {
  const key = dbPath
  if (instances.has(key)) {
    return instances.get(key)!
  }

  const url =
    dbPath === ':memory:' || dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`
  const client = createClient({ url })

  await client.execute(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      discovered_schema TEXT,
      created_at INTEGER NOT NULL
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      user_prompt TEXT NOT NULL,
      expected_criteria TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      "index" INTEGER NOT NULL,
      assistant_message TEXT NOT NULL,
      tool_calls TEXT NOT NULL,
      tool_results TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS judgements (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      rubric_id TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      criteria_scores TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      remediation TEXT NOT NULL,
      location TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  // Migration guard: add tag column to existing scenarios tables
  try {
    await client.execute(
      `ALTER TABLE scenarios ADD COLUMN tag TEXT NOT NULL DEFAULT 'happy-path'`,
    )
  } catch {
    // column already exists — safe to ignore
  }

  const db = drizzle(client, { schema })
  instances.set(key, db)
  return db
}
