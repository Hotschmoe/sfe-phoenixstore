import React from 'react';
import { ResponseData } from '../types';

interface ApiOperationsProps {
    loading: boolean;
    currentDocId: string | null;
    responses: ResponseData[];
    onTestEndpoint: (operation: string, endpoint: string, method: string, body?: any) => Promise<void>;
}

export function ApiOperations({ loading, currentDocId, responses, onTestEndpoint }: ApiOperationsProps) {
    const testOperations = [
        {
            name: 'Register User',
            action: () => onTestEndpoint(
                'REGISTER',
                '/auth/register',
                'POST',
                {
                    email: 'test@example.com',
                    password: 'Test123!@#',
                    displayName: 'Test User'
                }
            ),
            color: '#673AB7'
        },
        {
            name: 'Login User',
            action: () => onTestEndpoint(
                'LOGIN',
                '/auth/login',
                'POST',
                {
                    email: 'test@example.com',
                    password: 'Test123!@#'
                }
            ),
            color: '#2196F3'
        },
        {
            name: 'Create Document',
            action: () => onTestEndpoint(
                'CREATE',
                '/test-collection',
                'POST',
                { name: 'Test Document', timestamp: new Date().toISOString() }
            ),
            color: '#4CAF50'
        },
        {
            name: 'Read Documents',
            action: () => onTestEndpoint(
                'READ',
                '/test-collection',
                'GET'
            ),
            color: '#2196F3'
        },
        {
            name: 'Update Document',
            action: () => onTestEndpoint(
                'UPDATE',
                `/test-collection/${currentDocId}`,
                'PUT',
                { updated: true, timestamp: new Date().toISOString() }
            ),
            color: '#FF9800'
        },
        {
            name: 'Delete Document',
            action: () => onTestEndpoint(
                'DELETE',
                `/test-collection/${currentDocId}`,
                'DELETE'
            ),
            color: '#E91E63'
        }
    ];

    return (
        <div style={{ 
            display: 'grid',
            gridTemplateColumns: '250px 1fr',
            gap: '20px',
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
                {currentDocId && (
                    <div style={{
                        padding: '10px',
                        marginBottom: '10px',
                        backgroundColor: '#E3F2FD',
                        borderRadius: '4px',
                        fontSize: '14px',
                        wordBreak: 'break-all'
                    }}>
                        Current Document ID: {currentDocId}
                    </div>
                )}
                {testOperations.map((op, index) => (
                    <button
                        key={index}
                        onClick={op.action}
                        disabled={loading || (op.name.includes('Update') || op.name.includes('Delete')) && !currentDocId}
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
                    {responses
                        .filter(r => {
                            // Exclude storage-related messages from API section
                            const isStorageMessage = 
                                r.data?.url || 
                                r.data?.path || 
                                r.message?.includes('file upload') ||
                                r.message?.includes('upload failed') ||
                                r.message?.toLowerCase().includes('storage');
                            return !isStorageMessage;
                        })
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