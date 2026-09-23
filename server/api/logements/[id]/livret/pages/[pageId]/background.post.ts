// Depot de l'image de fond propre a une page, multipart/form-data : file
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const pageId = Number(getRouterParam(event, 'pageId'))
  await getPageForLogement(pageId, lg.id)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'Image requise' })
  await savePageBackground(pageId, file.filename, file.data)
  return { ok: true }
})
