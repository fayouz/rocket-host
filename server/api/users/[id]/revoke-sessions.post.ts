// Ferme toutes les sessions ouvertes d'un compte (la personne devra se reconnecter)
export default defineEventHandler(async (event) => {
  const me = (await currentUser(event))!
  const row = await getUserRow(getRouterParam(event, 'id'))
  await useDatabase().sql`UPDATE app_user SET session_version = session_version + 1 WHERE id = ${Number(row.id)}`
  await audit(event, 'sessions_fermees', String(row.username), me)
  return { ok: true }
})
