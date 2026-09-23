export default defineEventHandler(async (event) => saveTheme((await readBody(event)) ?? {}))
