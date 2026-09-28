// Outils communs aux scripts secrets:* (base SQLite en direct, meme schema que server/utils/secrets.ts)
import { DatabaseSync } from 'node:sqlite'
export function openDb(path) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA busy_timeout = 8000')
  db.exec('CREATE TABLE IF NOT EXISTS app_setting (name TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)')
  db.exec(`CREATE TABLE IF NOT EXISTS secret (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, ciphertext TEXT NOT NULL, nonce TEXT NOT NULL,
    key_version TEXT NOT NULL, hint TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  return db
}
export const dbPathArg = () => process.argv.slice(2).find(a => !a.startsWith('--')) || process.env.ROCKET_DB_PATH || '.data/db.sqlite3'
