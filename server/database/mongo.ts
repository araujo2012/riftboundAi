import { MongoClient } from 'mongodb';
import type { Db } from 'mongodb';

export type MongoConnection = {
  client: MongoClient;
  db: Db;
  close: () => Promise<void>;
};

export async function connectMongo(uri: string, databaseName?: string): Promise<MongoConnection> {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    return {
      client,
      db: databaseName ? client.db(databaseName) : client.db(),
      close: () => client.close()
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
