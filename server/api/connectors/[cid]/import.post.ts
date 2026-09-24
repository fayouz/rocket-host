// Recupere les documents du service et les depose dans l'explorateur du logement (dossier « Connecteurs/<nom> »), sans doublon
import { getPlugin, getConnector, contextOf, recordRun } from '../../../utils/connectors'
import { ensureFolder } from '../../../utils/explorer'
import { importDocument } from '../../../utils/imports'
export default defineEventHandler(async (event) => {
  const row = await getConnector(getRouterParam(event, 'cid'))
  const plugin = getPlugin(row.plugin_id)
  if (!plugin.documents) throw createError({ statusCode: 400, statusMessage: 'Ce plugin ne récupère pas de documents' })
  if (!Number(row.enabled)) throw createError({ statusCode: 409, statusMessage: 'Connecteur désactivé' })
  const ctx = contextOf(row)
  try {
    const docs = await plugin.documents(ctx)
    const lg = Number(row.logement_id)
    const folder = await ensureFolder(lg, await ensureFolder(lg, null, 'Connecteurs'), row.name)
    let added = 0, duplicates = 0
    const errors: string[] = []
    for (const d of docs) {
      if (d.error || !d.data) { errors.push(`${d.filename} : ${d.error || 'vide'}`); continue }
      try {
        const r = await importDocument({
          source: `connecteur-${row.id}`, externalId: d.externalId, logementId: lg, parentId: folder, filename: d.filename, data: d.data,
          title: d.title, category: ctx.config.documentsType || 'autre_doc', date: d.date, note: `Importé par le connecteur « ${row.name} »`,
        })
        if (r.status === 'ok') added += 1; else duplicates += 1
      } catch (e: any) { errors.push(`${d.filename} : ${e?.statusMessage || 'échec'}`) }
    }
    const message = `${added} ajouté(s), ${duplicates} déjà présent(s)${errors.length ? `, ${errors.length} refusé(s)` : ''}`
    await recordRun(row.id, `✓ Documents : ${message}`)
    return { ok: true, message, added, duplicates, errors: errors.slice(0, 10) }
  } catch (e: any) { await recordRun(row.id, `✗ ${e?.statusMessage || 'échec'}`); throw e }
})
