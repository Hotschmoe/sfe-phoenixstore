import { MongoClient, Collection, Db, ObjectId, Filter, Sort } from 'mongodb';
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

  // Query builder method
  async query<T extends DocumentData>(
    collectionName: string,
    conditions: { field: string; operator: QueryOperator; value: any }[],
    options: QueryOptions = {}
  ): Promise<T[]> {
    const collection = this.getCollection<T>(collectionName);
    
    try {
      // Build MongoDB query from conditions
      const filter = this.buildFilter(conditions);
      
      // Build sort options
      const sort = this.buildSort(options.orderBy, options.orderDirection);
      
      // Create query
      let query = collection.find(filter);
      
      // Apply sorting
      if (sort) {
        query = query.sort(sort);
      }
      
      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.skip(options.offset);
      }
      
      // Execute query
      const results = await query.toArray();
      
      // Transform results to include string IDs
      return results.map(doc => {
        const { _id, ...rest } = doc;
        return { id: _id.toString(), ...rest } as T;
      });
    } catch (error) {
      if (error instanceof PhoenixStoreError) {
        throw error; // Re-throw PhoenixStoreError with original code
      }
      throw new PhoenixStoreError(
        'Failed to execute query',
        'QUERY_ERROR',
        error as Error
      );
    }
  }

  private buildFilter(conditions: { field: string; operator: QueryOperator; value: any }[]): Filter<any> {
    const filter: Record<string, any> = {};
    
    for (const { field, operator, value } of conditions) {
      switch (operator) {
        case '==':
          filter[field] = { $eq: value };
          break;
        case '!=':
          filter[field] = { $ne: value };
          break;
        case '<':
          filter[field] = { $lt: value };
          break;
        case '<=':
          filter[field] = { $lte: value };
          break;
        case '>':
          filter[field] = { $gt: value };
          break;
        case '>=':
          filter[field] = { $gte: value };
          break;
        case 'in':
          filter[field] = { $in: value };
          break;
        case 'not-in':
          filter[field] = { $nin: value };
          break;
        default:
          throw new PhoenixStoreError(
            `Unsupported operator: ${operator}`,
            'INVALID_OPERATOR'
          );
      }
    }
    
    return filter;
  }

  private buildSort(field?: string, direction: 'asc' | 'desc' = 'asc'): Sort | undefined {
    if (!field) return undefined;
    
    return {
      [field]: direction === 'asc' ? 1 : -1
    };
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
