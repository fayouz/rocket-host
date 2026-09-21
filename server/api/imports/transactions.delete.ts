// Supprime toutes les lignes de releve importees d'une source (?source=airbnb), par exemple pour re-importer apres correction
export default defineEventHandler(async (event) => {
  const source = getQuery(event).source
  if (!isSource(source)) throw createError({ statusCode: 400, statusMessage: 'source requise' })
  await useDatabase().sql`DELETE FROM platform_transaction WHERE source = ${source}`
  return { ok: true }
})
