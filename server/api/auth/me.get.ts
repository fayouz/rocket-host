// Utilisateur connecte (le middleware garantit une session)
export default defineEventHandler(async (event) => ({ user: await currentUser(event) }))
