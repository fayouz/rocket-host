// Connexion : { username, password } -> ouvre une session (cookie). Message d'erreur identique quel que soit le motif.
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const user = await login(event, b.username, b.password)
  return { ok: true, user, mustChange: user.mustChange }
})
