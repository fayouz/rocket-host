// Retire le fond propre au logement : revient au fond general des reglages (heritage), s'il y en a un.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  await setBackgroundMode(lg.id, 'inherit')
  return { ok: true }
})
