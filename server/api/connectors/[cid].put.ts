// Modifie un connecteur : { name?, config?, enabled? }
import { getPlugin, getConnector, cleanConfig, connectorView } from '../../utils/connectors'
export default defineEventHandler(async (event) => {
  const row = await getConnector(getRouterParam(event, 'cid'))
  const b = (await readBody(event)) ?? {}
  const plugin = getPlugin(row.plugin_id)
  const name = b.name === undefined ? row.name : (String(b.name).trim().slice(0, 80) || plugin.name)
  const config = b.config === undefined ? row.config_json : JSON.stringify(await cleanConfig(plugin, b.config, { logementId: Number(row.logement_id), connectorId: row.id }))
  const enabled = b.enabled === undefined ? Number(row.enabled) : (b.enabled ? 1 : 0)
  await useDatabase().sql`UPDATE connector SET name = ${name}, config_json = ${config}, enabled = ${enabled}, updated_at = ${new Date().toISOString()} WHERE id = ${row.id}`
  return connectorView(await getConnector(row.id))
})
