import { MongoClient, Collection, Db, ObjectId, Filter, Sort, Document, OptionalUnlessRequiredId, FindOptions, UpdateFilter, DeleteOptions, InsertOneOptions, UpdateOptions, WithId } from 'mongodb';
import { DocumentData, QueryOperator, QueryOptions, PhoenixStoreError } from '../types';
import { config } from '../utils/config';
import { DatabaseAdapter } from './DatabaseAdapter';

export class MongoAdapter implements DatabaseAdapter {
  private client: MongoClient;
  private db: Db | null = null;
  private readonly uri: string;
  private readonly dbName: string;

  constructor(uri: string, dbName: string) {
    this.uri = uri || config.MONGODB_URI;
    this.dbName = dbName || config.MONGODB_DATABASE;
    this.client = new MongoClient(this.uri);
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

  // Add public getter for database connection
  public get database(): Db {
    if (!this.db) {
      throw new PhoenixStoreError(
        'Database connection not initialized',
        'MONGODB_NOT_CONNECTED'
      );
    }
    return this.db;
  }

  // Add public method to get collection with proper typing
  public getCollection<T extends Document = Document>(name: string): Collection<T> {
    return this.database.collection<T>(name);
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
  async query<T extends Document>(
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
        return { id: _id.toString(), ...rest } as unknown as T;
      });
    } catch (error) {
      if (error instanceof PhoenixStoreError) {
        throw error;
      }
      throw new PhoenixStoreError(
        'Failed to execute query',
        'QUERY_ERROR',
        error as Error
      );
    }
  }

  private buildFilter(conditions: { field: string; operator: QueryOperator; value: any }[]): Filter<Document> {
    if (conditions.length === 0) {
      return {};
    }

    // Group conditions by field
    const conditionsByField = conditions.reduce((acc, condition) => {
      const { field, operator, value } = condition;
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push({ operator, value });
      return acc;
    }, {} as Record<string, { operator: QueryOperator; value: any }[]>);

    // Build filter with $and for multiple conditions on the same field
    const filters = Object.entries(conditionsByField).map(([field, fieldConditions]) => {
      if (fieldConditions.length === 1) {
        // Single condition for this field
        const { operator, value } = fieldConditions[0];
        return this.buildSingleCondition(field, operator, value);
      } else {
        // Multiple conditions for this field - use $and
        return {
          $and: fieldConditions.map(({ operator, value }) => 
            this.buildSingleCondition(field, operator, value)
          )
        };
      }
    });

    // Combine all filters with $and
    return filters.length === 1 ? filters[0] : { $and: filters };
  }

  private buildSingleCondition(field: string, operator: QueryOperator, value: any): Filter<Document> {
    switch (operator) {
      case '==':
        return { [field]: { $eq: value } };
      case '!=':
        return { [field]: { $ne: value } };
      case '<':
        return { [field]: { $lt: value } };
      case '<=':
        return { [field]: { $lte: value } };
      case '>':
        return { [field]: { $gt: value } };
      case '>=':
        return { [field]: { $gte: value } };
      case 'in':
        return { [field]: { $in: value } };
      case 'not-in':
        return { [field]: { $nin: value } };
      case 'array-contains':
        return { [field]: { $elemMatch: { $eq: value } } };
      case 'array-contains-any':
        return { [field]: { $in: value } };
      default:
        throw new PhoenixStoreError(
          `Unsupported operator: ${operator}`,
          'INVALID_OPERATOR'
        );
    }
  }

  private buildSort(field?: string, direction: 'asc' | 'desc' = 'asc'): Sort | undefined {
    if (!field) return undefined;
    
    return {
      [field]: direction === 'asc' ? 1 : -1
    };
  }

  // Update CRUD operations with proper typing
  async add<T extends Document>(
    collectionName: string,
    data: T
  ): Promise<string> {
    const collection = this.getCollection<T>(collectionName);
    const result = await collection.insertOne(data as OptionalUnlessRequiredId<T>);
    return result.insertedId.toString();
  }

  async get<T extends Document>(
    collectionName: string,
    id: string
  ): Promise<T | null> {
    const collection = this.getCollection<T>(collectionName);
    try {
      const objectId = new ObjectId(id);
      const doc = await collection.findOne<T>({ _id: objectId } as Filter<T>);
      if (!doc) return null;
      
      // Convert MongoDB _id to string id in the returned document
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toString() } as unknown as T;
    } catch (error) {
      // If ID is invalid format, return null
      return null;
    }
  }

  async update<T extends Document>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    const collection = await this.getCollection(collectionName);
    const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: this.prepareForMongo(data) }
    );
    if (!result.acknowledged) {
        throw new PhoenixStoreError('Failed to update document', 'MONGODB_UPDATE_ERROR');
    }
  }

  async delete(collectionName: string, id: string): Promise<void> {
    const collection = await this.getCollection(collectionName);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (!result.acknowledged) {
        throw new PhoenixStoreError('Failed to delete document', 'MONGODB_DELETE_ERROR');
    }
  }

  // Add new methods for WebSocket support
  public async find<T extends Document = Document>(
    collectionName: string,
    filter: Filter<T> = {},
    options: FindOptions = {}
  ): Promise<T[]> {
    const collection = this.getCollection<T>(collectionName);
    const results = await collection.find(filter, options).toArray();
    return results.map(doc => {
      const { _id, ...rest } = doc;
      return { ...rest, id: _id.toString() } as unknown as T;
    });
  }

  public async findOne<T extends Document = Document>(
    collectionName: string,
    filter: Filter<T>
  ): Promise<T | null> {
    const collection = this.getCollection<T>(collectionName);
    const result = await collection.findOne(filter);
    if (!result) return null;
    
    const { _id, ...rest } = result;
    return { ...rest, id: _id.toString() } as unknown as T;
  }

  public async insertOne<T extends Document = Document>(
    collectionName: string,
    document: T,
    options?: InsertOneOptions
  ) {
    const collection = this.getCollection<T>(collectionName);
    return collection.insertOne(document as OptionalUnlessRequiredId<T>, options);
  }

  public async updateOne<T extends Document = Document>(
    collectionName: string,
    filter: Filter<T>,
    update: UpdateFilter<T>,
    options?: UpdateOptions
  ) {
    const collection = this.getCollection<T>(collectionName);
    return collection.updateOne(filter, update, options);
  }

  public async deleteOne<T extends Document = Document>(
    collectionName: string,
    filter: Filter<T>,
    options?: DeleteOptions
  ) {
    const collection = this.getCollection<T>(collectionName);
    return collection.deleteOne(filter, options);
  }

  private prepareForMongo(data: any): any {
    if (Array.isArray(data)) {
        return data.map(item => this.prepareForMongo(item));
    }
    
    if (data && typeof data === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip undefined values
            if (value === undefined) continue;
            
            // Handle nested objects and arrays
            if (Array.isArray(value) || (value && typeof value === 'object')) {
                result[key] = this.prepareForMongo(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
    
    return data;
  }
}
