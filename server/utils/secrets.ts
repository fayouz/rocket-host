// Reglages et secrets d'integration en base (voir docs/secrets.md) : lecture synchrone depuis un cache memoire court (60 s),
// recharge a chaque ecriture. Repli sur la variable d'environnement du meme nom UNIQUEMENT pour la migration (avertissement unique
// dans le journal, sans la valeur) : `npm run secrets:import-env` puis retirer la ligne de .env.
// Les valeurs de secrets ne sortent jamais d'ici vers le navigateur : les routes n'exposent que presence + indice (4 derniers caracteres).
import { CONFIG_ENTRIES, isKnownSecretName, isKnownSettingName, openSecret, sealSecret, secretKeysFromEnv } from './secretCrypto'

interface Cache { at: number; settings: Map<string, string>; secrets: Map<string, { value: string | null; hint: string; updatedAt: string }> }
let cache: Cache = { at: 0, settings: new Map(), secrets: new Map() }
let loading: Promise<void> | null = null
const warned = new Set<string>()
const TTL = 60_000

export async function initSecretTables() {
  const db = useDatabase()
  await db.exec('CREATE TABLE IF NOT EXISTS app_setting (name TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)')
  await db.exec(`CREATE TABLE IF NOT EXISTS secret (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, ciphertext TEXT NOT NULL, nonce TEXT NOT NULL,
    key_version TEXT NOT NULL, hint TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  await reloadConfigCache()
}

export async function reloadConfigCache() {
  const db = useDatabase()
  const { all } = secretKeysFromEnv()
  const settings = new Map<string, string>()
  for (const r of (await db.sql`SELECT name, value FROM app_setting`).rows as any[]) settings.set(String(r.name), String(r.value))
  const secrets: Cache['secrets'] = new Map()
  for (const r of (await db.sql`SELECT name, ciphertext, nonce, key_version, hint, updated_at FROM secret`).rows as any[]) {
    let value: string | null = null
    try { value = openSecret(String(r.name), { ciphertext: String(r.ciphertext), nonce: String(r.nonce), keyVersion: String(r.key_version) }, all) }
    catch (e: any) { if (!warned.has(`dec:${r.name}`)) { warned.add(`dec:${r.name}`); console.warn(`[secrets] ${e?.message ?? 'déchiffrement impossible'}`) } }
    secrets.set(String(r.name), { value, hint: String(r.hint || ''), updatedAt: String(r.updated_at) })
  }
  cache = { at: Date.now(), settings, secrets }
}

function refreshIfStale() {
  if (Date.now() - cache.at < TTL || loading) return
  loading = reloadConfigCache().catch(() => {}).finally(() => { loading = null })
}

// Ancien nom (.env) ou forme NUXT_<NOM> passee par docker-compose avant cette version
const envValue = (name: string) => (process.env[name] || process.env[`NUXT_${name}`] || '').trim()
function fromEnv(name: string) {
  const v = envValue(name)
  if (v && !warned.has(name)) { warned.add(name); console.warn(`[secrets] ${name} lu depuis l'environnement (repli de migration) : lance « npm run secrets:import-env » puis retire-le de .env`) }
  return v
}

/** Valeur d'un reglage non secret (adresse, identifiant). */
export function getSetting(name: string): string {
  refreshIfStale()
  return cache.settings.has(name) ? cache.settings.get(name)! : fromEnv(name)
}

/** Valeur d'un secret (dechiffree), '' si absent. Usage serveur uniquement : ne jamais la renvoyer au navigateur. */
export function getSecret(name: string): string {
  refreshIfStale()
  const s = cache.secrets.get(name)
  return s ? (s.value ?? '') : fromEnv(name)
}

export const hasSecret = (name: string) => !!getSecret(name)

type Source = 'db' | 'env' | ''
/** Etat d'un secret pour l'interface : jamais la valeur. */
export function secretStatus(name: string): { set: boolean; hint: string; source: Source; updatedAt: string | null; error?: string } {
  refreshIfStale()
  const s = cache.secrets.get(name)
  if (s) return { set: s.value !== null, hint: s.hint, source: 'db', updatedAt: s.updatedAt, ...(s.value === null ? { error: 'indéchiffrable (clé ROCKET_SECRETS_KEY changée ?)' } : {}) }
  return envValue(name) ? { set: true, hint: '', source: 'env', updatedAt: null } : { set: false, hint: '', source: '', updatedAt: null }
}

export function listConnectorSecrets() {
  refreshIfStale()
  return [...cache.secrets.keys()].filter(n => n.startsWith('CONNECTOR_')).sort().map(name => ({ name, ...secretStatus(name) }))
}

/** Vue d'ensemble pour Reglages > Connexions (valeurs des reglages, etat seulement des secrets). */
export function configOverview() {
  return CONFIG_ENTRIES.map(e => e.kind === 'setting'
    ? { ...e, value: getSetting(e.name), source: (cache.settings.has(e.name) ? 'db' : envValue(e.name) ? 'env' : '') as Source }
    : { ...e, ...secretStatus(e.name) })
}

export async function setSetting(name: string, value: string) {
  if (!isKnownSettingName(name)) throw createError({ statusCode: 400, statusMessage: `Réglage inconnu : ${name}` })
  const v = value.trim().slice(0, 500)
  if (/_URL$|_URI$/.test(name) && v && !/^https?:\/\/[^\s]+$/.test(v)) throw createError({ statusCode: 400, statusMessage: `${name} : adresse http(s) attendue` })
  await useDatabase().sql`INSERT INTO app_setting (name, value, updated_at) VALUES (${name}, ${v}, ${new Date().toISOString()})
    ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  await reloadConfigCache()
}

/** Ecrit (ou efface si value === null) un secret chiffre. */
export async function setSecret(name: string, value: string | null) {
  if (!isKnownSecretName(name)) throw createError({ statusCode: 400, statusMessage: `Secret inconnu : ${name} (CONNECTOR_… pour les connecteurs)` })
  const db = useDatabase()
  if (value === null) { await db.sql`DELETE FROM secret WHERE name = ${name}`; await reloadConfigCache(); return }
  const v = value.trim()
  if (!v || v.length > 4096) throw createError({ statusCode: 400, statusMessage: 'Valeur vide ou trop longue' })
  const { current } = secretKeysFromEnv()
  if (!current) throw createError({ statusCode: 503, statusMessage: 'ROCKET_SECRETS_KEY absente de l\'environnement : impossible de chiffrer (voir docs/secrets.md)' })
  const s = sealSecret(name, v, current)
  const now = new Date().toISOString()
  await db.sql`INSERT INTO secret (name, ciphertext, nonce, key_version, hint, created_at, updated_at)
    VALUES (${name}, ${s.ciphertext}, ${s.nonce}, ${s.keyVersion}, ${s.hint}, ${now}, ${now})
    ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, key_version = excluded.key_version,
      hint = excluded.hint, updated_at = excluded.updated_at`
  await reloadConfigCache()
}

export const secretsKeyPresent = () => !!secretKeysFromEnv().current
