// Langue de l'interface des pages voyageur (livret, écran TV), déduite du navigateur (Accept-Language).
// Le contenu libre écrit par l'hôte (mot de bienvenue, règlement...) n'est PAS traduit : saisi une seule fois, tel quel.
const DICT = {
  fr: {
    welcomeTo: 'Bienvenue au', hello: 'Bonjour', wifi: 'Wi-Fi', network: 'Réseau', password: 'Mot de passe',
    checkin: 'Arrivée', checkout: 'Départ', access: 'Accès', rules: 'Règlement intérieur', tips: 'Conseils du quartier',
    faq: 'Questions fréquentes', welcomeText: 'Mot de bienvenue', empty: 'Le livret de ce logement n\'a pas encore été rempli.',
    invalid: 'Lien invalide.', weather: 'Météo', devices: 'Équipements du logement', deviceOffline: 'Hors ligne',
    deviceOn: 'Allumé', deviceOff: 'Éteint',
  },
  en: {
    welcomeTo: 'Welcome to', hello: 'Hello', wifi: 'Wi-Fi', network: 'Network', password: 'Password',
    checkin: 'Check-in', checkout: 'Check-out', access: 'Access', rules: 'House rules', tips: 'Local tips',
    faq: 'FAQ', welcomeText: 'Welcome message', empty: 'This property\'s guide has not been filled in yet.',
    invalid: 'Invalid link.', weather: 'Weather', devices: 'Home devices', deviceOffline: 'Offline',
    deviceOn: 'On', deviceOff: 'Off',
  },
} as const
export type GuestLang = keyof typeof DICT

export function useGuestLang() {
  const headers = import.meta.server ? useRequestHeaders(['accept-language']) : {}
  const accept = import.meta.server ? (headers['accept-language'] ?? '') : (navigator.language || '')
  const lang: GuestLang = /^en\b/i.test(accept) ? 'en' : 'fr'
  return { lang, t: DICT[lang] }
}

const DATE_LOCALE: Record<GuestLang, string> = { fr: 'fr-FR', en: 'en-GB' }
export function formatGuestDate(iso: string, lang: GuestLang) {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' })
}

const WEATHER_LABEL: Record<number, { fr: string; en: string }> = {
  0: { fr: 'Ciel dégagé', en: 'Clear sky' }, 1: { fr: 'Plutôt dégagé', en: 'Mainly clear' },
  2: { fr: 'Partiellement nuageux', en: 'Partly cloudy' }, 3: { fr: 'Couvert', en: 'Overcast' },
  45: { fr: 'Brouillard', en: 'Fog' }, 48: { fr: 'Brouillard givrant', en: 'Depositing rime fog' },
  51: { fr: 'Bruine légère', en: 'Light drizzle' }, 53: { fr: 'Bruine', en: 'Drizzle' }, 55: { fr: 'Bruine forte', en: 'Dense drizzle' },
  61: { fr: 'Pluie légère', en: 'Light rain' }, 63: { fr: 'Pluie', en: 'Rain' }, 65: { fr: 'Pluie forte', en: 'Heavy rain' },
  71: { fr: 'Neige légère', en: 'Light snow' }, 73: { fr: 'Neige', en: 'Snow' }, 75: { fr: 'Neige forte', en: 'Heavy snow' },
  80: { fr: 'Averses légères', en: 'Light showers' }, 81: { fr: 'Averses', en: 'Showers' }, 82: { fr: 'Averses violentes', en: 'Violent showers' },
  95: { fr: 'Orage', en: 'Thunderstorm' }, 96: { fr: 'Orage et grêle', en: 'Thunderstorm with hail' }, 99: { fr: 'Orage et grêle fort', en: 'Severe thunderstorm with hail' },
}
export const weatherLabel = (code: number, lang: GuestLang) => (WEATHER_LABEL[code] ?? WEATHER_LABEL[3]!)[lang]

export function weatherIcon(code: number, isDay: boolean) {
  if (code === 0 || code === 1) return isDay ? 'i-lucide-sun' : 'i-lucide-moon'
  if (code === 2) return isDay ? 'i-lucide-cloud-sun' : 'i-lucide-cloud-moon'
  if (code === 3 || code === 45 || code === 48) return 'i-lucide-cloud'
  if (code >= 51 && code <= 65) return 'i-lucide-cloud-drizzle'
  if (code >= 71 && code <= 75) return 'i-lucide-cloud-snow'
  if (code >= 80 && code <= 82) return 'i-lucide-cloud-rain'
  if (code >= 95) return 'i-lucide-cloud-lightning'
  return 'i-lucide-cloud'
}
