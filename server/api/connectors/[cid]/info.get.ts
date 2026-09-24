// Informations lues sur le service (lecture seule), affichees dans le logement
import { getPlugin, getConnector, contextOf } from '../../../utils/connectors'
export default defineEventHandler(async (event) => {
  const row = await getConnector(getRouterParam(event, 'cid'))
  const plugin = getPlugin(row.plugin_id)
  if (!plugin.info) return { cards: [] }
  if (!Number(row.enabled)) throw createError({ statusCode: 409, statusMessage: 'Connecteur désactivé' })
  return { cards: await plugin.info(contextOf(row)) }
})
