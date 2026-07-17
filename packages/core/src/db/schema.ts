import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { ServerConfig, DiscoveredSchema } from '../mcp-client/types.js'

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).$type<ServerConfig>().notNull(),
  discoveredSchema: text('discovered_schema', { mode: 'json' }).$type<DiscoveredSchema>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
