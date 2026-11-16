// i18n : `labelKey` est la clé de traduction (t(w.labelKey)) ; `label` reste le libellé FR de repli.
// Catalogue des widgets du livret/écran TV — doit rester aligné avec WIDGET_IDS (server/utils/guestbook.ts).
// Chaque widget ne s'affiche que s'il a du contenu (logique déjà dans les pages) ; ce catalogue ne fait que
// nommer les choix proposés à l'hôte pour activer/désactiver et réordonner.
export const WIDGET_CATALOG = [
  { id: 'weather', label: 'Météo', labelKey: 'daily.widgets.weather', icon: 'i-lucide-cloud-sun' },
  { id: 'wifi', label: 'Wi-Fi', labelKey: 'daily.widgets.wifi', icon: 'i-lucide-wifi' },
  { id: 'checkin', label: 'Arrivée', labelKey: 'daily.widgets.checkin', icon: 'i-lucide-log-in' },
  { id: 'checkout', label: 'Départ', labelKey: 'daily.widgets.checkout', icon: 'i-lucide-log-out' },
  { id: 'access', label: 'Accès', labelKey: 'daily.widgets.access', icon: 'i-lucide-map-pin' },
  { id: 'rules', label: 'Règlement intérieur', labelKey: 'daily.widgets.rules', icon: 'i-lucide-list-checks' },
  { id: 'tips', label: 'Conseils du quartier', labelKey: 'daily.widgets.tips', icon: 'i-lucide-compass' },
  { id: 'faq', label: 'Questions fréquentes', labelKey: 'daily.widgets.faq', icon: 'i-lucide-circle-help' },
  { id: 'devices', label: 'Domotique', labelKey: 'daily.widgets.devices', icon: 'i-lucide-cpu' },
] as const

export type WidgetId = typeof WIDGET_CATALOG[number]['id']
export const DEFAULT_WIDGET_ORDER: WidgetId[] = WIDGET_CATALOG.map(w => w.id)
export const widgetLabel = (id: string, t?: (k: string) => string) => { const w = WIDGET_CATALOG.find(x => x.id === id); return w ? (t ? t(w.labelKey) : w.label) : id }
