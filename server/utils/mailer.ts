// Client Rocket Mailer pour l'assistant « Ajouter une boîte e-mail » (ROCKET_MAILER_URL / ROCKET_MAILER_TOKEN, Reglages > Connexions >
// Briques Rocket). Chaque appel est fait au nom de l'utilisateur connecte (X-Impersonate-User = son adresse e-mail) : Mailer ne
// renvoie que les boites partagees dont il est membre et cree SA boite perso.
// Routes visees (branche feature/personal-mailboxes de Rocket Mailer, en cours) :
//   GET  /api/mailboxes                      boites visibles par l'utilisateur (partagees + perso)
//   GET  /api/mailboxes/detect?email=        service de messagerie detecte (MX)
//   POST /api/mailboxes/personal             creation de la boite perso { email, provider?, imap?, smtp?, password? }
//   POST /api/mailboxes/{id}/test            test IMAP + SMTP de la boite
//   GET  /api/mailboxes/oauth/{provider}/start?returnTo=   connexion OAuth geree par Mailer
// Tant que Mailer n'expose pas ces routes (404), l'assistant affiche « bientôt » pour la boite perso.

export class MailerError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status } }

export const mailerConfigured = () => !!getSetting('ROCKET_MAILER_URL') && hasSecret('ROCKET_MAILER_TOKEN')
const base = () => getSetting('ROCKET_MAILER_URL').replace(/\/+$/, '')

export async function mailerCall(path: string, userEmail: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  if (!mailerConfigured()) throw new MailerError(503, 'Rocket Mailer non configuré (Réglages › Connexions › Briques Rocket)')
  if (!userEmail) throw new MailerError(400, 'Ton compte n\'a pas d\'adresse e-mail : impossible d\'agir en ton nom dans Rocket Mailer')
  let res: Response
  try {
    res = await fetch(base() + path, {
      method: init.method ?? 'GET',
      headers: { accept: 'application/json', Authorization: `Bearer ${getSecret('ROCKET_MAILER_TOKEN')}`, 'X-Impersonate-User': userEmail, ...(init.body ? { 'content-type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e: any) {
    throw new MailerError(502, e?.name === 'TimeoutError' ? 'Rocket Mailer ne répond pas (délai dépassé)' : 'Rocket Mailer injoignable')
  }
  const j: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = res.status === 401 || res.status === 403 ? 'Rocket Mailer refuse le jeton ou ton compte (membre de la boîte ?)'
      : res.status === 404 ? 'Fonction absente de ce Rocket Mailer (bientôt)' : String(j?.statusMessage || j?.message || j?.error || `erreur ${res.status}`).slice(0, 200)
    throw new MailerError(res.status, msg)
  }
  return j
}

export interface MailerBox { id: string; name: string; email: string; kind: 'shared' | 'personal' }
const toBox = (m: any): MailerBox => ({ id: String(m.id), name: String(m.name || m.label || m.email || ''), email: String(m.email || m.address || ''), kind: m.kind === 'personal' || m.personal || m.type === 'personal' ? 'personal' : 'shared' })

export async function mailerMailboxes(userEmail: string): Promise<MailerBox[]> {
  const j = await mailerCall('/api/mailboxes', userEmail)
  return (Array.isArray(j) ? j : Array.isArray(j?.mailboxes) ? j.mailboxes : Array.isArray(j?.items) ? j.items : []).map(toBox)
}

/** Etat de Mailer pour l'assistant : configure, joignable, boite perso disponible (route detect presente). */
export async function mailerStatus(userEmail: string) {
  if (!mailerConfigured()) return { configured: false, ok: false, personal: false, message: 'Rocket Mailer non configuré' }
  let ok = false, message = ''
  try { await mailerMailboxes(userEmail); ok = true } catch (e: any) { message = e.message }
  let personal = false
  if (ok) { try { await mailerCall(`/api/mailboxes/detect?email=${encodeURIComponent(userEmail)}`, userEmail); personal = true } catch { personal = false } }
  return { configured: true, ok, personal, message }
}

export const mailerCreatePersonal = async (userEmail: string, body: Record<string, unknown>) => toBox(await mailerCall('/api/mailboxes/personal', userEmail, { method: 'POST', body }))
export const mailerTest = (userEmail: string, id: string) => mailerCall(`/api/mailboxes/${encodeURIComponent(id)}/test`, userEmail, { method: 'POST' })
