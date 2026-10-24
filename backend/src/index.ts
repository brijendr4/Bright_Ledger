import 'dotenv/config'
import { migrate, pool } from './db.js'
import { startServer } from './app.js'

await migrate()
const server = await startServer()

const shutdown = async () => {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
