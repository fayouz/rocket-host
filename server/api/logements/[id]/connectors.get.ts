// Connecteurs d'un logement (sans aucun secret) et catalogue des plugins pour en ajouter
import { PLUGINS, connectorView, pluginView } from '../../../utils/connectors'
import type { ConnectorRow } from '../../../utils/connectors'
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const rows = (await useDatabase().sql`SELECT * FROM connector WHERE logement_id = ${lg.id} ORDER BY name COLLATE NOCASE, id`).rows as unknown as ConnectorRow[]
  return { plugins: PLUGINS.map(pluginView), connectors: rows.map(connectorView) }
})
