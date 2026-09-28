// Chiffrement des secrets en base (table `secret`) : AES-256-GCM (node:crypto), nonce aleatoire de 12 octets par valeur,
// etiquette d'authentification (16 octets) accolee au texte chiffre. Le nom du secret sert de donnee associee (AAD) :
// un texte chiffre recopie sous un autre nom ne se dechiffre pas.
// Cle maitre : ROCKET_SECRETS_KEY (base64, 32 octets), seule cle laissee dans l'environnement. Rotation : l'ancienne cle passe dans
// ROCKET_SECRETS_KEY_OLD, la nouvelle dans ROCKET_SECRETS_KEY, puis `npm run secrets:rotate` rechiffre tout.
// La version de cle est une empreinte courte (8 hex du SHA-256 de la cle) : jamais la cle elle-meme.
// Volontairement sans auto-import Nuxt : utilise aussi par les scripts (scripts/secrets-*.mjs, scripts/check-secrets.mjs).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export interface SecretKey { version: string; key: Buffer }
export interface SealedSecret { ciphertext: string; nonce: string; keyVersion: string; hint: string }

export function parseSecretsKey(b64: string | undefined): SecretKey | null {
  const raw = String(b64 || '').trim()
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ROCKET_SECRETS_KEY invalide : 32 octets encodés en base64 attendus (openssl rand -base64 32)')
  return { version: createHash('sha256').update(key).digest('hex').slice(0, 8), key }
}

// Cles disponibles : la courante (chiffre) puis l'ancienne (dechiffre seulement, pendant une rotation)
export function secretKeysFromEnv(env: Record<string, string | undefined> = process.env) {
  const current = parseSecretsKey(env.ROCKET_SECRETS_KEY)
  const old = parseSecretsKey(env.ROCKET_SECRETS_KEY_OLD)
  return { current, all: [current, old].filter(Boolean) as SecretKey[] }
}

// Indice affiche a la place de la valeur : 4 derniers caracteres seulement si la valeur est assez longue pour ne rien trahir
export const secretHint = (value: string) => (value.length >= 12 ? value.slice(-4) : '')

export function sealSecret(name: string, value: string, k: SecretKey): SealedSecret {
  const nonce = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', k.key, nonce)
  c.setAAD(Buffer.from(name, 'utf8'))
  const ct = Buffer.concat([c.update(value, 'utf8'), c.final(), c.getAuthTag()])
  return { ciphertext: ct.toString('base64'), nonce: nonce.toString('base64'), keyVersion: k.version, hint: secretHint(value) }
}

export function openSecret(name: string, row: { ciphertext: string; nonce: string; keyVersion: string }, keys: SecretKey[]): string {
  const k = keys.find(x => x.version === row.keyVersion)
  if (!k) throw new Error(`secret ${name} : clé ${row.keyVersion} indisponible (ROCKET_SECRETS_KEY / ROCKET_SECRETS_KEY_OLD)`)
  const buf = Buffer.from(row.ciphertext, 'base64')
  const d = createDecipheriv('aes-256-gcm', k.key, Buffer.from(row.nonce, 'base64'))
  d.setAAD(Buffer.from(name, 'utf8'))
  d.setAuthTag(buf.subarray(buf.length - 16))
  return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8')
}

// Catalogue des reglages et secrets geres dans l'appli (nom = ancienne variable .env, pour une migration sans surprise).
// kind 'secret' : chiffre, jamais renvoye ; kind 'setting' : texte clair (adresses, identifiants non sensibles).
export interface ConfigEntry { name: string; kind: 'secret' | 'setting'; group: string; label: string; help?: string; placeholder?: string }
export const CONFIG_GROUPS: { key: string; title: string; description: string }[] = [
  { key: 'pms', title: 'Rocket PMS', description: 'Adresse de l\'API et jeton d\'application (rpm_…). Vide = Lodgify/Nuki en direct.' },
  { key: 'place', title: 'Rocket Place', description: 'Tableau de bord intelligent : lieux, accès, écrans.' },
  { key: 'clean', title: 'Rocket Clean', description: 'Tableau de bord intelligent : ménage et linge.' },
  { key: 'stock', title: 'Rocket Stock', description: 'Tableau de bord intelligent : stock.' },
  { key: 'cast', title: 'Rocket Cast', description: 'Tableau de bord intelligent : écrans TV.' },
  { key: 'mailer', title: 'Rocket Mailer', description: 'Boîtes partagées et boîtes perso gérées par Rocket Mailer (assistant « Ajouter une boîte e-mail »). Appels faits au nom de l\'utilisateur connecté (X-Impersonate-User).' },
  { key: 'mailoauth', title: 'Connexion Google / Microsoft (boîtes e-mail)', description: 'Applications OAuth pour « Se connecter avec Google / Microsoft » dans l\'assistant boîte e-mail. Adresse de retour : https://<hôte>/api/mail/oauth/google|microsoft/callback.' },
  { key: 'mail', title: 'E-mail (IMAP/SMTP)', description: 'Mot de passe de la boîte ; serveur, identifiant et règles dans Boîte e-mail (IMAP/SMTP).' },
  { key: 'homey', title: 'Domotique (Homey)', description: 'Clé d\'API Homey Pro (accès local) et application OAuth (mode cloud).' },
  { key: 'direct', title: 'Lodgify / Nuki en direct', description: 'Utilisés seulement quand Rocket PMS n\'est pas branché.' },
  { key: 'webhook', title: 'Webhook (n8n)', description: 'Jeton attendu dans « Authorization: Bearer … » des imports n8n.' },
]
export const CONFIG_ENTRIES: ConfigEntry[] = [
  { name: 'PMS_API_URL', kind: 'setting', group: 'pms', label: 'Adresse de l\'API', placeholder: 'https://pms.exemple.fr' },
  { name: 'PMS_API_TOKEN', kind: 'secret', group: 'pms', label: 'Jeton d\'application' },
  { name: 'PMS_IMPERSONATE_USER', kind: 'setting', group: 'pms', label: 'Compte expéditeur des e-mails (Rocket Mailer)' },
  ...(['place', 'clean', 'stock', 'cast'] as const).flatMap(b => [
    { name: `ROCKET_${b.toUpperCase()}_URL`, kind: 'setting' as const, group: b, label: 'Adresse de l\'API', placeholder: `https://${b}.exemple.fr` },
    { name: `ROCKET_${b.toUpperCase()}_TOKEN`, kind: 'secret' as const, group: b, label: 'Jeton d\'application' },
  ]),
  { name: 'ROCKET_MAILER_URL', kind: 'setting', group: 'mailer', label: 'Adresse de l\'API', placeholder: 'https://mailer.exemple.fr' },
  { name: 'ROCKET_MAILER_TOKEN', kind: 'secret', group: 'mailer', label: 'Jeton d\'application' },
  { name: 'GOOGLE_MAIL_CLIENT_ID', kind: 'setting', group: 'mailoauth', label: 'Google : identifiant client OAuth', placeholder: '….apps.googleusercontent.com' },
  { name: 'GOOGLE_MAIL_CLIENT_SECRET', kind: 'secret', group: 'mailoauth', label: 'Google : secret client OAuth' },
  { name: 'MICROSOFT_MAIL_CLIENT_ID', kind: 'setting', group: 'mailoauth', label: 'Microsoft : identifiant d\'application (client)' },
  { name: 'MICROSOFT_MAIL_CLIENT_SECRET', kind: 'secret', group: 'mailoauth', label: 'Microsoft : secret client' },
  { name: 'MICROSOFT_MAIL_TENANT', kind: 'setting', group: 'mailoauth', label: 'Microsoft : locataire (facultatif)', placeholder: 'common' },
  { name: 'IMAP_PASSWORD', kind: 'secret', group: 'mail', label: 'Mot de passe de la boîte (IMAP et SMTP)' },
  { name: 'HOMEY_API_KEY', kind: 'secret', group: 'homey', label: 'Clé d\'API Homey Pro (local)', help: 'Homey web app > Réglages > Clés d\'API ; droits minimaux : lire et commander les appareils.' },
  { name: 'HOMEY_CLIENT_ID', kind: 'setting', group: 'homey', label: 'Identifiant de l\'application OAuth (cloud)' },
  { name: 'HOMEY_CLIENT_SECRET', kind: 'secret', group: 'homey', label: 'Secret de l\'application OAuth (cloud)' },
  { name: 'HOMEY_REDIRECT_URI', kind: 'setting', group: 'homey', label: 'Adresse de retour OAuth (facultatif)', placeholder: 'https://…/api/homey/callback' },
  { name: 'LODGIFY_API_KEY', kind: 'secret', group: 'direct', label: 'Clé d\'API Lodgify' },
  { name: 'NUKI_API_TOKEN', kind: 'secret', group: 'direct', label: 'Jeton Nuki Web' },
  { name: 'WEBHOOK_TOKEN', kind: 'secret', group: 'webhook', label: 'Jeton du webhook', help: 'openssl rand -hex 24' },
]
// Secrets des connecteurs (plugins « Service web »…) : nom libre commencant par CONNECTOR_
export const CONNECTOR_SECRET = /^CONNECTOR_[A-Z0-9_]{1,60}$/
// Secrets des boites e-mail ajoutees par l'assistant : mot de passe (Locale) ou jeton de renouvellement OAuth (Google / Microsoft)
export const MAILBOX_SECRET = /^MAILBOX_\d{1,9}_(PASSWORD|REFRESH_TOKEN)$/
export const isKnownSecretName = (n: string) => CONNECTOR_SECRET.test(n) || MAILBOX_SECRET.test(n) || CONFIG_ENTRIES.some(e => e.kind === 'secret' && e.name === n)
export const isKnownSettingName = (n: string) => CONFIG_ENTRIES.some(e => e.kind === 'setting' && e.name === n)
