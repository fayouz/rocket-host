// Fiche du logement ; pms = Loussa Réservations actif (PMS_API_URL renseigné), pour que les onglets affichent les données du PMS.
export default defineEventHandler(async (event) => ({ ...(await getLogement(getRouterParam(event, 'id'))), pms: pmsEnabled() }))
