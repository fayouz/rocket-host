// Renomme ou recolore une etiquette : { name?, color? }
export default defineEventHandler(async (event) => {
  const tag = await getTag(getRouterParam(event, 'tagId'))
  const b = (await readBody(event)) ?? {}
  const name = b.name === undefined ? tag.name : checkTagName(b.name)
  const color = b.color === undefined ? tag.color : checkTagColor(b.color)
  const db = useDatabase()
  if (await tagNameTaken(name, tag.id)) throw createError({ statusCode: 409, statusMessage: 'Cette étiquette existe déjà' })
  await db.sql`UPDATE fs_tag SET name = ${name}, color = ${color} WHERE id = ${tag.id}`
  return { ok: true }
})
