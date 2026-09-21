// Import de lignes de releve de plateforme (commissions, taxes de sejour, reversements). JSON, meme jeton que ci-dessus.
// Corps : { source, items: [{ externalId, date (AAAA-MM-JJ), kind (payout|fee|tourist_tax|refund|other), amount (>0), currency?, bookingRef?, label?,
//   logementId | lodgifyPropertyId | property }] }. Les lignes invalides sont listees dans `invalid` sans bloquer les autres.
export default defineEventHandler(async (event) => {
  requireWebhookToken(event)
  const b = await readBody(event)
  const source = b?.source
  if (!isSource(source)) throw createError({ statusCode: 400, statusMessage: 'source invalide (2 à 30 caractères : a-z, 0-9, - ou _)' })
  if (!Array.isArray(b?.items) || !b.items.length || b.items.length > 2000) throw createError({ statusCode: 400, statusMessage: 'items : 1 à 2000 lignes' })
  const db = useDatabase()
  let inserted = 0, duplicates = 0
  const invalid: { index: number; reason: string }[] = []
  const cache = new Map<string, number>()
  for (const [index, it] of (b.items as any[]).entries()) {
    try {
      const externalId = String(it?.externalId ?? '').trim().slice(0, 200)
      const date = String(it?.date ?? '')
      const amount = Number(String(it?.amount ?? '').replace(',', '.'))
      if (!externalId) throw new Error('externalId requis')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error('date invalide (AAAA-MM-JJ)')
      if (!TX_KINDS.includes(it?.kind)) throw new Error(`kind invalide (${TX_KINDS.join(', ')})`)
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error('amount doit être un nombre positif')
      const key = JSON.stringify([it.logementId, it.lodgifyPropertyId, it.property])
      if (!cache.has(key)) cache.set(key, (await resolveLogement(it)).id)
      const known = ((await db.sql`SELECT id FROM platform_transaction WHERE source = ${source} AND external_id = ${externalId}`).rows as any[]).length > 0
      if (known) { duplicates += 1; continue }
      await db.sql`INSERT INTO platform_transaction (source, external_id, logement_id, tx_date, kind, amount, currency, booking_ref, label, imported_at)
        VALUES (${source}, ${externalId}, ${cache.get(key)!}, ${date}, ${it.kind}, ${Math.round(amount * 100) / 100}, ${String(it.currency || 'EUR').toUpperCase().slice(0, 3)},
                ${it.bookingRef ? String(it.bookingRef).slice(0, 80) : null}, ${String(it.label ?? '').slice(0, 200)}, ${new Date().toISOString()})`
      inserted += 1
    } catch (e: any) { invalid.push({ index, reason: e?.statusMessage || e?.message || 'ligne invalide' }) }
  }
  await logImport(source, 'transactions', invalid.length === b.items.length ? 'error' : 'ok', `${inserted} ajoutée(s), ${duplicates} déjà connue(s), ${invalid.length} invalide(s)`)
  return { ok: true, inserted, duplicates, invalid }
})
