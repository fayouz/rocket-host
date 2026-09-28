// Page de connexion : Rocket Auth actif ? connexion locale gardee ? (aucun secret renvoye)
export default defineEventHandler(() => ({ enabled: rocketAuthEnabled(), localLogin: localLoginAllowed() }))
