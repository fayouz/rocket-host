// Deconnexion. Session ouverte par Connexion Loussa : renvoie aussi l'adresse de fin de session Connexion Loussa (RP-initiated logout).
export default defineEventHandler(async (event) => {
  const user = await currentUser(event)
  const { sso } = await endSession(event)
  if (user) await audit(event, 'deconnexion', sso ? 'Connexion Loussa' : '', user)
  const redirect = sso && rocketAuthEnabled() ? await endSessionUrl(event) : null
  return { ok: true, redirect }
})
