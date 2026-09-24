// Liste des etiquettes avec le nombre d'elements qui les portent, et les types de fichier possibles (charge / recette / doc)
export default defineEventHandler(async () => {
  const rows = (await useDatabase().sql`SELECT t.id, t.name, t.color, COUNT(nt.node_id) AS n FROM fs_tag t LEFT JOIN fs_node_tag nt ON nt.tag_id = t.id GROUP BY t.id ORDER BY t.name COLLATE NOCASE`).rows as any[]
  return {
    colors: TAG_COLORS,
    tags: rows.map(r => ({ id: Number(r.id), name: String(r.name), color: String(r.color), count: Number(r.n) })),
    types: Object.entries(CATEGORIES).map(([key, c]) => ({ key, label: c.label as string, kind: c.kind as 'charge' | 'recette' | 'doc' })),
  }
})
