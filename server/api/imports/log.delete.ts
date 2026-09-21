export default defineEventHandler(async () => { await useDatabase().sql`DELETE FROM import_log`; return { ok: true } })
