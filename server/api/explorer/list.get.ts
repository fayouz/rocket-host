// Contenu d'un emplacement de l'explorateur.
//  - sans logement : la racine « Documents » = un dossier par logement
//  - ?logement=<id> (&folder=<id>) : contenu de la racine du logement ou d'un de ses dossiers
//  - &q=<texte> : recherche par nom dans le logement (ou dans tous les logements sans ?logement)
//  - &tag=<id> : ne garde que les elements portant cette etiquette (combinable avec q)
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const db = useDatabase()
  const scope = await scopeOf(event) // null = administrateur (tout) ; sinon les logements autorises
  const logements = (await ensureLogements()).filter(l => !scope || scope.has(l.id))
  const q0 = String(q.q ?? '').trim().slice(0, 80)
  const tagId = q.tag === undefined || q.tag === '' ? null : (await getTag(q.tag)).id

  if (q.logement === undefined || q.logement === '') {
    const counts = new Map(((await db.sql`SELECT logement_id, COUNT(*) AS n FROM fs_node GROUP BY logement_id`).rows as any[]).map(r => [Number(r.logement_id), Number(r.n)]))
    if (!q0 && tagId === null) return { root: true, logement: null, path: [], logements: logements.map(l => ({ id: l.id, name: l.name })), items: logements.map(l => ({ id: l.id, kind: 'logement' as const, name: l.name, size: counts.get(l.id) ?? 0, updatedAt: '', createdAt: '', parentId: null, logementId: l.id, ext: '', inline: false })) }
  }

  const lg = q.logement === undefined || q.logement === '' ? null : await getLogement(q.logement)
  if (lg) await assertLogement(event, lg.id)
  const lgList = logements.map(l => ({ id: l.id, name: l.name }))

  if (q0 || tagId !== null) {
    const like = `%${q0.replace(/[\\%_]/g, m => `\\${m}`)}%`
    const where = ['1=1']; const args: (string | number)[] = []
    if (lg) { where.push('n.logement_id = ?'); args.push(lg.id) }
    else if (scope) { where.push(`n.logement_id IN (${[...scope, 0].map(() => '?').join(',')})`); args.push(...scope, 0) } // recherche globale : seulement les logements autorises
    if (q0) { where.push("n.name LIKE ? ESCAPE '\\'"); args.push(like) }
    if (tagId !== null) { where.push('EXISTS (SELECT 1 FROM fs_node_tag x WHERE x.node_id = n.id AND x.tag_id = ?)'); args.push(tagId) }
    const rows = (await db.prepare(`SELECT n.* FROM fs_node n WHERE ${where.join(' AND ')} ORDER BY n.kind, n.name LIMIT 100`).all(...args)) as any[]
    const items = []
    for (const r of rows) {
      const chain = (await ancestors(r as FsRow)).slice(0, -1).map(n => n.name)
      const owner = logements.find(l => l.id === Number(r.logement_id))
      items.push({ ...nodeFromRow(r), where: [owner?.name ?? '?', ...chain].join(' / ') })
    }
    return { root: false, search: q0, tag: tagId, logement: lg ? { id: lg.id, name: lg.name } : null, path: [], logements: lgList, items: await attachTags(items) }
  }

  const folder = q.folder === undefined || q.folder === '' ? null : await getNode(q.folder)
  if (folder && (folder.kind !== 'folder' || Number(folder.logement_id) !== lg!.id)) throw createError({ statusCode: 404, statusMessage: 'Dossier introuvable' })
  const rows = (folder
    ? (await db.sql`SELECT * FROM fs_node WHERE logement_id = ${lg!.id} AND parent_id = ${folder.id}`).rows
    : (await db.sql`SELECT * FROM fs_node WHERE logement_id = ${lg!.id} AND parent_id IS NULL`).rows) as any[]
  const path = folder ? (await ancestors(folder)).map(n => ({ id: n.id, name: n.name })) : []
  return { root: false, logement: { id: lg!.id, name: lg!.name }, path, logements: lgList, items: await attachTags(rows.map(nodeFromRow)) }
})
