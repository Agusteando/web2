// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,      // can be false too; doesn't matter for your server routes
  pages: false,

  nitro: {
    preset: "node-server",
    server: {
      host: process.env.NITRO_HOST || "127.0.0.1",
      port: Number(process.env.NITRO_PORT || process.env.PORT || 16767),
    },
  },

  runtimeConfig: {
    dbHost: "",
    dbPort: 3306,
    dbName: "",
    dbUser: "",
    dbPassword: "",
    public: {
      siteUrl: "",
    },
  },
});
