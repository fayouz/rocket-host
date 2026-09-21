// Modifie nom, e-mail, role, logements autorises et etat actif d'un compte. Effet immediat (le role et les logements sont lus a chaque requete).
export default defineEventHandler(async (event) => {
  const me = (await currentUser(event))!
  const row = await getUserRow(getRouterParam(event, 'id'))
  const id = Number(row.id)
  const b = (await readBody(event)) ?? {}
  const u = await parseUserInput(b, { username: String(row.username) })
  const active = b.active === undefined ? !!Number(row.active) : !!b.active
  if (id === me.id) {
    if (u.role !== 'admin') throw createError({ statusCode: 409, statusMessage: 'Tu ne peux pas retirer ton propre rôle d\'administrateur' })
    if (!active) throw createError({ statusCode: 409, statusMessage: 'Tu ne peux pas désactiver ton propre compte' })
  }
  if (row.role === 'admin' && (u.role !== 'admin' || !active)) await assertAnotherAdmin(id)
  const db = useDatabase()
  await db.sql`UPDATE app_user SET email = ${u.email}, display_name = ${u.displayName}, role = ${u.role}, active = ${active ? 1 : 0} WHERE id = ${id}`
  await setUserLogements(id, u.logements)
  await audit(event, 'utilisateur_modifie', `${row.username} : rôle ${u.role}, ${u.logements.length} logement(s)${active === !!Number(row.active) ? '' : active ? ', réactivé' : ', désactivé'}`, me)
  return { ok: true }
})
