// Decouverte des appareils Homey : LECTURE SEULE (liste des appareils). N'envoie aucune commande. Une seule tentative toutes les 3 s par logement.
const last = new Map<number, number>()
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  if (Date.now() - (last.get(lg.id) ?? 0) < 3000) throw createError({ statusCode: 429, statusMessage: 'Patiente quelques secondes entre deux tests' })
  last.set(lg.id, Date.now())
  const devices = await listHomeyDevices(await getDomoConfig(lg.id))
  return { ok: true, testedAt: new Date().toISOString(), devices }
})
