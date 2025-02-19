import svelte from 'rollup-plugin-svelte';
import typescript from '@rollup/plugin-typescript';
import sveltePreprocess from 'svelte-preprocess';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import css from 'rollup-plugin-css-only';

export default {
  input: 'src/main.ts',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
    name: 'app'
  },
  plugins: [
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