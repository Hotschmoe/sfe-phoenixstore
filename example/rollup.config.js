import svelte from 'rollup-plugin-svelte';
import typescript from '@rollup/plugin-typescript';
import sveltePreprocess from 'svelte-preprocess';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only';
import replace from '@rollup/plugin-replace';

// Load environment variables
const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3001';

export default {
  input: 'src/main.ts',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
    name: 'app'
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        'process.env.API_URL': JSON.stringify(API_URL),
        'process.env.WEBSOCKET_URL': JSON.stringify(WEBSOCKET_URL)
      }
    }),
    svelte({
      preprocess: sveltePreprocess(),
      compilerOptions: {
        dev: false
      },
      emitCss: true
    }),
    css({ output: 'bundle.css' }),
    resolve({
      browser: true,
      exportConditions: ['svelte'],
      extensions: ['.svelte']
    }),
    commonjs(),
    typescript()
  ]
}; 