import { serve } from 'bun';
import { join, normalize } from 'path';

const port = Number(process.env.PORT) || 80;
const DIST_DIR = 'dist';

console.log(`Starting server on port ${port}...`);

serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);
        // Normalize and sanitize the path
        const path = normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');

        // Serve index.html for root path
        if (path === '/' || path === '') {
            return new Response(Bun.file(join(DIST_DIR, 'index.html')));
        }

        // Try to serve the file from dist
        try {
            const filePath = join(DIST_DIR, path);
            const file = Bun.file(filePath);

            // Check if file exists
            const exists = await file.exists();
            if (!exists) {
                // Return index.html for SPA routing
                return new Response(Bun.file(join(DIST_DIR, 'index.html')));
            }

            // Set appropriate content type
            const headers = new Headers();
            if (path.endsWith('.js')) headers.set('Content-Type', 'application/javascript');
            else if (path.endsWith('.css')) headers.set('Content-Type', 'text/css');
            else if (path.endsWith('.html')) headers.set('Content-Type', 'text/html');

            return new Response(file, { headers });
        } catch (error) {
            console.error('File serving error:', error);
            return new Response(Bun.file(join(DIST_DIR, 'index.html')));
        }
    },
}); 