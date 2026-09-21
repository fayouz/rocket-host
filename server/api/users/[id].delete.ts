// Supprime un compte (le journal d'audit garde son identifiant). Jamais soi-meme, jamais le dernier administrateur.
export default defineEventHandler(async (event) => {
  const me = (await currentUser(event))!
  const row = await getUserRow(getRouterParam(event, 'id'))
  const id = Number(row.id)
  assertNotSelf(me, id, 'supprimer')
  if (row.role === 'admin') await assertAnotherAdmin(id)
  const db = useDatabase()
  await db.sql`DELETE FROM user_logement WHERE user_id = ${id}`
  await db.sql`DELETE FROM user_token WHERE user_id = ${id}`
  await db.sql`DELETE FROM app_user WHERE id = ${id}`
  await audit(event, 'utilisateur_supprime', String(row.username), me)
  return { ok: true }
})
