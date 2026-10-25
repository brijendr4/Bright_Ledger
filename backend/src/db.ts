import dotenv from 'dotenv'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const serverEnvFile = resolve(moduleDirectory, '../.env')
const rootEnvFile = resolve(moduleDirectory, '../../.env')
dotenv.config({ path: existsSync(serverEnvFile) ? serverEnvFile : rootEnvFile })

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required. Copy .env.example to .env and start PostgreSQL.')

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
})

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return pool.query<T>(text, values)
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function migrate() {
  const migrationsPath = resolve(moduleDirectory, '../migrations')
  for (const migration of ['001_initial.sql', '002_trade_counter_listing.sql', '003_usd_pricing.sql', '004_ai_evidence_review.sql', '005_global_sample_locations.sql', '006_solar_funding_estimates.sql', '007_evidence_file_storage.sql', '008_wallet_sessions_and_ai_project_gate.sql', '009_wallet_notifications_and_pledges.sql', '010_username_password_accounts.sql', '011_p2p_trade_review_flow.sql', '012_simulated_project_income.sql']) {
    const sql = await readFile(resolve(migrationsPath, migration), 'utf8')
    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [73421608])
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
      const alreadyApplied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migration])
      if (alreadyApplied.rowCount) return
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [migration])
    })
  }
}
