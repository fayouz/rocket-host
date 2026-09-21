export default defineEventHandler(async (event) => {
  const user = await currentUser(event)
  await endSession(event)
  if (user) await audit(event, 'deconnexion', '', user)
  return { ok: true }
})
