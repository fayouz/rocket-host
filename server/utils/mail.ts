// Interface e-mail : synchronisation des en-tetes (cache local), rattachement automatique des messages aux reservations et aux
// contacts, lecture d'un message a la demande. La synchronisation et la lecture sont en LECTURE SEULE ; les seules ecritures dans
// la boite sont le rangement (mailFiling.ts), la creation de dossiers et la copie dans « Envoyes » (smtp.ts), toutes declenchees par l'utilisateur.
// Vie privee : seuls les en-tetes et un apercu de 300 caracteres sont stockes ; le corps et les pieces jointes sont relus dans
// la boite quand on ouvre un message. Rien n'est jamais marque lu ni supprime.
import { simpleParser } from 'mailparser'
import sanitizeHtml from 'sanitize-html'
import { connect, errText, getImapConfig, need } from './imap'
import { COMPTA_FOLDER, LOGEMENTS_FOLDER, syncFolderTree } from './mailFolders'

export const domainOf = (a: string) => a.split('@')[1]?.toLowerCase() ?? ''
// Domaines de messagerie grand public : un meme domaine n'y designe pas la meme personne
const PUBLIC_DOMAIN = /(^|\.)(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|orange|wanadoo|free|sfr|laposte|neuf|proton|protonmail|gmx|aol)\.[a-z.]+$/i
const norm = (s: string) => s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase()

export interface MailRow {
  id: number; folder: string; uid: number; uid_validity: number; message_id: string; from_name: string; from_addr: string
  to_addrs: string; subject: string; date: string; snippet: string; attach_json: string
}

// ---------- association automatique ----------
// Signaux (score) : e-mail du voyageur = adresse du message (100) ; identifiant de reservation Lodgify cite, ex. « #B1000001 » ou nombre nu (95) ;
// prenom seul dans l'objet, si une seule reservation proche le porte (75) ;
// nom du voyageur dans l'expediteur / l'objet / l'apercu pendant son sejour (70). Contact : adresse exacte (100), meme domaine professionnel (60).
export function computeLinks(m: Pick<MailRow, 'from_name' | 'from_addr' | 'to_addrs' | 'subject' | 'date' | 'snippet'>, ctx: {
  bookings: { id: number; guest: string; guestEmail?: string; arrival: string; departure: string }[]
  contacts: { id: number; email: string }[]
}) {
  const out: { kind: 'booking' | 'contact'; targetId: number; score: number }[] = []
  const addrs = [m.from_addr, ...m.to_addrs.split(',')].map(a => a.trim().toLowerCase()).filter(Boolean)
  const when = Date.parse(m.date)
  const near = (b: { arrival: string; departure: string }, before: number, after: number) =>
    Number.isFinite(when) && when >= Date.parse(b.arrival) - before * 864e5 && when <= Date.parse(b.departure) + after * 864e5
  const push = (kind: 'booking' | 'contact', targetId: number, score: number) => {
    const known = out.find(o => o.kind === kind && o.targetId === targetId)
    if (known) known.score = Math.max(known.score, score); else out.push({ kind, targetId, score })
  }

  for (const c of ctx.contacts) {
    if (!c.email) continue
    if (addrs.includes(c.email)) push('contact', c.id, 100)
    else if (!PUBLIC_DOMAIN.test(domainOf(c.email)) && addrs.some(a => domainOf(a) === domainOf(c.email))) push('contact', c.id, 60)
  }

  const text = norm(`${m.from_name} ${m.subject} ${m.snippet}`)
  // Numero de reservation : « #B123… », « B123… » ou nombre nu (« pour la réservation 22988326 ») ; seuls les numeros de reservations connues comptent
  const ids = new Set([...`${m.subject} ${m.snippet}`.matchAll(/(?<!\d)(\d{7,9})(?!\d)/g)].map(x => Number(x[1])))
  // Prenom seul dans l'objet (« Rappel : Mélissa arrive bientôt ») : retenu si UNE seule reservation proche porte ce prenom
  const subj = norm(`${m.from_name} ${m.subject}`)
  const firstNamed = ctx.bookings.filter((b) => {
    const first = norm(b.guest).trim().split(/\s+/)[0] ?? ''
    return first.length >= 3 && new RegExp(`(?<![a-z])${first.replace(/[^a-z]/g, '')}(?![a-z])`).test(subj) && near(b, 10, 1)
  })
  for (const b of ctx.bookings) {
    if (firstNamed.length === 1 && firstNamed[0]!.id === b.id) push('booking', b.id, 75)
    if (b.guestEmail && addrs.includes(b.guestEmail) && near(b, 90, 60)) push('booking', b.id, 100)
    if (ids.has(b.id)) push('booking', b.id, 95)
    const name = norm(b.guest).trim()
    if (name.length >= 6 && text.includes(name) && near(b, 60, 45)) push('booking', b.id, 70)
  }
  return out.filter(o => o.score >= 60)
}

// Recalcule les associations automatiques de tous les messages du cache (les choix manuels et les retraits sont respectes)
export async function relinkAll() {
  const db = useDatabase()
  const { bookings } = await loadData()
  const contacts = ((await db.sql`SELECT id, email FROM contact WHERE email != ''`).rows as any[]).map(c => ({ id: Number(c.id), email: String(c.email).toLowerCase() }))
  const ctx = { bookings, contacts }
  const cfg = await getImapConfig()
  const skip = ((await db.sql`SELECT path FROM mail_folder WHERE role IN ('spam', 'trash')`).rows as any[]).map(r => String(r.path))
  if (cfg.spamFolder) skip.push(cfg.spamFolder)
  const rows = ((await db.sql`SELECT * FROM mail_message`).rows as unknown as MailRow[]).filter(m => !skip.includes(m.folder))
  const existing = (await db.sql`SELECT * FROM mail_link`).rows as any[]
  let added = 0
  await db.sql`DELETE FROM mail_link WHERE method = 'auto'`
  for (const m of rows) {
    for (const l of computeLinks(m, ctx)) {
      if (existing.some(e => Number(e.message_id) === Number(m.id) && e.kind === l.kind && Number(e.target_id) === l.targetId && e.method !== 'auto')) continue // manuel ou retire
      await db.sql`INSERT OR IGNORE INTO mail_link (message_id, kind, target_id, score, method) VALUES (${Number(m.id)}, ${l.kind}, ${l.targetId}, ${l.score}, 'auto')`
      added += 1
    }
  }
  return added
}

// ---------- synchronisation des en-tetes ----------
let syncing = false
export const isMailSyncing = () => syncing

const attachmentsOf = (node: any, acc: { name: string; size: number; type: string }[] = []) => {
  if (!node) return acc
  if (node.childNodes?.length) { node.childNodes.forEach((c: any) => attachmentsOf(c, acc)); return acc }
  const name = node.dispositionParameters?.filename || node.parameters?.name
  if (name || node.disposition === 'attachment') acc.push({ name: String(name || 'pièce jointe'), size: Number(node.size || 0), type: String(node.type || '') })
  return acc
}

export async function syncMail(opts: { days?: number; max?: number } = {}) {
  if (syncing) return { ok: false, message: 'Une synchronisation est déjà en cours.' }
  syncing = true
  const db = useDatabase()
  try {
    const cfg = await getImapConfig()
    const missing = need(cfg)
    if (missing) return { ok: false, message: missing }
    const days = opts.days ?? cfg.mailDays
    const max = opts.max ?? 500
    const client = connect(cfg)
    client.on('error', () => {})
    await client.connect()
    let added = 0, folderCount = 0, filed = 0
    try {
      const tree = await syncFolderTree(client, cfg)
      // Dossiers lus : reception, envoyes, spam, traite/archive, comptabilite, dossiers par logement (12 au plus)
      const wanted = [cfg.folder, tree.sent, tree.spam, cfg.treatedFolder, COMPTA_FOLDER, ...tree.paths.filter(p => p.startsWith(`${LOGEMENTS_FOLDER}${tree.delimiter}`))]
      const folders = [...new Set(wanted.filter(f => f && tree.paths.includes(f)))].slice(0, 12)
      for (const folder of folders) {
        const lock = await client.getMailboxLock(folder, { readOnly: true })
        try {
          folderCount += 1
          const validity = Number((client.mailbox as any)?.uidValidity ?? 0)
          const sinceDate = new Date(Date.now() - days * 864e5)
          const found = await client.search({ since: sinceDate }, { uid: true })
          const foundList = Array.isArray(found) ? found : []
          // Messages disparus du dossier (deplaces, supprimes) dans la fenetre : retires du cache avec leurs associations
          if (Array.isArray(found)) {
            const gone = ((await db.sql`SELECT id, uid, date FROM mail_message WHERE folder = ${folder} AND uid_validity = ${validity}`).rows as any[])
              .filter(r => String(r.date) >= sinceDate.toISOString() && !foundList.includes(Number(r.uid)))
            for (const g of gone) { await db.sql`DELETE FROM mail_link WHERE message_id = ${Number(g.id)}`; await db.sql`DELETE FROM mail_message WHERE id = ${Number(g.id)}` }
          }
          const uids = foundList.sort((a, b) => b - a).slice(0, max)
          const known = new Set(((await db.sql`SELECT uid FROM mail_message WHERE folder = ${folder} AND uid_validity = ${validity}`).rows as any[]).map(r => Number(r.uid)))
          const fresh = uids.filter(u => !known.has(u)).sort((a, b) => a - b)
          for (let i = 0; i < fresh.length; i += 40) {
            for await (const msg of client.fetch(fresh.slice(i, i + 40).join(','), { uid: true, envelope: true, bodyStructure: true, source: { start: 0, maxLength: 24_000 } }, { uid: true })) {
              const env = msg.envelope as any
              let snippet = ''
              try { snippet = ((await simpleParser(msg.source as Buffer)).text || '').replace(/\s+/g, ' ').trim().slice(0, 300) } catch { /* apercu facultatif */ }
              const from = env?.from?.[0]
              const to = (env?.to || []).map((a: any) => String(a.address || '').toLowerCase()).filter(Boolean).join(',')
              await db.sql`INSERT OR IGNORE INTO mail_message (folder, uid, uid_validity, message_id, from_name, from_addr, to_addrs, subject, date, snippet, attach_json, synced_at)
                VALUES (${folder}, ${Number(msg.uid)}, ${validity}, ${String(env?.messageId || '')}, ${String(from?.name || '').slice(0, 120)}, ${String(from?.address || '').toLowerCase()},
                        ${to.slice(0, 500)}, ${String(env?.subject || '').slice(0, 300)}, ${(env?.date ? new Date(env.date) : new Date()).toISOString()}, ${snippet},
                        ${JSON.stringify(attachmentsOf(msg.bodyStructure))}, ${new Date().toISOString()})`
              added += 1
            }
          }
        } finally { lock.release() }
      }
    } finally { await client.logout().catch(() => {}) }
    const linked = await relinkAll()
    if (cfg.autoFile) { const f = await applyFiling({ limit: 50 }).catch(() => null); if (f) filed = f.done }
    const summary = `${added} nouveau(x) e-mail(s) synchronisé(s) sur ${folderCount} dossier(s), ${linked} association(s) automatique(s)${cfg.autoFile ? `, ${filed} message(s) rangé(s)` : ''}`
    await db.sql`UPDATE imap_config SET mail_synced_at = ${new Date().toISOString()}, mail_result = ${summary} WHERE id = 1`
    return { ok: true, message: summary, added, linked }
  } catch (e: any) {
    const message = `Échec : ${errText(e)}`
    await db.sql`UPDATE imap_config SET mail_synced_at = ${new Date().toISOString()}, mail_result = ${message} WHERE id = 1`
    return { ok: false, message }
  } finally { syncing = false }
}

// ---------- lecture a la demande ----------
async function fetchSource(m: MailRow): Promise<Buffer> {
  const cfg = await getImapConfig()
  const missing = need(cfg)
  if (missing) throw createError({ statusCode: 503, statusMessage: missing })
  const client = connect(cfg)
  client.on('error', () => {})
  try {
    await client.connect()
    const lock = await client.getMailboxLock(m.folder, { readOnly: true })
    try {
      if (Number((client.mailbox as any)?.uidValidity ?? 0) !== Number(m.uid_validity)) throw createError({ statusCode: 409, statusMessage: 'Le dossier a été réinitialisé côté serveur : relance une synchronisation.' })
      const head = await client.fetchOne(String(m.uid), { size: true }, { uid: true })
      if (head && Number(head.size) > 30 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Message trop volumineux (30 Mo)' })
      const msg = await client.fetchOne(String(m.uid), { source: true }, { uid: true })
      if (!msg || !msg.source) throw createError({ statusCode: 404, statusMessage: 'Message introuvable dans la boîte (supprimé ou déplacé ?)' })
      return msg.source
    } finally { lock.release() }
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 502, statusMessage: errText(e) })
  } finally { await client.logout().catch(() => {}) }
}

export async function getMailRow(id: number): Promise<MailRow> {
  const row = ((await useDatabase().sql`SELECT * FROM mail_message WHERE id = ${id}`).rows as any[])[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Message inconnu' })
  return row as MailRow
}

// HTML nettoye : ni script, ni formulaire, ni image/ressource distante ; liens ouverts dans un nouvel onglet, sans referent
const cleanHtml = (html: string) => sanitizeHtml(html.slice(0, 500_000), {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'style', 'font', 'center', 'u', 's', 'small', 'span', 'div', 'hr', 'caption', 'colgroup', 'col', 'tfoot', 'sub', 'sup'],
  allowedAttributes: { '*': ['style', 'align', 'valign', 'bgcolor', 'color', 'width', 'height', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'dir', 'lang'], a: ['href', 'name', 'title'], font: ['face', 'size', 'color'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowVulnerableTags: true, // <style> : sans danger ici (iframe sans script + CSP qui interdit tout chargement)
  transformTags: { a: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' } }) },
})

// Corps (texte + HTML nettoye, jamais de ressource distante) et liste des pieces jointes
export async function readMessage(m: MailRow) {
  const mail = await simpleParser(await fetchSource(m))
  return {
    text: (mail.text || '').slice(0, 200_000),
    html: typeof mail.html === 'string' && mail.html.trim() ? cleanHtml(mail.html) : '',
    attachments: (mail.attachments || []).map((a, index) => ({ index, name: a.filename || `pièce-${index + 1}`, size: a.size, type: a.contentType })),
  }
}

export async function readAttachment(m: MailRow, index: number) {
  const mail = await simpleParser(await fetchSource(m))
  const a = mail.attachments?.[index]
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Pièce jointe introuvable' })
  return { name: a.filename || `pièce-${index + 1}`, type: a.contentType, content: a.content }
}
