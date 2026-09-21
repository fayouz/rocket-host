// Supprime un document (ligne en base + fichier sur le disque). Definitif : l'interface demande confirmation.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'docId'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const db = useDatabase()
  const row = ((await db.sql`SELECT file_path FROM document WHERE id = ${id}`).rows as any[])[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Document inconnu' })
  await db.sql`DELETE FROM document WHERE id = ${id}`
  await removeFile(String(row.file_path))
  return { ok: true }
})
