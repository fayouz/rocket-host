// Rotation de la cle maitre : ROCKET_SECRETS_KEY = nouvelle cle, ROCKET_SECRETS_KEY_OLD = ancienne. Rechiffre chaque secret avec la
// nouvelle cle (transaction : tout ou rien). N'affiche aucune valeur. Ensuite : retirer ROCKET_SECRETS_KEY_OLD et redemarrer.
//   npm run secrets:rotate [-- <base sqlite>]
import { openSecret, sealSecret, secretKeysFromEnv } from '../server/utils/secretCrypto.ts'
import { dbPathArg, openDb } from './secrets-lib.mjs'

const { current, all } = secretKeysFromEnv()
if (!current) { console.error('ROCKET_SECRETS_KEY absente ou invalide.'); process.exit(1) }
const db = openDb(dbPathArg())
const rows = db.prepare('SELECT name, ciphertext, nonce, key_version FROM secret').all()
const now = new Date().toISOString()
let done = 0, same = 0
db.exec('BEGIN IMMEDIATE')
try {
  for (const r of rows) {
    if (r.key_version === current.version) { same++; continue }
    const v = openSecret(r.name, { ciphertext: r.ciphertext, nonce: r.nonce, keyVersion: r.key_version }, all)
    const s = sealSecret(r.name, v, current)
    db.prepare('UPDATE secret SET ciphertext = ?, nonce = ?, key_version = ?, updated_at = ? WHERE name = ?').run(s.ciphertext, s.nonce, s.keyVersion, now, r.name)
    done++
  }
  db.exec('COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
  console.error(`Rotation annulée, rien n'a changé : ${e.message}`)
  process.exit(1)
}
console.log(`${done} secret(s) rechiffré(s) avec la clé ${current.version}, ${same} déjà à jour. Retire ROCKET_SECRETS_KEY_OLD puis redémarre.`)
