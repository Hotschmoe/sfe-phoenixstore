import { serve } from 'bun';
import { join } from 'path';

const port = Number(process.env.PORT) || 80;
const isDev = process.env.NODE_ENV !== 'production';

console.log(`Starting server on port ${port} in ${isDev ? 'development' : 'production'} mode...`);

serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;

        // In development, serve from src directory
        if (isDev) {
            if (path === '/') {
                return new Response(Bun.file('index.html'));
            }

            // Handle TSX/TS files
            if (path.endsWith('.tsx') || path.endsWith('.ts')) {
                const filePath = path.slice(1); // Remove leading slash
                try {
                    const result = await Bun.build({
                        entrypoints: [filePath],
                        target: 'browser',
                        define: {
                            'process.env.API_URL': JSON.stringify(process.env.API_URL || 'http://localhost:3000'),
                            'process.env.WEBSOCKET_URL': JSON.stringify(process.env.WEBSOCKET_URL || 'ws://localhost:3001')
                        }
                    });
                    
                    if (!result.success) {
                        console.error('Build failed:', result.logs);
                        return new Response('Build failed', { status: 500 });
                    }

                    return new Response(result.outputs[0], {
                        headers: {
                            'Content-Type': 'application/javascript',
                        },
                    });
                } catch (error) {
                    console.error('Build error:', error);
                    return new Response('Build error', { status: 500 });
                }
            }

            // Try to serve static files
            try {
                return new Response(Bun.file(path.slice(1)));
            } catch {
                return new Response(Bun.file('index.html'));
            }
        }
        
        // In production, serve from dist directory
        if (path === '/') {
            return new Response(Bun.file('dist/index.html'));
        }

        try {
            return new Response(Bun.file(join('dist', path)));
        } catch {
            return new Response(Bun.file('dist/index.html'));
        }
    },
}); 