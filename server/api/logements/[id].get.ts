// Fiche du logement ; pms = Rocket PMS actif (PMS_API_URL renseigné), pour que les onglets affichent les données du PMS.
export default defineEventHandler(async (event) => ({ ...(await getLogement(getRouterParam(event, 'id'))), pms: pmsEnabled() }))
