// Assistant, source Rocket Mailer : etat de Mailer et boites partagees dont l'utilisateur connecte est membre (X-Impersonate-User).
export default defineEventHandler(async (event) => {
  const email = (await currentUser(event))?.email ?? ''
  const status = await mailerStatus(email)
  let shared: MailerBox[] = [], personal: MailerBox[] = []
  if (status.ok) { const all = await mailerMailboxes(email).catch(() => []); shared = all.filter(m => m.kind === 'shared'); personal = all.filter(m => m.kind === 'personal') }
  return { ...status, userEmail: email, shared, personal }
})
