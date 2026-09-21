// Pose et/ou retire des etiquettes sur des elements : { nodes: number[], add?: number[], remove?: number[] }
const ids = (v: unknown, label: string, max: number) => {
  const a = Array.isArray(v) ? v : []
  if (a.length > max) throw createError({ statusCode: 400, statusMessage: `${label} : ${max} au plus` })
  const out = [...new Set(a.map(Number))]
  if (out.some(n => !Number.isInteger(n) || n <= 0)) throw createError({ statusCode: 400, statusMessage: `${label} invalides` })
  return out
}
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const nodes = ids(b.nodes, 'Éléments', 200)
  const add = ids(b.add, 'Étiquettes', 50)
  const remove = ids(b.remove, 'Étiquettes', 50)
  if (!nodes.length) throw createError({ statusCode: 400, statusMessage: 'Aucun élément' })
  for (const n of nodes) {
    const node = await getNode(n)
    await assertLogement(event, Number(node.logement_id)) // seulement des elements de logements autorises
  }
  for (const t of [...add, ...remove]) await getTag(t)
  const db = useDatabase()
  for (const n of nodes) {
    for (const t of add) await db.sql`INSERT OR IGNORE INTO fs_node_tag (node_id, tag_id) VALUES (${n}, ${t})`
    for (const t of remove) await db.sql`DELETE FROM fs_node_tag WHERE node_id = ${n} AND tag_id = ${t}`
  }
  return { ok: true }
})
