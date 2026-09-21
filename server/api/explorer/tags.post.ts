// Cree une etiquette : { name, color? }
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const name = checkTagName(b.name)
  const color = checkTagColor(b.color)
  const db = useDatabase()
  if (await tagNameTaken(name)) throw createError({ statusCode: 409, statusMessage: 'Cette étiquette existe déjà' })
  const r = await db.sql`INSERT INTO fs_tag (name, color) VALUES (${name}, ${color})`
  return { ok: true, id: Number(r.lastInsertRowid) }
})
