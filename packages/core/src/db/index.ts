import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

export { servers } from './schema.js'

type DrizzleDb = ReturnType<typeof drizzle>
const instances = new Map<string, DrizzleDb>()

export async function getDbReady(dbPath = 'local.db'): Promise<DrizzleDb> {
  const key = dbPath
  if (instances.has(key)) {
    return instances.get(key)!
  }

  const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`
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

  const db = drizzle(client, { schema })
  instances.set(key, db)
  return db
}
