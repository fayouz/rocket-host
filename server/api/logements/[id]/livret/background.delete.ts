export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  await removeBackground(lg.id)
  return { ok: true }
})
