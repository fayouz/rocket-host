export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/ui'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Valeurs lues dans .env (jamais envoyees au navigateur)
  runtimeConfig: {
    lodgifyApiKey: process.env.LODGIFY_API_KEY || '',
    nukiApiToken: process.env.NUKI_API_TOKEN || '',
    webhookToken: process.env.WEBHOOK_TOKEN || '',
    imapPassword: process.env.IMAP_PASSWORD || '', // mot de passe de la boite e-mail : jamais en base, jamais renvoye au navigateur
    demo: process.env.DEMO || '',
  },
  // Mini base SQLite (fichier .data/db.sqlite3, ignore par git)
  nitro: { experimental: { database: true } },
  // Anciennes pages Codes, Serrures et Timeline : sous chaque logement (et timeline commune dans Aujourd'hui) ; Stock : dans Reglages
  routeRules: { '/codes': { redirect: '/logements' }, '/locks': { redirect: '/logements' }, '/timeline': { redirect: '/' }, '/stock': { redirect: '/settings/stock' } },
  app: { head: { title: 'LoussaHousing', htmlAttrs: { lang: 'fr' } } },
})
