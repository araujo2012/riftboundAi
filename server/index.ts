import 'dotenv/config';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { loadConfig } from './config.js';
import { connectMongo } from './database/mongo.js';

const config = loadConfig(process.env);
const database = await connectMongo(config.mongoUri);
const auth = createAuth(database.db, config);
const app = createApp({ auth, db: database.db });
const server = app.listen(config.apiPort, '127.0.0.1', () => {
  process.stdout.write(`Riftbound API listening on http://127.0.0.1:${config.apiPort}\n`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await database.close();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
