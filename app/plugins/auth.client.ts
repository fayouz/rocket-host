// Session expirée ou révoquée pendant la navigation : toute réponse 401 renvoie vers la page de connexion.
export default defineNuxtPlugin(() => {
  const original = globalThis.$fetch
  globalThis.$fetch = original.create({
    onResponseError({ response }) {
      if (response.status === 401 && !location.pathname.startsWith('/connexion')) window.location.assign(`/connexion?next=${encodeURIComponent(location.pathname)}`)
    },
  }) as typeof $fetch
})
