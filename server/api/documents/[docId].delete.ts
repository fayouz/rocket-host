// Supprime un fichier importe (page Imports) : ligne en base, etiquettes et fichier sur le disque. Definitif : l'interface demande confirmation.
export default defineEventHandler(async (event) => {
  const node = await getNode(getRouterParam(event, 'docId'))
  if (node.kind !== 'file') throw createError({ statusCode: 400, statusMessage: 'Ce n\'est pas un fichier' })
  const db = useDatabase()
  await db.sql`DELETE FROM fs_node_tag WHERE node_id = ${Number(node.id)}`
  await db.sql`DELETE FROM fs_node WHERE id = ${Number(node.id)}`
  if (node.file_path) await removeFile(String(node.file_path))
  return { ok: true }
})
