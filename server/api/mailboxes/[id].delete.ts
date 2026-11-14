// Retire une boite (et ses secrets chiffres). La boite principale ne se retire pas.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  await deleteMailbox(id)
  await audit(event, 'boite_mail_retiree', `#${id}`)
  return { ok: true }
})
