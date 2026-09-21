// Reglages du rangement : { autoFile?: boolean, treatedFolder?: string }. Le rangement automatique est desactive par defaut.
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const db = useDatabase()
  if (typeof b.autoFile === 'boolean') await db.sql`UPDATE imap_config SET auto_file = ${b.autoFile ? 1 : 0} WHERE id = 1`
  if (b.treatedFolder !== undefined) {
    const t = String(b.treatedFolder).trim()
    if (!t || t.length > 120 || /\p{Cc}/u.test(t) || t.toUpperCase() === 'INBOX') throw createError({ statusCode: 400, statusMessage: 'Dossier « traité » invalide' })
    await db.sql`UPDATE imap_config SET treated_folder = ${t} WHERE id = 1`
  }
  return { ok: true }
})
