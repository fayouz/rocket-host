// Enregistre la configuration IMAP : { provider, enabled, host, port, secure, user, folder, intervalMin, sinceDays }. Pas de mot de passe ici (.env).
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
  const provider = getProvider(b.provider)
  if (!provider) throw bad('Service de messagerie inconnu')
  let host = String(b.host ?? '').trim().toLowerCase()
  let port = Number(b.port)
  let secure = b.secure
  const user = String(b.user ?? '').trim()
  const folder = String(b.folder ?? '').trim()
  const intervalMin = Number(b.intervalMin), sinceDays = Number(b.sinceDays)
  if (provider.key !== 'custom') {
    // Service connu : securite et port viennent de la liste ; le serveur aussi, sauf numero de serveur propre au compte (OVH Email Pro / Exchange)
    port = provider.port; secure = provider.secure
    if (provider.hostPattern) { if (!new RegExp(provider.hostPattern).test(host)) throw bad(`Serveur invalide pour ce service (ex. ${provider.host})`) } else host = provider.host
  }
  if (!/^[a-z0-9]([a-z0-9.-]{1,98})[a-z0-9]$/.test(host) || !host.includes('.')) throw bad('Serveur invalide (ex. ssl0.ovh.net)')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad('Port invalide')
  if (user.length > 120 || /\p{Cc}/u.test(user)) throw bad('Identifiant invalide')
  if (!folder || folder.length > 120 || /\p{Cc}/u.test(folder)) throw bad('Dossier invalide')
  if (!Number.isInteger(intervalMin) || intervalMin < 5 || intervalMin > 1440) throw bad('Intervalle : 5 à 1440 minutes')
  if (!Number.isInteger(sinceDays) || sinceDays < 1 || sinceDays > 365) throw bad('Historique : 1 à 365 jours')
  if (typeof b.enabled !== 'boolean' || typeof secure !== 'boolean') throw bad('Corps invalide')
  await useDatabase().sql`UPDATE imap_config SET provider = ${provider.key}, enabled = ${b.enabled ? 1 : 0}, host = ${host}, port = ${port}, secure = ${secure ? 1 : 0}, user = ${user},
    folder = ${folder}, interval_min = ${intervalMin}, since_days = ${sinceDays} WHERE id = 1`
  // Envoi (SMTP), dossier « traite » et rangement automatique (facultatifs : sans eux, les valeurs en place sont conservees)
  const db = useDatabase()
  if (b.smtpHost !== undefined || b.smtpPort !== undefined || b.smtpSecure !== undefined) {
    const preset = SMTP_PRESETS[provider.key]
    let smtpHost = String(b.smtpHost ?? '').trim().toLowerCase(), smtpPort = Number(b.smtpPort), smtpSecure = b.smtpSecure
    if (preset) { smtpPort = preset.port; smtpSecure = preset.secure; smtpHost = preset.sameAsImap ? host : preset.host }
    if (!/^[a-z0-9]([a-z0-9.-]{1,98})[a-z0-9]$/.test(smtpHost) || !smtpHost.includes('.')) throw bad('Serveur d\'envoi (SMTP) invalide')
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 || typeof smtpSecure !== 'boolean') throw bad('Port ou sécurité SMTP invalide')
    await db.sql`UPDATE imap_config SET smtp_host = ${smtpHost}, smtp_port = ${smtpPort}, smtp_secure = ${smtpSecure ? 1 : 0} WHERE id = 1`
  }
  if (typeof b.fromName === 'string') await db.sql`UPDATE imap_config SET from_name = ${b.fromName.replace(/[\r\n"<>]/g, ' ').trim().slice(0, 80)} WHERE id = 1`
  if (b.treatedFolder !== undefined) {
    const t = String(b.treatedFolder).trim()
    if (!t || t.length > 120 || /\p{Cc}/u.test(t) || t.toUpperCase() === 'INBOX') throw bad('Dossier « traité » invalide')
    await db.sql`UPDATE imap_config SET treated_folder = ${t} WHERE id = 1`
  }
  if (typeof b.autoFile === 'boolean') await db.sql`UPDATE imap_config SET auto_file = ${b.autoFile ? 1 : 0} WHERE id = 1`
  // Options de l'interface e-mail (facultatives : sans elles, la valeur en place est conservee)
  if (typeof b.syncMail === 'boolean') await useDatabase().sql`UPDATE imap_config SET sync_mail = ${b.syncMail ? 1 : 0} WHERE id = 1`
  if (b.mailDays !== undefined) {
    const d = Number(b.mailDays)
    if (!Number.isInteger(d) || d < 1 || d > 365) throw bad('Historique des e-mails : 1 à 365 jours')
    await useDatabase().sql`UPDATE imap_config SET mail_days = ${d} WHERE id = 1`
  }
  return { ok: true }
})
