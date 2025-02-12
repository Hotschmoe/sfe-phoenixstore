export const homeHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>PhoenixStore API</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.5;
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        background: #f5f5f5;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      h1 { color: #2563eb; }
      .endpoints {
        background: #f8fafc;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
      }
      .endpoint {
        margin: 0.5rem 0;
        font-family: monospace;
      }
      .links {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🔥 PhoenixStore API</h1>
      <p>A MongoDB-based Firestore alternative with familiar syntax for Flutter/Web projects</p>
      
      <h2>📚 API Endpoints</h2>
      <div class="endpoints">
        <div class="endpoint">POST /api/v1/:collection - Create document</div>
        <div class="endpoint">GET /api/v1/:collection/:id - Read document</div>
        <div class="endpoint">PUT /api/v1/:collection/:id - Update document</div>
        <div class="endpoint">DELETE /api/v1/:collection/:id - Delete document</div>
      </div>

      <div class="links">
        <h2>🔗 Useful Links</h2>
        <p><a href="/swagger">API Documentation (Swagger)</a></p>
        <p><a href="https://github.com/yourusername/phoenixstore">GitHub Repository</a></p>
      </div>

      <div class="version">
        <p>Version: 0.1.0</p>
      </div>
    </div>
  </body>
</html>`; 