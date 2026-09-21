// Liste des e-mails du cache (filtres, pagination) avec leurs associations et des libelles lisibles.
import { CONTACT_KINDS, isKind } from './contacts'
import type { MailRow } from './mail'

const like = (q: string) => `%${q.replace(/[!%_]/g, m => `!${m}`)}%`

export async function mailLabels() {
  const { bookings } = await loadData()
  const logements = await ensureLogements()
  const contacts = (await useDatabase().sql`SELECT id, name, kind FROM contact`).rows as any[]
  const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return {
    booking: (id: number) => {
      const b = bookings.find(x => x.id === id)
      if (!b) return `Réservation ${id}`
      const lg = logements.find(l => l.lodgifyPropertyId === b.propertyId)
      return `${b.guest} · ${fr(b.arrival)} → ${fr(b.departure)}${lg ? ` · ${lg.name}` : ''}`
    },
    bookingLogementId: (id: number) => logements.find(l => l.lodgifyPropertyId === bookings.find(x => x.id === id)?.propertyId)?.id ?? null,
    contact: (id: number) => {
      const c = contacts.find(x => Number(x.id) === id)
      return c ? `${c.name} · ${isKind(c.kind) ? CONTACT_KINDS[c.kind] : c.kind}` : `Contact ${id}`
    },
  }
}

export async function listMail(f: { folder?: string; q?: string; link?: string; booking?: number; contact?: number; limit?: number; offset?: number }) {
  const db = useDatabase()
  const where: string[] = []
  const args: (string | number)[] = []
  if (f.folder) { where.push('m.folder = ?'); args.push(f.folder) }
  if (f.q?.trim()) {
    where.push("(m.subject LIKE ? ESCAPE '!' OR m.from_addr LIKE ? ESCAPE '!' OR m.from_name LIKE ? ESCAPE '!' OR m.to_addrs LIKE ? ESCAPE '!' OR m.snippet LIKE ? ESCAPE '!')")
    const p = like(f.q.trim()); args.push(p, p, p, p, p)
  }
  const exists = (kind: string, id?: number) => `EXISTS (SELECT 1 FROM mail_link l WHERE l.message_id = m.id AND l.kind = '${kind}' AND l.method != 'removed'${id ? ' AND l.target_id = ?' : ''})`
  if (f.booking) { where.push(exists('booking', f.booking)); args.push(f.booking) }
  if (f.contact) { where.push(exists('contact', f.contact)); args.push(f.contact) }
  if (f.link === 'booking') where.push(exists('booking'))
  if (f.link === 'contact') where.push(exists('contact'))
  if (f.link === 'none') where.push(`NOT ${exists('booking')} AND NOT ${exists('contact')}`)
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 100), offset = Math.max(f.offset ?? 0, 0)

  const total = Number(((await db.prepare(`SELECT COUNT(*) AS n FROM mail_message m ${cond}`).all(...args)) as any[])[0].n)
  const rows = (await db.prepare(`SELECT m.* FROM mail_message m ${cond} ORDER BY m.date DESC, m.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset)) as unknown as MailRow[]
  const links = rows.length
    ? ((await db.prepare(`SELECT * FROM mail_link WHERE method != 'removed' AND message_id IN (${rows.map(() => '?').join(',')})`).all(...rows.map(r => Number(r.id)))) as any[])
    : []
  const label = await mailLabels()
  return { total, items: rows.map(r => mailItem(r, links, label)) }
}

export function mailItem(r: MailRow, links: any[], label: Awaited<ReturnType<typeof mailLabels>>) {
  let attachments: { name: string; size: number; type: string }[] = []
  try { attachments = JSON.parse(String(r.attach_json)) } catch { /* cache ancien ou corrompu */ }
  return {
    id: Number(r.id), folder: String(r.folder), fromName: String(r.from_name), fromAddr: String(r.from_addr), to: String(r.to_addrs).split(',').filter(Boolean),
    subject: String(r.subject), date: String(r.date), snippet: String(r.snippet), attachments,
    links: links.filter(l => Number(l.message_id) === Number(r.id)).map(l => ({
      kind: String(l.kind), targetId: Number(l.target_id), score: Number(l.score), method: String(l.method),
      label: l.kind === 'booking' ? label.booking(Number(l.target_id)) : label.contact(Number(l.target_id)),
      logementId: l.kind === 'booking' ? label.bookingLogementId(Number(l.target_id)) : null,
    })),
  }
}
