// Modifie les informations d'un document (pas le fichier) : { title?, category?, date?, amount?, note?, logementId? (0 = a classer) }
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'docId'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const db = useDatabase()
  if (!((await db.sql`SELECT id FROM document WHERE id = ${id}`).rows as any[]).length) throw createError({ statusCode: 404, statusMessage: 'Document inconnu' })
  const body = (await readBody(event)) ?? {}
  const f = parseFields(body, true)
  if (body.logementId !== undefined) {
    const target = Number(body.logementId)
    if (target !== 0 && !(await ensureLogements()).some(l => l.id === target)) throw createError({ statusCode: 400, statusMessage: 'Logement inconnu' })
    await db.sql`UPDATE document SET logement_id = ${target} WHERE id = ${id}`
  }
  if (f.title !== undefined) await db.sql`UPDATE document SET title = ${f.title} WHERE id = ${id}`
  if (f.category !== undefined) await db.sql`UPDATE document SET category = ${f.category} WHERE id = ${id}`
  if (f.date !== undefined) await db.sql`UPDATE document SET doc_date = ${f.date} WHERE id = ${id}`
  if (f.amount !== undefined) await db.sql`UPDATE document SET amount = ${f.amount} WHERE id = ${id}`
  if (f.note !== undefined) await db.sql`UPDATE document SET note = ${f.note} WHERE id = ${id}`
  return { ok: true }
})
