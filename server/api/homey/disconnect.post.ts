// Deconnecte le compte Homey (efface le jeton enregistre sur le serveur)
export default defineEventHandler(async () => { await disconnectCloud(); return { ok: true } })
