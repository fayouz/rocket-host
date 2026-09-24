// Fichiers des logements (explorateur, table fs_node) : fichiers sur disque dans .data/documents/<logement>/<uuid>.<ext>.
// Chaque fichier peut avoir un type (CATEGORIES) ; les types comptables (charge / recette) alimentent le Bilan.
// Le nom du fichier stocke est genere ici : jamais un nom ou un chemin fourni par l'utilisateur.
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

// Types de fichier. kind : charge (compte dans le bilan), recette (autre recette hors Lodgify), doc (simple repere, non compte)
export const CATEGORIES = {
  taxe_fonciere: { label: 'Taxe foncière', kind: 'charge' },
  assurance: { label: 'Assurance', kind: 'charge' },
  copropriete: { label: 'Copropriété / charges', kind: 'charge' },
  travaux: { label: 'Travaux et entretien', kind: 'charge' },
  energie: { label: 'Énergie et eau', kind: 'charge' },
  abonnements: { label: 'Internet et abonnements', kind: 'charge' },
  menage_linge: { label: 'Ménage et linge', kind: 'charge' },
  consommables: { label: 'Consommables et achats', kind: 'charge' },
  frais_plateformes: { label: 'Frais de plateformes', kind: 'charge' },
  comptabilite: { label: 'Comptabilité et frais bancaires', kind: 'charge' },
  autre_charge: { label: 'Autre charge', kind: 'charge' },
  autre_recette: { label: 'Autre recette (hors Lodgify)', kind: 'recette' },
  reversement: { label: 'Reversement de plateforme', kind: 'doc' },
  bail_contrat: { label: 'Contrat / bail', kind: 'doc' },
  diagnostic: { label: 'Diagnostic / attestation', kind: 'doc' },
  photo: { label: 'Photo', kind: 'doc' },
  notice: { label: 'Notice / mode d\'emploi', kind: 'doc' },
  autre_doc: { label: 'Autre document', kind: 'doc' },
} as const
export type CategoryKey = keyof typeof CATEGORIES
export const isCategory = (v: unknown): v is CategoryKey => typeof v === 'string' && v in CATEGORIES

export const MAX_SIZE = 15 * 1024 * 1024 // 15 Mo
// Types acceptes (par extension) ; le type servi est celui d'ici, jamais celui envoye par le navigateur
const TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  csv: 'text/csv', txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
const INLINE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']) // affichables dans le navigateur ; le reste est telecharge

export const docsRoot = () => resolve(process.cwd(), '.data', 'documents')

// Chemin absolu d'un fichier stocke, en refusant toute sortie de .data/documents
export function absPath(rel: string) {
  const root = docsRoot()
  const abs = resolve(root, rel)
  if (!abs.startsWith(root + sep)) throw createError({ statusCode: 400, statusMessage: 'Chemin invalide' })
  return abs
}

const startsWith = (buf: Buffer, bytes: number[], at = 0) => bytes.every((b, i) => buf[at + i] === b)
// Verifie que le contenu correspond a l'extension pour les formats courants (un .pdf qui n'en est pas un est refuse)
function magicOk(ext: string, buf: Buffer) {
  if (ext === 'pdf') return startsWith(buf, [0x25, 0x50, 0x44, 0x46])
  if (ext === 'png') return startsWith(buf, [0x89, 0x50, 0x4e, 0x47])
  if (ext === 'jpg' || ext === 'jpeg') return startsWith(buf, [0xff, 0xd8, 0xff])
  if (ext === 'webp') return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  if (ext === 'xlsx' || ext === 'docx') return startsWith(buf, [0x50, 0x4b, 0x03, 0x04])
  return true
}

// Nom d'affichage : sans chemin ni caracteres de controle (\p{Cc}), 120 caracteres au plus
export const cleanName = (n: string) => n.replace(/[\\/]+/g, '_').replace(/\p{Cc}/gu, '').trim().slice(0, 120) || 'document'

export async function saveFile(logementId: number, filename: string, data: Buffer) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (!TYPES[ext]) throw createError({ statusCode: 400, statusMessage: `Type de fichier non accepté (.${ext || '?'}). Acceptés : ${Object.keys(TYPES).join(', ')}` })
  if (!data.length) throw createError({ statusCode: 400, statusMessage: 'Fichier vide' })
  if (data.length > MAX_SIZE) throw createError({ statusCode: 413, statusMessage: 'Fichier trop volumineux (15 Mo maximum)' })
  if (!magicOk(ext, data)) throw createError({ statusCode: 400, statusMessage: `Le contenu ne correspond pas à un fichier .${ext}` })
  const rel = `${logementId}/${randomUUID()}.${ext}`
  const abs = absPath(rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data, { flag: 'wx' })
  return { rel, mime: TYPES[ext]!, ext, size: data.length, original: cleanName(filename) }
}

export async function removeFile(rel: string) {
  try { await unlink(absPath(rel)) } catch (e: any) { if (e?.code !== 'ENOENT') throw e }
}

export const isInline = (rel: string) => INLINE.has(rel.split('.').pop() || '')

// Type et donnees comptables d'un fichier (modification partielle : seuls les champs presents sont valides et renvoyes).
// fileType '' = sans type ; date/amount vides = null.
export function parseMeta(b: Record<string, unknown>) {
  const out: { fileType?: CategoryKey | ''; date?: string | null; amount?: number | null; note?: string } = {}
  if (b.fileType !== undefined) {
    if (b.fileType !== '' && !isCategory(b.fileType)) throw createError({ statusCode: 400, statusMessage: 'Type de fichier invalide' })
    out.fileType = b.fileType as CategoryKey | ''
  }
  if (b.date !== undefined) {
    const d = String(b.date ?? '').trim()
    if (!d) out.date = null
    else {
      const y = Number(d.slice(0, 4))
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)) || y < 2000 || y > 2100) throw createError({ statusCode: 400, statusMessage: 'Date invalide (AAAA-MM-JJ)' })
      out.date = d
    }
  }
  if (b.amount !== undefined) {
    const raw = String(b.amount ?? '').trim().replace(',', '.')
    if (raw === '') out.amount = null
    else {
      const n = Number(raw)
      if (!Number.isFinite(n) || Math.abs(n) > 10_000_000) throw createError({ statusCode: 400, statusMessage: 'Montant invalide' })
      out.amount = Math.round(n * 100) / 100
    }
  }
  if (b.note !== undefined) out.note = String(b.note ?? '').trim().slice(0, 500)
  return out
}

// Charges (fichiers de type kind='charge') totalisees par mois, tous logements confondus — pour le graphe
// revenus/charges du tableau de bord. Approximation volontairement simple (pas la substitution frais-de-plateforme
// du Bilan par logement, voir buildBilan) : suffisante pour une tendance, pas pour un chiffre exact par logement.
const CHARGE_CATEGORIES = Object.entries(CATEGORIES).filter(([, c]) => c.kind === 'charge').map(([k]) => k)
export async function getChargesByMonth(months: string[], logementIds?: number[]): Promise<Record<string, number>> {
  if (!months.length) return {}
  const db = useDatabase()
  const placeholders = CHARGE_CATEGORIES.map(() => '?').join(',')
  const logementFilter = logementIds ? ` AND logement_id IN (${logementIds.map(() => '?').join(',')})` : ''
  const rows = (await db.prepare(
    `SELECT substr(doc_date, 1, 7) AS m, SUM(amount) AS total FROM fs_node
     WHERE kind = 'file' AND logement_id > 0 AND amount IS NOT NULL AND doc_date IS NOT NULL AND file_type IN (${placeholders})${logementFilter} GROUP BY m`,
  ).all(...CHARGE_CATEGORIES, ...(logementIds ?? []))) as any[]
  const byMonth = Object.fromEntries(rows.map(r => [String(r.m), Number(r.total)]))
  return Object.fromEntries(months.map(m => [m, Math.round((byMonth[m] ?? 0) * 100) / 100]))
}

// Type d'un fichier -> libelle et nature ('' = sans type)
export function typeInfo(t: unknown) {
  return isCategory(t) ? { label: CATEGORIES[t].label as string, kind: CATEGORIES[t].kind as 'charge' | 'recette' | 'doc' } : { label: '', kind: '' as const }
}
export const ACCOUNTING_KINDS = new Set(['charge', 'recette'])

// Fichier (ligne fs_node) -> piece renvoyee au navigateur pour les Imports et l'export (jamais le chemin sur le disque)
export function docFromRow(r: any) {
  const t = typeInfo(r.file_type)
  return {
    id: Number(r.id), title: String(r.name).replace(/\.[^.]+$/, ''), category: String(r.file_type), categoryLabel: t.label || 'Sans type', kind: t.kind,
    date: r.doc_date ? String(r.doc_date) : '', amount: r.amount === null || r.amount === undefined ? null : Number(r.amount), note: String(r.note ?? ''),
    fileName: String(r.name), size: Number(r.size), inline: !!r.file_path && isInline(String(r.file_path)),
    source: String(r.source ?? 'manuel'), logementId: Number(r.logement_id),
  }
}
