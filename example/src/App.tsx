import React, { useState, useEffect } from 'react';
import { config } from './config';

// TODO: Replace hardcoded URLs with environment variables once deployment configuration is fixed
const API_BASE_URL = 'http://localhost:3000/api/v1';
const WS_URL = 'ws://localhost:3001';

// Helper function to generate request IDs
const generateRequestId = () => Math.random().toString(36).substring(2, 15);

type ResponseData = {
    status: 'success' | 'error';
    data?: any;
    message?: string;
    timestamp: string;
};

type WebSocketMessage = {
    type: string;
    requestId: string;
    data?: any;
    message?: string;
    timestamp: string;
};

type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
};

export function App() {
    const [responses, setResponses] = useState<ResponseData[]>([]);
    const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentDocId, setCurrentDocId] = useState<string | null>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [ws]);

    const addResponse = (response: ResponseData) => {
        setResponses(prev => [response, ...prev].slice(0, 10));
        
        // If this was a successful create operation, store the document ID
        if (response.status === 'success' && response.data?.id) {
            setCurrentDocId(response.data.id);
        }
    };

    const addWsMessage = (message: WebSocketMessage) => {
        setWsMessages(prev => [message, ...prev].slice(0, 50));
    };

    const signIn = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'Test123!@#'
                }),
            });
            const json = await response.json();
            if (json.status === 'success' && json.data) {
                setAuthTokens(json.data);
                addResponse({
                    status: 'success',
                    data: { message: 'Successfully signed in' },
                    timestamp: new Date().toISOString(),
                });
                return json.data.accessToken;
            } else {
                throw new Error(json.message || 'Failed to sign in');
            }
        } catch (err) {
            addResponse({
                status: 'error',
                message: err instanceof Error ? err.message : 'Failed to sign in',
                timestamp: new Date().toISOString(),
            });
            return null;
        } finally {
            setLoading(false);
        }
    };

    const connectWebSocket = async () => {
        if (ws) {
            ws.close();
        }

        // Get auth token
        const token = authTokens?.accessToken || await signIn();
        if (!token) {
            addWsMessage({
                type: 'error',
                requestId: generateRequestId(),
                message: 'Failed to get authentication token',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const newWs = new WebSocket(WS_URL);

        newWs.onopen = () => {
            setWsConnected(true);
            addWsMessage({
                type: 'connection',
                requestId: generateRequestId(),
                message: 'Connected to WebSocket server',
                timestamp: new Date().toISOString()
            });

            // Authenticate with the WebSocket server
            newWs.send(JSON.stringify({
                type: 'auth',
                requestId: generateRequestId(),
                token
            }));
        };

        newWs.onclose = () => {
            setWsConnected(false);
            addWsMessage({
                type: 'connection',
                requestId: generateRequestId(),
                message: 'Disconnected from WebSocket server',
                timestamp: new Date().toISOString()
            });
        };

        newWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            addWsMessage({
                type: data.type || 'message',
                requestId: data.requestId || generateRequestId(),
                data,
                timestamp: new Date().toISOString()
            });

            // If we receive successful auth response, start watching collection
            if (data.type === 'auth' && data.status === 'success') {
                newWs.send(JSON.stringify({
                    type: 'watch_collection',
                    requestId: generateRequestId(),
                    collection: 'test-collection',
                    query: {
                        orderBy: [
                            { field: 'timestamp', direction: 'desc' }
                        ]
                    }
                }));
            }
        };

        newWs.onerror = (error) => {
            addWsMessage({
                type: 'error',
                requestId: generateRequestId(),
                message: 'WebSocket error occurred',
                timestamp: new Date().toISOString()
            });
        };

        setWs(newWs);
    };

    const disconnectWebSocket = () => {
        if (ws) {
            // Send unwatch message for any active subscriptions
            ws.send(JSON.stringify({
                type: 'unwatch',
                requestId: generateRequestId(),
                subscriptionId: 'watch-1' // Use the subscription ID we received
            }));
            
            ws.close();
            setWs(null);
        }
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
            
            // Handle auth tokens from login response
            if (endpoint === '/auth/login' && json.status === 'success' && json.data) {
                setAuthTokens(json.data);
            }
            
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

    const testFileUpload = async () => {
        const file = new Blob(['Hello, MinIO from React!'], { type: 'text/plain' });
        const response = await fetch('http://localhost:3000/api/v1/storage/upload/test-from-react.txt', {
            method: 'POST',
            body: file,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        const result = await response.json();
        console.log('File upload result:', result);
    };

    const testOperations = [
        {
            name: 'Register User',
            action: () => testEndpoint(
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
            action: () => testEndpoint(
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
            action: () => {
                if (!currentDocId) {
                    addResponse({
                        status: 'error',
                        message: 'Please create a document first',
                        timestamp: new Date().toISOString(),
                    });
                    return;
                }
                testEndpoint(
                    'UPDATE',
                    `/test-collection/${currentDocId}`,
                    'PUT',
                    { updated: true, timestamp: new Date().toISOString() }
                );
            },
            color: '#FF9800'
        },
        {
            name: 'Delete Document',
            action: () => {
                if (!currentDocId) {
                    addResponse({
                        status: 'error',
                        message: 'Please create a document first',
                        timestamp: new Date().toISOString(),
                    });
                    return;
                }
                testEndpoint(
                    'DELETE',
                    `/test-collection/${currentDocId}`,
                    'DELETE'
                );
            },
            color: '#E91E63'
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            {/* API Section */}
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
                    <button onClick={() => testFileUpload()}>
                        Test File Upload
                    </button>
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

            {/* WebSocket Section */}
            <div style={{ 
                display: 'grid',
                gridTemplateColumns: '250px 1fr',
                gap: '20px',
            }}>
                {/* Left sidebar with WebSocket operations */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '20px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>WebSocket Operations</h2>
                    <div style={{
                        padding: '10px',
                        marginBottom: '10px',
                        backgroundColor: wsConnected ? '#E8F5E9' : '#FFEBEE',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}>
                        Status: {wsConnected ? 'Connected' : 'Disconnected'}
                    </div>
                    <button
                        onClick={connectWebSocket}
                        disabled={wsConnected}
                        style={{
                            padding: '12px 20px',
                            fontSize: '14px',
                            cursor: wsConnected ? 'not-allowed' : 'pointer',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            opacity: wsConnected ? 0.7 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        Connect
                    </button>
                    <button
                        onClick={disconnectWebSocket}
                        disabled={!wsConnected}
                        style={{
                            padding: '12px 20px',
                            fontSize: '14px',
                            cursor: !wsConnected ? 'not-allowed' : 'pointer',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            opacity: !wsConnected ? 0.7 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        Disconnect
                    </button>
                </div>

                {/* Right side WebSocket messages */}
                <div style={{
                    padding: '20px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>WebSocket Messages</h2>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        maxHeight: 'calc(50vh - 100px)',
                        overflowY: 'auto'
                    }}>
                        {wsMessages.map((message, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: '15px',
                                    backgroundColor: message.type === 'error' ? '#FFEBEE' : 
                                                   message.type === 'connection' ? '#E8F5E9' : '#E3F2FD',
                                    borderRadius: '4px',
                                    border: `1px solid ${
                                        message.type === 'error' ? '#FFCDD2' : 
                                        message.type === 'connection' ? '#A5D6A7' : '#90CAF9'
                                    }`,
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '10px',
                                    fontSize: '12px',
                                    color: '#666'
                                }}>
                                    <span>Type: {message.type.toUpperCase()}</span>
                                    <span>{new Date(message.timestamp).toLocaleString()}</span>
                                </div>
                                <pre style={{
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '14px'
                                }}>
                                    {JSON.stringify(message.data || message.message, null, 2)}
                                </pre>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
} 