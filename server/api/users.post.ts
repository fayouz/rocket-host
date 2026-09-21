// Cree un compte SANS mot de passe : il devient actif quand la personne suit son lien d'invitation (POST /api/users/:id/invite)
export default defineEventHandler(async (event) => {
  const me = (await currentUser(event))!
  const u = await parseUserInput((await readBody(event)) ?? {})
  const db = useDatabase()
  if (((await db.sql`SELECT 1 AS x FROM app_user WHERE username = ${u.username}`).rows as any[]).length) throw createError({ statusCode: 409, statusMessage: 'Cet identifiant existe déjà' })
  const r = await db.sql`INSERT INTO app_user (username, email, display_name, role, password_hash, must_change, created_at) VALUES (${u.username}, ${u.email}, ${u.displayName}, ${u.role}, '', 0, ${new Date().toISOString()})`
  const id = Number(r.lastInsertRowid)
  await setUserLogements(id, u.logements)
  await audit(event, 'utilisateur_cree', `${u.username} (${u.role})`, me)
  return { ok: true, id }
})
