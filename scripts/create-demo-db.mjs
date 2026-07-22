#!/usr/bin/env node
// scripts/create-demo-db.mjs
// Creates examples/demo/sample.db with realistic tables for the SQLite MCP server demo.
// Run: node scripts/create-demo-db.mjs

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { mkdirSync } from 'fs'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// @libsql/client is installed inside packages/core in a pnpm monorepo.
// We resolve it explicitly so this script works when run from the repo root.
const require = createRequire(resolve(__dirname, '..', 'packages', 'core', 'package.json'))
const { createClient } = require('@libsql/client')

const dbDir = resolve(__dirname, '..', 'examples', 'demo')
const dbPath = resolve(dbDir, 'sample.db')

mkdirSync(dbDir, { recursive: true })

const db = createClient({ url: `file:${dbPath}` })

await db.execute(`CREATE TABLE IF NOT EXISTS employees (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL,
  department TEXT   NOT NULL,
  salary    REAL    NOT NULL
)`)

await db.execute(`CREATE TABLE IF NOT EXISTS products (
  id    INTEGER PRIMARY KEY,
  name  TEXT    NOT NULL,
  price REAL    NOT NULL,
  stock INTEGER NOT NULL
)`)

// Idempotent: delete before re-inserting so reruns are clean
await db.execute(`DELETE FROM employees`)
await db.execute(`DELETE FROM products`)

const employees = [
  [1, 'Alice Johnson',  'Engineering',  95000],
  [2, 'Bob Smith',      'Marketing',    72000],
  [3, 'Carol White',    'Engineering', 105000],
  [4, 'David Lee',      'HR',           68000],
  [5, 'Eva Martinez',   'Engineering',  98000],
  [6, 'Frank Brown',    'Finance',      85000],
  [7, 'Grace Kim',      'Marketing',    74000],
  [8, 'Henry Davis',    'HR',           65000],
  [9, 'Iris Chen',      'Finance',      88000],
  [10,'James Wilson',   'Engineering',  99000],
]

for (const [id, name, department, salary] of employees) {
  await db.execute({
    sql: `INSERT INTO employees (id, name, department, salary) VALUES (?, ?, ?, ?)`,
    args: [id, name, department, salary],
  })
}

const products = [
  [1,  'Laptop Pro 15',      1299.99, 42],
  [2,  'Wireless Mouse',        29.99, 215],
  [3,  'USB-C Hub',             49.99, 130],
  [4,  'Mechanical Keyboard',  149.99,  78],
  [5,  '4K Monitor',           399.99,  25],
  [6,  'Webcam HD',             89.99,  60],
  [7,  'Noise-Cancel Headset', 199.99,  45],
  [8,  'Standing Desk',        549.99,  18],
  [9,  'Ergonomic Chair',      449.99,  12],
  [10, 'LED Desk Lamp',         34.99,  95],
]

for (const [id, name, price, stock] of products) {
  await db.execute({
    sql: `INSERT INTO products (id, name, price, stock) VALUES (?, ?, ?, ?)`,
    args: [id, name, price, stock],
  })
}

console.log(`Created ${dbPath}`)
console.log(`  employees: ${employees.length} rows`)
console.log(`  products:  ${products.length} rows`)
