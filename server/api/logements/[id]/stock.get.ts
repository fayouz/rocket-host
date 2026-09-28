// Stock du logement : articles qu'il suit (avec niveau), articles du catalogue qu'il ne suit pas, lien secret (QR code).
// Le catalogue lui-meme et le panier Amazon restent globaux (/api/stock).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  if (pmsEnabled()) { // Rocket PMS actif : niveaux du lieu dans Rocket Place (catalogue gere la-bas)
    const r = await pmsStock(lg.lodgifyPropertyId)
    return { pms: true as const, logement: lg, lines: r.lines, available: r.available }
  }
  const s = await buildStock()
  const p = s.properties.find(x => x.id === lg.lodgifyPropertyId)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Logement non associé à un logement Lodgify' })
  return {
    pms: false as const, logement: lg, propertyId: p.id, token: p.token,
    items: s.items.filter(i => i.id in p.levels).map(i => ({ id: i.id, name: i.name, subscription: i.subscription, level: p.levels[i.id] })),
    available: s.items.filter(i => !(i.id in p.levels)).map(i => ({ id: i.id, name: i.name })),
  }
})
