// Stock de consommables par logement : niveaux OK / Bas / Vide saisis par la personne qui fait le menage (lien secret / QR code).
import { randomBytes } from 'node:crypto'

export const LEVELS = ['ok', 'low', 'empty'] as const
export type Level = (typeof LEVELS)[number]
export const isLevel = (v: unknown): v is Level => LEVELS.includes(v as Level)
export const isToken = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v)

// Cree, si besoin, le lien secret de chaque logement. A la premiere visite d'un logement (jamais initialise), tous les articles
// du catalogue lui sont proposes ; ensuite il choisit lui-meme les articles suivis (une ligne stock_level = un article suivi).
export async function ensureStock() {
  const db = useDatabase()
  const { properties } = await loadData()
  const items = (await db.sql`SELECT id FROM stock_item`).rows as unknown as { id: number }[]
  const inited = new Set(((await db.sql`SELECT property_id FROM stock_init`).rows as any[]).map(r => Number(r.property_id)))
  const withRows = new Set(((await db.sql`SELECT DISTINCT property_id FROM stock_level`).rows as any[]).map(r => Number(r.property_id)))
  const now = new Date().toISOString()
  for (const p of properties) {
    await db.sql`INSERT OR IGNORE INTO property_token (property_id, token) VALUES (${p.id}, ${randomBytes(16).toString('hex')})`
    if (inited.has(p.id)) continue
    if (!withRows.has(p.id)) for (const it of items) await db.sql`INSERT OR IGNORE INTO stock_level (property_id, item_id, level, updated_at) VALUES (${p.id}, ${Number(it.id)}, 'ok', ${now})`
    await db.sql`INSERT OR IGNORE INTO stock_init (property_id) VALUES (${p.id})`
  }
  return properties
}

// Suit (ou ne suit plus) un article pour un logement Lodgify. Ne plus le suivre supprime son niveau.
export async function setTracked(propertyId: number, itemId: number, tracked: boolean) {
  const db = useDatabase()
  if (tracked) await db.sql`INSERT OR IGNORE INTO stock_level (property_id, item_id, level, updated_at) VALUES (${propertyId}, ${itemId}, 'ok', ${new Date().toISOString()})`
  else await db.sql`DELETE FROM stock_level WHERE property_id = ${propertyId} AND item_id = ${itemId}`
}

export async function propertyByToken(token: string) {
  const row = ((await useDatabase().sql`SELECT property_id FROM property_token WHERE token = ${token}`).rows as any[])[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const propertyId = Number(row.property_id)
  const { properties } = await loadData()
  return { propertyId, name: properties.find(p => p.id === propertyId)?.name ?? `Logement ${propertyId}` }
}

export async function setLevel(propertyId: number, itemId: number, level: Level) {
  await useDatabase().sql`UPDATE stock_level SET level = ${level}, updated_at = ${new Date().toISOString()} WHERE property_id = ${propertyId} AND item_id = ${itemId}`
}

// Lien "panier pre-rempli" Amazon : ASIN + quantite. A ouvrir puis valider a la main.
export function amazonCartUrl(lines: { asin: string; qty: number }[]) {
  const l = lines.filter(x => x.asin)
  if (!l.length) return null
  return 'https://www.amazon.fr/gp/aws/cart/add.html?' + l.map((x, i) => `ASIN.${i + 1}=${encodeURIComponent(x.asin)}&Quantity.${i + 1}=${x.qty}`).join('&')
}

// ids : filtre optionnel sur les logements (selecteur du tableau de bord) — n'affecte que les logements et le
// reassort affiches, pas le catalogue (`items[].propertyIds` reste global, utilise par la page Réglages > Stock)
export async function buildStock(ids?: Set<number> | null) {
  const db = useDatabase()
  const allProperties = await ensureStock()
  const properties = ids ? allProperties.filter(p => ids.has(p.id)) : allProperties
  const items = (await db.sql`SELECT * FROM stock_item ORDER BY id`).rows as any[]
  const levels = (await db.sql`SELECT * FROM stock_level`).rows as any[]
  const tokens = (await db.sql`SELECT * FROM property_token`).rows as any[]

  const shopping = items.map((it) => {
    const needing = levels.filter(l => Number(l.item_id) === Number(it.id) && l.level !== 'ok' && (!ids || ids.has(Number(l.property_id))))
      .map(l => ({ property: allProperties.find(p => p.id === Number(l.property_id))?.name ?? `Logement ${l.property_id}`, level: l.level as Level, propertyId: Number(l.property_id) }))
    return { itemId: Number(it.id), name: String(it.name), asin: String(it.asin), subscription: !!Number(it.subscription), qty: Number(it.reorder_qty) * needing.length, needing }
  }).filter(x => x.needing.length)

  return {
    items: items.map(it => ({
      id: Number(it.id), name: String(it.name), asin: String(it.asin), reorderQty: Number(it.reorder_qty), subscription: !!Number(it.subscription),
      propertyIds: levels.filter(l => Number(l.item_id) === Number(it.id)).map(l => Number(l.property_id)), // logements qui suivent cet article
    })),
    properties: properties.map(p => ({
      id: p.id, name: p.name, token: String(tokens.find(t => Number(t.property_id) === p.id)?.token ?? ''),
      levels: Object.fromEntries(levels.filter(l => Number(l.property_id) === p.id).map(l => [Number(l.item_id), l.level as Level])),
    })),
    shopping,
    // Les articles en abonnement Amazon sont deja automatiques : exclus du panier
    amazonUrl: amazonCartUrl(shopping.filter(x => !x.subscription).map(x => ({ asin: x.asin, qty: x.qty }))),
  }
}
