import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import type { SavedDeck } from '../../src/decks/types.js';

export type DeckDraft = Omit<SavedDeck, 'id'>;

type DeckDocument = DeckDraft & {
  _id: ObjectId;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

function serializeDeck(document: DeckDocument): SavedDeck {
  return {
    id: document._id.toHexString(),
    name: document.name,
    cards: document.cards,
    sourceText: document.sourceText
  };
}

export function createDeckRepository(db: Db) {
  const collection = db.collection<DeckDocument>('decks');

  return {
    async listByOwner(ownerId: string): Promise<SavedDeck[]> {
      const documents = await collection.find({ ownerId }).sort({ createdAt: -1, _id: -1 }).toArray();
      return documents.map(serializeDeck);
    },

    async findByOwner(id: ObjectId, ownerId: string): Promise<SavedDeck | null> {
      const document = await collection.findOne({ _id: id, ownerId });
      return document ? serializeDeck(document) : null;
    },

    async createForOwner(ownerId: string, draft: DeckDraft): Promise<SavedDeck> {
      const now = new Date();
      const document: DeckDocument = {
        _id: new ObjectId(),
        ownerId,
        ...draft,
        createdAt: now,
        updatedAt: now
      };
      await collection.insertOne(document);
      return serializeDeck(document);
    },

    async updateByOwner(id: ObjectId, ownerId: string, draft: DeckDraft): Promise<SavedDeck | null> {
      const result = await collection.updateOne(
        { _id: id, ownerId },
        { $set: { ...draft, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      const document = await collection.findOne({ _id: id, ownerId });
      return document ? serializeDeck(document) : null;
    },

    async deleteByOwner(id: ObjectId, ownerId: string): Promise<boolean> {
      const result = await collection.deleteOne({ _id: id, ownerId });
      return result.deletedCount > 0;
    }
  };
}
