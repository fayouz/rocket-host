// Journal d'audit recent (administrateur) : connexions, echecs, gestion des comptes. ?limit=<n> (defaut 100, max 500)
export default defineEventHandler(async (event) => {
  const n = Math.min(Math.max(Number(getQuery(event).limit) || 100, 1), 500)
  const rows = (await useDatabase().sql`SELECT * FROM audit_log ORDER BY id DESC LIMIT ${n}`).rows as any[]
  return { entries: rows.map(r => ({ id: Number(r.id), at: String(r.at), username: String(r.username), action: String(r.action), detail: String(r.detail), ip: String(r.ip) })) }
})
