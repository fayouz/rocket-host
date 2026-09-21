// Choisit le mot de passe grace a un lien a usage unique : { token, password }. Ferme les autres sessions du compte.
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  return { ok: true, ...(await activate(event, b.token, b.password)) }
})
