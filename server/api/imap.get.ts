// Configuration IMAP (sans le mot de passe, qui n'est jamais renvoye), regles et etat
export default defineEventHandler(async () => {
  const logements = await ensureLogements()
  return {
    config: await getImapConfig(),
    passwordSet: !!useRuntimeConfig().imapPassword,
    rules: await getImapRules(),
    running: isImapRunning(),
    providers: MAIL_PROVIDERS.map(({ mx, ...p }) => ({ ...p, smtp: SMTP_PRESETS[p.key] ?? null })),
    logements: logements.map(l => ({ id: l.id, name: l.name })),
    categories: Object.entries(CATEGORIES).map(([key, c]) => ({ key, ...c })),
  }
})
