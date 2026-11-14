// Selecteur d'applications de LoussaSuite (lu chez Connexion Loussa : GET /api/suite/apps)
export default defineEventHandler(async () => ({ enabled: rocketAuthEnabled(), ...(await suiteApps()) }))
