// Boites e-mail configurees + etat des sources de l'assistant (applications OAuth renseignees, Rocket Mailer). Jamais de secret : etat + indice.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  return {
    mailboxes: await listMailboxes(),
    oauth: Object.fromEntries(OAUTH_PROVIDERS.map(p => [p, { configured: oauthConfigured(p) }])),
    mailer: { configured: mailerConfigured() },
  }
})
