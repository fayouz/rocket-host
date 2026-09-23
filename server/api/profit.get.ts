// Rentabilite : filtree selon les logements autorises du compte, et le filtre optionnel ?properties=1,2 (selecteur du tableau de bord)
export default defineEventHandler(async (event) => {
  const data = await loadData()
  const ids = await effectivePropertyIds(event)
  const scoped = ids ? { ...data, bookings: data.bookings.filter(b => ids.has(b.propertyId)), properties: data.properties.filter(p => ids.has(p.id)) } : data
  const profit = buildProfit(scoped)
  const logementIds = ids ? (await ensureLogements()).filter(l => l.lodgifyPropertyId !== null && ids.has(l.lodgifyPropertyId)).map(l => l.id) : undefined
  const chargesByMonth = await getChargesByMonth(profit.months.map(m => m.month), logementIds)
  return { ...profit, months: profit.months.map(m => ({ ...m, charges: chargesByMonth[m.month] ?? 0 })) }
})
