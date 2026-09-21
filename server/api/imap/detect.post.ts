// Devine le service de messagerie a partir du domaine de l'adresse e-mail, en lisant les enregistrements MX publics (DNS).
// N'envoie rien au domaine : simple interrogation DNS. Corps : { email }
import { resolveMx, resolve4 } from 'node:dns/promises'

export default defineEventHandler(async (event) => {
  const email = String((await readBody(event))?.email ?? '').trim().toLowerCase()
  const domain = email.split('@')[1] ?? ''
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain) || domain.length > 120)
    throw createError({ statusCode: 400, statusMessage: 'Adresse e-mail invalide' })
  const timeout = <T>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), 6000))])
  let mx: string[] = []
  try { mx = (await timeout(resolveMx(domain))).sort((a, b) => a.priority - b.priority).map(m => m.exchange) }
  catch (e: any) { return { ok: false, domain, mx, message: e?.code === 'ENODATA' || e?.code === 'ENOTFOUND' ? `Aucun serveur de messagerie (MX) trouvé pour ${domain}.` : `Recherche DNS impossible : ${e?.message || e}` } }
  const provider = detectProvider(mx)
  let hostResolves: boolean | null = null
  if (provider?.host) hostResolves = await timeout(resolve4(provider.host)).then(a => a.length > 0).catch(() => false)
  return { ok: true, domain, mx, provider: provider?.key ?? null, label: provider?.label ?? null, host: provider?.host ?? null, hostResolves }
})
