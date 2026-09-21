// Planificateur du releve IMAP : verifie chaque minute s'il est temps de releve (intervalle des Reglages). Desactive par defaut.
export default defineNitroPlugin((nitro) => {
  const g = globalThis as { __imapTimer?: ReturnType<typeof setInterval> }
  if (g.__imapTimer) clearInterval(g.__imapTimer) // rechargement a chaud : pas de doublon
  g.__imapTimer = setInterval(async () => {
    try {
      const cfg = await getImapConfig()
      const isDue = (at: string | null) => !at || Date.now() - Date.parse(at) >= cfg.intervalMin * 60_000
      if (cfg.enabled && isDue(cfg.lastRunAt)) await runImap('auto')
      if (cfg.syncMail && isDue(cfg.mailSyncedAt)) await syncMail()
    } catch { /* le prochain passage reessaiera */ }
  }, 60_000)
  nitro.hooks.hook('close', () => { if (g.__imapTimer) clearInterval(g.__imapTimer) })
})
