// Dossiers de la boite : miroir des vrais dossiers IMAP + dossiers de rangement geres par l'appli
// (Logements/<logement>, Comptabilite, Traite). Creer un dossier ecrit dans la boite ; rien n'est jamais supprime.
import type { ImapFlow } from 'imapflow'

export const COMPTA_FOLDER = 'Comptabilité'
export const LOGEMENTS_FOLDER = 'Logements'

// Nom de dossier sur : sans separateur ni caracteres interdits ou de controle
export const safeFolderName = (n: string, delimiter = '/') =>
  n.replace(/\p{Cc}/gu, '').replace(/[\\/.:*?"<>|%&#~]/g, '-').replaceAll(delimiter, '-').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '').slice(0, 60) || 'Sans nom'

const ROLE_BY_FLAG: Record<string, string> = { '\\Sent': 'sent', '\\Junk': 'spam', '\\Trash': 'trash', '\\Drafts': 'drafts', '\\Archive': 'archive' }
const ROLE_BY_NAME: [RegExp, string][] = [[/^(sent|envoy)/i, 'sent'], [/^(junk|spam|ind[ée]sirable)/i, 'spam'], [/^(trash|corbeille|deleted)/i, 'trash'], [/^(drafts?|brouillons?)/i, 'drafts'], [/^(archives?)$/i, 'archive']]

export const joinPath = (delimiter: string, ...parts: string[]) => parts.join(delimiter)

// Lit l'arbre des dossiers, met a jour le miroir local (mail_folder) et memorise les dossiers Envoyes / Spam
export async function syncFolderTree(client: ImapFlow, cfg: { folder: string; treatedFolder: string }) {
  const db = useDatabase()
  const boxes = await client.list()
  const delimiter = boxes.find(b => b.delimiter)?.delimiter ?? '/'
  const logements = await ensureLogements()
  await db.sql`UPDATE mail_folder SET gone = 1`
  let sent = '', spam = ''
  for (const b of boxes) {
    if (b.flags?.has('\\Noselect') || (b as any).listed === false) continue
    const role = b.path === cfg.folder ? 'inbox'
      : [...(b.flags ?? [])].map(f => ROLE_BY_FLAG[f]).find(Boolean) ?? (b.specialUse ? ROLE_BY_FLAG[b.specialUse] : '') ?? ''
    const named = role || ROLE_BY_NAME.find(([re]) => re.test(b.path))?.[1] || ''
    if (named === 'sent' && !sent) sent = b.path
    if (named === 'spam' && !spam) spam = b.path
    const top = b.path.split(b.delimiter || delimiter)[0]!
    const lg = top === LOGEMENTS_FOLDER ? logements.find(l => joinPath(b.delimiter || delimiter, LOGEMENTS_FOLDER, safeFolderName(l.name, b.delimiter || delimiter)) === b.path) : undefined
    const managed = b.path === LOGEMENTS_FOLDER ? 'logements' : lg ? 'logement' : b.path === COMPTA_FOLDER ? 'compta' : b.path === cfg.treatedFolder ? 'treated' : ''
    await db.sql`INSERT INTO mail_folder (path, name, delimiter, role, managed, logement_id, gone) VALUES (${b.path}, ${b.name}, ${b.delimiter || delimiter}, ${named}, ${managed}, ${lg?.id ?? 0}, 0)
      ON CONFLICT(path) DO UPDATE SET name = excluded.name, delimiter = excluded.delimiter, role = excluded.role, managed = excluded.managed, logement_id = excluded.logement_id, gone = 0`
  }
  await db.sql`UPDATE imap_config SET sent_folder = ${sent}, spam_folder = ${spam} WHERE id = 1`
  return { delimiter, sent, spam, paths: boxes.map(b => b.path) }
}

// Chemins des dossiers de rangement attendus (selon les logements et le separateur du serveur)
export async function managedPaths(delimiter: string, treated: string) {
  const logements = await ensureLogements()
  return {
    logements: LOGEMENTS_FOLDER, compta: COMPTA_FOLDER, treated,
    perLogement: new Map(logements.map(l => [l.id, joinPath(delimiter, LOGEMENTS_FOLDER, safeFolderName(l.name, delimiter))])),
  }
}

// Cree les dossiers de rangement manquants (jamais de suppression ni de renommage). Renvoie les chemins crees.
export async function ensureManagedFolders(client: ImapFlow, delimiter: string, existing: string[], treated: string) {
  const want = await managedPaths(delimiter, treated)
  const paths = [want.logements, ...want.perLogement.values(), want.compta, want.treated]
  const created: string[] = []
  for (const path of paths) {
    if (existing.includes(path)) continue
    try { await client.mailboxCreate(path); created.push(path); existing.push(path) }
    catch (e: any) { if (!/already ?exist|exists/i.test(String(e?.responseText || e?.message || e))) throw e }
  }
  return created
}

// Ou ranger un message recu : dossiers cibles d'apres ses associations (reservation / contact) et les regles des dossiers libres
export function filingTargets(
  m: { subject: string; from_addr: string; from_name: string },
  links: { kind: string; targetId: number }[],
  ctx: {
    logementOfBooking: (bookingId: number) => number | null
    contact: (id: number) => { kind: string; logementIds: number[] } | undefined
    paths: Awaited<ReturnType<typeof managedPaths>>
    rules: { folder_path: string; sender: string; subject: string }[]
    hasAttachment: boolean
  },
): string[] {
  const out = new Set<string>()
  for (const l of links) {
    if (l.kind === 'booking') { const lg = ctx.logementOfBooking(l.targetId); const p = lg ? ctx.paths.perLogement.get(lg) : undefined; if (p) out.add(p) }
    if (l.kind === 'contact') {
      const c = ctx.contact(l.targetId)
      if (!c) continue
      if (['comptable', 'banque', 'assurance', 'syndic', 'fournisseur'].includes(c.kind)) out.add(ctx.paths.compta)
      for (const lg of c.logementIds) { const p = ctx.paths.perLogement.get(lg); if (p) out.add(p) }
    }
  }
  // Factures : objet evocateur ET piece jointe (evite d'attraper la publicite)
  if (ctx.hasAttachment && /\b(facture|invoice|re[cç]u|avoir|taxe|imp[oô]ts?|tva|bilan|liasse|comptab)/i.test(m.subject)) out.add(ctx.paths.compta)
  for (const r of ctx.rules) {
    const bySender = !r.sender || `${m.from_addr} ${m.from_name}`.toLowerCase().includes(r.sender.toLowerCase())
    const bySubject = !r.subject || m.subject.toLowerCase().includes(r.subject.toLowerCase())
    if ((r.sender || r.subject) && bySender && bySubject) out.add(r.folder_path)
  }
  return [...out]
}
