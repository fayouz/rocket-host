// Force aucun fond ('none') pour ce logement, meme si un fond general est reglé, ou revient a l'heritage ('inherit').
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const mode = String(((await readBody(event)) ?? {}).mode || '')
  if (mode !== 'inherit' && mode !== 'none') throw createError({ statusCode: 400, statusMessage: 'Mode invalide' })
  await setBackgroundMode(lg.id, mode)
  return { ok: true }
})
