// nuxt.config.ts
const isProd = process.env.NODE_ENV === 'production'

export default defineNuxtConfig({
  ssr: true,
  pages: false,

  compatibilityDate: '2025-12-13',

  // Only force node-server + host/port in production.
  // In dev, let Nuxt/Nitro use defaults.
  nitro: isProd
    ? {
        preset: 'node-server',
        server: {
          host: process.env.NITRO_HOST || process.env.HOST || '127.0.0.1',
          port: Number(process.env.NITRO_PORT || process.env.PORT || 16767),
        },
      }
    : {},

  // Allow BOTH env styles so local doesn't break:
  // - DB_HOST/DB_USER...
  // - NUXT_DB_HOST/NUXT_DB_USER...
  runtimeConfig: {
    dbHost: process.env.NUXT_DB_HOST || process.env.DB_HOST || '',
    dbPort: Number(process.env.NUXT_DB_PORT || process.env.DB_PORT || 3306),
    dbName: process.env.NUXT_DB_NAME || process.env.DB_NAME || '',
    dbUser: process.env.NUXT_DB_USER || process.env.DB_USER || '',
    dbPassword: process.env.NUXT_DB_PASSWORD || process.env.DB_PASSWORD || '',
    public: {
      siteUrl:
        process.env.NUXT_PUBLIC_SITE_URL ||
        process.env.NUXT_PUBLIC_SITE_URL ||
        'http://localhost:3000',
    },
  },
})
