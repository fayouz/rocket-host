// QR code (SVG) du lien secret d'un logement. L'adresse est deduite de la requete (Host / X-Forwarded-*).
import QRCode from 'qrcode'
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'propertyId'))
  await ensureStock()
  const row = ((await useDatabase().sql`SELECT token FROM property_token WHERE property_id = ${id}`).rows as any[])[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Logement inconnu' })
  const url = `${getRequestProtocol(event, { xForwardedProto: true })}://${getRequestHost(event, { xForwardedHost: true })}/r/${row.token}`
  setHeader(event, 'content-type', 'image/svg+xml')
  setHeader(event, 'cache-control', 'no-store')
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 240 })
  // <title> = adresse encodee (lisible par les lecteurs d'ecran et verifiable sans scanner)
  const esc = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return svg.replace(/^(<svg[^>]*>)/, `$1<title>${esc}</title>`)
})
