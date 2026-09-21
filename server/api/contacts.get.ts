// Contacts (?kind=, ?logementId=, ?q=). Sans logement : tous les contacts.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const logementId = Number(q.logementId)
  return {
    kinds: Object.entries(CONTACT_KINDS).map(([key, label]) => ({ key, label })),
    contacts: await listContacts({ kind: typeof q.kind === 'string' ? q.kind : undefined, logementId: Number.isInteger(logementId) && logementId > 0 ? logementId : undefined, q: typeof q.q === 'string' ? q.q : undefined }),
    today: new Date().toISOString().slice(0, 10),
  }
})
