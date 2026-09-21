// Base de donnees, puis compte de depart. En production, une configuration de securite invalide ARRETE le processus (le serveur ne reste jamais
// allume avec un mot de passe par defaut ou sans compte administrateur valide) ; en developpement, l'erreur est seulement affichee.
export default defineNitroPlugin(async () => {
  await initDb()
  try { await ensureAdmin() } catch (e: any) {
    console.error(`\n[sécurité] ${e?.message ?? e}\n`)
    if (isStrict()) process.exit(1)
    throw e
  }
})
