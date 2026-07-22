import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Externalize all node_modules so the bundle stays lightweight and avoids
  // resolution issues with workspace-transitive deps (drizzle-orm, libsql, etc.).
  // The binary is run from the monorepo where all deps are available.
  external: [
    'drizzle-orm',
    'drizzle-orm/libsql',
    'drizzle-orm/sqlite-core',
    '@libsql/client',
    '@anthropic-ai/sdk',
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/client/index.js',
    '@modelcontextprotocol/sdk/client/stdio.js',
    '@modelcontextprotocol/sdk/client/sse.js',
    'commander',
    'js-yaml',
    'zod',
  ],
})
