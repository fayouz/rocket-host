// Journee : filtree selon les logements autorises du compte
export default defineEventHandler(async (event) => {
  const data = await loadData()
  const ids = await allowedPropertyIds(event)
  if (!ids) return buildToday(data)
  return buildToday({ ...data, bookings: data.bookings.filter(b => ids.has(b.propertyId)), properties: data.properties.filter(p => ids.has(p.id)) })
})
