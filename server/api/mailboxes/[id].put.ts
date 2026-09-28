// Active / desactive le releve d'une boite : { enabled }. C'est le seul moyen d'activer un releve (desactive a la creation).
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const b = (await readBody(event).catch(() => null)) ?? {}
  if (!Number.isInteger(id) || typeof b.enabled !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  await setMailboxEnabled(id, b.enabled)
  await audit(event, b.enabled ? 'boite_mail_activee' : 'boite_mail_desactivee', `#${id}`)
  return { ok: true }
})
