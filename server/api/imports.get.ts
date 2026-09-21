// Vue d'ensemble des imports (administration) : documents a classer, sources, lignes de releves non affectees, journal
export default defineEventHandler(async () => {
  const db = useDatabase()
  const logements = await ensureLogements()
  const inbox = ((await db.sql`SELECT * FROM document WHERE logement_id = 0 ORDER BY doc_date DESC, id DESC`).rows as any[]).map(docFromRow)
  const docs = (await db.sql`SELECT source, COUNT(*) AS n, MAX(created_at) AS last FROM document GROUP BY source`).rows as any[]
  const txs = (await db.sql`SELECT source, COUNT(*) AS n, MAX(imported_at) AS last FROM platform_transaction GROUP BY source`).rows as any[]
  const unassigned = (await db.sql`SELECT source, COUNT(*) AS n, ROUND(SUM(amount), 2) AS total FROM platform_transaction WHERE logement_id = 0 GROUP BY source`).rows as any[]
  const names = new Set<string>([...docs, ...txs].map(r => String(r.source)))
  const sources = [...names].sort().map(s => ({
    source: s,
    documents: Number(docs.find(d => d.source === s)?.n ?? 0), transactions: Number(txs.find(t => t.source === s)?.n ?? 0),
    last: [docs.find(d => d.source === s)?.last, txs.find(t => t.source === s)?.last].filter(Boolean).sort().pop() ?? null,
  }))
  const log = (await db.sql`SELECT * FROM import_log ORDER BY id DESC LIMIT 30`).rows as any[]
  return {
    logements: logements.map(l => ({ id: l.id, name: l.name })),
    inbox,
    categories: Object.entries(CATEGORIES).map(([key, c]) => ({ key, ...c })),
    sources,
    unassignedTransactions: unassigned.map(u => ({ source: String(u.source), count: Number(u.n), total: Number(u.total) })),
    log: log.map(l => ({ id: Number(l.id), at: String(l.at), source: String(l.source), type: String(l.type), status: String(l.status), detail: String(l.detail) })),
    webhookConfigured: !!useRuntimeConfig().webhookToken,
  }
})
