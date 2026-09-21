// Enregistre une piece jointe dans les Documents : { index, logementId (0 = a classer), category?, date?, amount?, title? }
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const row = await getMailRow(Number(getRouterParam(event, 'id')))
  if (!Number.isInteger(b.index) || b.index < 0) throw createError({ statusCode: 400, statusMessage: 'Pièce jointe invalide' })
  const logementId = Number(b.logementId ?? 0)
  if (!Number.isInteger(logementId) || logementId < 0 || (logementId > 0 && !(await ensureLogements()).some(l => l.id === logementId))) throw createError({ statusCode: 400, statusMessage: 'Logement inconnu' })
  const a = await readAttachment(row, b.index)
  const r = await importDocument({
    source: 'mail', externalId: `${row.message_id || `mail-${row.id}`}#${a.name}`, logementId, filename: a.name, data: a.content,
    title: typeof b.title === 'string' && b.title.trim() ? b.title : (row.subject || a.name).slice(0, 120),
    category: b.category || 'autre_doc', date: b.date || String(row.date).slice(0, 10), amount: b.amount,
    note: `E-mail de ${row.from_addr} : « ${String(row.subject).slice(0, 120)} »`,
  })
  return { ok: true, duplicate: r.status === 'duplicate', id: r.id }
})
