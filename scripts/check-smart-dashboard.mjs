// Verifications du tableau de bord intelligent (server/utils/bricks/smart.ts) avec un fetch simule, sans reseau ni Nuxt :
// npm run check:smart-dashboard
// Cas couverts : croisement arrivees x menage/linge/acces/ecran/paiement, alertes triees, finances, brique en panne isolee,
// brique trop lente (delai), reponse trop grosse, linge absent (404 = colonne masquee), filtre des logements autorises.
import assert from 'node:assert/strict'
const { collectSmartDashboard, addDays } = await import('../server/utils/bricks/smart.ts')

const NOW = new Date('2026-09-28T12:30:00+02:00') // midi et demi a Paris
const TODAY = '2026-09-28', TOMORROW = '2026-09-29'
const P1 = '11111111-1111-1111-1111-111111111111', P2 = '22222222-2222-2222-2222-222222222222'
const PL1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', PL2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function routes(over = {}) {
  return {
    'pms/api/place-links': { properties: [
      { id: P1, name: 'Studio Lumière', color: '#f00', lodgifyPropertyId: 101, placeId: PL1 },
      { id: P2, name: 'Loft Canal', color: '#00f', lodgifyPropertyId: 102, placeId: PL2 },
    ] },
    [`pms/api/properties/${P1}/bookings`]: { items: [
      { id: 1, propertyId: 101, guest: 'Alice', arrival: TODAY, departure: '2026-10-01', checkIn: '14:00', nights: 3, status: 'Booked', source: 'Airbnb', total: 300, access: { grantId: 'g1', status: 'planned', error: null, outdated: false } },
      { id: 2, propertyId: 101, guest: 'Bob', arrival: '2026-09-25', departure: TODAY, checkOut: '10:00', nights: 3, status: 'Booked', source: 'Booking.com', total: 270, access: null },
    ] },
    [`pms/api/properties/${P2}/bookings`]: { items: [
      { id: 3, propertyId: 102, guest: 'Chloé', arrival: TOMORROW, departure: '2026-10-05', checkIn: '16:00', nights: 6, status: 'Booked', source: 'Airbnb', total: 900, access: { grantId: 'g3', status: 'created', error: null, outdated: false } },
      { id: 4, propertyId: 102, guest: 'Annulé', arrival: TODAY, departure: '2026-09-30', nights: 2, status: 'Declined', source: 'Airbnb', total: 200, access: null },
    ] },
    [`pms/api/properties/${P1}/bookings/1/pricing`]: { paid: 100, due: 200 },
    [`pms/api/properties/${P2}/bookings/3/pricing`]: { paid: 900, due: 0 },
    [`pms/api/properties/${P1}/bilan`]: { currency: 'EUR', months: Array.from({ length: 12 }, (_, i) => ({ revenue: i === 8 ? 1500 : 0, nights: i === 8 ? 15 : 0 })) },
    [`pms/api/properties/${P2}/bilan`]: { currency: 'EUR', months: [] },
    [`place/api/places/${PL1}/access-grants`]: [],
    [`place/api/places/${PL2}/access-grants`]: [],
    [`clean/api/cleanings?date=${addDays(TODAY, -1)}`]: [],
    [`clean/api/cleanings?date=${TODAY}`]: [{ id: 'c1', placeId: PL1, label: 'Ménage départ Bob', type: 'rental', scheduledAt: `${TODAY}T11:00:00+02:00`, status: 'in_progress', late: false, conflict: true }],
    [`clean/api/cleanings?date=${TOMORROW}`]: [{ id: 'c2', placeId: PL2, label: 'Ménage', type: 'rental', scheduledAt: `${TOMORROW}T10:00:00+02:00`, status: 'todo', late: false, conflict: false }],
    'clean/api/cleanings/export': { unit: 'cents', total: 12000, items: [{ placeId: PL1, cost: 8000 }, { placeId: PL2, cost: 4000 }] },
    [`clean/api/linen/readiness?place=${PL1}&date=${TODAY}`]: { status: 'missing' },
    [`clean/api/linen/readiness?place=${PL2}&date=${TOMORROW}`]: { status: 'ready' },
    [`stock/api/places/${PL1}/stock`]: [{ itemName: 'Café', level: 'empty' }, { itemName: 'Savon', level: 'ok' }],
    [`stock/api/places/${PL2}/stock`]: [],
    'stock/api/export/consumption': { totalCost: 42.5, items: [{}] },
    'cast/api/screens': [{ id: 's1', name: 'TV salon', location: `Studio Lumière`, online: false, lastSeenAt: '2026-09-27T20:00:00Z' }],
    ...over,
  }
}
const CFG = { pms: { url: 'http://pms', token: 't' }, place: { url: 'http://place', token: 't' }, clean: { url: 'http://clean', token: 't' }, stock: { url: 'http://stock', token: 't' }, cast: { url: 'http://cast', token: 't' } }

let calls = []
function mockFetch(table, { slow = {}, down = {}, big = {} } = {}) {
  globalThis.fetch = async (url, init) => {
    const u = new URL(url)
    const brick = u.hostname
    calls.push(`${brick}${u.pathname}${u.search}`)
    assert.equal(init.headers.Authorization, 'Bearer t')
    if (down[brick]) throw new TypeError('fetch failed')
    if (slow[brick]) await new Promise((res, rej) => { const t = setTimeout(res, 5000); init.signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('t'), { name: 'TimeoutError' })) }) })
    if (big[brick]) return new Response('x'.repeat(100), { status: 200, headers: { 'content-length': '999999999' } })
    // cle exacte (avec requete), sinon chemin seul (export, bilan : parametres de dates)
    const body = table[`${brick}${u.pathname}${u.search}`] ?? table[`${brick}${u.pathname}`]
    if (body === undefined) return new Response('{"detail":"Not Found"}', { status: 404 })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
}

let n = 0
const ok = async (name, fn) => { await fn(); n++; console.log('ok  ', name) }

await ok('toutes briques : lignes du jour et de demain croisees', async () => {
  mockFetch(routes())
  const r = await collectSmartDashboard(CFG, { now: NOW })
  assert.equal(r.today, TODAY)
  assert.deepEqual(r.arrivals.map(a => a.guest), ['Alice', 'Chloé'], 'reservation annulee exclue, tri par date/heure')
  const [a, c] = r.arrivals
  assert.equal(a.cleaning.status, 'in_progress')
  assert.equal(a.linen, 'missing')
  assert.equal(a.access.status, 'to_send')
  assert.equal(a.screen.status, 'offline')
  assert.deepEqual(a.payment, { paid: 100, due: 200, total: 300 })
  assert.equal(c.cleaning.status, 'todo')
  assert.equal(c.access.status, 'sent')
  assert.equal(c.screen.status, 'none')
  assert.equal(r.departures.length, 1)
  assert.equal(r.departures[0].cleaningPlanned, true)
  assert.deepEqual(r.columns, { cleaning: true, linen: true, access: true, screen: true, payment: true })
  for (const b of Object.values(r.bricks)) assert.ok(b.ok, b.name)
})

await ok('alertes croisees triees par urgence', async () => {
  mockFetch(routes())
  const r = await collectSmartDashboard(CFG, { now: NOW })
  const codes = r.alerts.map(a => a.code)
  for (const c of ['cleaning_not_done', 'access_not_sent', 'screen_offline', 'stock_low', 'linen_missing', 'booking_changed']) assert.ok(codes.includes(c), c)
  const ranks = r.alerts.map(a => ({ critical: 0, warning: 1, info: 2 })[a.level])
  assert.deepEqual(ranks, [...ranks].sort((x, y) => x - y))
  assert.equal(r.alerts[0].level, 'critical')
  assert.ok(r.alerts.every(a => a.link.startsWith('/')))
  assert.ok(r.alerts.find(a => a.code === 'cleaning_not_done').link.includes('/logements/101/'))
})

await ok('finances : bilan du mois, canaux, couts menage, consommation, prevision 30 j', async () => {
  mockFetch(routes())
  const r = await collectSmartDashboard(CFG, { now: NOW })
  const f = r.finances
  assert.equal(f.month, '2026-09')
  assert.equal(f.properties[0].revenue, 1500)
  assert.equal(f.properties[0].source, 'bilan')
  assert.equal(f.properties[0].occupancy, 50)
  assert.equal(f.properties[0].cleaningCost, 80)
  assert.equal(f.cleaningCost, 120)
  assert.equal(f.stockConsumption, 42.5)
  assert.ok(f.channels.some(c => c.source === 'Airbnb'))
  assert.equal(f.forecast.bookings, 2)
  assert.equal(f.forecast.revenue, 1200)
})

await ok('linge absent de Rocket Clean (404) : colonne masquee, pas d\'alerte de panne', async () => {
  const t = routes(); delete t[`clean/api/linen/readiness?place=${PL1}&date=${TODAY}`]; delete t[`clean/api/linen/readiness?place=${PL2}&date=${TOMORROW}`]
  mockFetch(t)
  const r = await collectSmartDashboard(CFG, { now: NOW })
  assert.equal(r.columns.linen, false)
  assert.ok(r.arrivals.every(a => a.linen === null))
  assert.ok(r.bricks.clean.ok)
})

await ok('une brique en panne ne casse rien (Clean injoignable)', async () => {
  mockFetch(routes(), { down: { clean: true } })
  const r = await collectSmartDashboard(CFG, { now: NOW })
  assert.equal(r.bricks.clean.ok, false)
  assert.equal(r.arrivals.length, 2)
  assert.equal(r.arrivals[0].cleaning, null)
  assert.equal(r.columns.cleaning, false)
  assert.ok(r.alerts.some(a => a.code === 'brick_unreachable' && a.brick === 'clean'))
  assert.equal(r.arrivals[0].access.status, 'to_send')
})

await ok('brique trop lente : delai par brique respecte', async () => {
  mockFetch(routes(), { slow: { cast: true } })
  const t0 = Date.now()
  const r = await collectSmartDashboard({ ...CFG, cast: { ...CFG.cast, timeoutMs: 200 } }, { now: NOW })
  assert.ok(Date.now() - t0 < 2000)
  assert.equal(r.bricks.cast.ok, false)
  assert.match(r.bricks.cast.error, /délai/)
  assert.equal(r.columns.screen, false)
})

await ok('reponse trop volumineuse refusee', async () => {
  mockFetch(routes(), { big: { stock: true } })
  const r = await collectSmartDashboard(CFG, { now: NOW })
  assert.equal(r.bricks.stock.ok, false)
  assert.match(r.bricks.stock.error, /volumineuse/)
})

await ok('briques non configurees : masquees, aucun appel', async () => {
  calls = []
  mockFetch(routes())
  const r = await collectSmartDashboard({ pms: CFG.pms }, { now: NOW })
  assert.ok(calls.every(c => c.startsWith('pms/')))
  assert.equal(r.bricks.clean.configured, false)
  assert.deepEqual([r.columns.cleaning, r.columns.linen, r.columns.screen], [false, false, false])
  assert.equal(r.alerts.filter(a => a.code === 'brick_unreachable').length, 0)
})

await ok('sans PMS : tableau de bord desactive', async () => {
  calls = []
  mockFetch(routes())
  const r = await collectSmartDashboard({}, { now: NOW })
  assert.equal(r.enabled, false)
  assert.equal(calls.length, 0)
})

await ok('perimetre : seuls les logements autorises', async () => {
  calls = []
  mockFetch(routes())
  const r = await collectSmartDashboard(CFG, { now: NOW, allowed: new Set([102]) })
  assert.deepEqual(r.arrivals.map(a => a.guest), ['Chloé'])
  assert.ok(!calls.some(c => c.includes(P1)))
  assert.equal(r.finances.properties.length, 1)
})

await ok('PMS en panne : alerte critique, page vide mais valide', async () => {
  mockFetch(routes(), { down: { pms: true } })
  const r = await collectSmartDashboard(CFG, { now: NOW })
  assert.equal(r.enabled, true)
  assert.equal(r.arrivals.length, 0)
  assert.equal(r.alerts[0].code, 'brick_unreachable')
  assert.equal(r.alerts[0].level, 'critical')
})

console.log(`\n${n} verifications OK`)
