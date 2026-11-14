// Page de connexion : Connexion Loussa actif ? connexion locale gardee ? (aucun secret renvoye)
export default defineEventHandler(() => ({ enabled: rocketAuthEnabled(), localLogin: localLoginAllowed() }))
