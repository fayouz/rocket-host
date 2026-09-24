// Verifie la connexion au service (appel en lecture seule)
import { getPlugin, getConnector, contextOf, recordRun } from '../../../utils/connectors'
export default defineEventHandler(async (event) => {
  const row = await getConnector(getRouterParam(event, 'cid'))
  try {
    const message = await getPlugin(row.plugin_id).test(contextOf(row))
    await recordRun(row.id, `✓ ${message}`)
    return { ok: true, message }
  } catch (e: any) { await recordRun(row.id, `✗ ${e?.statusMessage || 'échec'}`); throw e }
})
