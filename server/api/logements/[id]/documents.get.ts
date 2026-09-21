// Documents du logement, filtres par annee (?year=AAAA). categories = liste des categories (cle, libelle, nature).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const q = getQuery(event)
  const year = /^\d{4}$/.test(String(q.year ?? '')) ? String(q.year) : null
  const rows = (await useDatabase().sql`SELECT * FROM document WHERE logement_id = ${lg.id} ORDER BY doc_date DESC, id DESC`).rows as any[]
  return {
    logement: lg,
    years: [...new Set(rows.map(r => String(r.doc_date).slice(0, 4)))].sort().reverse(),
    categories: Object.entries(CATEGORIES).map(([key, c]) => ({ key, ...c })),
    items: rows.filter(r => !year || String(r.doc_date).startsWith(year)).map(docFromRow),
    maxSize: MAX_SIZE,
  }
})
