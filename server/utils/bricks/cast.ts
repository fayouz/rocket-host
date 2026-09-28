// Client direct Rocket Cast (ROCKET_CAST_URL / ROCKET_CAST_TOKEN), lecture seule : ecrans et leur presence.
import { asList, brickGet, type BrickConfig } from './http.ts'

export interface CastScreen { id: string; name: string; location: string; placeId: string | null; enabled: boolean; online: boolean; lastSeenAt: string | null }

export async function castScreens(cfg: BrickConfig): Promise<CastScreen[]> {
  return asList(await brickGet('cast', cfg, '/api/screens')).map((s: any) => ({
    id: String(s.id), name: String(s.name || ''), location: String(s.location || ''),
    placeId: typeof s.placeId === 'string' && s.placeId ? s.placeId.toLowerCase() : null, enabled: s.enabled !== false,
    online: !!s.online, lastSeenAt: s.lastSeenAt ? String(s.lastSeenAt) : null,
  }))
}

// Ecrans d'un logement : ceux dont le lieu Rocket Place (placeId, Rocket Cast >= 0.2) est celui du logement. Repli pour
// les ecrans sans placeId (ancien Cast ou ecran non rattache) : champ « location » (ou nom) contenant l'uuid du lieu,
// l'uuid du logement PMS ou le nom du logement (insensible a la casse). Un ecran rattache a un autre lieu ne compte jamais.
export function screensFor(screens: CastScreen[], keys: { placeId: string | null; propertyId: string; name: string }): CastScreen[] {
  const place = keys.placeId?.toLowerCase() || null
  const linked = place ? screens.filter(s => s.placeId === place) : []
  if (linked.length) return linked
  const ids = [keys.placeId, keys.propertyId].filter(Boolean).map(s => s!.toLowerCase())
  const name = keys.name.trim().toLowerCase()
  return screens.filter((s) => {
    if (s.placeId) return false
    const hay = `${s.location} ${s.name}`.toLowerCase()
    return ids.some(id => hay.includes(id)) || (name.length >= 3 && hay.includes(name))
  })
}
