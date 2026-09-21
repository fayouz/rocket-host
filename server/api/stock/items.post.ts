// Ajoute un article au catalogue. { name, propertyIds? } : logements (id Lodgify) qui le suivent ; par defaut tous.
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  const name = typeof b?.name === 'string' ? b.name.trim().slice(0, 80) : ''
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nom requis' })
  const properties = await ensureStock()
  const wanted = Array.isArray(b?.propertyIds) ? properties.filter(p => b.propertyIds.includes(p.id)) : properties
  const db = useDatabase()
  await db.sql`INSERT INTO stock_item (name) VALUES (${name})`
  const id = Number(((await db.sql`SELECT MAX(id) AS id FROM stock_item`).rows as any[])[0].id)
  for (const p of wanted) await setTracked(p.id, id, true)
  return { ok: true, id }
})
