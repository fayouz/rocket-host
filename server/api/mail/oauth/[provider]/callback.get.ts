// Retour OAuth Google / Microsoft : echange du code, jeton de renouvellement chiffre (MAILBOX_<id>_REFRESH_TOKEN), boite creee
// avec releve DESACTIVE. Retour a l'assistant avec le resultat (jamais de jeton dans l'adresse).
export default defineEventHandler(async (event) => {
  const p = getRouterParam(event, 'provider')
  if (!isOAuthProvider(p)) throw createError({ statusCode: 404, statusMessage: 'Fournisseur inconnu' })
  const q = getQuery(event)
  const back = (params: Record<string, string>) => sendRedirect(event, `/settings/imap?${new URLSearchParams({ assistant: p, ...params })}`)
  if (q.error) return back({ erreur: `${OAUTH[p].label} : connexion annulée ou refusée` })
  const user = await currentUser(event)
  const st = takeOAuthState(String(q.state ?? ''), p, user!.id)
  if (!st) return back({ erreur: 'Lien de connexion expiré ou invalide : recommence' })
  try {
    const t = await exchangeOAuthCode(p, String(q.code ?? ''), st.redirectUri)
    const id = await createOAuthMailbox(p, t.email, t.refreshToken, t.accessToken, t.expiresIn)
    await audit(event, 'boite_mail_ajoutee', `${p} #${id}`)
    return back({ boite: String(id) })
  } catch (e: any) { return back({ erreur: String(e?.message || 'Échec de la connexion').slice(0, 200) }) }
})
