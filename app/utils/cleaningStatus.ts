// Couleur de badge pour un statut de menage (texte libre, synchronise depuis Lodgify PM Modules via n8n — voir
// server/api/cleaning-tasks.post.ts). Mutualise entre la carte Turnover enrichie et TurnoverWidget.
export function cleaningStatusColor(status?: string | null) {
  const s = (status ?? '').toLowerCase()
  if (/terminé|fait|complet|done/.test(s)) return 'success' as const
  if (/problème|annulé|erreur/.test(s)) return 'error' as const
  if (!status || /inconnue|non assignée|à compléter/.test(s)) return 'warning' as const
  return 'neutral' as const
}
