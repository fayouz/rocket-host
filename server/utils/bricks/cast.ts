// Client direct Rocket Cast (ROCKET_CAST_URL / ROCKET_CAST_TOKEN), lecture seule : ecrans et leur presence.
import { asList, brickGet, type BrickConfig } from './http.ts'

export interface CastScreen { id: string; name: string; location: string; enabled: boolean; online: boolean; lastSeenAt: string | null }

export async function castScreens(cfg: BrickConfig): Promise<CastScreen[]> {
  return asList(await brickGet('cast', cfg, '/api/screens')).map((s: any) => ({
    id: String(s.id), name: String(s.name || ''), location: String(s.location || ''), enabled: s.enabled !== false,
    online: !!s.online, lastSeenAt: s.lastSeenAt ? String(s.lastSeenAt) : null,
  }))
}

// Cast ne connait pas les lieux : un ecran est rattache a un logement si son champ « location » (ou son nom) contient
// l'uuid du lieu Rocket Place, l'uuid du logement PMS ou le nom du logement (insensible a la casse).
export function screensFor(screens: CastScreen[], keys: { placeId: string | null; propertyId: string; name: string }): CastScreen[] {
  const ids = [keys.placeId, keys.propertyId].filter(Boolean).map(s => s!.toLowerCase())
  const name = keys.name.trim().toLowerCase()
  return screens.filter((s) => {
    const hay = `${s.location} ${s.name}`.toLowerCase()
    return ids.some(id => hay.includes(id)) || (name.length >= 3 && hay.includes(name))
  })
}
