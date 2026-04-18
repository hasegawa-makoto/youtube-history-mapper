import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import manifest from './manifest.json';
import path from 'path';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['path', 'zlib', 'stream', 'util', 'buffer', 'fs'],
    }),
    crx({ manifest }),
  ],
  define: {
    global: 'window',
    'process.env': {},
  },
  build: {
    rollupOptions: {
      input: {
        dashboard: path.resolve(__dirname, 'src/dashboard/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'mongodb': path.resolve(__dirname, './src/mock/empty.ts'),
      'mongoose': path.resolve(__dirname, './src/mock/empty.ts'),
      'redis': path.resolve(__dirname, './src/mock/empty.ts'),
      '@redis/client': path.resolve(__dirname, './src/mock/empty.ts'),
      'pg': path.resolve(__dirname, './src/mock/empty.ts'),
      'pg-hstore': path.resolve(__dirname, './src/mock/empty.ts'),
      'os': path.resolve(__dirname, './src/mock/empty.ts'),
      'crypto': path.resolve(__dirname, './src/mock/empty.ts'),
      'net': path.resolve(__dirname, './src/mock/empty.ts'),
      'tls': path.resolve(__dirname, './src/mock/empty.ts'),
      'dns': path.resolve(__dirname, './src/mock/empty.ts'),
      'child_process': path.resolve(__dirname, './src/mock/empty.ts'),
      'fs': path.resolve(__dirname, './src/mock/empty.ts'),
      'fs/promises': path.resolve(__dirname, './src/mock/empty.ts'),
    },
  },
});
