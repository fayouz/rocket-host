// Teste une boite enregistree (IMAP + SMTP, ou endpoint de test de Rocket Mailer). Aucun message lu ni envoye.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  return testSavedMailbox(id, (await currentUser(event))?.email ?? '')
})
