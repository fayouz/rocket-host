export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const url = String(b.url || '')
  if (!/^https:\/\//.test(url)) throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  await saveDefaultBackgroundWeb(url, String(b.attribution || ''))
  return { ok: true }
})
