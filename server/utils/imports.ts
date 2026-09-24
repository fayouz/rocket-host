// Import de documents et de lignes de releves depuis l'exterieur (workflows n8n, lecture IMAP...).
// Une "source" est un identifiant court de provenance (airbnb, booking, lodgify, edf, imap-...).
import { createHash } from 'node:crypto'

export const isSource = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{1,29}$/.test(v)
export const TX_KINDS = ['payout', 'fee', 'tourist_tax', 'refund', 'other'] as const // reversement, commission, taxe de sejour, remboursement
export type TxKind = (typeof TX_KINDS)[number]

const norm = (s: string) => s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim()

export async function logImport(source: string, type: 'document' | 'transactions' | 'imap', status: 'ok' | 'duplicate' | 'error', detail = '') {
  const db = useDatabase()
  await db.sql`INSERT INTO import_log (at, source, type, status, detail) VALUES (${new Date().toISOString()}, ${source}, ${type}, ${status}, ${detail.slice(0, 300)})`
  await db.sql`DELETE FROM import_log WHERE id NOT IN (SELECT id FROM import_log ORDER BY id DESC LIMIT 500)` // journal borne a 500 lignes
}

// Logement cible : par id du logement, id Lodgify ou nom. Sans indication ou nom non reconnu : 0 = "a classer" (affecte plus tard).
export async function resolveLogement(i: { logementId?: unknown; lodgifyPropertyId?: unknown; property?: unknown }): Promise<{ id: number; note?: string }> {
  const list = await ensureLogements()
  const given = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== ''
  if (given(i.logementId)) {
    const id = Number(i.logementId)
    if (id === 0) return { id: 0 }
    if (!list.some(l => l.id === id)) throw createError({ statusCode: 400, statusMessage: `Logement inconnu : ${i.logementId}` })
    return { id }
  }
  if (given(i.lodgifyPropertyId)) {
    const found = list.find(l => l.lodgifyPropertyId === Number(i.lodgifyPropertyId))
    if (!found) throw createError({ statusCode: 400, statusMessage: `Logement Lodgify inconnu : ${i.lodgifyPropertyId}` })
    return { id: found.id }
  }
  if (given(i.property)) {
    const q = norm(String(i.property))
    const hits = list.filter(l => [l.name, l.lodgifyName, l.lodgifyShortName].some(n => n && (norm(n).includes(q) || q.includes(norm(n)))))
    if (hits.length === 1) return { id: hits[0]!.id }
    return { id: 0, note: hits.length ? `logement ambigu : « ${i.property} »` : `logement non reconnu : « ${i.property} »` }
  }
  return { id: 0 }
}

export interface ImportDocInput {
  source: string; externalId?: string; logementId: number; parentId?: number | null; filename: string; data: Buffer
  title?: string; category?: unknown; date?: unknown; amount?: unknown; note?: unknown
}

// Depose un fichier importe dans l'explorateur (racine du logement ; logement 0 = « a classer »), avec son type et ses
// donnees comptables. Sans doublon : meme (source, externalId), ou meme contenu deja present, renvoie l'existant.
export async function importDocument(i: ImportDocInput) {
  const db = useDatabase()
  if (!isSource(i.source)) throw createError({ statusCode: 400, statusMessage: 'source invalide (2 à 30 caractères : a-z, 0-9, - ou _)' })
  const externalId = i.externalId?.trim().slice(0, 200) || null
  const sha = createHash('sha256').update(i.data).digest('hex')

  const m = parseMeta({
    fileType: i.category ?? 'autre_doc',
    date: i.date || new Date().toISOString().slice(0, 10),
    amount: i.amount, note: i.note,
  })
  const dup = async (where: 'ext' | 'sha') => (where === 'ext'
    ? (await db.sql`SELECT id, logement_id FROM fs_node WHERE source = ${i.source} AND external_id = ${externalId}`).rows
    : (await db.sql`SELECT id, logement_id FROM fs_node WHERE kind = 'file' AND sha256 = ${sha}`).rows) as any[]
  const existing = (externalId ? await dup('ext') : [])[0] ?? (await dup('sha'))[0]
  if (existing) {
    await logImport(i.source, 'document', 'duplicate', `${i.filename} (déjà importé, n°${existing.id})`)
    return { status: 'duplicate' as const, id: Number(existing.id), logementId: Number(existing.logement_id) }
  }

  const saved = await saveFile(i.logementId, i.filename, i.data)
  let id: number
  try {
    // Nom affiche : le titre fourni (sinon le nom du fichier) + l'extension reelle ; « nom 2.ext » si deja pris
    const title = cleanName(i.title?.trim() || i.filename.replace(/\.[^.]+$/, '')).replace(/\.[^.]+$/, '')
    const name = await freeName(i.logementId, i.parentId ?? null, checkName(`${title}.${saved.ext}`))
    const now = new Date().toISOString()
    const r = await db.sql`INSERT INTO fs_node (logement_id, parent_id, kind, name, file_path, mime, size, created_at, updated_at, file_type, doc_date, amount, note, source, external_id, sha256)
      VALUES (${i.logementId}, ${i.parentId ?? null}, 'file', ${name}, ${saved.rel}, ${saved.mime}, ${saved.size}, ${now}, ${now}, ${m.fileType ?? ''}, ${m.date ?? null}, ${m.amount ?? null}, ${m.note ?? ''}, ${i.source}, ${externalId}, ${sha})`
    id = Number(r.lastInsertRowid)
  } catch (e) { await removeFile(saved.rel); throw e }
  await logImport(i.source, 'document', 'ok', `${saved.original} → ${i.logementId ? `logement ${i.logementId}` : 'à classer'}`)
  return { status: 'ok' as const, id, logementId: i.logementId }
}
