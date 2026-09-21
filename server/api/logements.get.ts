export default defineEventHandler(async () => ({ logements: await ensureLogements() }))
