import React from 'react';
import { ResponseData } from '../types';

interface StorageOperationsProps {
    loading: boolean;
    currentFile: string | null;
    responses: ResponseData[];
    onUpload: () => Promise<void>;
    onDownload: () => Promise<void>;
}

export function StorageOperations({ loading, currentFile, responses, onUpload, onDownload }: StorageOperationsProps) {
    return (
        <div style={{ 
            display: 'grid',
            gridTemplateColumns: '250px 1fr',
            gap: '20px',
        }}>
            {/* Left sidebar with Storage operations */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '20px',
                background: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Storage Operations</h2>
                {currentFile && (
                    <div style={{
                        padding: '10px',
                        marginBottom: '10px',
                        backgroundColor: '#E3F2FD',
                        borderRadius: '4px',
                        fontSize: '14px',
                        wordBreak: 'break-all'
                    }}>
                        Current File: {currentFile}
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        onClick={onUpload}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            fontSize: '14px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            opacity: loading ? 0.7 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {loading ? 'Uploading...' : 'Upload Test File'}
                    </button>
                    <button
                        onClick={onDownload}
                        disabled={loading || !currentFile}
                        style={{
                            padding: '12px 20px',
                            fontSize: '14px',
                            cursor: (!loading && currentFile) ? 'pointer' : 'not-allowed',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            opacity: (!loading && currentFile) ? 1 : 0.7,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {loading ? 'Downloading...' : 'Download File'}
                    </button>
                </div>
            </div>

            {/* Right side storage response display */}
            <div style={{
                padding: '20px',
                background: '#f5f5f5',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Storage Log</h2>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: 'calc(50vh - 100px)',
                    overflowY: 'auto'
                }}>
                    {responses
                        .filter(r => {
                            // Include all storage-related messages in Storage section
                            const isStorageMessage = 
                                r.data?.url || 
                                r.data?.path || 
                                r.message?.toLowerCase().includes('file upload') ||
                                r.message?.toLowerCase().includes('upload failed') ||
                                r.message?.toLowerCase().includes('storage') ||
                                r.data?.filename ||
                                r.data?.message?.toLowerCase().includes('file') ||
                                r.data?.message?.toLowerCase().includes('upload');
                            return isStorageMessage;
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