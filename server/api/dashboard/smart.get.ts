// Tableau de bord intelligent : une seule route qui interroge en parallele Rocket PMS, Place, Clean, Stock et Cast
// (chaque brique facultative, delai propre, pannes isolees). Lecture seule. Voir docs/rocket-host-dashboard.md.
import { collectSmartDashboard, type BrickConfigs } from '../../utils/bricks/smart.ts'

export default defineEventHandler(async (event) => {
  // Adresses (reglages) et jetons (secrets chiffres) : Reglages > Connexions
  const cfg = (name: string, extra: object = {}) => {
    const url = getSetting(`${name}_URL`)
    return url ? { url, token: getSecret(`${name}_TOKEN`), timeoutMs: 4000, ...extra } : undefined
  }
  const cfgs: BrickConfigs = {
    pms: (() => { const url = getSetting('PMS_API_URL'); return url ? { url, token: getSecret('PMS_API_TOKEN'), timeoutMs: 6000 } : undefined })(),
    place: cfg('ROCKET_PLACE'),
    clean: cfg('ROCKET_CLEAN'),
    stock: cfg('ROCKET_STOCK'),
    cast: cfg('ROCKET_CAST'),
  }
  setResponseHeader(event, 'Cache-Control', 'no-store, private')
  return collectSmartDashboard(cfgs, { allowed: await effectivePropertyIds(event) })
})
