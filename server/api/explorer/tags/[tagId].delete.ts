// Supprime une etiquette (elle est retiree de tous les elements ; les fichiers ne sont pas touches)
export default defineEventHandler(async (event) => {
  const tag = await getTag(getRouterParam(event, 'tagId'))
  const db = useDatabase()
  await db.sql`DELETE FROM fs_node_tag WHERE tag_id = ${tag.id}`
  await db.sql`DELETE FROM fs_tag WHERE id = ${tag.id}`
  return { ok: true }
})
