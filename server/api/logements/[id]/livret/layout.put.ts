// Mise en page (par logement) : navigation du livret (defilement/onglets), colonnes du livret et de l'ecran TV.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = ((await readBody(event)) ?? {}) as { navMode?: unknown; gridColumns?: unknown; tvColumns?: unknown }
  await saveLayoutSettings(lg.id, b.navMode, b.gridColumns, b.tvColumns)
  return { ok: true }
})
