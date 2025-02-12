import { MongoClient, Collection, Db } from 'mongodb';
import { DocumentData, QueryOperator, QueryOptions, PhoenixStoreError } from '../types';

export class MongoAdapter {
  private client: MongoClient;
  private db: Db | null = null;

  constructor(private uri: string, private dbName: string) {
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      console.log('Successfully connected to MongoDB');
    } catch (error) {
      throw new PhoenixStoreError(
        'Failed to connect to MongoDB',
        'MONGODB_CONNECTION_ERROR',
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  private getCollection<T = DocumentData>(collectionName: string): Collection<T> {
    if (!this.db) {
      throw new PhoenixStoreError(
        'Database connection not initialized',
        'MONGODB_NOT_CONNECTED'
      );
    }
    return this.db.collection<T>(collectionName);
  }

  // Firestore-like query operator conversion
  private convertOperator(operator: QueryOperator): string {
    const operatorMap: Record<QueryOperator, string> = {
      '==': '$eq',
      '!=': '$ne',
      '<': '$lt',
      '<=': '$lte',
      '>': '$gt',
      '>=': '$gte',
      'in': '$in',
      'not-in': '$nin',
      'array-contains': '$elemMatch',
      'array-contains-any': '$in'
    };
    return operatorMap[operator];
  }

  // Basic CRUD operations
  async add<T extends DocumentData>(
    collectionName: string,
    data: T
  ): Promise<string> {
    const collection = this.getCollection<T>(collectionName);
    const result = await collection.insertOne(data);
    return result.insertedId.toString();
  }

  async get<T extends DocumentData>(
    collectionName: string,
    id: string
  ): Promise<T | null> {
    const collection = this.getCollection<T>(collectionName);
    return collection.findOne({ _id: id });
  }

  async update<T extends DocumentData>(
    collectionName: string,
    id: string,
    data: Partial<T>
  ): Promise<boolean> {
    const collection = this.getCollection<T>(collectionName);
    const result = await collection.updateOne(
      { _id: id },
      { $set: data }
    );
    return result.modifiedCount > 0;
  }

  async delete(collectionName: string, id: string): Promise<boolean> {
    const collection = this.getCollection(collectionName);
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
