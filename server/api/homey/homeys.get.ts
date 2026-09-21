// Homey du compte connecte (nom et identifiant seulement)
export default defineEventHandler(async () => {
  const list = await listHomeys(true)
  return { homeys: list.map(h => ({ id: h.id, name: h.name })) }
})
