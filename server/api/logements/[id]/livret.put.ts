// Enregistre le contenu du livret d'accueil (creation progressive, tous les champs sont facultatifs).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const content = parseGuestbook((await readBody(event)) ?? {})
  await saveGuestbook(lg.id, content)
  return { ok: true }
})
