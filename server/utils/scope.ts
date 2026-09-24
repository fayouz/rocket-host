// Perimetre : quels logements un compte peut-il voir ? (administrateur = tous). Les verifications se font cote serveur, jamais seulement dans l'interface.
import type { H3Event } from 'h3'
import type { AuthUser } from './auth'

// null = tous les logements (administrateur) ; sinon l'ensemble des ids de logements autorises
export async function allowedLogementIds(user: AuthUser): Promise<Set<number> | null> {
  if (user.role === 'admin') return null
  const rows = (await useDatabase().sql`SELECT logement_id FROM user_logement WHERE user_id = ${user.id}`).rows as any[]
  return new Set(rows.map(r => Number(r.logement_id)))
}

export async function scopeOf(event: H3Event): Promise<Set<number> | null> {
  const user = await currentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Connexion requise' })
  return allowedLogementIds(user)
}

export async function assertLogement(event: H3Event, logementId: number) {
  const scope = await scopeOf(event)
  if (scope && !scope.has(Number(logementId))) throw createError({ statusCode: 403, statusMessage: 'Accès refusé à ce logement' })
}

// Identifiants Lodgify (propertyId) des logements autorises, pour filtrer les donnees Lodgify ; null = tous
export async function allowedPropertyIds(event: H3Event): Promise<Set<number> | null> {
  const scope = await scopeOf(event)
  if (!scope) return null
  const all = await ensureLogements()
  return new Set(all.filter(l => scope.has(l.id) && l.lodgifyPropertyId !== null).map(l => l.lodgifyPropertyId as number))
}

// Comme allowedPropertyIds, mais croise en plus avec le filtre optionnel ?properties=1,2 (selecteur de logements du
// tableau de bord) : le filtre choisi cote client ne peut que restreindre le perimetre deja autorise, jamais l'elargir.
export async function effectivePropertyIds(event: H3Event): Promise<Set<number> | null> {
  const allowed = await allowedPropertyIds(event)
  const q = getQuery(event).properties
  const selected = typeof q === 'string' && q.trim() ? new Set(q.split(',').map(Number).filter(Number.isFinite)) : null
  if (!selected) return allowed
  if (!allowed) return selected
  return new Set([...allowed].filter(id => selected.has(id)))
}

// Logement auquel appartient une ressource (undefined = introuvable ou non rattachee : refusee aux non-administrateurs)
export async function logementOf(kind: 'logement' | 'document' | 'node' | 'booking', id: string): Promise<number | undefined> {
  const n = Number(id)
  if (!Number.isInteger(n)) return undefined
  const db = useDatabase()
  if (kind === 'logement') return n
  if (kind === 'document') { const r = ((await db.sql`SELECT logement_id FROM fs_node WHERE id = ${n} AND kind = 'file'`).rows as any[])[0]; return r && Number(r.logement_id) > 0 ? Number(r.logement_id) : undefined }
  if (kind === 'node') { const r = ((await db.sql`SELECT logement_id FROM fs_node WHERE id = ${n}`).rows as any[])[0]; return r ? Number(r.logement_id) : undefined }
  // reservation -> code -> serrure -> logement Lodgify -> logement
  const r = ((await db.sql`SELECT l.id AS id FROM access_code a JOIN lock_link k ON k.lock_id = a.lock_id JOIN logement l ON l.lodgify_property_id = k.property_id WHERE a.booking_id = ${n}`).rows as any[])[0]
  return r ? Number(r.id) : undefined
}
export async function logementOfProperty(propertyId: number): Promise<number | undefined> {
  const r = ((await useDatabase().sql`SELECT id FROM logement WHERE lodgify_property_id = ${propertyId}`).rows as any[])[0]
  return r ? Number(r.id) : undefined
}
