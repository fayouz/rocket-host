// Reglages > Connexions : adresses en clair, secrets reduits a leur etat (present, indice « ••••1234 », origine base/env). Jamais de valeur secrete.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  return { keyPresent: secretsKeyPresent(), groups: CONFIG_GROUPS, entries: configOverview(), connectorSecrets: listConnectorSecrets() }
})
