// Verifications unitaires de server/utils/rocketAuth.ts (sans Rocket Auth ni reseau) : npm run check:rocket-auth
// Signature RS256 par JWKS, emetteur/audience/expiration/type, PKCE, roles d'apres les groupes.
import { generateKeyPairSync, sign } from 'node:crypto'
import assert from 'node:assert/strict'
const m = await import('../server/utils/rocketAuth.ts')

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' }
const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (payload, header = {}) => { const h = enc({ alg: 'RS256', kid: 'k1', typ: 'JWT', ...header }); const p = enc(payload); return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}` }
const now = Math.floor(Date.now() / 1000)
const base = { iss: 'https://auth.test', aud: 'loussahousing', sub: 'u1', iat: now, exp: now + 300, email: 'a@b.c', groups: ['rocket-admins'] }
const opts = { issuer: 'https://auth.test', audience: 'loussahousing' }
let n = 0
const ok = (name, fn) => { fn(); n++; console.log('ok  ', name) }
const ko = (name, fn, re) => { assert.throws(fn, re); n++; console.log('ok  ', name) }

ok('jeton valide accepte', () => assert.equal(m.verifyJwtWithKeys(jwt(base), [jwk], opts).sub, 'u1'))
ko('signature falsifiee', () => { const t = jwt(base).split('.'); t[1] = enc({ ...base, sub: 'pirate' }); m.verifyJwtWithKeys(t.join('.'), [jwk], opts) }, /Signature/)
ko('autre cle', () => { const other = { ...generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'jwk' }), kid: 'k1' }; m.verifyJwtWithKeys(jwt(base), [other], opts) }, /Signature/)
ko('alg none refuse', () => m.verifyJwtWithKeys(jwt(base, { alg: 'none' }), [jwk], opts), /Algorithme/)
ko('HS256 refuse', () => m.verifyJwtWithKeys(jwt(base, { alg: 'HS256' }), [jwk], opts), /Algorithme/)
ko('mauvais emetteur', () => m.verifyJwtWithKeys(jwt({ ...base, iss: 'https://evil' }), [jwk], opts), /metteur/)
ko('mauvaise audience', () => m.verifyJwtWithKeys(jwt({ ...base, aud: 'rocket-mailer' }), [jwk], opts), /Audience/)
ko('expire', () => m.verifyJwtWithKeys(jwt({ ...base, exp: now - 600 }), [jwk], opts), /expir/)
ok('logout+jwt accepte', () => m.verifyJwtWithKeys(jwt(base, { typ: 'logout+jwt' }), [jwk], { ...opts, typ: 'logout+jwt' }))
ko('id_token presente comme logout token', () => m.verifyJwtWithKeys(jwt(base), [jwk], { ...opts, typ: 'logout+jwt' }), /Type/)
ok('PKCE S256 (SHA-256 base64url, vecteur connu)', () => assert.equal(m.pkceChallenge('abc'), 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0'))
const cfg = { adminGroup: 'rocket-admins', roleGroups: m.parseRoleGroups('gestionnaire=lh-gestion|gestion, comptable=lh-compta, inconnu=x, menage=lh-menage') }
ok('groupes -> admin', () => assert.equal(m.roleFromGroups(['x', 'rocket-admins'], cfg), 'admin'))
ok('groupes -> role le plus fort', () => assert.equal(m.roleFromGroups(['lh-menage', 'gestion'], cfg), 'gestionnaire'))
ok('groupes inconnus -> null', () => assert.equal(m.roleFromGroups(['x'], cfg), null))
ok('role inconnu ignore', () => assert.equal(cfg.roleGroups.x, undefined))
ok('next interne seulement', () => { assert.equal(m.safeNextPath('//evil.com'), '/'); assert.equal(m.safeNextPath('https://evil'), '/'); assert.equal(m.safeNextPath('/logements/2'), '/logements/2') })
console.log(`\n${n} verifications OK`)
