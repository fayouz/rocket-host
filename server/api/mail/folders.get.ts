// Dossiers de la boite (miroir des dossiers IMAP) avec le nombre de messages en cache, et les reglages de rangement
export default defineEventHandler(async () => {
  const db = useDatabase()
  const cfg = await getImapConfig()
  const counts = (await db.sql`SELECT folder, COUNT(*) AS n FROM mail_message GROUP BY folder`).rows as any[]
  const folders = ((await db.sql`SELECT * FROM mail_folder WHERE gone = 0 ORDER BY path COLLATE NOCASE`).rows as any[]).map(f => ({
    path: String(f.path), name: String(f.name), delimiter: String(f.delimiter), role: String(f.role), managed: String(f.managed), logementId: Number(f.logement_id),
    count: Number(counts.find(c => c.folder === f.path)?.n ?? 0),
  }))
  const rules = (await db.sql`SELECT * FROM mail_folder_rule ORDER BY id`).rows as any[]
  return {
    folders, inbox: cfg.folder, sent: cfg.sentFolder, spam: cfg.spamFolder, treated: cfg.treatedFolder, autoFile: cfg.autoFile,
    rules: rules.map(r => ({ id: Number(r.id), folderPath: String(r.folder_path), sender: String(r.sender), subject: String(r.subject) })),
    inboxCount: Number(counts.find(c => c.folder === cfg.folder)?.n ?? 0),
    sentCount: Number(counts.find(c => c.folder === cfg.sentFolder)?.n ?? 0),
    spamCount: Number(counts.find(c => c.folder === cfg.spamFolder)?.n ?? 0),
    synced: folders.length > 0,
  }
})
