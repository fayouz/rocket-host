// Regenere le lien secret du livret : l'ancien cesse de fonctionner immediatement.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  await regenerateGuestToken(lg.id)
  return { ok: true }
})
