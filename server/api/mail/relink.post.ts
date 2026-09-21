// Recalcule les associations automatiques (apres ajout d'un contact, par exemple). Les choix manuels et les retraits sont conserves.
export default defineEventHandler(async () => ({ ok: true, linked: await relinkAll() }))
