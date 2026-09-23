// Depot de l'image de fond du livret/ecran TV (multipart/form-data : file)
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'Image requise' })
  await saveBackground(lg.id, file.filename, file.data)
  return { ok: true }
})
