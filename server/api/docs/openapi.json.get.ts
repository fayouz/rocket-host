// Specification OpenAPI 3 GENEREE depuis la table des permissions (server/utils/policy.ts) : elle ne peut pas diverger des regles appliquees.
// Reservee a l'administrateur. Interface : page /docs-api (Swagger UI hebergee par l'appli).
const ROLE_NAMES: Record<string, string> = { A: 'administrateur', G: 'gestionnaire', C: 'comptable', M: 'ménage', P: 'public (jeton ou sans session)' }
const SCOPE_NAMES: Record<string, string> = { logement: 'le logement du chemin', document: 'le logement du document', node: 'le logement de l\'élément', booking: 'le logement de la réservation', handler: 'filtré par la route selon les logements autorisés' }

export default defineEventHandler(() => {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const r of RULES) {
    const p = r.path.replace(/:([A-Za-z]+)/g, '{$1}')
    const roles = [...r.roles].map(l => ROLE_NAMES[l]!)
    paths[p] ??= {}
    paths[p]![r.method.toLowerCase()] = {
      tags: [r.tag],
      summary: r.summary,
      description: `**Rôles autorisés :** ${roles.join(', ')}.${r.scope ? `\n\n**Périmètre (non-administrateurs) :** ${SCOPE_NAMES[r.scope]}.` : ''}`,
      operationId: `${r.method.toLowerCase()}${r.path.replace(/[^A-Za-z]+(.)?/g, (_m, c) => (c ? c.toUpperCase() : ''))}`,
      parameters: r.params.map(name => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
      ...(r.body ? { requestBody: { description: r.body, content: { 'application/json': { schema: { type: 'object' } } } } } : {}),
      'x-roles': [...r.roles],
      'x-scope': r.scope || 'aucun',
      security: r.roles === 'P' ? [] : [{ sessionCookie: [] }],
      responses: { 200: { description: 'Succès' }, 401: { description: 'Connexion requise' }, 403: { description: 'Rôle ou logement non autorisé' } },
    }
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'Rocket Host — API interne',
      version: '1.0.0',
      description: 'Générée automatiquement depuis la table des permissions (`server/utils/policy.ts`). Rôles : administrateur, gestionnaire, comptable (lecture), ménage. Refus par défaut : toute route non listée est refusée. Les non-administrateurs ne voient que leurs logements autorisés.',
    },
    servers: [{ url: '/' }],
    tags: [...new Set(RULES.map(r => r.tag))].map(name => ({ name })),
    components: { securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'lh_session', description: 'Session ouverte par POST /api/auth/login (cookie HttpOnly). Les écritures doivent venir de la même origine (protection CSRF).' } } },
    paths,
  }
})
