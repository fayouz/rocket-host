// Tableau de bord intelligent : une seule route qui interroge en parallele Rocket PMS, Place, Clean, Stock et Cast
// (chaque brique facultative, delai propre, pannes isolees). Lecture seule. Voir docs/rocket-host-dashboard.md.
import { collectSmartDashboard, type BrickConfigs } from '../../utils/bricks/smart.ts'

export default defineEventHandler(async (event) => {
  const c = useRuntimeConfig()
  const cfg = (url: unknown, token: unknown, extra: object = {}) => (url ? { url: String(url), token: String(token || ''), timeoutMs: 4000, ...extra } : undefined)
  const cfgs: BrickConfigs = {
    pms: cfg(c.pmsApiUrl, c.pmsApiToken, { timeoutMs: 6000 }),
    place: cfg(c.rocketPlaceUrl, c.rocketPlaceToken),
    clean: cfg(c.rocketCleanUrl, c.rocketCleanToken),
    stock: cfg(c.rocketStockUrl, c.rocketStockToken),
    cast: cfg(c.rocketCastUrl, c.rocketCastToken),
  }
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  return collectSmartDashboard(cfgs, { allowed: await effectivePropertyIds(event) })
})
