// Query Types
export type QueryOperator = 
  | '==' 
  | '!=' 
  | '<' 
  | '<=' 
  | '>' 
  | '>=' 
  | 'array-contains' 
  | 'array-contains-any' 
  | 'in' 
  | 'not-in';

export type OrderDirection = 'asc' | 'desc';

export interface QueryOptions {
  limit?: number;
  orderBy?: string;
  orderDirection?: OrderDirection;
  startAfter?: any;
  endBefore?: any;
}

// Document Types
export interface DocumentData {
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
