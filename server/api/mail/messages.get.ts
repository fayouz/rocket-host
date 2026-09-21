// Liste des e-mails synchronises : ?folder= &q= &link=(booking|contact|none) &booking= &contact= &limit= &offset=
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const num = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : undefined }
  const cfg = await getImapConfig()
  const folders = ((await useDatabase().sql`SELECT DISTINCT folder FROM mail_message ORDER BY folder`).rows as any[]).map(r => String(r.folder))
  const r = await listMail({
    folder: (({ inbox: cfg.folder, sent: cfg.sentFolder, spam: cfg.spamFolder } as Record<string, string>)[String(q.box ?? '')]) || (typeof q.folder === 'string' && q.folder ? q.folder : undefined), q: typeof q.q === 'string' ? q.q : undefined,
    link: typeof q.link === 'string' ? q.link : undefined, booking: num(q.booking), contact: num(q.contact), limit: num(q.limit), offset: Number(q.offset) || 0,
  })
  return {
    ...r, folders, syncing: isMailSyncing(), passwordSet: !!useRuntimeConfig().imapPassword,
    sync: { enabled: cfg.syncMail, days: cfg.mailDays, at: cfg.mailSyncedAt, result: cfg.mailResult },
  }
})
