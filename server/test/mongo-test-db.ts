import { randomUUID } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo } from '../database/mongo.js';

export async function createMongoTestDatabase() {
  const server = await MongoMemoryServer.create();
  const uri = `${server.getUri()}riftbound_test_${randomUUID().replaceAll('-', '')}`;

  try {
    const connection = await connectMongo(uri);
    return {
      ...connection,
      uri,
      close: async () => {
        await connection.close();
        await server.stop();
      }
    };
  } catch (error) {
    await server.stop();
    throw error;
  }
}
