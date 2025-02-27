import React from 'react';
import { WebSocketMessage } from '../types';

interface WebSocketOperationsProps {
    wsConnected: boolean;
    wsMessages: WebSocketMessage[];
    onConnect: () => void;
    onDisconnect: () => void;
}

export function WebSocketOperations({ wsConnected, wsMessages, onConnect, onDisconnect }: WebSocketOperationsProps) {
    return (
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
                    onClick={onConnect}
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
                    onClick={onDisconnect}
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
    );
} 