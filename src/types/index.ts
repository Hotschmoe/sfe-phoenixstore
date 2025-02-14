import { Document } from 'mongodb';

// Query Types
export type QueryOperator = 
  | '==' 
  | '!=' 
  | '<' 
  | '<=' 
  | '>' 
  | '>=' 
  | 'in' 
  | 'not-in'
  | 'array-contains'
  | 'array-contains-any';

export type OrderDirection = 'asc' | 'desc';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: OrderDirection;
}

// Document Types
export interface DocumentData extends Document {
  id?: string;
  [field: string]: any;
}

export interface DocumentSnapshot<T = DocumentData> {
  id: string;
  exists: boolean;
  data(): T | undefined;
}

// Collection Types
export interface CollectionReference<T = DocumentData> {
  id: string;
  path: string;
}

// Query Types
export interface QueryCondition {
  field: string;
  operator: QueryOperator;
  value: any;
}

// Error Types
export class PhoenixStoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PhoenixStoreError';
  }
}
