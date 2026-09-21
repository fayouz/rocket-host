// Supprime un fichier, ou un dossier avec tout son contenu (fichiers effaces du disque). Definitif : l'interface confirme.
export default defineEventHandler(async (event) => {
  const node = await getNode(getRouterParam(event, 'id'))
  const all = node.kind === 'folder' ? [node, ...(await descendants(Number(node.id)))] : [node]
  const db = useDatabase()
  for (const n of all) { await db.sql`DELETE FROM fs_node WHERE id = ${Number(n.id)}`; await db.sql`DELETE FROM fs_node_tag WHERE node_id = ${Number(n.id)}` }
  for (const n of all) if (n.file_path) await removeFile(String(n.file_path))
  return { ok: true, removed: all.length }
})
