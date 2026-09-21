// Liste des logements : un compte non administrateur ne voit que les siens
export default defineEventHandler(async (event) => {
  const scope = await scopeOf(event)
  const all = await ensureLogements()
  return { logements: scope ? all.filter(l => scope.has(l.id)) : all }
})
