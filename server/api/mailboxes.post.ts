// Assistant, etape finale : enregistre la boite. Releve DESACTIVE par defaut (rien n'est lu ni envoye avant activation).
//  { source: 'local', label?, provider, host, port, secure, smtpHost, smtpPort, smtpSecure, user, password }
//  { source: 'mailer-shared', mailerId }   boite partagee de Rocket Mailer dont l'utilisateur est membre
//  { source: 'mailer-personal', email, provider?, host?, port?, secure?, smtpHost?, smtpPort?, smtpSecure?, password? }  creee dans Rocket Mailer
// (Google / Microsoft : creees au retour OAuth, GET /api/mail/oauth/:provider/callback)
export default defineEventHandler(async (event) => {
  const b = (await readBody(event).catch(() => null)) ?? {}
  const user = await currentUser(event)
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
  let id: number
  if (b.source === 'local') {
    const c = validateServer(b)
    const password = typeof b.password === 'string' ? b.password.trim() : ''
    if (!password || password.length > 4096) throw bad('Mot de passe requis')
    id = await createLocalMailbox(c, password, String(b.label ?? '').replace(/\p{Cc}/gu, '').trim().slice(0, 80) || c.user)
  } else if (b.source === 'mailer-shared') {
    const box = (await mailerMailboxes(user?.email ?? '').catch((e: any) => { throw createError({ statusCode: 502, statusMessage: e.message }) }))
      .find(m => m.id === String(b.mailerId) && m.kind === 'shared')
    if (!box) throw bad('Boîte partagée introuvable (es-tu membre de cette boîte dans Rocket Mailer ?)')
    id = await createMailerMailbox('mailer-shared', box)
  } else if (b.source === 'mailer-personal') {
    const email = String(b.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw bad('Adresse e-mail invalide')
    const body: Record<string, unknown> = { email }
    if (b.host) { const c = validateServer({ ...b, user: email }); Object.assign(body, { provider: c.provider, imap: { host: c.host, port: c.port, secure: c.secure }, smtp: { host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure } }) }
    if (typeof b.password === 'string' && b.password) body.password = b.password // transmis a Mailer (qui le chiffre), jamais stocke dans Host
    const box = await mailerCreatePersonal(user?.email ?? '', body).catch((e: any) => { throw createError({ statusCode: e.status === 404 ? 501 : 502, statusMessage: e.message }) })
    id = await createMailerMailbox('mailer-personal', { ...box, kind: 'personal' })
  } else throw bad('Source inconnue')
  await audit(event, 'boite_mail_ajoutee', `${b.source} #${id}`)
  return { ok: true, id }
})
