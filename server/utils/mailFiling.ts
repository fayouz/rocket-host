// Rangement des e-mails recus : pour chaque message de la reception qui correspond a une regle, une COPIE va dans le dossier voulu
// (Logements/<logement>, Comptabilite, dossier libre) et l'ORIGINAL est deplace dans le dossier « traite » (Traite ou Archive).
// Un message qui ne correspond a rien reste dans la reception, intact. Jamais de suppression. Uniquement la reception est concernee.
import { connect, errText, getImapConfig, need } from './imap'
import { ensureManagedFolders, filingTargets, managedPaths, syncFolderTree } from './mailFolders'
import type { MailRow } from './mail'

export interface FilingPlanItem { id: number; uid: number; subject: string; from: string; targets: string[] }

export async function planFiling() {
  const db = useDatabase()
  const cfg = await getImapConfig()
  const delimiter = ((await db.sql`SELECT delimiter FROM mail_folder LIMIT 1`).rows as any[])[0]?.delimiter ?? '/'
  const paths = await managedPaths(delimiter, cfg.treatedFolder)
  const rows = ((await db.sql`SELECT * FROM mail_message WHERE folder = ${cfg.folder} ORDER BY date DESC`).rows as unknown as MailRow[]).slice(0, 500)
  const links = rows.length ? ((await db.prepare(`SELECT * FROM mail_link WHERE method != 'removed' AND message_id IN (${rows.map(() => '?').join(',')})`).all(...rows.map(r => Number(r.id)))) as any[]) : []
  const labels = await mailLabels()
  const contacts = await listContacts()
  const rules = ((await db.sql`SELECT folder_path, sender, subject FROM mail_folder_rule`).rows as any[]).map(r => ({ folder_path: String(r.folder_path), sender: String(r.sender), subject: String(r.subject) }))
  const items: FilingPlanItem[] = []
  for (const m of rows) {
    const mine = links.filter(l => Number(l.message_id) === Number(m.id)).map(l => ({ kind: String(l.kind), targetId: Number(l.target_id) }))
    let hasAttachment = false
    try { hasAttachment = JSON.parse(String(m.attach_json)).length > 0 } catch { /* cache ancien */ }
    const targets = filingTargets(m, mine, {
      logementOfBooking: id => labels.bookingLogementId(id), contact: id => contacts.find(c => c.id === id), paths, rules, hasAttachment,
    })
    if (targets.length) items.push({ id: Number(m.id), uid: Number(m.uid), subject: String(m.subject), from: String(m.from_name || m.from_addr), targets })
  }
  return { treated: cfg.treatedFolder, inbox: cfg.folder, items }
}

// dryRun : ne touche a rien, renvoie le plan. Sinon range (50 messages au plus par passage par defaut).
export async function applyFiling(opts: { dryRun?: boolean; limit?: number } = {}) {
  const plan = await planFiling()
  if (opts.dryRun) return { ok: true, dryRun: true, treated: plan.treated, items: plan.items, done: 0, failed: 0, created: [] as string[] }
  const cfg = await getImapConfig()
  const missing = need(cfg)
  if (missing) return { ok: false, message: missing, done: 0, failed: 0, items: plan.items, created: [] as string[] }
  const todo = plan.items.slice(0, opts.limit ?? 50)
  if (!todo.length) return { ok: true, done: 0, failed: 0, items: [], created: [] as string[], message: 'Rien à ranger.' }

  const db = useDatabase()
  const client = connect(cfg)
  client.on('error', () => {})
  let done = 0, failed = 0
  let created: string[] = []
  try {
    await client.connect()
    // Garde-fou : un deplacement sans MOVE est un COPY + EXPUNGE. Avec UIDPLUS, l'effacement ne vise que le message concerne (UID EXPUNGE) ;
    // sans MOVE ni UIDPLUS, un EXPUNGE general pourrait effacer d'autres messages deja marques « supprimes » : rangement refuse.
    if (!client.capabilities.has('MOVE') && !client.capabilities.has('UIDPLUS')) return { ok: false, message: 'Ce serveur ne gère ni MOVE ni UIDPLUS : rangement automatique refusé par sécurité.', done, failed, items: todo, created }
    const tree = await syncFolderTree(client, cfg)
    created = await ensureManagedFolders(client, tree.delimiter, [...tree.paths], cfg.treatedFolder)
    if (created.length) await syncFolderTree(client, cfg)
    const lock = await client.getMailboxLock(cfg.folder) // lecture-ecriture
    try {
      const validity = Number((client.mailbox as any)?.uidValidity ?? 0)
      for (const it of todo) {
        const row = ((await db.sql`SELECT * FROM mail_message WHERE id = ${it.id}`).rows as any[])[0]
        if (!row || Number(row.uid_validity) !== validity || row.folder !== cfg.folder) { failed += 1; continue }
        try {
          // 1) copies vers les dossiers cibles (l'original ne bouge pas tant qu'une copie echoue)
          const copies: { path: string; uid: number | undefined; validity: number }[] = []
          for (const target of it.targets) {
            const r = await client.messageCopy(String(it.uid), target, { uid: true })
            if (!r) throw new Error(`copie vers ${target} refusée`)
            copies.push({ path: target, uid: (r.uidMap as Map<number, number> | undefined)?.get(it.uid), validity: Number((r as any).uidValidity ?? 0) })
          }
          // 2) l'original va dans le dossier « traite »
          const mv = await client.messageMove(String(it.uid), cfg.treatedFolder, { uid: true })
          if (!mv) throw new Error('déplacement refusé')
          // 3) cache : l'original garde son identifiant (associations conservees), les copies sont de nouvelles lignes
          const newUid = (mv.uidMap as Map<number, number> | undefined)?.get(it.uid)
          if (newUid) await db.sql`UPDATE mail_message SET folder = ${cfg.treatedFolder}, uid = ${newUid}, uid_validity = ${Number((mv as any).uidValidity ?? 0)} WHERE id = ${it.id}`
          else await db.sql`DELETE FROM mail_message WHERE id = ${it.id}` // sera relu a la prochaine synchronisation
          for (const c of copies) {
            if (!c.uid) continue
            await db.sql`INSERT OR IGNORE INTO mail_message (folder, uid, uid_validity, message_id, from_name, from_addr, to_addrs, subject, date, snippet, attach_json, synced_at)
              VALUES (${c.path}, ${c.uid}, ${c.validity}, ${row.message_id}, ${row.from_name}, ${row.from_addr}, ${row.to_addrs}, ${row.subject}, ${row.date}, ${row.snippet}, ${row.attach_json}, ${new Date().toISOString()})`
            const copyRow = ((await db.sql`SELECT id FROM mail_message WHERE folder = ${c.path} AND uid = ${c.uid} AND uid_validity = ${c.validity}`).rows as any[])[0]
            if (copyRow) await db.sql`INSERT OR IGNORE INTO mail_link (message_id, kind, target_id, score, method) SELECT ${Number(copyRow.id)}, kind, target_id, score, method FROM mail_link WHERE message_id = ${it.id}`
          }
          done += 1
        } catch (e: any) { failed += 1; await logImport('imap', 'imap', 'error', `rangement du message n°${it.id} : ${errText(e)}`) }
      }
    } finally { lock.release() }
  } catch (e: any) {
    return { ok: false, message: `Échec : ${errText(e)}`, done, failed, items: todo, created }
  } finally { await client.logout().catch(() => {}) }
  const message = `${done} message(s) rangé(s), ${failed} échec(s)${created.length ? `, dossier(s) créé(s) : ${created.join(', ')}` : ''}`
  await logImport('imap', 'imap', failed ? 'error' : 'ok', `Rangement : ${message}`)
  return { ok: true, message, done, failed, items: todo, created }
}
