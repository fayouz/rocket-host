// Plugin « Homey » : un Homey (Pro) par connecteur, en mode cloud (compte Homey connecte dans Domotique) ou local
// (adresse du Homey + HOMEY_API_KEY). Plusieurs connecteurs Homey possibles dans un meme logement.
// LECTURE SEULE : affiche les appareils et leurs valeurs. Aucune commande n'est envoyee depuis un connecteur (les commandes
// restent reservees au widget voyageur, avec liste blanche et bornes, apres validation appareil par appareil).
import type { ConnectorContext, PluginDef } from './plugins'
import { listHomeyDevices, pingHomey } from './homey'
import { isPrivateHost } from './plugins'

const fail = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })

const domoOf = (ctx: ConnectorContext) => ({
  logementId: ctx.logementId, homeyMode: ctx.config.mode === 'local' ? 'local' as const : 'cloud' as const,
  homeyUrl: ctx.config.homeyUrl ?? '', homeyId: ctx.config.homeyId ?? '',
  preheatEnabled: false, preheatHours: 3, comfortTemp: 20, ecoTemp: 17, ecoDelayMin: 60,
})

const fmt = (v: unknown, units: string | null) => v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'oui' : 'non') : `${v}${units ? ` ${units}` : ''}`

export const homeyPlugin: PluginDef = {
  id: 'homey',
  name: 'Homey',
  description: 'Hub domotique Homey (Pro) : voir les appareils du logement et leurs valeurs (températures, prises, capteurs…). Lecture seule.',
  icon: 'i-lucide-house-wifi',
  category: 'domotique',
  capabilities: ['info'],
  fields: [
    { key: 'mode', label: 'Connexion', type: 'select', required: true, options: [{ label: 'Cloud (compte Homey connecté)', value: 'cloud' }, { label: 'Locale (adresse + HOMEY_API_KEY)', value: 'local' }] },
    { key: 'homeyId', label: 'Homey', type: 'select', optionsFrom: 'homeys', showIf: { key: 'mode', values: ['cloud'] }, help: 'Homey du compte connecté (onglet Domotique d\'un logement).' },
    { key: 'homeyUrl', label: 'Adresse locale du Homey', type: 'url', placeholder: 'http://192.168.1.20', showIf: { key: 'mode', values: ['local'] } },
  ],
  // Un Homey ne sert qu'UN logement (regle deja appliquee dans Domotique) : jamais partage entre deux logements
  async validate(config, { logementId, connectorId }) {
    const mode = config.mode === 'local' ? 'local' : 'cloud'
    if (mode === 'cloud') {
      if (!config.homeyId) throw fail(400, 'Choisis le Homey')
      const db = useDatabase()
      const other = ((await db.sql`SELECT logement_id FROM connector WHERE plugin_id = 'homey' AND id != ${connectorId} AND logement_id != ${logementId} AND json_extract(config_json, '$.homeyId') = ${config.homeyId}`).rows as any[])[0]
        ?? ((await db.sql`SELECT logement_id FROM domotique_config WHERE homey_id = ${config.homeyId} AND logement_id != ${logementId}`).rows as any[])[0]
      if (other) throw fail(409, 'Ce Homey est déjà associé à un autre logement')
      return { mode, homeyId: config.homeyId }
    }
    // La cle HOMEY_API_KEY (secret de l'appli) n'est envoyee qu'a une adresse du reseau local, jamais sur Internet
    let u: URL
    try { u = new URL(config.homeyUrl ?? ''); if (!/^https?:$/.test(u.protocol)) throw new Error('') } catch { throw fail(400, 'Adresse locale du Homey invalide') }
    if (!isPrivateHost(u.hostname)) throw fail(400, 'Mode local : l\'adresse doit être sur le réseau local (192.168.x.x, 10.x.x.x, .local…) ; sinon utilise le mode cloud')
    return { mode, homeyUrl: config.homeyUrl! }
  },
  async test(ctx) {
    const r = await pingHomey(domoOf(ctx))
    return r.homey ? `Connecté à « ${r.homey} ».` : `Homey joignable (${r.count ?? 0} appareil(s)).`
  },
  async info(ctx) {
    const devices = await listHomeyDevices(domoOf(ctx))
    return devices.slice(0, 60).map(d => ({
      title: d.name, icon: d.available ? 'i-lucide-cpu' : 'i-lucide-unplug',
      items: d.capabilities.filter(c => c.value !== null).slice(0, 8).map(c => ({ label: c.title, value: fmt(c.value, c.units) })),
    }))
  },
}
