import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import type { Card, CardDraft } from '../../src/cards/types.js';

type CardDocument = CardDraft & {
  _id: ObjectId;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function serializeCard({ _id, createdBy: _createdBy, updatedBy: _updatedBy, createdAt: _createdAt, updatedAt: _updatedAt, ...draft }: CardDocument): Card {
  return { id: _id.toHexString(), ...draft };
}

export function createCardRepository(db: Db) {
  const collection = db.collection<CardDocument>('cards');

  return {
    async list(): Promise<Card[]> {
      const documents = await collection
        .find()
        .sort({ set: 1, collectorNumber: 1, name: 1, _id: 1 })
        .toArray();
      return documents.map(serializeCard);
    },

    async find(id: ObjectId): Promise<Card | null> {
      const document = await collection.findOne({ _id: id });
      return document ? serializeCard(document) : null;
    },

    async create(userId: string, draft: CardDraft): Promise<Card> {
      const now = new Date();
      const document: CardDocument = {
        _id: new ObjectId(),
        ...draft,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now
      };
      await collection.insertOne(document);
      return serializeCard(document);
    },

    async update(id: ObjectId, userId: string, draft: CardDraft): Promise<Card | null> {
      const document = await collection.findOneAndUpdate(
        { _id: id },
        { $set: { ...draft, updatedBy: userId, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return document ? serializeCard(document) : null;
    },

    async delete(id: ObjectId): Promise<boolean> {
      const result = await collection.deleteOne({ _id: id });
      return result.deletedCount > 0;
    }
  };
}
