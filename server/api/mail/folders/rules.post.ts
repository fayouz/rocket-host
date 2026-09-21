// Regle de rangement automatique d'un dossier libre : { folderPath, sender?, subject? } (au moins l'un des deux)
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const sender = String(b.sender ?? '').trim().toLowerCase().slice(0, 100)
  const subject = String(b.subject ?? '').trim().slice(0, 100)
  if (!sender && !subject) throw createError({ statusCode: 400, statusMessage: 'Expéditeur ou objet requis' })
  if (/\p{Cc}/u.test(sender + subject)) throw createError({ statusCode: 400, statusMessage: 'Caractères invalides' })
  const db = useDatabase()
  const f = ((await db.sql`SELECT managed FROM mail_folder WHERE path = ${String(b.folderPath ?? '')} AND gone = 0`).rows as any[])[0]
  if (!f) throw createError({ statusCode: 404, statusMessage: 'Dossier inconnu' })
  if (f.managed) throw createError({ statusCode: 400, statusMessage: 'Les dossiers de rangement automatique ont leurs propres règles' })
  await db.sql`INSERT INTO mail_folder_rule (folder_path, sender, subject) VALUES (${String(b.folderPath)}, ${sender}, ${subject})`
  return { ok: true }
})
