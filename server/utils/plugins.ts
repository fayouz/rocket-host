// Bibliotheque de plugins (catalogue integre a l'appli, aucun code exterieur n'est execute) et connecteurs par logement.
// Un plugin decrit un type de service (Homey, service web...) : ses champs de configuration et ce qu'il sait faire
// (afficher des infos, lancer des actions manuelles, recuperer des documents). Un connecteur = un plugin configure pour
// un logement ; un logement peut en avoir plusieurs, y compris du meme plugin (ex. deux Homey).
//
// Secrets : jamais en base ni dans le navigateur. Un champ secret contient le NOM d'une variable de .env (prefixe CONNECTOR_
// obligatoire, pour qu'un connecteur ne puisse jamais lire les autres secrets de l'appli comme la cle Lodgify).

export type Capability = 'info' | 'actions' | 'documents'
export type PluginCategory = 'domotique' | 'documents' | 'general'

export interface PluginField {
  key: string; label: string; type: 'text' | 'url' | 'select' | 'secret' | 'textarea'
  required?: boolean; help?: string; placeholder?: string; default?: string
  options?: { label: string; value: string }[]
  optionsFrom?: 'homeys' // liste chargee a la demande (Homey du compte connecte)
  showIf?: { key: string; values: string[] } // champ affiche seulement si un autre champ a l'une de ces valeurs
}
export interface InfoCard { title: string; icon?: string; items: { label: string; value: string; hint?: string }[] }
export interface PluginAction { id: string; label: string; confirm: string }
// error : ce fichier n'a pas pu etre recupere (les autres le sont quand meme)
export interface RemoteDocument { externalId: string; filename: string; data?: Buffer; error?: string; title?: string; date?: string }

export interface ConnectorContext {
  connectorId: number; logementId: number
  config: Record<string, string>
  secret: (fieldKey: string) => string // valeur de la variable .env designee par le champ (erreur claire si absente)
}

export interface PluginDef {
  id: string; name: string; description: string; icon: string; category: PluginCategory
  capabilities: Capability[]
  fields: PluginField[]
  // Verifie la configuration cote serveur (appelee a l'enregistrement) ; renvoie les valeurs nettoyees
  validate?: (config: Record<string, string>, ctx: { logementId: number; connectorId: number }) => Promise<Record<string, string>>
  test: (ctx: ConnectorContext) => Promise<string>
  info?: (ctx: ConnectorContext) => Promise<InfoCard[]>
  actions?: (ctx: ConnectorContext) => PluginAction[]
  runAction?: (ctx: ConnectorContext, actionId: string) => Promise<string>
  documents?: (ctx: ConnectorContext) => Promise<RemoteDocument[]>
}

export const SECRET_VAR = /^CONNECTOR_[A-Z0-9_]{1,60}$/

// Valeur d'une variable secrete de .env designee par son nom (jamais renvoyee au navigateur)
export function readSecretVar(name: string, label: string) {
  if (!name) throw createError({ statusCode: 400, statusMessage: `« ${label} » : aucune variable indiquée` })
  if (!SECRET_VAR.test(name)) throw createError({ statusCode: 400, statusMessage: `« ${label} » : le nom doit commencer par CONNECTOR_ (lettres majuscules, chiffres, _)` })
  const v = process.env[name]
  if (!v) throw createError({ statusCode: 400, statusMessage: `Variable ${name} absente de .env (ajoute-la puis redémarre l'appli)` })
  return v
}

// Adresse privee / reseau local (LAN, localhost, .local) : les seuls endroits ou l'on accepte d'envoyer un secret en http,
// et les seuls ou l'on envoie la cle Homey locale (secret de l'appli, pas une variable CONNECTOR_).
export function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.local') || h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith('fe80:')) return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) // 100.64/10 : Tailscale
}
