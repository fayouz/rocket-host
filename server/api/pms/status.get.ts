// Etat de la connexion a Rocket PMS (page Reglages > Plugins). Jamais de secret renvoye au navigateur.
export default defineEventHandler(async () => pmsHealth())
