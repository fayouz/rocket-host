// Etat de la domotique d'un logement : configuration, presence de la cle d'API (jamais sa valeur) et simulation des actions a venir.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const cfg = await getDomoConfig(lg.id)
  const { bookings, demo } = await loadData()
  const mine = bookings.filter(b => b.propertyId === lg.lodgifyPropertyId)
  const keyPresent = !!useRuntimeConfig().homeyApiKey
  const cloud = { ...(await cloudStatus()), redirectUri: redirectUri(event) }
  return {
    demo, logement: { id: lg.id, name: lg.name }, config: cfg, limits: LIMITS, keyPresent,
    cloud,
    // Connexion : rien n'est appele ici ; le test se lance a la demande (lecture seule)
    connection: cfg.homeyMode === 'cloud'
      ? (!cloud.clientConfigured ? 'no-client' : !cloud.connected ? 'not-connected' : !cfg.homeyId ? 'no-homey' : 'untested')
      : !cfg.homeyUrl ? 'unconfigured' : !keyPresent ? 'no-key' : 'untested',
    actions: cfg.preheatEnabled ? simulate(mine, cfg) : [],
    // Rocket PMS actif : connecteurs du lieu vus par Rocket Place, en lecture seule (null quand le PMS n'est pas configure)
    pms: pmsEnabled()
      ? await pmsDomotique(lg.lodgifyPropertyId).then(sections => ({ sections, error: null as string | null })).catch((e: any) => ({ sections: [] as PmsDomotiqueSection[], error: String(e?.statusMessage || e) }))
      : null,
  }
})
