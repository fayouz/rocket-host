// Bibliotheque de plugins (catalogue integre) et nombre de connecteurs qui utilisent chacun
import { PLUGINS, pluginView } from '../utils/connectors'
export default defineEventHandler(async () => {
  const rows = (await useDatabase().sql`SELECT plugin_id, COUNT(*) AS n FROM connector GROUP BY plugin_id`).rows as any[]
  return { plugins: PLUGINS.map(p => ({ ...pluginView(p), connectors: Number(rows.find(r => r.plugin_id === p.id)?.n ?? 0) })) }
})
