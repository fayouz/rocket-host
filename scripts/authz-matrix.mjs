// MATRICE D'AUTORISATION : essaie chaque route de la specification OpenAPI avec chaque role, sur une appli DE TEST (base a part, mode demo).
//   node scripts/authz-matrix.mjs <adresse, ex. http://localhost:3100> <base SQLite de l'appli de test, ex. ./.data/db.sqlite>
// ATTENTION : le script cree des comptes, modifie et SUPPRIME des donnees dans la base indiquee. Ne jamais le lancer sur une base reelle.
// Verifie, pour chaque route : sans session -> 401 ; role non autorise -> 403 ; logement interdit -> 403 ; cas autorise -> ni 401 ni 403.
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [base, dbPath] = process.argv.slice(2)
if (!base || !dbPath) { console.error('usage : node scripts/authz-matrix.mjs <adresse> <base sqlite de TEST>'); process.exit(2) }
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error('Refus : le script ne cible que localhost.'); process.exit(2) }

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA busy_timeout = 8000')
const hash = pw => { const s = randomBytes(16); return `scrypt$16384$8$1$${s.toString('base64')}$${scryptSync(pw, s, 64, { N: 16384, r: 8, p: 1 }).toString('base64')}` }
const PW = `T#${randomBytes(12).toString('base64url')}!9a` // mot de passe de test aleatoire, propre a chaque execution
const ROLES = { admin: 'A', gest: 'G', compta: 'C', menage: 'M', vide: 'G' } // vide = gestionnaire SANS logement

// --- Jeu de donnees de test : 2 logements (1 autorise, 2 interdit), ressources dans chacun
const sessions = {}
async function call(user, method, path, opts = {}) {
  const res = await fetch(base + path, { method, redirect: 'manual', headers: { ...(sessions[user] ? { cookie: sessions[user] } : {}), ...(opts.headers ?? {}) }, body: opts.body })
  const text = await res.text() // corps lu une seule fois
  let msg = ''
  if (res.status >= 400) { try { msg = JSON.parse(text).statusMessage ?? '' } catch { /* corps non JSON */ } }
  return { status: res.status, msg, location: res.headers.get('location') ?? '', text }
}
async function login(user) {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user, password: PW }) })
  if (res.status !== 200) throw new Error(`connexion ${user} : ${res.status}`)
  sessions[user] = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
}

for (let i = 0; i < 30 && !db.prepare("SELECT 1 FROM app_user WHERE username='admin'").get(); i++) await new Promise(r => setTimeout(r, 1000))
db.prepare("UPDATE app_user SET password_hash=?, must_change=0, default_password=0 WHERE username='admin'").run(hash(PW))
for (const u of ['gest', 'compta', 'menage', 'vide']) {
  db.prepare("DELETE FROM app_user WHERE username=?").run(u)
  db.prepare("INSERT INTO app_user (username, display_name, role, password_hash, created_at) VALUES (?, ?, ?, ?, '2026-09-21T00:00:00Z')")
    .run(u, u, { gest: 'gestionnaire', compta: 'comptable', menage: 'menage', vide: 'gestionnaire' }[u], hash(PW))
}
await login('admin')
await call('admin', 'GET', '/api/logements') // cree les logements de demonstration (1 et 2)
const uid = u => db.prepare('SELECT id FROM app_user WHERE username=?').get(u).id
db.exec('DELETE FROM user_logement')
for (const u of ['gest', 'compta', 'menage']) db.prepare('INSERT INTO user_logement (user_id, logement_id) VALUES (?, 1)').run(uid(u)) // logement 1 seulement
for (const u of ['gest', 'compta', 'menage', 'vide']) await login(u)

db.exec('DELETE FROM fs_node_tag; DELETE FROM fs_tag; DELETE FROM fs_node; DELETE FROM document') // idempotent : relancable sur la meme base de test
const now = '2026-09-21T00:00:00Z'
const ins = (sql, ...a) => Number(db.prepare(sql).run(...a).lastInsertRowid)
const docs = { ok: ins("INSERT INTO document (logement_id,title,category,doc_date,note,file_path,original_name,mime,size,created_at) VALUES (1,'t','autre_doc','2026-01-01','','1/x.pdf','x.pdf','application/pdf',1,?)", now), ko: ins("INSERT INTO document (logement_id,title,category,doc_date,note,file_path,original_name,mime,size,created_at) VALUES (2,'t','autre_doc','2026-01-01','','2/x.pdf','x.pdf','application/pdf',1,?)", now) }
const nodes = { ok: ins("INSERT INTO fs_node (logement_id,parent_id,kind,name,created_at,updated_at) VALUES (1,NULL,'folder','A-ok',?,?)", now, now), ko: ins("INSERT INTO fs_node (logement_id,parent_id,kind,name,created_at,updated_at) VALUES (2,NULL,'folder','B-ko',?,?)", now, now) }
db.exec('DELETE FROM lock_link; DELETE FROM access_code')
db.exec("INSERT INTO lock_link (lock_id, property_id) VALUES (5001, 1), (5002, 2)")
db.exec("INSERT INTO access_code (booking_id, lock_id, code, valid_from, valid_until) VALUES (7001, 5001, '111111', '2026-01-01', '2026-01-02'), (7002, 5002, '222222', '2026-01-01', '2026-01-02')")
const TARGET = { logement: { ok: '1', ko: '2' }, document: { ok: docs.ok, ko: docs.ko }, node: { ok: nodes.ok, ko: nodes.ko }, booking: { ok: 7001, ko: 7002 } }

// --- Specification generee par l'appli
const spec = JSON.parse((await call('admin', 'GET', '/api/docs/openapi.json')).text)
const ops = []
for (const [path, item] of Object.entries(spec.paths)) for (const [method, op] of Object.entries(item)) ops.push({ method: method.toUpperCase(), path, roles: op['x-roles'].join(''), scope: op['x-scope'] === 'aucun' ? '' : op['x-scope'], params: (op.parameters ?? []).map(p => p.name) })
const SKIP_ALL = /^\/api\/auth\//
const NO_ADMIN_CALL = /^\/api\/(imap|mail|homey|codes\/|users\/\{id\}\/revoke-sessions)/ // appels vers l'exterieur, ou qui couperaient la session de l'administrateur de test lui-meme
ops.sort((a, b) => (a.method === 'DELETE') - (b.method === 'DELETE')) // les suppressions en dernier

const fill = (op, side) => op.path.replace(/\{(\w+)\}/g, (_m, name) => {
  if (op.scope && op.scope !== 'handler' && name === op.params[0]) return String(TARGET[op.scope][side])
  return { token: 'zz', tagId: '1', iid: '1', n: '0', propertyId: '1', id: '1', bookingId: '1', docId: '1' }[name] ?? '1'
})

const fails = []
let n = 0
const check = (label, cond, got) => { n++; if (!cond) fails.push(`${label}  -> obtenu ${got}`) }

for (const op of ops) {
  if (SKIP_ALL.test(op.path)) continue
  const isPublic = op.roles === 'P'
  const url = side => fill(op, side)
  // Sans session
  if (!isPublic) { const r = await call(null, op.method, url('ok')); check(`SANS SESSION ${op.method} ${op.path}`, r.status === 401, r.status) }
  for (const user of [...Object.keys(ROLES).filter(u => u !== 'admin'), 'admin']) { // l'administrateur en dernier : il peut supprimer la ressource visee
    if (isPublic) continue
    if (user === 'admin' && NO_ADMIN_CALL.test(op.path)) continue
    const letter = ROLES[user]
    const allowedRole = op.roles.includes(letter) || user === 'admin'
    const inScope = op.scope === '' || user === 'admin'
    if (!allowedRole) { const r = await call(user, op.method, url('ok')); check(`ROLE INTERDIT ${user} ${op.method} ${op.path}`, r.status === 403, r.status); continue }
    if (user === 'vide' && op.scope && op.scope !== 'handler') { const r = await call(user, op.method, url('ok')); check(`SANS LOGEMENT ${user} ${op.method} ${op.path}`, r.status === 403, r.status); continue }
    if (user !== 'admin' && op.scope && op.scope !== 'handler') {
      const ko = await call(user, op.method, url('ko')); check(`LOGEMENT INTERDIT ${user} ${op.method} ${op.path}`, ko.status === 403, ko.status)
    }
    if (user === 'vide') continue
    const r = await call(user, op.method, url('ok'))
    check(`AUTORISE ${user} ${op.method} ${op.path}`, r.status !== 401 && r.status !== 403, `${r.status} ${r.msg}`)
    void inScope
  }
}

// --- Routes qui filtrent elles-memes (scope "handler") : cas cibles (les ressources de test ont pu etre supprimees plus haut : on les recree)
nodes.ok = ins("INSERT INTO fs_node (logement_id,parent_id,kind,name,created_at,updated_at) VALUES (1,NULL,'folder','A-ok',?,?)", now, now)
nodes.ko = ins("INSERT INTO fs_node (logement_id,parent_id,kind,name,created_at,updated_at) VALUES (2,NULL,'folder','B-ko',?,?)", now, now)
const j = r => JSON.parse(r.text)
{
  const l = (await j(await call('gest', 'GET', '/api/logements'))).logements
  check('LISTE logements : gestionnaire ne voit que le logement 1', l.length === 1 && l[0].id === 1, JSON.stringify(l.map(x => x.id)))
  check('LISTE logements : administrateur voit tout', (await j(await call('admin', 'GET', '/api/logements'))).logements.length >= 2, '')
  check('LISTE logements : gestionnaire sans logement = liste vide', (await j(await call('vide', 'GET', '/api/logements'))).logements.length === 0, '')
  const root = await j(await call('compta', 'GET', '/api/explorer/list'))
  check('EXPLORATEUR racine : seulement le logement 1', root.items.length === 1 && root.items[0].id === 1, JSON.stringify(root.items.map(i => i.id)))
  check('EXPLORATEUR logement interdit', (await call('compta', 'GET', '/api/explorer/list?logement=2')).status === 403, '')
  const search = await j(await call('gest', 'GET', '/api/explorer/list?q=-ko'))
  check('EXPLORATEUR recherche globale : ne renvoie pas B-ko', !search.items.some(i => i.name === 'B-ko'), JSON.stringify(search.items.map(i => i.name)))
  const own = await j(await call('gest', 'GET', '/api/explorer/list?q=A-ok'))
  check('EXPLORATEUR recherche globale : trouve A-ok', own.items.some(i => i.name === 'A-ok'), JSON.stringify(own.items.map(i => i.name)))
  const jh = { 'content-type': 'application/json' }
  check('EXPLORATEUR creer dossier logement interdit', (await call('gest', 'POST', '/api/explorer/folder', { headers: jh, body: JSON.stringify({ logement: 2, name: 'x' }) })).status === 403, '')
  check('EXPLORATEUR creer dossier logement autorise', (await call('gest', 'POST', '/api/explorer/folder', { headers: jh, body: JSON.stringify({ logement: 1, name: 'ok-gest' }) })).status === 200, '')
  check('EXPLORATEUR comptable ne peut pas ecrire', (await call('compta', 'POST', '/api/explorer/folder', { headers: jh, body: JSON.stringify({ logement: 1, name: 'y' }) })).status === 403, '')
  const fd = new FormData(); fd.append('logement', '2'); fd.append('file', new Blob(['%PDF-1.4\n']), 'a.pdf')
  check('EXPLORATEUR depot logement interdit', (await call('gest', 'POST', '/api/explorer/upload', { body: fd })).status === 403, '')
  const tag = (await j(await call('gest', 'POST', '/api/explorer/tags', { headers: jh, body: JSON.stringify({ name: 'T-test' }) }))).id
  check('ETIQUETTES poser sur un element interdit', (await call('gest', 'POST', '/api/explorer/tags/assign', { headers: jh, body: JSON.stringify({ nodes: [nodes.ko], add: [tag] }) })).status === 403, '')
  check('ETIQUETTES poser sur un element autorise', (await call('gest', 'POST', '/api/explorer/tags/assign', { headers: jh, body: JSON.stringify({ nodes: [nodes.ok], add: [tag] }) })).status === 200, '')
  check('ETIQUETTES melange autorise + interdit refuse en bloc', (await call('gest', 'POST', '/api/explorer/tags/assign', { headers: jh, body: JSON.stringify({ nodes: [nodes.ok, nodes.ko], remove: [tag] }) })).status === 403, '')
  check('ETIQUETTES supprimer : reserve a l\'administrateur', (await call('gest', 'DELETE', `/api/explorer/tags/${tag}`)).status === 403, '')
  check('STOCK niveau : logement interdit (propriete 2)', (await call('menage', 'PUT', '/api/stock/level', { headers: jh, body: JSON.stringify({ propertyId: 2, itemId: 1, level: 'ok' }) })).status === 403, '')
  const lv = await call('menage', 'PUT', '/api/stock/level', { headers: jh, body: JSON.stringify({ propertyId: 1, itemId: 1, level: 'ok' }) })
  check('STOCK niveau : logement autorise (propriete 1)', lv.status !== 401 && lv.status !== 403, lv.status)
  const today = await j(await call('gest', 'GET', '/api/today')); const todayAll = await j(await call('admin', 'GET', '/api/today'))
  const idsIn = o => JSON.stringify(o).match(/"propertyId":(\d+)/g) ?? []
  check('AUJOURD\'HUI : aucune donnee du logement 2 pour le gestionnaire', !idsIn(today).includes('"propertyId":2'), idsIn(today).join(','))
  const tl = await j(await call('gest', 'GET', '/api/timeline')); const tlAll = await j(await call('admin', 'GET', '/api/timeline'))
  check('TIMELINE : moins d\'evenements pour le gestionnaire que pour l\'administrateur', JSON.stringify(tl).length < JSON.stringify(tlAll).length, `${JSON.stringify(tl).length} vs ${JSON.stringify(tlAll).length}`)
  check('TIMELINE : rien du logement 2 (Le ponant)', !JSON.stringify(tl).includes('Le ponant'), '')
}

// --- Pages : chaque role, chaque page, logement autorise puis interdit
const PAGES = [...readFileSync('server/utils/policy.ts', 'utf8').matchAll(/^\s*\['(\/[^']*)', '([AGCM]+)'\],?/gm)].map(m => [m[1], m[2]])
const HOME = { admin: '/', gest: '/', compta: '/documents', menage: '/logements', vide: '/' }
for (const user of Object.keys(ROLES)) for (const [pattern, letters] of PAGES) for (const side of pattern.includes(':id') ? ['1', '2'] : ['1']) {
  const path = pattern.replace(':id', side)
  const should = (user === 'admin' || letters.includes(ROLES[user])) && !(pattern.includes(':id') && user !== 'admin' && (user === 'vide' || side === '2') )
  const r = await call(user, 'GET', path)
  if (should) check(`PAGE autorisee ${user} ${path}`, r.status === 200 || (r.status >= 300 && r.status < 400 && !r.location.includes('/connexion') && r.location.replace(base, '') !== HOME[user] || r.status === 200), `${r.status} ${r.location}`)
  else check(`PAGE interdite ${user} ${path}`, r.status === 403 || (r.status === 302 && r.location.replace(base, '') === HOME[user]), `${r.status} ${r.location}`)
}

console.log(`\n${n} verifications, ${fails.length} echec(s)`)
if (fails.length) { console.log('\n' + fails.join('\n')); process.exit(1) }
console.log('OK : toutes les routes et pages respectent la table des permissions.')
