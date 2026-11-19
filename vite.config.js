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
      workbox: { globPatterns: ['**/*.{js,css,html,svg}', '**/*{-latin-,-vietnamese-}*.woff2'] },
      manifest: {
        name: 'Calo Gym',
        short_name: 'CaloGym',
        lang: 'vi',
        display: 'standalone',
        theme_color: '#ddd6c6',
        background_color: '#ddd6c6',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
})
