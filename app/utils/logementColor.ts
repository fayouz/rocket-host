// Palette couleur repere pour les logements (choisie dans Réglages > Logements, voir server/utils/logements.ts#LOGEMENT_COLORS)
export const LOGEMENT_COLOR_CHOICES = [
  { value: '', label: 'Aucune', hex: '' },
  { value: 'red', label: 'Rouge', hex: '#ef4444' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
  { value: 'amber', label: 'Ambre', hex: '#f59e0b' },
  { value: 'green', label: 'Vert', hex: '#22c55e' },
  { value: 'teal', label: 'Sarcelle', hex: '#14b8a6' },
  { value: 'blue', label: 'Bleu', hex: '#3b82f6' },
  { value: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { value: 'pink', label: 'Rose', hex: '#ec4899' },
] as const

export function logementColorHex(color?: string | null): string | null {
  return LOGEMENT_COLOR_CHOICES.find(c => c.value === color)?.hex || null
}
