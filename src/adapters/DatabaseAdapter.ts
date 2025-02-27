import { DocumentData, QueryCondition } from '../types';

export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    add(collection: string, data: Omit<DocumentData, 'id'>): Promise<string>;
    update(collection: string, id: string, data: Partial<DocumentData>): Promise<void>;
    delete(collection: string, id: string): Promise<void>;
    get(collection: string, id: string): Promise<DocumentData | null>;
    query(collection: string, conditions: QueryCondition[]): Promise<DocumentData[]>;
} 