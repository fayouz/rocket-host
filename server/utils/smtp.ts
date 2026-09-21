// Envoi d'e-mails (SMTP) depuis l'adresse configuree, avec copie dans le dossier « Envoyes » de la boite.
// Mot de passe : celui de la boite (.env, IMAP_PASSWORD). Chaque envoi vient d'un clic de l'utilisateur dans l'interface.
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import { connect, errText, getImapConfig, need } from './imap'
import { syncFolderTree } from './mailFolders'

const transport = (cfg: Awaited<ReturnType<typeof getImapConfig>>) => nodemailer.createTransport({
  host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpSecure, requireTLS: !cfg.smtpSecure, // STARTTLS obligatoire si pas de TLS direct
  auth: { user: cfg.user, pass: useRuntimeConfig().imapPassword },
  connectionTimeout: 20_000, greetingTimeout: 20_000, socketTimeout: 60_000, tls: { rejectUnauthorized: true },
})

// Verifie la connexion et l'identification SMTP SANS envoyer de message
export async function verifySmtp() {
  const cfg = await getImapConfig()
  const missing = need(cfg)
  if (missing) return { ok: false as const, error: missing }
  if (!cfg.smtpHost) return { ok: false as const, error: 'Serveur d\'envoi (SMTP) non renseigné' }
  try { await transport(cfg).verify(); return { ok: true as const, host: cfg.smtpHost, port: cfg.smtpPort } }
  catch (e) { return { ok: false as const, error: errText(e) } }
}

export interface SendInput {
  to: string[]; cc?: string[]; subject: string; text: string
  attachments?: { filename: string; content: Buffer }[]
  inReplyTo?: string; references?: string
}

const ADDRESS = /^[^\s@<>",;()[\]]+@[^\s@<>",;()[\]]+\.[^\s@<>",;()[\]]{2,}$/
const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })

export function validateSend(i: SendInput) {
  const to = i.to.map(a => a.trim().toLowerCase()).filter(Boolean), cc = (i.cc ?? []).map(a => a.trim().toLowerCase()).filter(Boolean)
  if (!to.length) throw bad('Destinataire requis')
  if (to.length + cc.length > 20) throw bad('20 destinataires au plus')
  for (const a of [...to, ...cc]) if (!ADDRESS.test(a) || a.length > 200) throw bad(`Adresse invalide : ${a.slice(0, 60)}`)
  const subject = i.subject.trim()
  if (/[\r\n]/.test(subject) || subject.length > 300) throw bad('Objet invalide (300 caractères, une seule ligne)')
  if (!i.text.trim()) throw bad('Message vide')
  if (i.text.length > 100_000) throw bad('Message trop long (100 000 caractères)')
  const files = i.attachments ?? []
  if (files.reduce((n, f) => n + f.content.length, 0) > MAX_SIZE) throw bad('Pièces jointes : 15 Mo au total')
  return { to, cc, subject, files }
}

// dryRun : construit et valide le message sans rien envoyer
// noSentCopy : ne depose PAS de copie dans « Envoyes » (messages contenant un lien secret : invitations, mot de passe oublie)
export async function sendMail(input: SendInput, opts: { dryRun?: boolean; noSentCopy?: boolean } = {}) {
  const v = validateSend(input)
  const cfg = await getImapConfig()
  const missing = need(cfg)
  if (missing) throw createError({ statusCode: 503, statusMessage: missing })
  const from = cfg.fromName.trim() ? { name: cfg.fromName.replace(/[\r\n"<>]/g, ' ').trim(), address: cfg.user } : cfg.user
  const compiled = new MailComposer({
    from, to: v.to, cc: v.cc, subject: v.subject, text: input.text,
    inReplyTo: input.inReplyTo || undefined, references: input.references || undefined,
    attachments: v.files.map(f => ({ filename: cleanName(f.filename), content: f.content })),
  }).compile()
  const raw = await compiled.build()
  const messageId = String(compiled.messageId())
  if (opts.dryRun) return { ok: true, dryRun: true, messageId, size: raw.length, recipients: v.to.length + v.cc.length }

  try { await transport(cfg).sendMail({ envelope: { from: cfg.user, to: [...v.to, ...v.cc] }, raw }) }
  catch (e) { throw createError({ statusCode: 502, statusMessage: `Envoi refusé : ${errText(e)}` }) }

  // Copie dans « Envoyes » (ecriture limitee a ce dossier). L'echec de la copie n'annule pas l'envoi.
  let saved = false
  if (opts.noSentCopy) return { ok: true, dryRun: false, messageId, size: raw.length, recipients: v.to.length + v.cc.length, savedInSent: false }
  try {
    const client = connect(cfg)
    client.on('error', () => {})
    await client.connect()
    try {
      const sent = cfg.sentFolder || (await syncFolderTree(client, cfg)).sent
      if (sent) { await client.append(sent, raw, ['\\Seen'], new Date()); saved = true }
    } finally { await client.logout().catch(() => {}) }
  } catch { /* la copie sera absente de « Envoyes » ; le message est parti */ }
  await logImport('smtp', 'imap', 'ok', `E-mail envoyé à ${v.to.length + v.cc.length} destinataire(s)${saved ? '' : ' (copie dans Envoyés impossible)'}`)
  return { ok: true, dryRun: false, messageId, size: raw.length, recipients: v.to.length + v.cc.length, savedInSent: saved }
}
