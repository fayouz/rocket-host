// Verifie que la table des permissions (server/utils/policy.ts) et le dossier server/api sont d'accord :
//  - toute route (fichier) doit avoir une ligne dans la table (sinon elle serait refusee par defaut) ;
//  - toute ligne de la table doit correspondre a un fichier (pas de route fantome dans le Swagger).
// Usage : npm run check:policy   (code de sortie 1 en cas d'ecart : a brancher sur la CI)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = d => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const norm = p => p.replace(/:[A-Za-z]+/g, ':p')

const files = new Map()
for (const f of walk('server/api').filter(f => f.endsWith('.ts'))) {
  const m = f.replace(/\\/g, '/').replace(/^server\/api/, '/api').match(/^(.*)\.(get|post|put|patch|delete)\.ts$/)
  if (!m) { console.error(`Nom de fichier inattendu : ${f}`); process.exitCode = 1; continue }
  files.set(`${m[2].toUpperCase()} ${norm(m[1].replace(/\[([A-Za-z]+)\]/g, ':$1'))}`, f)
}
const table = new Map()
for (const line of readFileSync('server/utils/policy.ts', 'utf8').split('\n')) {
  const m = line.match(/^\s*\['(GET|POST|PUT|PATCH|DELETE)',\s*'(\/api\/[^']*)',\s*'([AGCMP]+)'/)
  if (m) table.set(`${m[1]} ${norm(m[2])}`, m[3])
}
const missing = [...files.keys()].filter(k => !table.has(k))
const ghost = [...table.keys()].filter(k => !files.has(k))
console.log(`${files.size} routes (fichiers), ${table.size} lignes dans la table des permissions`)
if (missing.length) { console.error('\nRoutes SANS ligne dans la table (refusees par defaut) :\n  ' + missing.map(k => `${k}   <- ${files.get(k)}`).join('\n  ')); process.exitCode = 1 }
if (ghost.length) { console.error('\nLignes de la table SANS fichier de route :\n  ' + ghost.join('\n  ')); process.exitCode = 1 }
if (!missing.length && !ghost.length) console.log('OK : la table couvre exactement toutes les routes.')
