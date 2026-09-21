// Depot d'un document (multipart/form-data) : file + title, category, date (AAAA-MM-JJ), amount?, note?
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  if (Number(getHeader(event, 'content-length') || 0) > MAX_SIZE + 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Fichier trop volumineux (15 Mo maximum)' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!parts || !file?.filename) throw createError({ statusCode: 400, statusMessage: 'Fichier requis' })
  const field = (n: string) => parts.find(p => p.name === n && !p.filename)?.data.toString('utf8')
  const f = parseFields({
    title: field('title')?.trim() || file.filename.replace(/\.[^.]+$/, ''),
    category: field('category'), date: field('date'), amount: field('amount'), note: field('note'),
  })
  const saved = await saveFile(lg.id, file.filename, file.data)
  try {
    await useDatabase().sql`INSERT INTO document (logement_id, title, category, doc_date, amount, note, file_path, original_name, mime, size, created_at)
      VALUES (${lg.id}, ${f.title!}, ${f.category!}, ${f.date!}, ${f.amount ?? null}, ${f.note ?? ''}, ${saved.rel}, ${saved.original}, ${saved.mime}, ${saved.size}, ${new Date().toISOString()})`
  } catch (e) { await removeFile(saved.rel); throw e }
  return { ok: true }
})
