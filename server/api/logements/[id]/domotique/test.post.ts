// Verifie la connexion a Homey (authentification seulement en mode cloud). Ne lit pas la liste des appareils et n'envoie aucune commande.
const last = new Map<number, number>()
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  if (Date.now() - (last.get(lg.id) ?? 0) < 3000) throw createError({ statusCode: 429, statusMessage: 'Patiente quelques secondes entre deux tests' })
  last.set(lg.id, Date.now())
  return { ok: true, testedAt: new Date().toISOString(), ...(await pingHomey(await getDomoConfig(lg.id))) }
})
