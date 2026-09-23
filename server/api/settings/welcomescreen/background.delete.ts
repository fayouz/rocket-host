export default defineEventHandler(async () => {
  await removeDefaultBackground()
  return { ok: true }
})
