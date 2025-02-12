import { MongoAdapter } from '../adapters/MongoAdapter';
import { DocumentData, QueryOptions, PhoenixStoreError } from '../types';

export class PhoenixStore {
  private adapter: MongoAdapter;

  constructor(uri: string, dbName: string) {
    this.adapter = new MongoAdapter(uri, dbName);
  }

  async connect(): Promise<void> {
    await this.adapter.connect();
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
  }

  collection<T extends DocumentData = DocumentData>(name: string) {
    return {
      // Basic CRUD operations with Firestore-like syntax
      async add(data: T): Promise<string> {
        return this.adapter.add<T>(name, data);
      },

      async doc(id: string) {
        return {
          async get(): Promise<{ id: string; data: () => T | null }> {
            const doc = await this.adapter.get<T>(name, id);
            return {
              id,
              data: () => doc
            };
          },

          async update(data: Partial<T>): Promise<void> {
            await this.adapter.update<T>(name, id, data);
          },

          async delete(): Promise<void> {
            await this.adapter.delete(name, id);
          }
        };
      }
    };
  }
}
