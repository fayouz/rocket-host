// Verifie un lien d'invitation / de reinitialisation (public : le jeton secret fait office de preuve)
export default defineEventHandler(async (event) => inspectToken(event, getQuery(event).token))
