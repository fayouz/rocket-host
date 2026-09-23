// Appareils domotiques mis a disposition du voyageur (V3) : liste blanche par logement, capacites commandables
// restreintes a un ensemble sur, et bornes de temperature qui ne peuvent jamais depasser LIMITS_GUEST_TEMP,
// meme si l'hote se trompe en les reglant. Les serrures et cameras ne sont jamais exposees, quoi que l'hote choisisse.
export const LIMITS_GUEST_TEMP = [16, 24] as const // aligne sur LIMITS.comfort de server/utils/domotique.ts
export const CONTROLLABLE_CAPS = new Set(['onoff', 'dim', 'target_temperature'])
export const EXCLUDED_CLASSES = new Set(['lock', 'garagedoor', 'camera', 'doorbell'])

export interface GuestDevice { deviceId: string; deviceName: string; minTemp: number | null; maxTemp: number | null }

export async function getGuestDevices(logementId: number): Promise<GuestDevice[]> {
  const rows = ((await useDatabase().sql`SELECT device_id, device_name, min_temp, max_temp FROM guest_device WHERE logement_id = ${logementId}`).rows as any[])
  return rows.map(r => ({ deviceId: String(r.device_id), deviceName: String(r.device_name), minTemp: r.min_temp === null ? null : Number(r.min_temp), maxTemp: r.max_temp === null ? null : Number(r.max_temp) }))
}

export async function getGuestDevice(logementId: number, deviceId: string): Promise<GuestDevice | null> {
  const r = ((await useDatabase().sql`SELECT device_id, device_name, min_temp, max_temp FROM guest_device WHERE logement_id = ${logementId} AND device_id = ${deviceId}`).rows as any[])[0]
  if (!r) return null
  return { deviceId: String(r.device_id), deviceName: String(r.device_name), minTemp: r.min_temp === null ? null : Number(r.min_temp), maxTemp: r.max_temp === null ? null : Number(r.max_temp) }
}

// Remplace toute la liste pour ce logement (coche/decoche dans l'onglet Appareils). Classes exclues refusees ici aussi
// (defense en profondeur : meme si le navigateur de l'hote envoyait un id de serrure par erreur, il serait rejete).
export async function setGuestDevices(logementId: number, devices: { deviceId: string; deviceName: string; deviceClass: string; minTemp?: number; maxTemp?: number }[]) {
  for (const d of devices) if (EXCLUDED_CLASSES.has(d.deviceClass)) throw createError({ statusCode: 400, statusMessage: `Type d'appareil non partageable avec un voyageur : ${d.deviceClass}` })
  const db = useDatabase()
  await db.sql`DELETE FROM guest_device WHERE logement_id = ${logementId}`
  for (const d of devices) {
    const min = d.minTemp === undefined ? null : clampGuestTemp(d.minTemp)
    const max = d.maxTemp === undefined ? null : clampGuestTemp(d.maxTemp)
    await db.sql`INSERT INTO guest_device (logement_id, device_id, device_name, min_temp, max_temp) VALUES (${logementId}, ${d.deviceId}, ${d.deviceName.slice(0, 80)}, ${min}, ${max})`
  }
}

export function clampGuestTemp(v: number): number {
  return Math.min(LIMITS_GUEST_TEMP[1], Math.max(LIMITS_GUEST_TEMP[0], v))
}

// Les erreurs Homey (server/utils/homey.ts, toujours 502) peuvent mentionner la cle d'API, le mode cloud/local ou le
// reseau : jamais a montrer a un voyageur anonyme (jusqu'ici ces messages n'etaient vus que par l'hote connecte).
export function guestSafeMessage(e: unknown): string {
  const err = e as { statusCode?: number; statusMessage?: string }
  if (err?.statusCode === 502) return 'Appareil temporairement indisponible, réessaie plus tard.'
  return err?.statusMessage || 'Une erreur est survenue.'
}

export interface GuestDeviceView {
  id: string; name: string; class: string; available: boolean
  controls: { capabilityId: string; kind: 'onoff' | 'dim' | 'target_temperature'; value: unknown; min?: number; max?: number; units: string | null }[]
  info: { title: string; value: unknown; units: string | null }[]
}

// Etat en direct des appareils mis a disposition du voyageur pour ce logement (lecture Homey a chaque appel : pas de cache,
// pour ne jamais afficher un etat perime alors qu'une commande vient peut-etre d'etre envoyee).
export async function resolveGuestDeviceViews(logementId: number): Promise<GuestDeviceView[]> {
  const allowed = await getGuestDevices(logementId)
  if (!allowed.length) return []
  const cfg = await getDomoConfig(logementId)
  const live = await listHomeyDevices(cfg)
  const byId = new Map(live.map(d => [d.id, d]))
  const views: GuestDeviceView[] = []
  for (const a of allowed) {
    const d = byId.get(a.deviceId)
    if (!d || EXCLUDED_CLASSES.has(d.class)) continue
    const controls: GuestDeviceView['controls'] = []
    const info: GuestDeviceView['info'] = []
    for (const c of d.capabilities) {
      if (c.id === 'onoff') controls.push({ capabilityId: c.id, kind: 'onoff', value: c.value, units: null })
      else if (c.id === 'dim') controls.push({ capabilityId: c.id, kind: 'dim', value: c.value, units: null })
      else if (c.id === 'target_temperature') {
        controls.push({
          capabilityId: c.id, kind: 'target_temperature', value: c.value,
          min: a.minTemp ?? LIMITS_GUEST_TEMP[0], max: a.maxTemp ?? LIMITS_GUEST_TEMP[1], units: c.units,
        })
      } else info.push({ title: c.title, value: c.value, units: c.units })
    }
    views.push({ id: d.id, name: a.deviceName || d.name, class: d.class, available: d.available, controls, info: info.slice(0, 4) })
  }
  return views
}

// Verifie et applique une commande envoyee par un voyageur : appareil autorise, capacite sure, valeur bornee.
export async function setGuestCapability(logementId: number, deviceId: string, capabilityId: string, rawValue: unknown) {
  if (!CONTROLLABLE_CAPS.has(capabilityId)) throw createError({ statusCode: 400, statusMessage: 'Commande non autorisée' })
  const allowed = await getGuestDevice(logementId, deviceId)
  if (!allowed) throw createError({ statusCode: 404, statusMessage: 'Appareil non partagé avec le voyageur' })
  const cfg = await getDomoConfig(logementId)
  const live = (await listHomeyDevices(cfg)).find(d => d.id === deviceId)
  if (!live || EXCLUDED_CLASSES.has(live.class)) throw createError({ statusCode: 404, statusMessage: 'Appareil indisponible' })
  if (!live.capabilities.some(c => c.id === capabilityId)) throw createError({ statusCode: 400, statusMessage: 'Cet appareil n\'a pas cette commande' })

  let value: unknown = rawValue
  if (capabilityId === 'onoff') {
    if (typeof rawValue !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Valeur invalide' })
  } else if (capabilityId === 'dim') {
    const n = Number(rawValue)
    if (!Number.isFinite(n) || n < 0 || n > 1) throw createError({ statusCode: 400, statusMessage: 'Valeur invalide (0 à 1)' })
    value = n
  } else if (capabilityId === 'target_temperature') {
    const n = Number(rawValue)
    if (!Number.isFinite(n)) throw createError({ statusCode: 400, statusMessage: 'Valeur invalide' })
    const min = allowed.minTemp ?? LIMITS_GUEST_TEMP[0]
    const max = allowed.maxTemp ?? LIMITS_GUEST_TEMP[1]
    if (n < min || n > max) throw createError({ statusCode: 400, statusMessage: `Température autorisée : ${min} à ${max} °C` })
    value = n
  }
  await setHomeyCapability(cfg, deviceId, capabilityId, value)
}
