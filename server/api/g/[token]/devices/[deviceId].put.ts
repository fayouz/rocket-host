// Commande d'un appareil mis a disposition du voyageur (lien secret). Liste blanche, capacites sures et bornes de
// temperature verifiees dans setGuestCapability. Frequence limitee par jeton ET par jeton+appareil (une cle par
// appareil seule serait contournable en variant l'id d'appareil envoye).
const lastByDevice = new Map<string, number>()
const lastByToken = new Map<string, number>()

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const deviceId = String(getRouterParam(event, 'deviceId') || '')
  const deviceKey = `${token}:${deviceId}`
  if (Date.now() - (lastByToken.get(token!) ?? 0) < 500) throw createError({ statusCode: 429, statusMessage: 'Patiente un instant entre deux commandes' })
  if (Date.now() - (lastByDevice.get(deviceKey) ?? 0) < 1500) throw createError({ statusCode: 429, statusMessage: 'Patiente un instant entre deux commandes' })
  lastByToken.set(token!, Date.now())
  lastByDevice.set(deviceKey, Date.now())
  if (lastByDevice.size > 1000) for (const [k, t] of lastByDevice) if (Date.now() - t > 3600_000) lastByDevice.delete(k) // purge occasionnelle

  const logementId = await logementByGuestToken(token)
  const b = ((await readBody(event)) ?? {}) as { capabilityId?: unknown; value?: unknown }
  try {
    await setGuestCapability(logementId, deviceId, String(b.capabilityId || ''), b.value)
  } catch (e: any) {
    if (e?.statusCode === 502) throw createError({ statusCode: 502, statusMessage: guestSafeMessage(e) })
    throw e // erreurs 400/404 deja formulees pour le voyageur (liste blanche, bornes, valeur invalide)
  }
  return { ok: true }
})
