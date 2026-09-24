// Ajoute un connecteur au logement : { pluginId, name, config }
import { getPlugin, getConnector, cleanConfig, connectorView } from '../../../utils/connectors'
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = (await readBody(event)) ?? {}
  const plugin = getPlugin(String(b.pluginId ?? ''))
  const name = String(b.name ?? '').trim().slice(0, 80) || plugin.name
  const config = await cleanConfig(plugin, b.config, { logementId: lg.id, connectorId: 0 })
  const now = new Date().toISOString()
  const r = await useDatabase().sql`INSERT INTO connector (logement_id, plugin_id, name, config_json, created_at, updated_at) VALUES (${lg.id}, ${plugin.id}, ${name}, ${JSON.stringify(config)}, ${now}, ${now})`
  return connectorView(await getConnector(Number(r.lastInsertRowid)))
})
