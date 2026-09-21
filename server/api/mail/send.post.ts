// Envoie un e-mail (multipart/form-data) : to, cc?, subject, text, files[]?, replyTo? (id d'un message du cache), dryRun?
// Chaque appel correspond a un clic « Envoyer » de l'utilisateur ; dryRun=1 valide et construit sans envoyer.
export default defineEventHandler(async (event) => {
  if (Number(getHeader(event, 'content-length') || 0) > MAX_SIZE + 2 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Pièces jointes : 15 Mo au total' })
  const parts = (await readMultipartFormData(event)) ?? []
  const field = (n: string) => parts.find(p => p.name === n && !p.filename)?.data.toString('utf8') ?? ''
  const list = (v: string) => v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
  let inReplyTo: string | undefined, references: string | undefined
  const replyTo = Number(field('replyTo'))
  if (Number.isInteger(replyTo) && replyTo > 0) {
    const row = await getMailRow(replyTo)
    if (row.message_id) { inReplyTo = row.message_id; references = row.message_id }
  }
  return sendMail({
    to: list(field('to')), cc: list(field('cc')), subject: field('subject'), text: field('text'), inReplyTo, references,
    attachments: parts.filter(p => p.filename && p.name === 'files').map(p => ({ filename: p.filename!, content: p.data })),
  }, { dryRun: field('dryRun') === '1' })
})
