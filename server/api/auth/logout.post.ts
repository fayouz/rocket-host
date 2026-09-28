// Deconnexion. Session ouverte par Rocket Auth : renvoie aussi l'adresse de fin de session Rocket Auth (RP-initiated logout).
export default defineEventHandler(async (event) => {
  const user = await currentUser(event)
  const { sso } = await endSession(event)
  if (user) await audit(event, 'deconnexion', sso ? 'Rocket Auth' : '', user)
  const redirect = sso && rocketAuthEnabled() ? await endSessionUrl(event) : null
  return { ok: true, redirect }
})
