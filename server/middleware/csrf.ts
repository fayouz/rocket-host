// Protection contre les requetes d'ecriture venant d'un AUTRE site (CSRF). Utile car l'appli est protegee par un mot de passe
// de navigateur (Basic) : sans cette verification, une page piegee ouverte dans le meme navigateur pourrait declencher, par
// exemple, un envoi d'e-mail. Les appels de n8n (serveur a serveur, sans en-tetes de navigateur) ne sont pas concernes.
export default defineEventHandler((event) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  const fetchSite = getHeader(event, 'sec-fetch-site')
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) throw createError({ statusCode: 403, statusMessage: 'Requête inter-sites refusée' })
  const origin = getHeader(event, 'origin')
  if (origin && origin !== 'null') {
    const host = getRequestHost(event, { xForwardedHost: true })
    let originHost = ''
    try { originHost = new URL(origin).host } catch { /* origine illisible : refusee ci-dessous */ }
    if (originHost !== host) throw createError({ statusCode: 403, statusMessage: 'Origine refusée' })
  } else if (origin === 'null') throw createError({ statusCode: 403, statusMessage: 'Origine refusée' })
})
