// Verifications des secrets, sans Nuxt ni reseau : npm run check:secrets
//  1. aller-retour AES-256-GCM, nonce different a chaque chiffrement, AAD (nom) verifiee, falsification detectee, mauvaise cle refusee ;
//  2. rotation (ancienne cle -> nouvelle) ;
//  3. « l'API ne renvoie jamais de valeur » : les routes /api/settings/connexions et /api/imap n'exposent que l'etat (lecture statique
//     du code) et aucune route ni page ne lit getSecret pour le renvoyer.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
const { sealSecret, openSecret, parseSecretsKey, secretKeysFromEnv, secretHint, isKnownSecretName, CONFIG_ENTRIES } = await import('../server/utils/secretCrypto.ts')

const k1 = parseSecretsKey(randomBytes(32).toString('base64')), k2 = parseSecretsKey(randomBytes(32).toString('base64'))
const v = 'rpm_' + randomBytes(18).toString('hex')
const a = sealSecret('PMS_API_TOKEN', v, k1), b = sealSecret('PMS_API_TOKEN', v, k1)
assert.equal(openSecret('PMS_API_TOKEN', a, [k1]), v, 'aller-retour')
assert.notEqual(a.nonce, b.nonce, 'nonce unique'); assert.notEqual(a.ciphertext, b.ciphertext)
assert.ok(!a.ciphertext.includes(v) && !Buffer.from(a.ciphertext, 'base64').toString('utf8').includes(v), 'texte chiffre opaque')
assert.equal(a.hint, v.slice(-4)); assert.equal(secretHint('court'), '', 'pas d\'indice pour une valeur courte')
assert.throws(() => openSecret('WEBHOOK_TOKEN', a, [k1]), 'AAD : autre nom refuse')
const t = Buffer.from(a.ciphertext, 'base64'); t[0] ^= 1
assert.throws(() => openSecret('PMS_API_TOKEN', { ...a, ciphertext: t.toString('base64') }, [k1]), 'falsification detectee')
assert.throws(() => openSecret('PMS_API_TOKEN', { ...a, keyVersion: k2.version }, [k2]), 'mauvaise cle')
assert.throws(() => parseSecretsKey(Buffer.alloc(16).toString('base64')), 'cle de 16 octets refusee')
// Rotation
const keys = secretKeysFromEnv({ ROCKET_SECRETS_KEY: k2.key.toString('base64'), ROCKET_SECRETS_KEY_OLD: k1.key.toString('base64') })
const rotated = sealSecret('PMS_API_TOKEN', openSecret('PMS_API_TOKEN', a, keys.all), keys.current)
assert.equal(rotated.keyVersion, k2.version); assert.equal(openSecret('PMS_API_TOKEN', rotated, [k2]), v)
assert.ok(isKnownSecretName('CONNECTOR_MON_SERVICE') && !isKnownSecretName('PATH') && !isKnownSecretName('connector_x'))
console.log('OK chiffrement : aller-retour, nonce, AAD, falsification, mauvaise cle, rotation')

// « L'API ne renvoie jamais de valeur »
const walk = d => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
// Routes autorisees a LIRE un secret (pour appeler un service : en-tete sortant, config de brique), relues a la main.
// Toute nouvelle route qui lit un secret fait echouer ce controle tant qu'elle n'est pas relue et ajoutee ici.
const OUTBOUND_OK = new Set(['server/api/dashboard/smart.get.ts', 'server/api/logements/[id]/reservations/[bookingId]/conversation.get.ts',
  'server/api/logements/[id]/reservations/[bookingId]/conversation.post.ts', 'server/api/logements/[id]/reservations/[bookingId]/pricing.get.ts'])
const leaks = []
for (const f of walk('server/api').map(x => x.replace(/\\/g, '/'))) {
  const src = readFileSync(f, 'utf8')
  if (/ciphertext|openSecret|reloadConfigCache/.test(src)) leaks.push(`${f} (acces direct au stockage)`)
  if (/getSecret\(/.test(src) && !OUTBOUND_OK.has(f)) leaks.push(`${f} (lit un secret : a relire)`)
}
const get = readFileSync('server/api/settings/connexions.get.ts', 'utf8')
assert.ok(!/getSecret/.test(get), 'connexions.get ne lit aucune valeur secrete')
const overview = readFileSync('server/utils/secrets.ts', 'utf8')
const statusFn = overview.slice(overview.indexOf('export function secretStatus'), overview.indexOf('export function listConnectorSecrets'))
assert.ok(!/value:/.test(statusFn.replace(/s\.value/g, '')), 'secretStatus ne renvoie pas de champ value')
const cfgFn = overview.slice(overview.indexOf('export function configOverview'), overview.indexOf('export async function setSetting'))
assert.ok(/e\.kind === 'setting'[\s\S]*value: getSetting/.test(cfgFn) && !/getSecret/.test(cfgFn), 'configOverview : valeur pour les reglages seulement')
assert.ok(!CONFIG_ENTRIES.some(e => e.kind === 'setting' && /TOKEN|SECRET|PASSWORD|API_KEY/.test(e.name)), 'aucun secret range comme reglage en clair')
assert.deepEqual(leaks, [], `routes susceptibles de renvoyer un secret : ${leaks.join(', ')}`)
console.log('OK API : aucune route ne renvoie de valeur secrete (etat + indice seulement)')
