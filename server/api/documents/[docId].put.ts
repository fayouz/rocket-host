// Modifie un fichier importe (page Imports) : { title?, category?, date?, amount?, note?, logementId? (0 = a classer) }.
// Changer de logement le range a la racine du nouveau logement. Le fichier lui-meme n'est pas modifie.
export default defineEventHandler(async (event) => {
  const node = await getNode(getRouterParam(event, 'docId'))
  if (node.kind !== 'file') throw createError({ statusCode: 400, statusMessage: 'Ce n\'est pas un fichier' })
  const db = useDatabase()
  const body = (await readBody(event)) ?? {}
  const meta = parseMeta({ ...body, fileType: body.category ?? body.fileType })
  let logementId = Number(node.logement_id)
  let parent = node.parent_id === null ? null : Number(node.parent_id)
  let name = String(node.name)
  if (body.logementId !== undefined && Number(body.logementId) !== logementId) {
    const target = Number(body.logementId)
    if (target !== 0 && !(await ensureLogements()).some(l => l.id === target)) throw createError({ statusCode: 400, statusMessage: 'Logement inconnu' })
    // Un compte non administrateur ne peut deplacer que vers un de ses logements (jamais vers « a classer »)
    const scope = await scopeOf(event)
    if (scope && !scope.has(target)) throw createError({ statusCode: 403, statusMessage: 'Accès refusé à ce logement' })
    logementId = target
    parent = null
    name = await freeName(target, null, name)
  }
  if (typeof body.title === 'string' && body.title.trim()) {
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
    const wanted = checkName(`${cleanName(body.title).replace(/\.[^.]+$/, '')}${ext}`)
    if (wanted !== name) name = await freeName(logementId, parent, wanted)
  }
  const cur = node as FsRow & { file_type: string; doc_date: string | null; amount: number | null; note: string }
  await db.sql`UPDATE fs_node SET logement_id = ${logementId}, parent_id = ${parent}, name = ${name},
    file_type = ${meta.fileType ?? cur.file_type ?? ''}, doc_date = ${meta.date === undefined ? cur.doc_date ?? null : meta.date},
    amount = ${meta.amount === undefined ? cur.amount ?? null : meta.amount}, note = ${meta.note ?? cur.note ?? ''},
    updated_at = ${new Date().toISOString()} WHERE id = ${Number(node.id)}`
  // Tags : ils sont communs a tous les logements, rien a deplacer
  return { ok: true }
})
