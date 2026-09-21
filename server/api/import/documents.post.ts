// Import d'un document par un workflow externe (n8n...). multipart/form-data, en-tete Authorization: Bearer <WEBHOOK_TOKEN>.
// Champs : file (requis), source (requis, ex. airbnb), externalId (recommande : evite les doublons si n8n reessaie),
//   logementId | lodgifyPropertyId | property (sinon : "a classer"), category (defaut autre_doc), date (defaut aujourd'hui), title, amount, note.
export default defineEventHandler(async (event) => {
  requireWebhookToken(event)
  if (Number(getHeader(event, 'content-length') || 0) > MAX_SIZE + 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Fichier trop volumineux (15 Mo maximum)' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  const field = (n: string) => parts?.find(p => p.name === n && !p.filename)?.data.toString('utf8')
  const source = field('source')?.trim() ?? ''
  try {
    if (!parts || !file?.filename) throw createError({ statusCode: 400, statusMessage: 'Fichier requis' })
    const target = await resolveLogement({ logementId: field('logementId'), lodgifyPropertyId: field('lodgifyPropertyId'), property: field('property') })
    const r = await importDocument({
      source, externalId: field('externalId'), logementId: target.id, filename: file.filename, data: file.data,
      title: field('title'), category: field('category') || undefined, date: field('date') || undefined, amount: field('amount'),
      note: [field('note'), target.note].filter(Boolean).join(' · ') || undefined,
    })
    return { ok: true, duplicate: r.status === 'duplicate', id: r.id, logementId: r.logementId, toClassify: r.logementId === 0 }
  } catch (e: any) {
    if (isSource(source)) await logImport(source, 'document', 'error', e?.statusMessage || String(e))
    throw e
  }
})
