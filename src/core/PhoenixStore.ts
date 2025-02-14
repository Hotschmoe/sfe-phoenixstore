import { MongoAdapter } from '../adapters/MongoAdapter';
import { DocumentData, QueryOperator, QueryOptions, QueryCondition, PhoenixStoreError } from '../types';

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
    
    return {
      async add(data: T): Promise<string> {
        return adapter.add<T>(name, data);
      },

      doc(id: string): DocumentReference<T> {
        return new DocumentReference<T>(id, adapter, name);
      },

      where(field: string, operator: QueryOperator, value: any): CollectionQuery<T> {
        const query = new CollectionQuery<T>(name, adapter, name);
        return query.where(field, operator, value);
      },

      orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): CollectionQuery<T> {
        const query = new CollectionQuery<T>(name, adapter, name);
        return query.orderBy(field, direction);
      },

      limit(limit: number): CollectionQuery<T> {
        const query = new CollectionQuery<T>(name, adapter, name);
        return query.limit(limit);
      }
    };
  }
}
