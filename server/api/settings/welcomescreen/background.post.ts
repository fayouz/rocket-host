// Depot du fond par defaut (multipart/form-data : file)
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'Image requise' })
  await saveDefaultBackground(file.filename, file.data)
  return { ok: true }
})
