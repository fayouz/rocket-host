// Lance une action manuelle du connecteur (l'interface demande toujours confirmation avant l'appel)
import { getPlugin, getConnector, contextOf, recordRun } from '../../../../utils/connectors'
export default defineEventHandler(async (event) => {
  const row = await getConnector(getRouterParam(event, 'cid'))
  const plugin = getPlugin(row.plugin_id)
  if (!plugin.runAction) throw createError({ statusCode: 400, statusMessage: 'Ce plugin n\'a pas d\'action' })
  if (!Number(row.enabled)) throw createError({ statusCode: 409, statusMessage: 'Connecteur désactivé' })
  try {
    const message = await plugin.runAction(contextOf(row), String(getRouterParam(event, 'actionId')))
    await recordRun(row.id, `✓ ${message}`)
    return { ok: true, message }
  } catch (e: any) { await recordRun(row.id, `✗ ${e?.statusMessage || 'échec'}`); throw e }
})
