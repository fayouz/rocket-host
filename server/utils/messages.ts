// Messages envoyes (type "Owner") lus dans les fils Lodgify. Le contenu n'est jamais lu : date, sujet, canal, statut.
import type { Booking, SentMessage } from './types'

const cache = new Map<string, { at: number; msgs: SentMessage[] }>()

async function sentMessages(threadUid: string): Promise<SentMessage[]> {
  const hit = cache.get(threadUid)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.msgs
  const t = await lodgifyCall(`/messaging/${threadUid}`, useRuntimeConfig().lodgifyApiKey).catch(() => null)
  const msgs: SentMessage[] = (t?.messages || [])
    .filter((m: any) => m.type === 'Owner')
    // Dates Lodgify sans fuseau : on les lit comme UTC
    .map((m: any) => ({ id: m.id, at: new Date(String(m.date_created) + 'Z').toISOString(), subject: String(m.subject || ''), channel: m.route || '', status: m.message_status || '' }))
  cache.set(threadUid, { at: Date.now(), msgs })
  return msgs
}

export async function loadSentMessages(bookings: Booking[], demo: boolean): Promise<Record<number, SentMessage[]>> {
  if (demo) return {}
  const out: Record<number, SentMessage[]> = {}
  await Promise.all(bookings.filter(b => b.threadUid).map(async (b) => { out[b.id] = await sentMessages(b.threadUid!) }))
  return out
}
