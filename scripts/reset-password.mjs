// SECOURS : genere un lien de reinitialisation a usage unique pour un compte (ex. administrateur enferme dehors, sans e-mail configure).
// A lancer SUR LE SERVEUR (il faut acceder au fichier de base). Le lien s'affiche dans le terminal ; rien n'est envoye.
//   node scripts/reset-password.mjs <identifiant> <base sqlite, ex. .data/db.sqlite> <adresse du site, ex. https://app.exemple.fr>
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes } from 'node:crypto'

const [username, dbPath, site] = process.argv.slice(2)
if (!username || !dbPath || !/^https?:\/\/[^/\s]+$/.test(site ?? '')) { console.error('usage : node scripts/reset-password.mjs <identifiant> <base sqlite> <adresse du site, ex. https://app.exemple.fr>'); process.exit(2) }
const db = new DatabaseSync(dbPath)
db.exec('PRAGMA busy_timeout = 8000')
const u = db.prepare('SELECT id, username, active, password_hash FROM app_user WHERE username = ? COLLATE NOCASE').get(username)
if (!u) { console.error(`Compte « ${username} » introuvable.`); process.exit(1) }
if (!u.active) { console.error('Ce compte est désactivé : réactive-le d\'abord dans Réglages > Utilisateurs.'); process.exit(1) }
const token = randomBytes(32).toString('base64url')
const now = new Date().toISOString()
db.prepare('UPDATE user_token SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(now, u.id)
db.prepare('INSERT INTO user_token (user_id, token_hash, purpose, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
  .run(u.id, createHash('sha256').update(token).digest('hex'), u.password_hash ? 'reset' : 'invite', new Date(Date.now() + 3600_000).toISOString(), now)
db.prepare("INSERT INTO audit_log (at, user_id, username, action, detail, ip) VALUES (?, ?, ?, 'reinitialisation_secours', 'lien genere en ligne de commande', 'serveur')").run(now, u.id, u.username)
console.log(`\nLien de réinitialisation pour « ${u.username} » (à usage unique, valable 1 heure) :\n${site}/activation?token=${encodeURIComponent(token)}\n`)
