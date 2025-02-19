import React, { useState } from 'react';
import { ResponseData } from '../types';

interface QueryOperationsProps {
    loading: boolean;
    responses: ResponseData[];
    onTestEndpoint: (operation: string, endpoint: string, method: string, body?: any) => Promise<ResponseData | void>;
}

export function QueryOperations({ loading, responses, onTestEndpoint }: QueryOperationsProps) {
    const [customQuery, setCustomQuery] = useState('');
    const [filterConditions, setFilterConditions] = useState<Array<{
        field: string;
        operator: string;
        value: string | number | string[];
    }>>([]);
    const [orderBy, setOrderBy] = useState('');
    const [limit, setLimit] = useState('');

    const validOperators = [
        '==', '!=', '<', '<=', '>', '>=',
        'in', 'not-in',
        'array-contains', 'array-contains-any'
    ];

    const buildQueryString = () => {
        const parts = [];
        
        if (filterConditions.length > 0) {
            parts.push(`filter=${encodeURIComponent(JSON.stringify(filterConditions))}`);
        }
        
        if (orderBy) {
            parts.push(`orderBy=${orderBy}`);
        }
        
        if (limit) {
            parts.push(`limit=${limit}`);
        }
        
        return parts.join('&');
    };

    const addFilterCondition = () => {
        setFilterConditions([...filterConditions, { field: '', operator: '==', value: '' }]);
    };

    const updateFilterCondition = (index: number, update: Partial<{
        field: string;
        operator: string;
        value: string | number | string[];
    }>) => {
        const newConditions = [...filterConditions];
        newConditions[index] = { ...newConditions[index], ...update };
        setFilterConditions(newConditions);
    };

    const removeFilterCondition = (index: number) => {
        setFilterConditions(filterConditions.filter((_, i) => i !== index));
    };

    const handleCustomQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const queryString = buildQueryString();
        if (queryString) {
            onTestEndpoint('QUERY', `/test-collection?${queryString}`, 'GET');
        }
    };

    const sampleData = [
        {
            name: 'Premium Laptop',
            status: 'active',
            type: 'premium',
            price: 1299.99,
            category: 'electronics',
            features: ['wifi', 'bluetooth', '4K display'],
            tags: ['tech', 'premium', 'laptop'],
            age: 0,
            timestamp: new Date().toISOString()
        },
        {
            name: 'Basic Smartphone',
            status: 'active',
            type: 'basic',
            price: 299.99,
            category: 'electronics',
            features: ['wifi', 'bluetooth'],
            tags: ['tech', 'budget', 'smartphone'],
            age: 1,
            timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
            name: 'Programming Book',
            status: 'active',
            type: 'basic',
            price: 49.99,
            category: 'books',
            features: ['digital', 'paperback'],
            tags: ['education', 'programming', 'news'],
            age: 30,
            timestamp: new Date(Date.now() - 86400000 * 2).toISOString() // 2 days ago
        },
        {
            name: 'Gaming Console',
            status: 'inactive',
            type: 'premium',
            price: 499.99,
            category: 'electronics',
            features: ['wifi', 'bluetooth', '4K gaming'],
            tags: ['tech', 'gaming', 'premium'],
            age: 180,
            timestamp: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
        },
        {
            name: 'Smart Watch',
            status: 'active',
            type: 'premium',
            price: 399.99,
            category: 'electronics',
            features: ['wifi', 'bluetooth', 'health tracking'],
            tags: ['tech', 'wearable', 'health'],
            age: 45,
            timestamp: new Date(Date.now() - 86400000 * 4).toISOString() // 4 days ago
        }
    ];

    const createSampleData = async () => {
        try {
            // Clear existing data first
            const existingDocs = responses
                .filter(r => r.operation === 'QUERY' && r.status === 'success' && Array.isArray(r.data?.data))
                .flatMap(r => r.data.data)
                .filter(doc => doc?.id);

            // Delete all existing documents
            for (const doc of existingDocs) {
                await onTestEndpoint('DELETE', `/test-collection/${doc.id}`, 'DELETE');
            }

            // Create new sample data
            for (const item of sampleData) {
                await onTestEndpoint('CREATE', '/test-collection', 'POST', item);
            }
            
            // After creating sample data, show all documents
            onTestEndpoint('QUERY', '/test-collection', 'GET');
        } catch (error) {
            console.error('Error creating sample data:', error);
        }
    };

    const predefinedQueries = [
        {
            name: 'Basic Equality',
            query: `filter=${encodeURIComponent(JSON.stringify([
                { field: 'status', operator: '==', value: 'active' }
            ]))}`,
            description: 'Find all active documents',
            color: '#2196F3'
        },
        {
            name: 'Numeric Comparison',
            query: `filter=${encodeURIComponent(JSON.stringify([
                { field: 'age', operator: '>', value: 21 },
                { field: 'age', operator: '<', value: 65 }
            ]))}`,
            description: 'Find documents with age between 21 and 65',
            color: '#4CAF50'
        },
        {
            name: 'Array Contains',
            query: `filter=${encodeURIComponent(JSON.stringify([
                { field: 'tags', operator: 'array-contains', value: 'news' }
            ]))}`,
            description: 'Find documents with "news" tag',
            color: '#FF9800'
        },
        {
            name: 'Multiple Conditions',
            query: `filter=${encodeURIComponent(JSON.stringify([
                { field: 'status', operator: '==', value: 'active' },
                { field: 'type', operator: 'in', value: ['premium', 'basic'] }
            ]))}`,
            description: 'Find active documents with specific types',
            color: '#9C27B0'
        },
        {
            name: 'Sorting and Pagination',
            query: 'orderBy=timestamp:desc&limit=5',
            description: 'Get 5 most recent documents',
            color: '#00BCD4'
        },
        {
            name: 'Complex Query',
            query: `filter=${encodeURIComponent(JSON.stringify([
                { field: 'price', operator: '>=', value: 100 },
                { field: 'category', operator: 'in', value: ['electronics', 'books'] },
                { field: 'features', operator: 'array-contains', value: 'wifi' }
            ]))}&orderBy=price:desc`,
            description: 'Find expensive items with specific features',
            color: '#E91E63'
        }
    ];

    return (
        <div style={{ 
            display: 'grid',
            gridTemplateColumns: '300px 1fr',
            gap: '20px',
            marginTop: '20px'
        }}>
            {/* Left sidebar with query builder */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '20px',
                background: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Query Operations</h2>
                
                {/* Create Sample Data Button */}
                <button
                    onClick={createSampleData}
                    disabled={loading}
                    style={{
                        padding: '12px 20px',
                        backgroundColor: '#673AB7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        marginBottom: '20px',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? 'Creating...' : 'Create Data to Query'}
                </button>
                
                {/* Custom Query Builder Form */}
                <form onSubmit={handleCustomQuerySubmit} style={{
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: '#fff',
                    borderRadius: '4px'
                }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>Custom Query Builder</h3>
                    
                    {/* Filter Conditions */}
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Filter Conditions</label>
                            <button
                                type="button"
                                onClick={addFilterCondition}
                                style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Add Condition
                            </button>
                        </div>
                        
                        {filterConditions.map((condition, index) => (
                            <div key={index} style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr auto',
                                gap: '8px',
                                marginBottom: '8px'
                            }}>
                                <input
                                    type="text"
                                    value={condition.field}
                                    onChange={(e) => updateFilterCondition(index, { field: e.target.value })}
                                    placeholder="Field"
                                    style={{
                                        padding: '6px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}
                                />
                                <select
                                    value={condition.operator}
                                    onChange={(e) => updateFilterCondition(index, { operator: e.target.value })}
                                    style={{
                                        padding: '6px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}
                                >
                                    {validOperators.map(op => (
                                        <option key={op} value={op}>{op}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={String(condition.value)}
                                    onChange={(e) => updateFilterCondition(index, { value: e.target.value })}
                                    placeholder="Value"
                                    style={{
                                        padding: '6px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeFilterCondition(index)}
                                    style={{
                                        padding: '6px',
                                        backgroundColor: '#f44336',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* OrderBy */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                            Order By
                        </label>
                        <input
                            type="text"
                            value={orderBy}
                            onChange={(e) => setOrderBy(e.target.value)}
                            placeholder="field:asc or field:desc"
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    {/* Limit */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                            Limit
                        </label>
                        <input
                            type="number"
                            value={limit}
                            onChange={(e) => setLimit(e.target.value)}
                            placeholder="Maximum results"
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    {/* Query Preview */}
                    <div style={{
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                    }}>
                        {buildQueryString()}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Loading...' : 'Execute Query'}
                    </button>
                </form>

                {/* Predefined Queries */}
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>Example Queries</h3>
                {predefinedQueries.map((q, index) => (
                    <div key={index} style={{
                        padding: '15px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        marginBottom: '10px'
                    }}>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 'bold',
                            marginBottom: '5px',
                            color: '#333'
                        }}>
                            {q.name}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#666',
                            marginBottom: '10px'
                        }}>
                            {q.description}
                        </div>
                        <button
                            onClick={() => onTestEndpoint('QUERY', `/test-collection?${q.query}`, 'GET')}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '8px',
                                backgroundColor: q.color,
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                fontSize: '14px'
                            }}
                        >
                            {loading ? 'Loading...' : 'Run Query'}
                        </button>
                        <div style={{
                            fontSize: '12px',
                            color: '#666',
                            marginTop: '5px',
                            wordBreak: 'break-all',
                            fontFamily: 'monospace'
                        }}>
                            {q.query}
                        </div>
                    </div>
                ))}
            </div>

            {/* Right side response display */}
            <div style={{
                padding: '20px',
                background: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Query Results</h2>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: 'calc(100vh - 100px)',
                    overflowY: 'auto'
                }}>
                    {responses
                        .filter(r => r.operation === 'QUERY')
                        .map((response, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: '15px',
                                    backgroundColor: response.status === 'success' ? '#E8F5E9' : '#FFEBEE',
                                    borderRadius: '4px',
                                    border: `1px solid ${response.status === 'success' ? '#A5D6A7' : '#FFCDD2'}`,
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '10px',
                                    fontSize: '12px',
                                    color: '#666'
                                }}>
                                    <span>Status: {response.status.toUpperCase()}</span>
                                    <span>{new Date(response.timestamp).toLocaleString()}</span>
                                </div>
                                <pre style={{
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '14px'
                                }}>
                                    {JSON.stringify(response.data || response.message, null, 2)}
                                </pre>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
} 