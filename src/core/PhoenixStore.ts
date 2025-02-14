import { MongoAdapter } from '../adapters/MongoAdapter';
import { DocumentData, QueryOperator, QueryOptions, QueryCondition, PhoenixStoreError } from '../types';

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

    class Query {
      private conditions: QueryCondition[] = [];
      private queryOptions: QueryOptions = {};
      private hasOrderBy = false;

      constructor(private readonly collectionName: string) {}

      private clone(): Query {
        const newQuery = new Query(this.collectionName);
        newQuery.conditions = [...this.conditions];
        newQuery.queryOptions = { ...this.queryOptions };
        newQuery.hasOrderBy = this.hasOrderBy;
        return newQuery;
      }

      where(field: string, operator: QueryOperator, value: any): Query {
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

      orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Query {
        const newQuery = this.clone();
        newQuery.queryOptions.orderBy = field;
        newQuery.queryOptions.orderDirection = direction;
        newQuery.hasOrderBy = true;
        return newQuery;
      }

      limit(limit: number): Query {
        const newQuery = this.clone();
        newQuery.queryOptions.limit = limit;
        return newQuery;
      }

      offset(offset: number): Query {
        const newQuery = this.clone();
        newQuery.queryOptions.offset = offset;
        return newQuery;
      }

      async get(): Promise<T[]> {
        return adapter.query<T>(name, this.conditions, this.queryOptions);
      }
    }

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
      },

      where(field: string, operator: QueryOperator, value: any): Query {
        const query = new Query(name);
        return query.where(field, operator, value);
      },

      orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Query {
        const query = new Query(name);
        return query.orderBy(field, direction);
      },

      limit(limit: number): Query {
        const query = new Query(name);
        return query.limit(limit);
      }
    };
  }
}
