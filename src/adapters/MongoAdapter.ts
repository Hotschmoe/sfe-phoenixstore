import { MongoClient, Collection, Db, ObjectId } from 'mongodb';
import { DocumentData, QueryOperator, QueryOptions, PhoenixStoreError } from '../types';

export class MongoAdapter {
  private client: MongoClient;
  private db: Db | null = null;

  constructor(private uri: string, private dbName: string) {
    try {
      this.client = new MongoClient(uri);
    } catch (error) {
      throw new PhoenixStoreError(
        'Failed to connect to MongoDB: Invalid connection string format',
        'MONGODB_CONNECTION_ERROR',
        error as Error
      );
    }
  }

  async connect(): Promise<void> {
    try {
      // Add a 3 second timeout to the connection attempt
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });

      await Promise.race([connectPromise, timeoutPromise]);
      this.db = this.client.db(this.dbName);
      console.log('Successfully connected to MongoDB');
    } catch (error) {
      // Ensure any MongoDB-specific errors are wrapped in our PhoenixStoreError
      if (error instanceof PhoenixStoreError) {
        throw error;
      }
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
    try {
      const objectId = new ObjectId(id);
      const doc = await collection.findOne({ _id: objectId });
      if (!doc) return null;
      
      // Convert MongoDB _id to string id in the returned document
      const { _id, ...rest } = doc;
      return { id: _id.toString(), ...rest } as T;
    } catch (error) {
      // If ID is invalid format, return null
      return null;
    }
  }

  async update<T extends DocumentData>(
    collectionName: string,
    id: string,
    data: Partial<T>
  ): Promise<boolean> {
    const collection = this.getCollection<T>(collectionName);
    try {
      const objectId = new ObjectId(id);
      const result = await collection.updateOne(
        { _id: objectId },
        { $set: data }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      return false;
    }
  }

  async delete(collectionName: string, id: string): Promise<boolean> {
    const collection = this.getCollection(collectionName);
    try {
      const objectId = new ObjectId(id);
      const result = await collection.deleteOne({ _id: objectId });
      return result.deletedCount > 0;
    } catch (error) {
      return false;
    }
  }
}
