export default defineEventHandler(async (event) => {
  await setDefaultAnimated(!!((await readBody(event)) ?? {}).animated)
  return { ok: true }
})
