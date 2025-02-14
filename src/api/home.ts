import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

// Get NODE_ENV from Dockerfile environment
const nodeEnv = process.env.NODE_ENV || 'development';

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
      .ascii-art {
        font-family: monospace;
        white-space: pre;
        margin: 1rem 0;
        color: #2563eb;
      }
      .version {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
        font-family: monospace;
      }
      .env-tag {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        margin-left: 0.5rem;
        font-size: 0.875rem;
        font-weight: bold;
      }
      .env-development {
        background: #dcfce7;
        color: #166534;
      }
      .env-production {
        background: #fee2e2;
        color: #991b1b;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="ascii-art">
    ____  __                      _      _____ __                 
   / __ \\/ /_  ____  ___  ____  (_)_  _/ ___// /_____  ________ 
  / /_/ / __ \\/ __ \\/ _ \\/ __ \\/ /| |/_\\__ \\/ __/ __ \\/ ___/ _ \\
 / ____/ / / / /_/ /  __/ / / / />  < ___/ / /_/ /_/ / /  /  __/
/_/   /_/ /_/\\____/\\___/_/ /_/_/_/|_/____/\\__/\\____/_/   \\___/ 
      </div>
      <p>A MongoDB-based Firestore alternative with familiar syntax for Flutter/Web projects</p>
      
      <h2>[API] Endpoints</h2>
      <div class="endpoints">
        <div class="endpoint">POST /api/v1/:collection - Create document</div>
        <div class="endpoint">GET /api/v1/:collection/:id - Read document</div>
        <div class="endpoint">PUT /api/v1/:collection/:id - Update document</div>
        <div class="endpoint">DELETE /api/v1/:collection/:id - Delete document</div>
      </div>

      <div class="links">
        <h2>[->] Useful Links</h2>
        <p><a href="/swagger">API Documentation (Swagger)</a></p>
        <p><a href="https://github.com/Hotschmoe/sfe-phoenixstore">GitHub Repository</a></p>
      </div>

      <div class="version">
        <p>Version: ${version}<span class="env-tag env-${nodeEnv}">${nodeEnv.toUpperCase()}</span></p>
      </div>
    </div>
  </body>
</html>`; 