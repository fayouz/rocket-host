// Changement de mot de passe : { current, next }. Invalide les autres sessions du compte.
export default defineEventHandler(async (event) => {
  const user = await currentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Non connecté' })
  const b = (await readBody(event)) ?? {}
  return { ok: true, user: await changePassword(event, user, b.current, b.next) }
})
