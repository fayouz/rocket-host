// Rangement automatique : { dryRun: true } renvoie le plan sans rien toucher ; sinon copie vers les dossiers cibles et
// deplace l'original dans le dossier « traite » (50 messages au plus par passage). Ecrit dans la boite.
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  return applyFiling({ dryRun: b.dryRun !== false, limit: 50 })
})
