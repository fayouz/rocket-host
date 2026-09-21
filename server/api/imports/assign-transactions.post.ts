// Affecte a un logement toutes les lignes de releve non affectees d'une source : { source, logementId }
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  if (!isSource(b?.source) || !Number.isInteger(b?.logementId) || b.logementId < 1) throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  if (!(await ensureLogements()).some(l => l.id === b.logementId)) throw createError({ statusCode: 400, statusMessage: 'Logement inconnu' })
  await useDatabase().sql`UPDATE platform_transaction SET logement_id = ${b.logementId} WHERE source = ${b.source} AND logement_id = 0`
  return { ok: true }
})
