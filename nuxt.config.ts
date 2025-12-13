export default defineNuxtConfig({
  ssr: false,

  runtimeConfig: {
    dbHost: process.env.DB_HOST,
    dbPort: Number(process.env.DB_PORT || 3306),
    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000"
    }
  },

  // We will serve the designer HTML directly from Nitro routes.
  // Keep Nuxt pages disabled to avoid conflicts.
  pages: false
});
