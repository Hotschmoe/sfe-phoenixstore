import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { config } from './config'; // Adjust path if needed

// Log config to verify it’s loaded in the browser
console.log('Config loaded in main.tsx:', config);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);