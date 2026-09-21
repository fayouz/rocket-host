// Cree un dossier : { logement, parent?, name }
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const lg = await getLogement(b.logement)
  await assertLogement(event, lg.id)
  const parent = b.parent === null || b.parent === undefined || b.parent === '' ? null : Number(b.parent)
  const depth = await checkParent(lg.id, parent)
  if (depth >= MAX_DEPTH) throw createError({ statusCode: 400, statusMessage: `Profondeur maximale atteinte (${MAX_DEPTH} niveaux)` })
  const name = checkName(b.name)
  if (await nameTaken(lg.id, parent, name)) throw createError({ statusCode: 409, statusMessage: 'Un élément porte déjà ce nom ici' })
  const now = new Date().toISOString()
  const r = await useDatabase().sql`INSERT INTO fs_node (logement_id, parent_id, kind, name, created_at, updated_at) VALUES (${lg.id}, ${parent}, 'folder', ${name}, ${now}, ${now})`
  return { ok: true, id: Number(r.lastInsertRowid) }
})
