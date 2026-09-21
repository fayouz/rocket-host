// Enregistre la configuration domotique du logement (connexion et regle de prechauffage). N'envoie AUCUNE commande.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const current = await getDomoConfig(lg.id)
  const c = parseDomoConfig((await readBody(event)) ?? {}, current)
  // Un Homey n'est associe qu'a un seul logement (evite de commander l'appartement voisin)
  if (c.homeyId) {
    const other = ((await useDatabase().sql`SELECT logement_id FROM domotique_config WHERE homey_id = ${c.homeyId} AND logement_id != ${lg.id}`).rows as any[])[0]
    if (other) {
      const name = (await ensureLogements()).find(l => l.id === Number(other.logement_id))?.name ?? 'un autre logement'
      throw createError({ statusCode: 409, statusMessage: `Ce Homey est déjà associé à « ${name} » : dissocie-le d'abord` })
    }
  }
  await useDatabase().sql`INSERT INTO domotique_config (logement_id, homey_mode, homey_url, homey_id, preheat_enabled, preheat_hours, comfort_temp, eco_temp, eco_delay_min, updated_at)
    VALUES (${lg.id}, ${c.homeyMode}, ${c.homeyUrl}, ${c.homeyId}, ${c.preheatEnabled ? 1 : 0}, ${c.preheatHours}, ${c.comfortTemp}, ${c.ecoTemp}, ${c.ecoDelayMin}, ${new Date().toISOString()})
    ON CONFLICT(logement_id) DO UPDATE SET homey_mode = excluded.homey_mode, homey_url = excluded.homey_url, homey_id = excluded.homey_id, preheat_enabled = excluded.preheat_enabled,
      preheat_hours = excluded.preheat_hours, comfort_temp = excluded.comfort_temp, eco_temp = excluded.eco_temp, eco_delay_min = excluded.eco_delay_min, updated_at = excluded.updated_at`
  return { ok: true }
})
