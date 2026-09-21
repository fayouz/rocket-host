// Services de messagerie proposes dans Reglages > E-mail : serveur IMAP, port, securite, et motifs des enregistrements MX du domaine
// (pour deviner le service a partir de l'adresse e-mail). Les serveurs sont ceux documentes par chaque service ; a verifier
// dans l'aide du fournisseur en cas de doute. `hostPattern` : le serveur reste modifiable (numero de serveur propre a chaque compte).
export interface MailProvider {
  key: string; label: string; host: string; port: number; secure: boolean
  note?: string
  hostPattern?: string // si present, l'hote est modifiable mais doit correspondre (regex)
  mx?: string[]        // motifs (regex) des serveurs MX de ce service
}

export const MAIL_PROVIDERS: MailProvider[] = [
  { key: 'ovh-mxplan', label: 'OVH — MX Plan (e-mail inclus avec le domaine ou l\'hébergement)', host: 'ssl0.ovh.net', port: 993, secure: true,
    note: 'Cas le plus courant chez OVH : serveur ssl0.ovh.net, identifiant = adresse e-mail complète.', mx: ['(^|\\.)mail\\.ovh\\.(net|com)$', '\\.ovh\\.(net|com)$'] },
  { key: 'ovh-emailpro', label: 'OVH — Email Pro', host: 'pro1.mail.ovh.net', port: 993, secure: true, hostPattern: '^pro\\d+\\.mail\\.ovh\\.net$',
    note: 'Le numéro du serveur (pro1, pro2, pro3…) est indiqué dans ton espace client OVH, rubrique Email Pro.' },
  { key: 'ovh-exchange', label: 'OVH — Exchange', host: 'ex1.mail.ovh.net', port: 993, secure: true, hostPattern: '^ex\\d+\\.mail\\.ovh\\.net$',
    note: 'Le numéro du serveur (ex1, ex2, ex3…) est indiqué dans ton espace client OVH, rubrique Exchange.' },
  { key: 'google', label: 'Gmail / Google Workspace', host: 'imap.gmail.com', port: 993, secure: true,
    note: 'Demande un « mot de passe d\'application » (validation en deux étapes obligatoire) et l\'accès IMAP activé.', mx: ['aspmx\\.l\\.google\\.com$', '\\.google\\.com$', 'googlemail\\.com$'] },
  { key: 'microsoft', label: 'Microsoft 365 / Outlook', host: 'outlook.office365.com', port: 993, secure: true,
    note: 'L\'authentification simple est souvent désactivée par les organisations : il faut alors un mot de passe d\'application ou l\'administrateur.', mx: ['mail\\.protection\\.outlook\\.com$', 'outlook\\.com$'] },
  { key: 'icloud', label: 'iCloud Mail', host: 'imap.mail.me.com', port: 993, secure: true, note: 'Demande un mot de passe spécifique à l\'app.', mx: ['icloud\\.com$', 'me\\.com$'] },
  { key: 'yahoo', label: 'Yahoo Mail', host: 'imap.mail.yahoo.com', port: 993, secure: true, note: 'Demande un mot de passe d\'application.', mx: ['yahoodns\\.net$', 'yahoo\\.com$'] },
  { key: 'infomaniak', label: 'Infomaniak', host: 'mail.infomaniak.com', port: 993, secure: true, mx: ['infomaniak\\.(ch|com)$'] },
  { key: 'ionos', label: 'IONOS (1&1)', host: 'imap.ionos.fr', port: 993, secure: true, mx: ['kundenserver\\.de$', 'ionos\\.(fr|com|de)$', '1and1\\.'] },
  { key: 'gandi', label: 'Gandi', host: 'mail.gandi.net', port: 993, secure: true, mx: ['gandi\\.net$'] },
  { key: 'zoho', label: 'Zoho Mail (Europe)', host: 'imap.zoho.eu', port: 993, secure: true, note: 'Pour un compte hébergé aux États-Unis, le serveur est imap.zoho.com : choisis « Autre ».', mx: ['zoho\\.eu$', 'zoho\\.com$'] },
  { key: 'orange', label: 'Orange', host: 'imap.orange.fr', port: 993, secure: true, mx: ['orange\\.fr$', 'wanadoo\\.fr$'] },
  { key: 'free', label: 'Free', host: 'imap.free.fr', port: 993, secure: true, mx: ['free\\.fr$'] },
  { key: 'sfr', label: 'SFR', host: 'imap.sfr.fr', port: 993, secure: true, mx: ['sfr\\.fr$'] },
  { key: 'custom', label: 'Autre serveur (saisie manuelle)', host: '', port: 993, secure: true, note: 'Renseigne le serveur IMAP, le port et le type de sécurité indiqués par ton fournisseur.' },
]

export const getProvider = (key: unknown) => MAIL_PROVIDERS.find(p => p.key === key)

// Service qui correspond a une liste de serveurs MX (le premier motif qui matche, dans l'ordre de la liste ci-dessus)
export function detectProvider(mxHosts: string[]): MailProvider | null {
  const hosts = mxHosts.map(h => h.toLowerCase().replace(/\.$/, ''))
  return MAIL_PROVIDERS.find(p => p.mx?.some(re => hosts.some(h => new RegExp(re).test(h)))) ?? null
}

// Envoi (SMTP) des services connus : [serveur, port, TLS direct (465) ou STARTTLS (587)]. sameAsImap : meme serveur que l'IMAP (numero propre au compte).
export const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean; sameAsImap?: boolean }> = {
  'ovh-mxplan': { host: 'ssl0.ovh.net', port: 465, secure: true },
  'ovh-emailpro': { host: 'pro1.mail.ovh.net', port: 587, secure: false, sameAsImap: true },
  'ovh-exchange': { host: 'ex1.mail.ovh.net', port: 587, secure: false, sameAsImap: true },
  google: { host: 'smtp.gmail.com', port: 465, secure: true },
  microsoft: { host: 'smtp.office365.com', port: 587, secure: false },
  icloud: { host: 'smtp.mail.me.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  infomaniak: { host: 'mail.infomaniak.com', port: 465, secure: true },
  ionos: { host: 'smtp.ionos.fr', port: 465, secure: true },
  gandi: { host: 'mail.gandi.net', port: 465, secure: true },
  zoho: { host: 'smtp.zoho.eu', port: 465, secure: true },
  orange: { host: 'smtp.orange.fr', port: 465, secure: true },
  free: { host: 'smtp.free.fr', port: 465, secure: true },
  sfr: { host: 'smtp.sfr.fr', port: 465, secure: true },
}
