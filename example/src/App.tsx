import React, { useState, useEffect } from 'react';
import { ApiOperations } from './components/ApiOperations';
import { WebSocketOperations } from './components/WebSocketOperations';
import { StorageOperations } from './components/StorageOperations';
import { QueryOperations } from './components/QueryOperations';
import { ResponseData, WebSocketMessage, AuthTokens } from './types';
import { config } from './config'; // Ensure path matches your project structure

// Use configuration for API, WebSocket, and Storage URLs
const API_BASE_URL = `${config.PHOENIXSTORE_PUBLIC_URL}/api/v1`;
const WS_URL = config.WEBSOCKET_PUBLIC_URL;
const STORAGE_URL = config.STORAGE_PUBLIC_URL;

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

  // Debug: Log config at app initialization
  useEffect(() => {
    // console.log('App initialized with config:', {
    //   API_BASE_URL,
    //   WS_URL,
    //   STORAGE_URL,
    // });
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  const addResponse = (response: ResponseData) => {
    setResponses((prev) => [response, ...prev].slice(0, 10));
    if (response.status === 'success') {
      const docId = response.data?.id || response.data?.data?.id;
      if (docId) {
        setCurrentDocId(docId);
      } else if (response.operation === 'DELETE' && response.data?.id === currentDocId) {
        setCurrentDocId(null);
      }
    }
  };

  const addWsMessage = (message: WebSocketMessage) => {
    setWsMessages((prev) => [message, ...prev].slice(0, 50));
  };

  const signIn = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Test123!@#',
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

    const token = authTokens?.accessToken || (await signIn());
    if (!token) {
      addWsMessage({
        type: 'error',
        requestId: generateRequestId(),
        message: 'Failed to get authentication token',
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
      });
      newWs.send(
        JSON.stringify({
          type: 'auth',
          requestId: generateRequestId(),
          token,
        })
      );
    };

    newWs.onclose = () => {
      setWsConnected(false);
      addWsMessage({
        type: 'connection',
        requestId: generateRequestId(),
        message: 'Disconnected from WebSocket server',
        timestamp: new Date().toISOString(),
      });
    };

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      addWsMessage({
        type: data.type || 'message',
        requestId: data.requestId || generateRequestId(),
        data,
        timestamp: new Date().toISOString(),
      });
      if (data.type === 'auth' && data.status === 'success') {
        newWs.send(
          JSON.stringify({
            type: 'watch_collection',
            requestId: generateRequestId(),
            collection: 'test-collection',
            query: {
              orderBy: [{ field: 'timestamp', direction: 'desc' }],
            },
          })
        );
      }
    };

    newWs.onerror = () => {
      addWsMessage({
        type: 'error',
        requestId: generateRequestId(),
        message: 'WebSocket error occurred',
        timestamp: new Date().toISOString(),
      });
    };

    setWs(newWs);
  };

  const disconnectWebSocket = () => {
    if (ws) {
      ws.send(
        JSON.stringify({
          type: 'unwatch',
          requestId: generateRequestId(),
          subscriptionId: 'watch-1',
        })
      );
      ws.close();
      setWs(null);
    }
  };

  const testEndpoint = async (operation: string, endpoint: string, method: string, body?: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body && { body: JSON.stringify(body) }),
      });
      const json = await response.json();
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
        timestamp: new Date().toISOString(),
      });

      const uploadEndpoint = `${API_BASE_URL}/storage/upload/${filename}`;
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': 'text/plain' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'success') {
        setCurrentFile(filename);
        addResponse({
          status: 'success',
          data: {
            message: 'File uploaded successfully',
            filename,
            storageUrl: `${STORAGE_URL}/${filename}`,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      addResponse({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload file',
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setLoading(true);
    try {
      addResponse({
        status: 'success',
        message: 'Fetching download URL...',
        timestamp: new Date().toISOString(),
      });

      const downloadEndpoint = `${API_BASE_URL}/storage/download/${encodeURIComponent(currentFile)}`;
      const response = await fetch(downloadEndpoint);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (result.status === 'success' && result.data?.url) {
        const downloadUrl = result.data.url;
        window.open(downloadUrl, '_blank');

        addResponse({
          status: 'success',
          data: {
            message: 'Download URL opened in new tab',
            filename: currentFile,
            url: downloadUrl,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        throw new Error(`Failed to get download URL: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      addResponse({
        status: 'error',
        data: {
          message: error instanceof Error ? error.message : 'Failed to download file',
          error: error instanceof Error ? error.toString() : error,
          file: currentFile,
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <h1>API Tester</h1>
      <p>Environment: {config.ENVIRONMENT}</p>
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