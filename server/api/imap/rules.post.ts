export default defineEventHandler(async (event) => {
  const r = await parseRule((await readBody(event)) ?? {})
  await useDatabase().sql`INSERT INTO imap_rule (name, sender, subject, source, category, logement_id, enabled) VALUES (${r.name}, ${r.sender}, ${r.subject}, ${r.source}, ${r.category}, ${r.logementId}, ${r.enabled ? 1 : 0})`
  return { ok: true }
})
