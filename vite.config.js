import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  logLevel: 'error',
  server: {
    host: true,
    // Fixado em 5174 (em vez do padrão 5173) porque a porta 5173 já é usada
    // por outro projeto local (endividamento-web). Antes isso era sobrescrito
    // via "--port 5174" na linha de comando, mas esse argumento não chega até
    // o Vite quando o processo é iniciado pelo PM2 no Windows — por isso agora
    // fica fixo aqui, sem depender de flag de linha de comando.
    port: 5174,
    strictPort: true,
  },
  plugins: [
    // Sem VITE_BASE44_APP_BASE_URL o plugin não cria proxy remoto.
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: false,
      navigationNotifier: false,
      analyticsTracker: false,
      visualEditAgent: false
    }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['@tanstack/react-query'],
          'chart-vendor': ['recharts'],
          'date-vendor': ['date-fns'],
          'icons-vendor': ['lucide-react'],
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      '@tanstack/react-query', 'lucide-react', 'date-fns',
      'clsx', 'lodash', 'recharts',
    ],
  },
});