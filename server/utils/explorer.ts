// Explorateur de fichiers (menu Documents) : arborescence de dossiers et fichiers par logement, table fs_node.
// Les fichiers passent par saveFile (types et contenu verifies, nom stocke genere). Un nom d'affichage n'est jamais un chemin.
export const MAX_DEPTH = 12
export const MAX_NAME = 120

export interface FsRow { id: number; logement_id: number; parent_id: number | null; kind: 'folder' | 'file'; name: string; file_path: string | null; mime: string | null; size: number; created_at: string; updated_at: string }

// Nom de dossier / fichier : pas de separateur ni de caracteres de controle, ni « . » / « .. »
export function checkName(raw: unknown) {
  const n = String(raw ?? '').replace(/\p{Cc}/gu, '').trim()
  if (!n || n === '.' || n === '..' || /[\\/]/.test(n)) throw createError({ statusCode: 400, statusMessage: 'Nom invalide (pas de « / », ni vide)' })
  if (n.length > MAX_NAME) throw createError({ statusCode: 400, statusMessage: `Nom trop long (${MAX_NAME} caractères au plus)` })
  return n
}

export const nodeFromRow = (r: any) => ({
  id: Number(r.id), kind: String(r.kind) as 'folder' | 'file', name: String(r.name), size: Number(r.size),
  updatedAt: String(r.updated_at), createdAt: String(r.created_at), parentId: r.parent_id === null ? null : Number(r.parent_id),
  logementId: Number(r.logement_id),
  ext: r.kind === 'file' ? (String(r.name).split('.').pop() || '').toLowerCase() : '',
  inline: r.kind === 'file' && !!r.file_path && isInline(String(r.file_path)),
})

export async function getNode(idParam: unknown): Promise<FsRow> {
  const id = Number(idParam)
  const row = Number.isInteger(id) ? ((await useDatabase().sql`SELECT * FROM fs_node WHERE id = ${id}`).rows as any[])[0] : undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Élément introuvable' })
  return row as FsRow
}

// Dossier parent valide dans ce logement (null = racine du logement) ; renvoie sa profondeur (racine = 0)
export async function checkParent(logementId: number, parentId: number | null) {
  if (parentId === null) return 0
  const p = await getNode(parentId)
  if (p.kind !== 'folder' || Number(p.logement_id) !== logementId) throw createError({ statusCode: 400, statusMessage: 'Dossier de destination invalide' })
  return (await ancestors(p)).length
}

// Chemin depuis la racine jusqu'au dossier (inclus)
export async function ancestors(node: FsRow): Promise<FsRow[]> {
  const chain: FsRow[] = []
  let cur: FsRow | undefined = node
  const db = useDatabase()
  while (cur && chain.length <= MAX_DEPTH + 1) {
    chain.unshift(cur)
    cur = cur.parent_id === null ? undefined : ((await db.sql`SELECT * FROM fs_node WHERE id = ${Number(cur.parent_id)}`).rows as any[])[0]
  }
  return chain
}

// Tous les descendants (recursif) d'un dossier
export async function descendants(id: number): Promise<FsRow[]> {
  // prepare().all() : le connecteur ne reconnait pas « WITH » comme une lecture avec le modele sql``
  return (await useDatabase().prepare(`WITH RECURSIVE t(id) AS (SELECT id FROM fs_node WHERE parent_id = ? UNION ALL SELECT n.id FROM fs_node n JOIN t ON n.parent_id = t.id)
    SELECT * FROM fs_node WHERE id IN (SELECT id FROM t)`).all(id)) as FsRow[]
}

const sameSpot = (parentId: number | null) => parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'

export async function nameTaken(logementId: number, parentId: number | null, name: string, exceptId = 0) {
  const db = useDatabase()
  const stmt = db.prepare(`SELECT 1 FROM fs_node WHERE logement_id = ? AND ${sameSpot(parentId)} AND lower(name) = lower(?) AND id != ? LIMIT 1`)
  const args = parentId === null ? [logementId, name, exceptId] : [logementId, parentId, name, exceptId]
  return !!(await stmt.get(...args))
}

// « rapport.pdf » deja pris -> « rapport 2.pdf » (comme le Finder)
export async function freeName(logementId: number, parentId: number | null, name: string) {
  if (!(await nameTaken(logementId, parentId, name))) return name
  const dot = name.lastIndexOf('.')
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let i = 2; i < 500; i++) {
    const cand = `${base.slice(0, MAX_NAME - ext.length - 6)} ${i}${ext}`
    if (!(await nameTaken(logementId, parentId, cand))) return cand
  }
  throw createError({ statusCode: 409, statusMessage: 'Trop de doublons de ce nom' })
}

// --- Etiquettes ---
export const TAG_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'gray'] as const
export const MAX_TAG_NAME = 30
export interface Tag { id: number; name: string; color: string }

export function checkTagName(raw: unknown) {
  const n = String(raw ?? '').replace(/\p{Cc}/gu, '').trim()
  if (!n) throw createError({ statusCode: 400, statusMessage: 'Nom d\'étiquette requis' })
  if (n.length > MAX_TAG_NAME) throw createError({ statusCode: 400, statusMessage: `Nom trop long (${MAX_TAG_NAME} caractères au plus)` })
  return n
}
export function checkTagColor(raw: unknown) {
  const c = String(raw ?? 'blue')
  if (!(TAG_COLORS as readonly string[]).includes(c)) throw createError({ statusCode: 400, statusMessage: 'Couleur invalide' })
  return c
}

// Etiquettes de chaque element de la liste (une seule requete)
export async function attachTags<T extends { id: number; kind: string }>(items: T[]): Promise<(T & { tags: Tag[] })[]> {
  const ids = items.filter(i => i.kind !== 'logement').map(i => i.id)
  const byNode = new Map<number, Tag[]>()
  if (ids.length) {
    const rows = (await useDatabase().prepare(`SELECT nt.node_id, t.id, t.name, t.color FROM fs_node_tag nt JOIN fs_tag t ON t.id = nt.tag_id
      WHERE nt.node_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.name`).all(...ids)) as any[]
    for (const r of rows) byNode.set(Number(r.node_id), [...(byNode.get(Number(r.node_id)) ?? []), { id: Number(r.id), name: String(r.name), color: String(r.color) }])
  }
  return items.map(i => ({ ...i, tags: i.kind === 'logement' ? [] : (byNode.get(i.id) ?? []) }))
}

export async function getTag(idParam: unknown): Promise<Tag> {
  const id = Number(idParam)
  const r = Number.isInteger(id) ? ((await useDatabase().sql`SELECT * FROM fs_tag WHERE id = ${id}`).rows as any[])[0] : undefined
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Étiquette introuvable' })
  return { id: Number(r.id), name: String(r.name), color: String(r.color) }
}

// Doublon insensible a la casse ET aux accents de majuscules (SQLite NOCASE ne gere que l'ASCII, d'ou la comparaison ici)
export async function tagNameTaken(name: string, exceptId = 0) {
  const norm = (v: string) => v.toLocaleLowerCase('fr')
  const rows = (await useDatabase().sql`SELECT id, name FROM fs_tag`).rows as any[]
  return rows.some(r => Number(r.id) !== exceptId && norm(String(r.name)) === norm(name))
}
