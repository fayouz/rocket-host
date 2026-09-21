// Validation d'une regle IMAP (creation / modification)
export async function parseRule(b: Record<string, unknown>) {
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
  const name = String(b.name ?? '').trim().slice(0, 60)
  const sender = String(b.sender ?? '').trim().toLowerCase()
  const subject = String(b.subject ?? '').trim().slice(0, 100)
  if (!name) throw bad('Nom requis')
  if (sender.length < 3 || sender.length > 100 || /[\s\p{Cc}]/u.test(sender)) throw bad('Expéditeur : au moins 3 caractères, sans espace (ex. airbnb.com)')
  if (/\p{Cc}/u.test(subject)) throw bad('Objet invalide')
  if (!isSource(b.source)) throw bad('Source invalide (2 à 30 caractères : a-z, 0-9, - ou _)')
  if (!isCategory(b.category)) throw bad('Catégorie invalide')
  const logementId = Number(b.logementId ?? 0)
  if (!Number.isInteger(logementId) || logementId < 0 || (logementId > 0 && !(await ensureLogements()).some(l => l.id === logementId))) throw bad('Logement inconnu')
  return { name, sender, subject, source: b.source, category: b.category as string, logementId, enabled: b.enabled === undefined ? true : !!b.enabled }
}
