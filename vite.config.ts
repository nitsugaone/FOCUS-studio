import {defineConfig} from 'vite';
import {focusOfflinePlugin} from './scripts/build-offline-worker.mjs';

export default defineConfig({
  plugins: [focusOfflinePlugin()],
  server: {
    // Preserve the existing explicit HMR override for development environments.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
