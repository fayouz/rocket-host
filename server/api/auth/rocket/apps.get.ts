// Selecteur d'applications de la suite Rocket (lu chez Rocket Auth : GET /api/suite/apps)
export default defineEventHandler(async () => ({ enabled: rocketAuthEnabled(), ...(await suiteApps()) }))
