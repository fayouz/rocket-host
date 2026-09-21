// Un message : en-tetes du cache + corps lu dans la boite a l'instant (jamais stocke). Texte seulement.
export default defineEventHandler(async (event) => {
  const row = await getMailRow(Number(getRouterParam(event, 'id')))
  const links = (await useDatabase().sql`SELECT * FROM mail_link WHERE message_id = ${Number(row.id)} AND method != 'removed'`).rows as any[]
  const item = mailItem(row, links, await mailLabels())
  try { return { ...item, body: await readMessage(row), bodyError: null } }
  catch (e: any) { return { ...item, body: null, bodyError: e?.statusMessage || 'Lecture impossible' } }
})
