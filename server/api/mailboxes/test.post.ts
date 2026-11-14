// Assistant, etape « Test » d'une boite Locale : connexion IMAP + identification SMTP avec les valeurs saisies.
// Le mot de passe sert au test puis est oublie (il n'est enregistre, chiffre, qu'a l'etape finale). Aucun message lu ni envoye.
export default defineEventHandler(async (event) => {
  const b = (await readBody(event).catch(() => null)) ?? {}
  const c = validateServer(b)
  const password = typeof b.password === 'string' ? b.password : ''
  if (password.length > 4096) throw createError({ statusCode: 400, statusMessage: 'Mot de passe trop long' })
  return testServerConfig(c, password)
})
