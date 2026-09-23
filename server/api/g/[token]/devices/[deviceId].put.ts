// Commande d'un appareil mis a disposition du voyageur (lien secret). Liste blanche, capacites sures et bornes de
// temperature verifiees dans setGuestCapability. Frequence limitee (evite le spam/l'enchainement de commandes).
const last = new Map<string, number>()

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const deviceId = String(getRouterParam(event, 'deviceId') || '')
  const key = `${token}:${deviceId}`
  if (Date.now() - (last.get(key) ?? 0) < 1500) throw createError({ statusCode: 429, statusMessage: 'Patiente un instant entre deux commandes' })
  last.set(key, Date.now())

  const logementId = await logementByGuestToken(token)
  const b = ((await readBody(event)) ?? {}) as { capabilityId?: unknown; value?: unknown }
  await setGuestCapability(logementId, deviceId, String(b.capabilityId || ''), b.value)
  return { ok: true }
})
