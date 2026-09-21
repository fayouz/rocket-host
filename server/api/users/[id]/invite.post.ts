// Cree un lien d'invitation (compte sans mot de passe) ou de reinitialisation (compte existant), a usage unique.
// Le lien est renvoye UNE fois a l'administrateur. { send: true } l'envoie aussi par e-mail (comme un clic « Envoyer » : jamais automatique).
export default defineEventHandler(async (event) => {
  const me = (await currentUser(event))!
  const row = await getUserRow(getRouterParam(event, 'id'))
  const b = (await readBody(event).catch(() => ({}))) ?? {}
  if (!Number(row.active)) throw createError({ statusCode: 409, statusMessage: 'Compte désactivé : réactive-le d\'abord' })
  if (b.send && !row.email) throw createError({ statusCode: 400, statusMessage: 'Ce compte n\'a pas d\'adresse e-mail' })
  const inv = await createInvitation(Number(row.id), me.id)
  const link = invitationLink(event, inv.token)
  await audit(event, inv.purpose === 'invite' ? 'invitation_creee' : 'reinitialisation_creee', String(row.username), me)
  let emailSent = false, emailError = ''
  if (b.send) {
    try {
      await invitationEmail(event, { displayName: String(row.display_name), username: String(row.username), email: String(row.email) }, link, inv.purpose, me.displayName)
      emailSent = true
      await audit(event, 'invitation_envoyee', `${row.username} -> ${row.email}`, me)
    } catch (e: any) { emailError = e?.statusMessage || e?.message || 'Envoi impossible' }
  }
  return { ok: true, link, purpose: inv.purpose, expiresAt: inv.expiresAt, emailSent, emailError }
})
