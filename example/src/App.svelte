<script lang="ts">
  import { onMount } from 'svelte';

  // State
  let email = '';
  let password = '';
  let isLoggedIn = false;
  let accessToken = '';
  let uploadFile: File | null = null;
  let messages: any[] = [];
  let wsConnection: WebSocket | null = null;

  // API URLs from environment
  const API_URL = process.env.API_URL;
  const WS_URL = process.env.WEBSOCKET_URL;

  // WebSocket setup
  function setupWebSocket() {
    if (!WS_URL) {
      console.error('WebSocket URL not configured');
      return;
    }

    wsConnection = new WebSocket(WS_URL);
    
    wsConnection.onopen = () => {
      console.log('WebSocket connected');
      // Authenticate WebSocket
      wsConnection?.send(JSON.stringify({
        type: 'auth',
        requestId: 'auth-1',
        token: accessToken
      }));
    };

    wsConnection.onmessage = (event) => {
      const message = JSON.parse(event.data);
      messages = [...messages, message];
    };

    wsConnection.onclose = () => {
      console.log('WebSocket disconnected');
    };
  }

  // Authentication
  async function register() {
    if (!API_URL) {
      console.error('API URL not configured');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert('Registration successful! Please login.');
      }
    } catch (error) {
      console.error('Registration error:', error);
    }
  }

  async function login() {
    if (!API_URL) {
      console.error('API URL not configured');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.status === 'success') {
        accessToken = data.data.accessToken;
        isLoggedIn = true;
        setupWebSocket();
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  }

  // File handling
  async function handleFileUpload() {
    if (!uploadFile || !API_URL) {
      console.error('No file selected or API URL not configured');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch(`${API_URL}/storage/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert('File uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  }

  // Cleanup on component unmount
  onMount(() => {
    console.log('Component mounted');
    return () => {
      if (wsConnection) {
        console.log('Cleaning up WebSocket connection');
        wsConnection.close();
      }
    };
  });
</script>

<main>
  <h1>PhoenixStore Demo</h1>

  {#if !isLoggedIn}
    <section class="auth">
      <h2>Authentication</h2>
      <div class="form">
        <input type="email" bind:value={email} placeholder="Email" />
        <input type="password" bind:value={password} placeholder="Password" />
        <button on:click={register}>Register</button>
        <button on:click={login}>Login</button>
      </div>
    </section>
  {:else}
    <section class="storage">
      <h2>File Storage</h2>
      <div class="form">
        <input type="file" on:change={(e) => uploadFile = e.target.files?.[0] || null} />
        <button on:click={handleFileUpload}>Upload File</button>
      </div>
    </section>

    <section class="realtime">
      <h2>Real-time Messages</h2>
      <div class="messages">
        {#each messages as message}
          <div class="message">
            <pre>{JSON.stringify(message, null, 2)}</pre>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  h1 {
    color: #333;
    text-align: center;
  }

  section {
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  input {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  button {
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: #0056b3;
  }

  .messages {
    max-height: 300px;
    overflow-y: auto;
  }

  .message {
    padding: 10px;
    margin: 5px 0;
    background: #f8f9fa;
    border-radius: 4px;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
  }
</style> 