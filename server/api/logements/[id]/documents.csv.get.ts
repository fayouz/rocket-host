// Export CSV des documents (?year=AAAA), pour le comptable ou un tableur. Separateur ";", BOM pour Excel.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const year = /^\d{4}$/.test(String(getQuery(event).year ?? '')) ? String(getQuery(event).year) : null
  const rows = ((await useDatabase().sql`SELECT * FROM document WHERE logement_id = ${lg.id} ORDER BY doc_date, id`).rows as any[])
    .filter(r => !year || String(r.doc_date).startsWith(year)).map(docFromRow)
  // Anti-injection de formules : un texte commencant par = + - @ est precede d'une apostrophe ; guillemets doubles echappes
  const text = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
  const nature: Record<string, string> = { charge: 'Charge', recette: 'Recette', doc: 'Justificatif' }
  const lines = [['Date', 'Catégorie', 'Nature', 'Titre', 'Montant (€)', 'Fichier', 'Note'].join(';')]
  for (const d of rows) lines.push([d.date, text(d.categoryLabel), nature[d.kind] ?? '', text(d.title), d.amount === null ? '' : String(d.amount).replace('.', ','), text(d.fileName), text(d.note)].join(';'))
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="documents-${lg.name.replace(/[^\w-]+/g, '_')}-${year ?? 'toutes-annees'}.csv"`)
  setHeader(event, 'cache-control', 'private, no-store')
  return String.fromCharCode(0xfeff) + lines.join('\r\n') + '\r\n'
})
