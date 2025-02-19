import svelte from 'rollup-plugin-svelte';
import typescript from '@rollup/plugin-typescript';
import sveltePreprocess from 'svelte-preprocess';

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
      }
    }),
    typescript()
  ]
}; 