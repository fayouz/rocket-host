// Telecharge une piece jointe (toujours en telechargement, jamais affichee : type neutre, nosniff)
export default defineEventHandler(async (event) => {
  const n = Number(getRouterParam(event, 'n'))
  if (!Number.isInteger(n) || n < 0) throw createError({ statusCode: 400, statusMessage: 'Pièce jointe invalide' })
  const a = await readAttachment(await getMailRow(Number(getRouterParam(event, 'id'))), n)
  setHeader(event, 'content-type', 'application/octet-stream')
  setHeader(event, 'content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(cleanName(a.name))}`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'private, no-store')
  return a.content
})
