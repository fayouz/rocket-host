// Catalogue des widgets du livret/écran TV — doit rester aligné avec WIDGET_IDS (server/utils/guestbook.ts).
// Chaque widget ne s'affiche que s'il a du contenu (logique déjà dans les pages) ; ce catalogue ne fait que
// nommer les choix proposés à l'hôte pour activer/désactiver et réordonner.
export const WIDGET_CATALOG = [
  { id: 'weather', label: 'Météo', icon: 'i-lucide-cloud-sun' },
  { id: 'wifi', label: 'Wi-Fi', icon: 'i-lucide-wifi' },
  { id: 'checkin', label: 'Arrivée', icon: 'i-lucide-log-in' },
  { id: 'checkout', label: 'Départ', icon: 'i-lucide-log-out' },
  { id: 'access', label: 'Accès', icon: 'i-lucide-map-pin' },
  { id: 'rules', label: 'Règlement intérieur', icon: 'i-lucide-list-checks' },
  { id: 'tips', label: 'Conseils du quartier', icon: 'i-lucide-compass' },
  { id: 'faq', label: 'Questions fréquentes', icon: 'i-lucide-circle-help' },
  { id: 'devices', label: 'Domotique', icon: 'i-lucide-cpu' },
] as const

export type WidgetId = typeof WIDGET_CATALOG[number]['id']
export const DEFAULT_WIDGET_ORDER: WidgetId[] = WIDGET_CATALOG.map(w => w.id)
export const widgetLabel = (id: string) => WIDGET_CATALOG.find(w => w.id === id)?.label ?? id
