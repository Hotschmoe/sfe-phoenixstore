import { MongoAdapter } from '../adapters/MongoAdapter';
import { DocumentData, QueryOperator, QueryOptions, QueryCondition, PhoenixStoreError } from '../types';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { WebSocketManager } from '../websocket/WebSocketManager';

// Helper classes for collection operations
export class CollectionQuery<T extends DocumentData> {
  conditions: QueryCondition[] = [];
  queryOptions: QueryOptions = {};
  hasOrderBy = false;

  constructor(
    readonly collectionName: string,
    readonly adapter: MongoAdapter,
    readonly name: string
  ) {}

  clone(): CollectionQuery<T> {
    const newQuery = new CollectionQuery<T>(this.collectionName, this.adapter, this.name);
    newQuery.conditions = [...this.conditions];
    newQuery.queryOptions = { ...this.queryOptions };
    newQuery.hasOrderBy = this.hasOrderBy;
    return newQuery;
  }

  where(field: string, operator: QueryOperator, value: any): CollectionQuery<T> {
    if (this.hasOrderBy) {
      throw new PhoenixStoreError(
        'where must come before orderBy',
        'INVALID_QUERY'
      );
    }

    if (operator === '>' || operator === '<' || operator === '>=' || operator === '<=') {
      if (typeof value !== 'number' && !(value instanceof Date)) {
        throw new PhoenixStoreError(
          `Value must be a number or Date for operator ${operator}`,
          'INVALID_ARGUMENT'
        );
      }
    }

    const newQuery = this.clone();
    newQuery.conditions.push({ field, operator, value });
    return newQuery;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): CollectionQuery<T> {
    const newQuery = this.clone();
    newQuery.queryOptions.orderBy = field;
    newQuery.queryOptions.orderDirection = direction;
    newQuery.hasOrderBy = true;
    return newQuery;
  }

  limit(limit: number): CollectionQuery<T> {
    const newQuery = this.clone();
    newQuery.queryOptions.limit = limit;
    return newQuery;
  }

  offset(offset: number): CollectionQuery<T> {
    const newQuery = this.clone();
    newQuery.queryOptions.offset = offset;
    return newQuery;
  }

  async get(): Promise<T[]> {
    return this.adapter.query<T>(this.name, this.conditions, this.queryOptions);
  }
}

export class DocumentReference<T extends DocumentData> {
  constructor(
    readonly id: string,
    readonly adapter: MongoAdapter,
    readonly name: string
  ) {}

  async get(): Promise<{ id: string; data: () => T | null }> {
    const doc = await this.adapter.get<T>(this.name, this.id);
    return {
      id: this.id,
      data: () => doc
    };
  }

  async update(data: Partial<T>): Promise<void> {
    await this.adapter.update<T>(this.name, this.id, data);
  }

  async delete(): Promise<void> {
    await this.adapter.delete(this.name, this.id);
  }
}

class Collection<T extends DocumentData> {
  constructor(
    private readonly name: string,
    private readonly adapter: DatabaseAdapter
  ) {}

  async add(data: Omit<T, 'id'>): Promise<string> {
    return await this.adapter.add(this.name, data);
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await this.adapter.update(this.name, id, data);
  }

  async delete(id: string): Promise<void> {
    await this.adapter.delete(this.name, id);
  }

  async get(id: string): Promise<T | null> {
    return await this.adapter.get(this.name, id) as T | null;
  }

  async query(conditions: QueryCondition[]): Promise<T[]> {
    return await this.adapter.query(this.name, conditions) as T[];
  }

  doc(id: string): DocumentReference<T> {
    return new DocumentReference<T>(id, this.adapter as MongoAdapter, this.name);
  }

  where(field: string, operator: QueryOperator, value: any): CollectionQuery<T> {
    const query = new CollectionQuery<T>(this.name, this.adapter as MongoAdapter, this.name);
    return query.where(field, operator, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): CollectionQuery<T> {
    const query = new CollectionQuery<T>(this.name, this.adapter as MongoAdapter, this.name);
    return query.orderBy(field, direction);
  }

  limit(limit: number): CollectionQuery<T> {
    const query = new CollectionQuery<T>(this.name, this.adapter as MongoAdapter, this.name);
    return query.limit(limit);
  }
}

export class PhoenixStore {
  private adapter: DatabaseAdapter;
  private webSocketManager: WebSocketManager;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
    this.webSocketManager = new WebSocketManager(this);
  }

  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  getWebSocketManager(): WebSocketManager {
    return this.webSocketManager;
  }

  async connect(): Promise<void> {
    await this.adapter.connect();
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
  }

  async add<T extends DocumentData>(collection: string, data: Omit<T, 'id'>): Promise<string> {
    return await this.adapter.add(collection, data);
  }

  async update<T extends DocumentData>(collection: string, id: string, data: Partial<T>): Promise<void> {
    await this.adapter.update(collection, id, data);
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.adapter.delete(collection, id);
  }

  async get<T extends DocumentData>(collection: string, id: string): Promise<T | null> {
    return await this.adapter.get(collection, id) as T | null;
  }

  async query<T extends DocumentData>(collection: string, conditions: QueryCondition[]): Promise<T[]> {
    return await this.adapter.query(collection, conditions) as T[];
  }

  collection<T extends DocumentData>(name: string): Collection<T> {
    return new Collection<T>(name, this.adapter);
  }
}
