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
    const adapter = this.adapter;

    class DocumentReference {
      constructor(private id: string) {}

      async get(): Promise<{ id: string; data: () => T | null }> {
        const doc = await adapter.get<T>(name, this.id);
        return {
          id: this.id,
          data: () => doc
        };
      }

      async update(data: Partial<T>): Promise<void> {
        await adapter.update<T>(name, this.id, data);
      }

      async delete(): Promise<void> {
        await adapter.delete(name, this.id);
      }
    }

    return {
      async add(data: T): Promise<string> {
        return adapter.add<T>(name, data);
      },

      doc(id: string): DocumentReference {
        return new DocumentReference(id);
      }
    };
  }
}
