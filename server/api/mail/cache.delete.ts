// Vide le cache local des e-mails (en-tetes, apercus, associations). La boite e-mail n'est pas touchee.
export default defineEventHandler(async () => {
  const db = useDatabase()
  await db.sql`DELETE FROM mail_link`
  await db.sql`DELETE FROM mail_message`
  await db.sql`UPDATE imap_config SET mail_synced_at = NULL, mail_result = '' WHERE id = 1`
  return { ok: true }
})
