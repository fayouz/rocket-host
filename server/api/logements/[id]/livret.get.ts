// Contenu du livret d'accueil du logement, pour l'edition cote hote.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const content = await getGuestbook(lg.id)
  const token = ((await useDatabase().sql`SELECT token FROM guestbook_token WHERE logement_id = ${lg.id}`).rows as any[])[0]?.token
  return { logement: { id: lg.id, name: lg.name }, content, token }
})
