// Stock : filtre optionnel ?properties=1,2 (selecteur du tableau de bord) ; la page Réglages > Stock l'appelle sans filtre (catalogue complet)
export default defineEventHandler(async (event) => buildStock(await effectivePropertyIds(event)))
