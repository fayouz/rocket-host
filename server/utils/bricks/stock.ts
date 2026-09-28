// Client direct Rocket Stock (ROCKET_STOCK_URL / ROCKET_STOCK_TOKEN), lecture seule : niveaux d'un lieu, consommation.
import { asList, brickGet, type BrickConfig } from './http.ts'

export async function stockLow(cfg: BrickConfig, placeId: string): Promise<{ name: string; level: string }[]> {
  return asList(await brickGet('stock', cfg, `/api/places/${encodeURIComponent(placeId)}/stock`))
    .filter((l: any) => l.level === 'low' || l.level === 'empty')
    .map((l: any) => ({ name: String(l.itemName || l.name || ''), level: String(l.level) }))
}

// GET /api/export/consumption?usage=rental&from=&to= : cout de la consommation location (tous lieux)
export async function stockRentalConsumption(cfg: BrickConfig, from: string, to: string): Promise<{ totalCost: number; items: number }> {
  const r = await brickGet('stock', cfg, `/api/export/consumption?usage=rental&from=${from}&to=${to}`)
  return { totalCost: Number(r?.totalCost) || 0, items: asList(r).length }
}
