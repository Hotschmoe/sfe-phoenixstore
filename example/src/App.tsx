import React, { useState, useEffect } from 'react';
import { ApiOperations } from './components/ApiOperations';
import { WebSocketOperations } from './components/WebSocketOperations';
import { StorageOperations } from './components/StorageOperations';
import { QueryOperations } from './components/QueryOperations';
import { ResponseData, WebSocketMessage, AuthTokens } from './types';

// Use environment variables for API and WebSocket URLs
// const API_BASE_URL = `${process.env.PHOENIXSTORE_API_URL || 'http://localhost'}:${process.env.PHOENIXSTORE_PORT || '3000'}/api/v1`;
// const WS_URL = `ws://${(process.env.PHOENIXSTORE_API_URL || 'http://localhost').replace('http://', '')}:${process.env.WEBSOCKET_PORT || '3001'}`;
const API_BASE_URL = 'http://localhost:3000/api/v1';
const WS_URL = 'ws://localhost:3001';

// Helper function to generate request IDs
const generateRequestId = () => Math.random().toString(36).substring(2, 15);

export function App() {
    const [responses, setResponses] = useState<ResponseData[]>([]);
    const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentDocId, setCurrentDocId] = useState<string | null>(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);
    const [currentFile, setCurrentFile] = useState<string | null>(null);

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
        
        // Update currentDocId based on response type and content
        if (response.status === 'success') {
            // Handle nested data structure
            const docId = response.data?.id || response.data?.data?.id;
            if (docId) {
                // For create operations, set the new document ID
                setCurrentDocId(docId);
            } else if (response.operation === 'DELETE' && response.data?.id === currentDocId) {
                // Clear currentDocId if we just deleted it
                setCurrentDocId(null);
            }
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
        setLoading(true);
        const file = new Blob(['Hello, MinIO from React!'], { type: 'text/plain' });
        const filename = `test-from-react-${new Date().getTime()}.txt`;
        
        try {
            addResponse({
                status: 'success',
                message: 'Starting file upload...',
                timestamp: new Date().toISOString()
            });

            const response = await fetch(`${API_BASE_URL}/storage/upload/${filename}`, {
                method: 'POST',
                body: file,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.status === 'success') {
                setCurrentFile(filename);
                addResponse({
                    status: 'success',
                    data: { message: 'File uploaded successfully', filename },
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            addResponse({
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to upload file',
                timestamp: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    };

    const downloadFile = async () => {
        if (!currentFile) {
            addResponse({
                status: 'error',
                message: 'No file to download. Please upload a file first.',
                timestamp: new Date().toISOString()
            });
            return;
        }

        setLoading(true);
        try {
            addResponse({
                status: 'success',
                message: 'Fetching download URL...',
                timestamp: new Date().toISOString()
            });

            const response = await fetch(`${API_BASE_URL}/storage/download/${currentFile}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success' && result.data.url) {
                window.open(result.data.url, '_blank');
                addResponse({
                    status: 'success',
                    data: { message: 'Download started', filename: currentFile },
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error(result.message || 'Failed to get download URL');
            }
        } catch (error) {
            addResponse({
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to download file',
                timestamp: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            <ApiOperations
                loading={loading}
                currentDocId={currentDocId}
                responses={responses}
                onTestEndpoint={testEndpoint}
            />
            <QueryOperations
                loading={loading}
                responses={responses}
                onTestEndpoint={testEndpoint}
            />
            <WebSocketOperations
                wsConnected={wsConnected}
                wsMessages={wsMessages}
                onConnect={connectWebSocket}
                onDisconnect={disconnectWebSocket}
            />
            <StorageOperations
                loading={loading}
                currentFile={currentFile}
                responses={responses}
                onUpload={testFileUpload}
                onDownload={downloadFile}
            />
        </div>
    );
} 