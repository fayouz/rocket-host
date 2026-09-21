// Liste des comptes (administrateur) avec leurs logements autorises
export default defineEventHandler(async () => ({
  users: await listUsers(), roles: ROLES,
  logements: (await ensureLogements()).map(l => ({ id: l.id, name: l.name })),
}))
