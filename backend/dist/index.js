import 'dotenv/config';
import { migrate, pool } from './db.js';
import { startServer } from './app.js';
import { seedDemoData } from './seed.js';
await migrate();
if (process.env.SEED_SAMPLE_DATA === 'true')
    await seedDemoData();
const server = await startServer();
const shutdown = async () => {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
