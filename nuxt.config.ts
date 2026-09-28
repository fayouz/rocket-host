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
    homeyClientId: process.env.HOMEY_CLIENT_ID || '', // application OAuth Homey (mode cloud) : identifiant et secret restent dans .env
    homeyClientSecret: process.env.HOMEY_CLIENT_SECRET || '',
    homeyRedirectUri: process.env.HOMEY_REDIRECT_URI || '', // facultatif : adresse de retour OAuth si elle ne se deduit pas de l'adresse du site
    homeyApiKey: process.env.HOMEY_API_KEY || '', // cle d'API Homey Pro : jamais en base, jamais renvoyee au navigateur
    demo: process.env.DEMO || '',
    // Rocket PMS (fayouz/rocket-pms), optionnel : si PMS_API_URL est vide, l'appli continue de parler a Lodgify/Nuki en
    // direct comme avant. jeton d'application Rocket Core ("rpm_..."), jamais renvoye au navigateur.
    pmsApiUrl: process.env.PMS_API_URL || '',
    pmsApiToken: process.env.PMS_API_TOKEN || '',
    // Compte Rocket PMS au nom duquel partent les e-mails (Rocket Mailer exige un utilisateur) : X-Impersonate-User
    pmsImpersonateUser: process.env.PMS_IMPERSONATE_USER || '',
    // Tableau de bord intelligent : clients directs des briques (facultatifs, adresse vide = brique masquee).
    // Jetons d'application de chaque brique, jamais renvoyes au navigateur. Voir docs/rocket-host-dashboard.md.
    rocketPlaceUrl: process.env.ROCKET_PLACE_URL || '',
    rocketPlaceToken: process.env.ROCKET_PLACE_TOKEN || '',
    rocketCleanUrl: process.env.ROCKET_CLEAN_URL || '',
    rocketCleanToken: process.env.ROCKET_CLEAN_TOKEN || '',
    rocketStockUrl: process.env.ROCKET_STOCK_URL || '',
    rocketStockToken: process.env.ROCKET_STOCK_TOKEN || '',
    rocketCastUrl: process.env.ROCKET_CAST_URL || '',
    rocketCastToken: process.env.ROCKET_CAST_TOKEN || '',
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
