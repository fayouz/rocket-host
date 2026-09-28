// Lien voyageur (livret personnalisé au séjour, page /g/ de Rocket PMS) d'une réservation + QR code (SVG en data URL).
import QRCode from 'qrcode'
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  const link = await pmsGuestLink(lg.lodgifyPropertyId, Number(getRouterParam(event, 'bookingId')))
  const qr = link.url ? await QRCode.toDataURL(link.url, { margin: 1, width: 240 }) : ''
  return { ...link, qr }
})
