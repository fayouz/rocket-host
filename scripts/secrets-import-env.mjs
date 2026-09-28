// Importe en base les reglages et secrets encore presents dans l'environnement (.env) : idempotent, n'affiche JAMAIS de valeur.
//   npm run secrets:import-env [-- <base sqlite>] [--force]
// Sans --force, une valeur deja en base n'est pas ecrasee (la base, modifiee dans l'appli, fait foi). Relancer ne change rien.
// Ensuite : retirer ces lignes de .env et redemarrer (voir docs/secrets.md).
import { CONFIG_ENTRIES, CONNECTOR_SECRET, sealSecret, secretKeysFromEnv } from '../server/utils/secretCrypto.ts'
import { dbPathArg, openDb } from './secrets-lib.mjs'

const force = process.argv.includes('--force')
const { current } = secretKeysFromEnv()
if (!current) { console.error('ROCKET_SECRETS_KEY absente ou invalide (openssl rand -base64 32) : rien importé.'); process.exit(1) }
const path = dbPathArg()
const db = openDb(path)
const now = new Date().toISOString()
const env = name => (process.env[name] || process.env[`NUXT_${name}`] || '').trim() // NUXT_<NOM> : forme passee par docker-compose
const names = [...CONFIG_ENTRIES, ...[...new Set(Object.keys(process.env).map(n => n.replace(/^NUXT_/, '')).filter(n => CONNECTOR_SECRET.test(n)))].map(name => ({ name, kind: 'secret' }))]
const report = { imported: [], kept: [], absent: [] }
for (const { name, kind } of names) {
  const v = env(name)
  if (!v) { report.absent.push(name); continue }
  if (kind === 'setting') {
    const exists = db.prepare('SELECT 1 FROM app_setting WHERE name = ?').get(name)
    if (exists && !force) { report.kept.push(name); continue }
    db.prepare('INSERT INTO app_setting (name, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(name, v, now)
  } else {
    const exists = db.prepare('SELECT 1 FROM secret WHERE name = ?').get(name)
    if (exists && !force) { report.kept.push(name); continue }
    const s = sealSecret(name, v, current)
    db.prepare(`INSERT INTO secret (name, ciphertext, nonce, key_version, hint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce, key_version = excluded.key_version, hint = excluded.hint, updated_at = excluded.updated_at`)
      .run(name, s.ciphertext, s.nonce, s.keyVersion, s.hint, now, now)
  }
  report.imported.push(name)
}
if (report.imported.length) try { db.prepare("INSERT INTO audit_log (at, user_id, username, action, detail, ip) VALUES (?, NULL, 'script', 'secrets_import_env', ?, 'serveur')").run(now, report.imported.join(', ').slice(0, 500)) } catch { /* base neuve sans journal : l'appli le creera */ }
console.log(`Base : ${path}`)
console.log(`Importés (${report.imported.length}) : ${report.imported.join(', ') || '—'}`)
console.log(`Déjà en base, gardés (${report.kept.length}) : ${report.kept.join(', ') || '—'}${report.kept.length && !force ? '  (--force pour écraser)' : ''}`)
console.log(`Absents de l'environnement (${report.absent.length}) : ${report.absent.join(', ') || '—'}`)
if (report.imported.length || report.kept.length) console.log('\nÉtape suivante : retirer ces lignes de .env, garder ROCKET_SECRETS_KEY (et sa sauvegarde), redémarrer.')
