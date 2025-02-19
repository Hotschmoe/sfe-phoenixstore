declare module '*.svelte' {
    import type { ComponentType } from 'svelte';
    const component: ComponentType;
    export default component;
}

interface ImportMetaEnv {
    API_URL: string;
    WEBSOCKET_URL: string;
} 