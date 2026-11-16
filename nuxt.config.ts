export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  // Multilingue FR/EN : langue du navigateur par defaut (cookie si l'utilisateur choisit), francais sinon. Pas de prefixe d'URL.
  i18n: {
    locales: [{ code: 'fr', language: 'fr-FR', files: ['fr/common.json', 'fr/daily.json', 'fr/manage.json', 'fr/admin.json'], name: 'Français' }, { code: 'en', language: 'en-GB', files: ['en/common.json', 'en/daily.json', 'en/manage.json', 'en/admin.json'], name: 'English' }],
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    detectBrowserLanguage: { useCookie: true, cookieKey: 'loussa_lang', fallbackLocale: 'fr', alwaysRedirect: false },
  },
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Secrets et reglages d'integration (Lodgify, Nuki, IMAP, Homey, Loussa Réservations/Place/Clean/Stock/Cast, webhook, CONNECTOR_*) :
  // en base, chiffres (AES-256-GCM, cle ROCKET_SECRETS_KEY), saisis dans Reglages > Connexions. Voir docs/secrets.md.
  runtimeConfig: {
    demo: process.env.DEMO || '',
    // Adresses des interfaces web des briques (facultatif) : liens « géré dans Loussa Réservations/Place » du menu Administration
    public: {
      pmsFrontUrl: process.env.PMS_FRONT_URL || '',
      placeFrontUrl: process.env.PLACE_FRONT_URL || '',
      // Adresse publique de Loussa Console (facultatif) : lien « Créer un compte · choisir une offre » de la page de connexion
      rocketConsolePublicUrl: process.env.ROCKET_CONSOLE_PUBLIC_URL || '',
    },
  },
  // Mini base SQLite (fichier .data/db.sqlite3, ignore par git)
  nitro: { experimental: { database: true } },
  // Anciennes pages Codes, Serrures et Timeline : sous chaque logement (et timeline commune dans Aujourd'hui) ; Stock : dans Reglages
  routeRules: { '/codes': { redirect: '/logements' }, '/locks': { redirect: '/logements' }, '/timeline': { redirect: '/' }, '/stock': { redirect: '/settings/stock' } },
  app: { head: { title: 'Espace Loussa', htmlAttrs: { lang: 'fr' } } },
})
