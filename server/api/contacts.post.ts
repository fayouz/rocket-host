export default defineEventHandler(async (event) => {
  const c = parseContact((await readBody(event)) ?? {})
  const db = useDatabase()
  const now = new Date().toISOString()
  await db.sql`INSERT INTO contact (name, kind, company, phone, phone2, email, website, address, note, follow_up, created_at, updated_at)
    VALUES (${c.name}, ${c.kind}, ${c.company}, ${c.phone}, ${c.phone2}, ${c.email}, ${c.website}, ${c.address}, ${c.note}, ${c.followUp}, ${now}, ${now})`
  const id = Number(((await db.sql`SELECT MAX(id) AS id FROM contact`).rows as any[])[0].id)
  try { await saveLinks(id, c.logementIds) } catch (e) { await db.sql`DELETE FROM contact WHERE id = ${id}`; throw e }
  return { ok: true, id }
})
