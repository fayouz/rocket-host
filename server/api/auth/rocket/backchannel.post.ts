// Connexion Loussa : back-channel logout (serveur a serveur, corps application/x-www-form-urlencoded : logout_token=...)
export default defineEventHandler(async (event) => {
  if (!rocketAuthEnabled()) throw createError({ statusCode: 404, statusMessage: 'Connexion Loussa non configuré' })
  setHeader(event, 'cache-control', 'no-store')
  const b = (await readBody(event)) ?? {}
  const token = typeof b === 'string' ? new URLSearchParams(b).get('logout_token') : b.logout_token
  return handleBackchannel(token)
})
