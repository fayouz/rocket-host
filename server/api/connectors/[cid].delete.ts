// Supprime un connecteur (les documents deja importes restent dans l'explorateur)
import { getConnector } from '../../utils/connectors'
export default defineEventHandler(async (event) => {
  const row = await getConnector(getRouterParam(event, 'cid'))
  await useDatabase().sql`DELETE FROM connector WHERE id = ${row.id}`
  return { ok: true }
})
