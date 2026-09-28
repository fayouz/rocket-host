export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/ui'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Secrets et reglages d'integration (Lodgify, Nuki, IMAP, Homey, Rocket PMS/Place/Clean/Stock/Cast, webhook, CONNECTOR_*) :
  // en base, chiffres (AES-256-GCM, cle ROCKET_SECRETS_KEY), saisis dans Reglages > Connexions. Voir docs/secrets.md.
  runtimeConfig: {
    demo: process.env.DEMO || '',
    // Adresses des interfaces web des briques (facultatif) : liens « géré dans Rocket PMS/Place » du menu Administration
    public: {
      pmsFrontUrl: process.env.PMS_FRONT_URL || '',
      placeFrontUrl: process.env.PLACE_FRONT_URL || '',
      // Adresse publique de Rocket Console (facultatif) : lien « Créer un compte · choisir une offre » de la page de connexion
      rocketConsolePublicUrl: process.env.ROCKET_CONSOLE_PUBLIC_URL || '',
    },
  },
  // Mini base SQLite (fichier .data/db.sqlite3, ignore par git)
  nitro: { experimental: { database: true } },
  // Anciennes pages Codes, Serrures et Timeline : sous chaque logement (et timeline commune dans Aujourd'hui) ; Stock : dans Reglages
  routeRules: { '/codes': { redirect: '/logements' }, '/locks': { redirect: '/logements' }, '/timeline': { redirect: '/' }, '/stock': { redirect: '/settings/stock' } },
  app: { head: { title: 'Rocket Host', htmlAttrs: { lang: 'fr' } } },
})
