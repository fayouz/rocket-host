// Mot de passe oublie : { identifier } (identifiant ou e-mail). Reponse identique que le compte existe ou non ; le lien part par e-mail.
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  return requestPasswordReset(event, b.identifier)
})
