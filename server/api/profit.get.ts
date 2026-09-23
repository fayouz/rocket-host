export default defineEventHandler(async () => {
  const profit = buildProfit(await loadData())
  const chargesByMonth = await getChargesByMonth(profit.months.map(m => m.month))
  return { ...profit, months: profit.months.map(m => ({ ...m, charges: chargesByMonth[m.month] ?? 0 })) }
})
