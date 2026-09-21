// Mini CRM : contacts (comptable, artisans, assureur...) avec leurs coordonnees, les logements concernes et l'historique des echanges.
export const CONTACT_KINDS = {
  comptable: 'Comptable', banque: 'Banque', assurance: 'Assurance', syndic: 'Syndic / copropriété', notaire: 'Notaire / juridique',
  artisan: 'Artisan / dépannage', menage: 'Ménage / conciergerie', fournisseur: 'Fournisseur (énergie, internet…)', plateforme: 'Plateforme / support', autre: 'Autre',
} as const
export type ContactKind = keyof typeof CONTACT_KINDS
export const isKind = (v: unknown): v is ContactKind => typeof v === 'string' && v in CONTACT_KINDS

const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export function parseContact(b: Record<string, unknown>) {
  const name = text(b.name, 120)
  if (!name) throw bad('Nom requis')
  if (!isKind(b.kind ?? 'autre')) throw bad('Type de contact invalide')
  const phone = text(b.phone, 30), phone2 = text(b.phone2, 30)
  for (const p of [phone, phone2]) if (p && !/^[0-9+().\- ]{3,30}$/.test(p)) throw bad('Téléphone invalide (chiffres, espaces, + ( ) . -)')
  const email = text(b.email, 120).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw bad('Adresse e-mail invalide')
  const website = text(b.website, 200)
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) throw bad('Site web : adresse complète commençant par http:// ou https://')
  const followUp = b.followUp ? String(b.followUp) : null
  if (followUp && (!/^\d{4}-\d{2}-\d{2}$/.test(followUp) || Number.isNaN(Date.parse(followUp)))) throw bad('Date de relance invalide (AAAA-MM-JJ)')
  const logementIds = Array.isArray(b.logementIds) ? [...new Set(b.logementIds.map(Number))] : []
  if (logementIds.some(i => !Number.isInteger(i) || i < 1)) throw bad('Logement invalide')
  return {
    name, kind: (b.kind ?? 'autre') as ContactKind, company: text(b.company, 120), phone, phone2, email, website,
    address: text(b.address, 300), note: text(b.note, 2000), followUp, logementIds,
  }
}

// Contacts avec leurs logements et leurs echanges. Filtre par logement : les contacts lies a ce logement + ceux sans lien (valables pour tous).
export async function listContacts(filter: { kind?: string; logementId?: number; q?: string } = {}) {
  const db = useDatabase()
  const rows = (await db.sql`SELECT * FROM contact ORDER BY name COLLATE NOCASE`).rows as any[]
  const links = (await db.sql`SELECT * FROM contact_logement`).rows as any[]
  const inter = (await db.sql`SELECT * FROM contact_interaction ORDER BY at DESC, id DESC`).rows as any[]
  const q = (filter.q ?? '').trim().toLowerCase()
  return rows.map((r) => {
    const logementIds = links.filter(l => Number(l.contact_id) === Number(r.id)).map(l => Number(l.logement_id))
    return {
      id: Number(r.id), name: String(r.name), kind: String(r.kind), kindLabel: isKind(r.kind) ? CONTACT_KINDS[r.kind] : String(r.kind), company: String(r.company),
      phone: String(r.phone), phone2: String(r.phone2), email: String(r.email), website: String(r.website), address: String(r.address), note: String(r.note),
      followUp: r.follow_up ? String(r.follow_up) : null, logementIds, all: logementIds.length === 0,
      interactions: inter.filter(i => Number(i.contact_id) === Number(r.id)).map(i => ({ id: Number(i.id), at: String(i.at), note: String(i.note) })),
    }
  }).filter(c => (!filter.kind || c.kind === filter.kind)
    && (!filter.logementId || c.all || c.logementIds.includes(filter.logementId))
    && (!q || [c.name, c.company, c.email, c.phone, c.phone2, c.note, c.kindLabel].some(v => v.toLowerCase().includes(q))))
}

export async function saveLinks(contactId: number, logementIds: number[]) {
  const db = useDatabase()
  const valid = (await ensureLogements()).map(l => l.id)
  if (logementIds.some(i => !valid.includes(i))) throw bad('Logement inconnu')
  await db.sql`DELETE FROM contact_logement WHERE contact_id = ${contactId}`
  for (const i of logementIds) await db.sql`INSERT OR IGNORE INTO contact_logement (contact_id, logement_id) VALUES (${contactId}, ${i})`
}
