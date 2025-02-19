import React, { useState } from 'react';
import { config } from './config';

// TODO: Replace hardcoded URLs with environment variables once deployment configuration is fixed
const API_BASE_URL = 'http://localhost:3000/api/v1';

type ResponseData = {
    status: 'success' | 'error';
    data?: any;
    message?: string;
    timestamp: string;
};

export function App() {
    const [responses, setResponses] = useState<ResponseData[]>([]);
    const [loading, setLoading] = useState(false);

    const addResponse = (response: ResponseData) => {
        setResponses(prev => [response, ...prev].slice(0, 10));
    };

    const testEndpoint = async (operation: string, endpoint: string, method: string, body?: any) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                ...(body && { body: JSON.stringify(body) }),
            });
            const json = await response.json();
            addResponse({
                status: response.ok ? 'success' : 'error',
                data: json,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            addResponse({
                status: 'error',
                message: err instanceof Error ? err.message : 'An error occurred',
                timestamp: new Date().toISOString(),
            });
        } finally {
            setLoading(false);
        }
    };

    const testOperations = [
        {
            name: 'Create Document',
            action: () => testEndpoint(
                'CREATE',
                '/test-collection',
                'POST',
                { name: 'Test Document', timestamp: new Date().toISOString() }
            ),
            color: '#4CAF50'
        },
        {
            name: 'Read Documents',
            action: () => testEndpoint(
                'READ',
                '/test-collection',
                'GET'
            ),
            color: '#2196F3'
        },
        {
            name: 'Update Document',
            action: () => testEndpoint(
                'UPDATE',
                '/test-collection/latest',
                'PATCH',
                { updated: true, timestamp: new Date().toISOString() }
            ),
            color: '#FF9800'
        },
        {
            name: 'Delete Document',
            action: () => testEndpoint(
                'DELETE',
                '/test-collection/latest',
                'DELETE'
            ),
            color: '#E91E63'
        }
    ];

    return (
        <div style={{ 
            display: 'grid',
            gridTemplateColumns: '250px 1fr',
            minHeight: '100vh',
            gap: '20px',
            padding: '20px'
        }}>
            {/* Left sidebar with buttons */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '20px',
                background: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>API Operations</h2>
                {testOperations.map((op, index) => (
                    <button
                        key={index}
                        onClick={op.action}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            fontSize: '14px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            backgroundColor: op.color,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            opacity: loading ? 0.7 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {loading ? 'Loading...' : op.name}
                    </button>
                ))}
            </div>

            {/* Right side response display */}
            <div style={{
                padding: '20px',
                background: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Response Log</h2>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: 'calc(100vh - 100px)',
                    overflowY: 'auto'
                }}>
                    {responses.map((response, index) => (
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