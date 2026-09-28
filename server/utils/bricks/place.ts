// Client direct Rocket Place (ROCKET_PLACE_URL / ROCKET_PLACE_TOKEN), lecture seule : acces (codes) d'un lieu.
import { asList, brickGet, type BrickConfig } from './http.ts'

export interface PlaceGrant { id: string; status: string; error: string | null; externalRef: string | null; validFrom: string | null }

export async function placeAccessGrants(cfg: BrickConfig, placeId: string): Promise<PlaceGrant[]> {
  return asList(await brickGet('place', cfg, `/api/places/${encodeURIComponent(placeId)}/access-grants`)).map((g: any) => ({
    id: String(g.id), status: String(g.status || ''), error: g.error ? String(g.error) : null,
    externalRef: g.externalRef ? String(g.externalRef) : null, validFrom: g.validFrom ? String(g.validFrom) : null,
  }))
}
