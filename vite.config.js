import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // chạy được cả ở GitHub Pages (đường dẫn con)
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // chỉ cache font bộ latin + tiếng Việt, bỏ cyrillic... cho nhẹ
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}', '**/*{-latin-,-vietnamese-}*.woff2'] },
      manifest: {
        name: 'Calo Gym',
        short_name: 'CaloGym',
        lang: 'vi',
        display: 'standalone',
        theme_color: '#ddd6c6',
        background_color: '#ddd6c6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
