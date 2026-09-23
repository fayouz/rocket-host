// Logements de l'appli : chacun est associe a un logement Lodgify (lodgify_property_id). Crees automatiquement pour chaque
// logement Lodgify encore sans logement ; renommables sans toucher a Lodgify.
export interface Logement { id: number; name: string; lodgifyPropertyId: number | null; lodgifyName: string | null; lodgifyShortName: string | null; latitude: number | null; longitude: number | null }

export async function ensureLogements(): Promise<Logement[]> {
  const db = useDatabase()
  const { properties } = await loadData()
  const known = (await db.sql`SELECT lodgify_property_id FROM logement`).rows as any[]
  const legacy = (await db.sql`SELECT property_id, alias FROM property_alias`).rows as any[]
  for (const p of properties) {
    if (known.some(r => Number(r.lodgify_property_id) === p.id)) continue
    const alias = legacy.find(a => Number(a.property_id) === p.id)?.alias
    await db.sql`INSERT OR IGNORE INTO logement (name, lodgify_property_id) VALUES (${String(alias || p.original || p.name)}, ${p.id})`
  }
  const rows = (await db.sql`SELECT * FROM logement ORDER BY id`).rows as any[]
  return rows.map(r => ({
    id: Number(r.id), name: String(r.name),
    lodgifyPropertyId: r.lodgify_property_id === null ? null : Number(r.lodgify_property_id),
    lodgifyName: properties.find(p => p.id === Number(r.lodgify_property_id))?.original ?? null,
    // Nom court saisi dans Lodgify (champ « nom interne »), ex. « Le ponant »
    lodgifyShortName: properties.find(p => p.id === Number(r.lodgify_property_id))?.internalName ?? null,
    latitude: properties.find(p => p.id === Number(r.lodgify_property_id))?.latitude ?? null,
    longitude: properties.find(p => p.id === Number(r.lodgify_property_id))?.longitude ?? null,
  }))
}

export async function getLogement(idParam: unknown): Promise<Logement> {
  const id = Number(idParam)
  const found = Number.isInteger(id) ? (await ensureLogements()).find(l => l.id === id) : undefined
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Logement inconnu' })
  return found
}

export async function renameLogement(id: number, name: string) {
  const clean = name.trim().slice(0, 80)
  if (!clean) throw createError({ statusCode: 400, statusMessage: 'Nom requis' })
  await useDatabase().sql`UPDATE logement SET name = ${clean} WHERE id = ${id}`
}

// Reprend le nom court de Lodgify (nom interne) comme nom du logement
export async function syncLogementName(id: number) {
  const lg = (await ensureLogements()).find(l => l.id === id)
  if (!lg) throw createError({ statusCode: 404, statusMessage: 'Logement inconnu' })
  if (!lg.lodgifyShortName) throw createError({ statusCode: 400, statusMessage: 'Pas de nom court (nom interne) renseigné dans Lodgify pour ce logement' })
  await renameLogement(id, lg.lodgifyShortName)
  return lg.lodgifyShortName
}
