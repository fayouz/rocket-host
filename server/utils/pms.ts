// Client pour l'API Rocket PMS (fayouz/rocket-pms), optionnel : actif seulement si PMS_API_URL est renseigne dans .env.
// Tant qu'il est absent, l'appli fonctionne exactement comme avant (Lodgify + Nuki en direct, voir lodgify.ts et nuki.ts).
// Authentification : jeton d'application Rocket Core ("Authorization: Bearer rpm_..."), cree dans Rocket PMS > Applications.
//
// Tranche branchee pour l'instant : logements + reservations en lecture (voir pmsLoadData, utilise par lodgify.ts::loadData).
// Le reste de l'API (serrures/codes, domotique, documents, conversation) reste a brancher : voir docs/rocket-pms.md.
import type { Booking, Property } from './types'

const MAX_BYTES = 5 * 1024 * 1024 // reponse plafonnee, comme les autres clients (lodgify.ts, nuki.ts)

function config() {
  const cfg = useRuntimeConfig()
  return { url: String(cfg.pmsApiUrl || '').replace(/\/+$/, ''), token: String(cfg.pmsApiToken || '') }
}

// Vrai si PMS_API_URL est renseigne : bascule le reste de l'appli sur Rocket PMS plutot que Lodgify/Nuki en direct.
export function pmsEnabled(): boolean {
  return !!config().url
}

async function call(path: string, init?: RequestInit): Promise<any> {
  const { url, token } = config()
  if (!url) throw createError({ statusCode: 500, statusMessage: 'Rocket PMS non configuré (PMS_API_URL absent de .env)' })
  const res = await fetch(url + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Rocket PMS ${res.status} sur ${path}` })
  const text = await res.text()
  if (text.length > MAX_BYTES) throw createError({ statusCode: 502, statusMessage: `Réponse Rocket PMS trop volumineuse sur ${path}` })
  return text ? JSON.parse(text) : null
}

export interface PmsProperty {
  id: string // uuid Rocket PMS
  name: string
  lodgifyPropertyId: number | null
  lodgifyName: string | null
  color: string
  latitude: number | null
  longitude: number | null
}

// GET /api/properties (API Platform, sans pagination : accept json renvoie un tableau simple, pas du JSON-LD)
export async function pmsProperties(): Promise<PmsProperty[]> {
  const r = await call('/api/properties')
  const list: any[] = Array.isArray(r) ? r : r['hydra:member'] || r.member || []
  return list.map(p => ({
    id: String(p.id),
    name: String(p.name || ''),
    lodgifyPropertyId: typeof p.lodgifyPropertyId === 'number' ? p.lodgifyPropertyId : null,
    lodgifyName: typeof p.lodgifyName === 'string' ? p.lodgifyName : null,
    color: String(p.color || ''),
    latitude: typeof p.latitude === 'number' ? p.latitude : null,
    longitude: typeof p.longitude === 'number' ? p.longitude : null,
  }))
}

// Reservations d'un logement PMS (60 derniers jours + a venir), deja au format attendu par l'appli (voir Booking dans types.ts).
// threadUid n'est pas expose par le PMS (la conversation Lodgify reste lue en direct pour l'instant, voir next steps) :
// l'appariement automatique des e-mails par fil de conversation ne fonctionne pas encore sur les reservations venant du PMS.
export async function pmsBookings(pmsPropertyId: string): Promise<Booking[]> {
  const r = await call(`/api/properties/${pmsPropertyId}/bookings`)
  const items: any[] = r?.items || []
  return items.map((b): Booking => ({
    id: Number(b.id),
    propertyId: Number(b.propertyId),
    arrival: String(b.arrival || ''),
    departure: String(b.departure || ''),
    guest: String(b.guest || ''),
    status: String(b.status || ''),
    source: String(b.source || ''),
    total: Number(b.total ?? 0) || 0,
    checkIn: typeof b.checkIn === 'string' ? b.checkIn : undefined,
    checkOut: typeof b.checkOut === 'string' ? b.checkOut : undefined,
    guestEmail: typeof b.guestEmail === 'string' ? b.guestEmail : undefined,
  }))
}

// Equivalent PMS de lodgify.ts::fetchProperties + fetchBookings, au meme format : ne garde que les logements PMS lies a
// Lodgify (lodgifyPropertyId), le reste de l'appli continue de raisonner en identifiant Lodgify (voir server/utils/logements.ts).
export async function pmsLoadData(): Promise<{ properties: Property[]; bookings: Booking[] }> {
  const props = (await pmsProperties()).filter(p => p.lodgifyPropertyId !== null)
  const bookingsByProperty = await Promise.all(props.map(p => pmsBookings(p.id)))
  return {
    properties: props.map((p): Property => ({
      id: p.lodgifyPropertyId!,
      name: p.name,
      original: p.lodgifyName || p.name,
      internalName: p.lodgifyName || undefined,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
    })),
    bookings: bookingsByProperty.flat(),
  }
}

// Etat de la connexion, pour la page Réglages > Plugins (jamais de secret renvoyé au navigateur).
export async function pmsHealth(): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  if (!pmsEnabled()) return { configured: false, ok: false }
  try {
    await pmsProperties()
    return { configured: true, ok: true }
  } catch (e: any) {
    return { configured: true, ok: false, error: e?.statusMessage || String(e) }
  }
}
