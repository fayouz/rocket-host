export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  await setBackgroundAnimated(lg.id, !!((await readBody(event)) ?? {}).animated)
  return { ok: true }
})
