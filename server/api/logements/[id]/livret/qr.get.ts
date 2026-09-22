// QR code (SVG) du lien secret du livret d'accueil, a imprimer/afficher dans le logement.
import QRCode from 'qrcode'
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  await ensureGuestbook(lg.id)
  const row = ((await useDatabase().sql`SELECT token FROM guestbook_token WHERE logement_id = ${lg.id}`).rows as any[])[0]
  const url = `${getRequestProtocol(event, { xForwardedProto: true })}://${getRequestHost(event, { xForwardedHost: true })}/g/${row.token}`
  setHeader(event, 'content-type', 'image/svg+xml')
  setHeader(event, 'cache-control', 'no-store')
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 240 })
  const esc = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return svg.replace(/^(<svg[^>]*>)/, `$1<title>${esc}</title>`)
})
