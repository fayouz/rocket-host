// Retour de l'autorisation OAuth : verifie l'etat, echange le code contre les jetons, puis renvoie vers la page du logement.
import { timingSafeEqual } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  let saved: { state?: string; ret?: string } = {}
  try { saved = JSON.parse(Buffer.from(getCookie(event, 'homey_oauth') ?? '', 'base64url').toString('utf8')) } catch { /* cookie absent ou invalide */ }
  deleteCookie(event, 'homey_oauth', { path: '/api/homey' })
  const back = (status: string) => sendRedirect(event, `${saved.ret && /^\/logements\/\d+\/domotique$/.test(saved.ret) ? saved.ret : '/'}?homey=${status}`, 302)
  const a = Buffer.from(String(q.state ?? '')), b = Buffer.from(String(saved.state ?? ''))
  if (!b.length || a.length !== b.length || !timingSafeEqual(a, b)) return back('etat')
  if (q.error || typeof q.code !== 'string' || !q.code) return back('refuse')
  try { await completeAuthorization(q.code, redirectUri(event)) } catch { return back('erreur') }
  return back('ok')
})
